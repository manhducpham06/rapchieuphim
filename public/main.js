import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { buildWorld } from './world.js';
import { buildArcade } from './arcade.js';
import { createShop } from './shop.js';
import { createGames } from './games.js';
import { createTouch, isTouchDevice } from './touch.js';
import { EMOTE_META, ICONS, icon, injectSprite } from './icons.js';
import { createAvatar, makeLabel, makeBubble, makeEmote, disposeSprite, LOOK_DEFS, HIP_Y, hex } from './avatar.js';

const L = window.LAYOUT;
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const EMOTE_LIST = EMOTE_META;
const TOUCH = isTouchDevice();
let RL = L.layoutOf('theater'); // bố cục của phòng hiện tại
let curRoom = L.ROOM_BY_ID.std;
let roomCounts = {};
let passes = new Map(); // roomId -> exp (ms, 0 = vĩnh viễn)
injectSprite();

// ====================== Three.js ======================
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, TOUCH ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 80);
let world = buildWorld(scene, 'std');
let worldKey = 'std';

// Lớp CSS3D chứa video YouTube, nằm phía sau canvas WebGL (nhìn xuyên qua "lỗ" trên màn hình)
const css = new CSS3DRenderer({ element: $('css3d') });
css.domElement.style.position = 'absolute';
const cssScene = new THREE.Scene();
const SCR_PX = { w: 1280, h: 720 };
const screenEl = document.createElement('div');
screenEl.style.cssText = `width:${SCR_PX.w}px;height:${SCR_PX.h}px;position:relative;background:#000;overflow:hidden;`;
screenEl.innerHTML = `
  <div id="ytHost" style="position:absolute;inset:0"></div>
  <div id="idle" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;background:radial-gradient(circle at 50% 40%,#1c2a55,#05060f 70%);color:#fff;font-family:'Be Vietnam Pro',sans-serif;text-align:center">
    <svg viewBox="0 0 24 24" width="150" height="150" fill="#ffd24a" style="filter:drop-shadow(0 0 28px rgba(255,210,74,.45))">${ICONS.film}</svg>
    <div style="font-size:54px;font-weight:800">Màn hình đang chờ phim</div>
    <div style="font-size:30px;opacity:.75">Dán link YouTube vào khung “Màn hình” để cả rạp cùng xem</div>
  </div>`;
const idleEl = screenEl.querySelector('#idle');
const ytHostEl = screenEl.querySelector('#ytHost');
const css3dObj = new CSS3DObject(screenEl);
css3dObj.position.set(L.SCREEN.x, L.SCREEN.y, L.SCREEN.z);
css3dObj.scale.setScalar(L.SCREEN.w / SCR_PX.w);
cssScene.add(css3dObj);

function buildRoomWorld(def) {
  const key = def.kind === 'arcade' ? 'arcade' : def.id;
  RL = L.layoutOf(def.kind);
  curRoom = def;
  if (key !== worldKey) {
    world.dispose();
    world = def.kind === 'arcade' ? buildArcade(scene) : buildWorld(scene, def.id);
    worldKey = key;
  }
  css.domElement.style.display = def.kind === 'arcade' ? 'none' : '';
  $('roomName').textContent = def.name;
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  css.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ====================== Màn hình chọn nhân vật ======================
const look = Object.assign({ shirt: 5, skin: 0, hair: 1, hat: 0 }, store.get('look', {}));
const C = L.LOOK_COUNTS;
for (const k of Object.keys(C)) if (!(look[k] >= 0 && look[k] < C[k])) look[k] = 0;
$('nameInput').value = store.get('name', '');

const pv = { r: null, scene: null, cam: null, av: null };
function initPreview() {
  const cv = $('preview');
  pv.r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  pv.r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  pv.r.setSize(240, 300, false);
  pv.scene = new THREE.Scene();
  pv.scene.add(new THREE.HemisphereLight(0xffffff, 0x553355, 1.6));
  const dl = new THREE.DirectionalLight(0xffffff, 1.6);
  dl.position.set(2, 3, 4);
  pv.scene.add(dl);
  pv.cam = new THREE.PerspectiveCamera(32, 240 / 300, 0.1, 20);
  pv.cam.position.set(0, 1.15, 4.1);
  pv.cam.lookAt(0, 0.98, 0);
  rebuildPreview();
}
function rebuildPreview() {
  if (pv.av) pv.scene.remove(pv.av.group);
  pv.av = createAvatar(look);
  pv.scene.add(pv.av.group);
}
function buildPickers() {
  document.querySelectorAll('.pick').forEach((el) => {
    const key = el.dataset.key;
    const box = el.querySelector('.sw');
    box.innerHTML = '';
    const n = C[key];
    for (let i = 0; i < n; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      if (key === 'hat') b.textContent = LOOK_DEFS.hatNames[i];
      else b.style.background = hex(LOOK_DEFS[key][i]);
      b.className = look[key] === i ? 'on' : '';
      b.addEventListener('click', () => {
        look[key] = i;
        box.querySelectorAll('button').forEach((x, j) => x.classList.toggle('on', j === i));
        rebuildPreview();
      });
      box.appendChild(b);
    }
  });
}
$('randomBtn').addEventListener('click', () => {
  for (const k of Object.keys(C)) look[k] = Math.floor(Math.random() * C[k]);
  buildPickers();
  rebuildPreview();
});
buildPickers();

// ====================== Trạng thái game ======================
const me = { id: null, x: L.SPAWN.x, z: L.SPAWN.z, ry: Math.PI, seat: null, speed: 0, name: '' };
const peers = new Map(); // id -> peer
window.__me = me; // chỉ để kiểm thử
const seatOwner = new Map(); // seatIndex -> id
let joined = false;
let clockOffset = 0; // serverTime - Date.now()
let bestRtt = Infinity;
let ws = null;
let reconnectTimer = null;
let lastSent = { x: 0, z: 0, ry: 0, t: 0 };
let autoWalk = null;

const cam = { yaw: 0, pitch: 0.42, dist: 5.2, targetDist: 5.2, lookYaw: 0, lookPitch: 0.06, lx: 0, ly: 0, lz: 0 };

function makePeer(p, isMe = false) {
  const av = createAvatar(p.look || look);
  const label = makeLabel(p.name, { self: isMe });
  label.position.set(0, 2.0, 0);
  av.group.add(label);
  scene.add(av.group);
  const peer = {
    id: p.id, name: p.name, look: p.look, av, label, bubble: null, bubbleUntil: 0, emote: null, floats: [],
    x: p.x, z: p.z, ry: p.ry, tx: p.x, tz: p.z, try_: p.ry, seat: p.seat ?? null, speed: 0, isMe,
  };
  av.group.position.set(p.x, RL.heightAt(p.z), p.z);
  av.group.rotation.y = p.ry;
  return peer;
}

const selfPeer = () => peers.get(me.id);

// ====================== Mạng ======================
function send(o) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(o));
}
const serverNow = () => Date.now() + clockOffset;

function setNet(state, text) {
  $('netPill').className = 'pill ' + state;
  $('netText').textContent = text;
}

function connect() {
  setNet('', 'đang kết nối');
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  const mine = ws;
  mine.onopen = () => {
    send({ t: 'join', name: me.name, look, room: curRoom.id, tokens: shop.tokens() });
    send({ t: 'ping', t0: Date.now() });
  };
  mine.onmessage = (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    onMessage(m);
  };
  mine.onclose = () => {
    if (mine !== ws) return;
    setNet('bad', 'mất kết nối - đang thử lại…');
    if (joined) toast('Mất kết nối, đang thử vào lại…');
    clearPeers();
    $('joinStatus').textContent = joined ? '' : 'Không kết nối được máy chủ, đang thử lại…';
    $('enterBtn').disabled = false;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 2000);
  };
  mine.onerror = () => {};
}
setInterval(() => send({ t: 'ping', t0: Date.now() }), 5000);

function clearPeers() {
  for (const p of peers.values()) removePeerVisual(p);
  peers.clear();
  seatOwner.clear();
  updateOnline();
}
function removePeerVisual(p) {
  disposeSprite(p.label);
  disposeSprite(p.bubble);
  p.floats.forEach((f) => disposeSprite(f.sp));
  p.av.dispose();
}

function onMessage(m) {
  switch (m.t) {
    case 'pong': {
      const rtt = Date.now() - m.t0;
      if (rtt <= bestRtt + 30) {
        bestRtt = Math.min(bestRtt, rtt);
        clockOffset = m.ts + rtt / 2 - Date.now();
      }
      return;
    }
    case 'welcome': {
      clockOffset = m.serverTime - Date.now();
      clearPeers();
      const def = L.ROOM_BY_ID[m.room] || L.ROOM_BY_ID.std;
      const changed = joined && def.id !== curRoom.id;
      buildRoomWorld(def);
      if (m.passes) setPasses(m.passes);
      if (m.counts) { roomCounts = m.counts; }
      games.close(true);
      interactId = null;
      me.id = m.id;
      for (const p of m.players) {
        const peer = makePeer(p, p.id === m.id);
        peers.set(p.id, peer);
        if (p.seat !== null) seatOwner.set(p.seat, p.id);
      }
      const s = peers.get(m.id);
      me.x = s.x; me.z = s.z; me.ry = s.ry; me.seat = null;
      camSnap();
      $('chatLog').innerHTML = '';
      m.chat.forEach((c) => addChat(c.name, c.text, c.id === me.id, true));
      addSys(def.kind === 'arcade'
        ? 'Chào mừng đến Khu Giải Trí! Chạy vào quả bóng để sút, lại gần máy game và bấm E / nút Chơi.'
        : changed ? `Bạn vừa vào ${def.name}. Bấm vào ghế trống để ngồi xem.` : 'Chào mừng bạn đến rạp chiếu phim! Bấm vào một ghế trống để ngồi xem.');
      if (m.ball && world.setBall) { world.setBall(m.ball.b, false); world.setScores(m.ball.top); }
      if (TOUCH) touch.show(true);
      renderRooms();
      setNet('ok', 'trực tuyến');
      joined = true;
      $('join').hidden = true;
      $('hud').hidden = false;
      updateOnline();
      applyQueue(m.queue);
      applyVideo(m.video);
      updateSeatChip();
      updateInteract(true);
      if (changed) closePanel();
      return;
    }
    case 'join': {
      if (peers.has(m.player.id)) return;
      peers.set(m.player.id, makePeer(m.player));
      if (m.player.seat !== null) seatOwner.set(m.player.seat, m.player.id);
      updateOnline();
      return;
    }
    case 'leave': {
      const p = peers.get(m.id);
      if (!p) return;
      removePeerVisual(p);
      peers.delete(m.id);
      for (const [s, id] of seatOwner) if (id === m.id) seatOwner.delete(s);
      updateOnline();
      return;
    }
    case 's': {
      for (const [id, x, z, ry] of m.p) {
        const p = peers.get(id);
        if (!p || p.isMe || p.seat !== null) continue;
        p.tx = x; p.tz = z; p.try_ = ry;
      }
      return;
    }
    case 'sit': {
      const p = peers.get(m.id);
      if (!p) return;
      for (const [s, id] of seatOwner) if (id === m.id) seatOwner.delete(s);
      seatOwner.set(m.seat, m.id);
      p.seat = m.seat; p.tx = m.x; p.tz = m.z; p.try_ = m.ry;
      if (p.isMe) {
        me.seat = m.seat; me.ry = m.ry; autoWalk = null;
        cam.lookYaw = 0; cam.lookPitch = 0.06;
        updateSeatChip();
      }
      updatePeopleList();
      return;
    }
    case 'stand': {
      const p = peers.get(m.id);
      if (!p) return;
      for (const [s, id] of seatOwner) if (id === m.id) seatOwner.delete(s);
      p.seat = null; p.tx = m.x; p.tz = m.z;
      if (p.isMe) {
        me.seat = null; me.x = m.x; me.z = m.z;
        cam.yaw = me.ry + Math.PI;
        updateSeatChip();
      } else { p.x = m.x; p.z = m.z; }
      updatePeopleList();
      return;
    }
    case 'chat': {
      addChat(m.name, m.text, m.id === me.id);
      if (m.id !== me.id) noteChat(m.name, m.text);
      const p = peers.get(m.id);
      if (p) showBubble(p, m.text);
      return;
    }
    case 'emote': {
      const p = peers.get(m.id);
      if (p) playEmote(p, m.e);
      return;
    }
    case 'sys': addSys(m.text); return;
    case 'err':
      toast(m.text);
      if (m.need && L.ROOM_BY_ID[m.need] && L.ROOM_BY_ID[m.need].price > 0) shop.open(L.ROOM_BY_ID[m.need]);
      return;
    case 'rooms': roomCounts = m.counts || {}; if (curPanel === 'rooms') renderRooms(); return;
    case 'passes': setPasses(m.passes); return;
    case 'ball': if (world.setBall) world.setBall(m.b, m.frozen); return;
    case 'goal':
      if (world.celebrate) { world.celebrate(m.by); world.setScores(m.top); }
      toast(`Bàn thắng! ${m.by} vừa ghi bàn.`);
      return;
    case 'video': applyVideo(m.video); return;
    case 'queue': applyQueue(m.queue); return;
  }
}

// ====================== Chat / bong bóng / emote ======================
function addChat(name, text, mine, quiet) {
  const log = $('chatLog');
  const p = document.createElement('p');
  if (mine) p.className = 'me';
  const n = document.createElement('span');
  n.className = 'n';
  n.textContent = name + ':';
  n.style.color = mine ? '' : nameColor(name);
  p.append(n, document.createTextNode(text));
  log.appendChild(p);
  trimLog(log);
  log.scrollTop = log.scrollHeight;
}
function addSys(text) {
  const log = $('chatLog');
  const p = document.createElement('p');
  p.className = 'sys';
  p.textContent = text;
  log.appendChild(p);
  trimLog(log);
  log.scrollTop = log.scrollHeight;
}
function trimLog(log) { while (log.children.length > 120) log.removeChild(log.firstChild); }
function nameColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h},75%,72%)`;
}
function showBubble(p, text) {
  disposeSprite(p.bubble);
  p.bubble = makeBubble(text);
  p.bubble.position.set(0, 2.35, 0);
  p.av.group.add(p.bubble);
  p.bubbleUntil = performance.now() + Math.min(9000, 3500 + text.length * 60);
}
function playEmote(p, e) {
  p.emote = { type: e, until: performance.now() + 2200 };
  const sp = makeEmote(e);
  sp.scale.setScalar(0.62);
  sp.position.set((Math.random() - 0.5) * 0.4, 2.2, 0);
  p.av.group.add(sp);
  p.floats.push({ sp, born: performance.now() });
}
function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  $('toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
}

$('chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('chatInput').value.trim();
  if (v) send({ t: 'chat', text: v });
  $('chatInput').value = '';
});
$('chatInput').addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Escape') { $('chatInput').blur(); closePanel(); }
});
$('urlInput').addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Escape') $('urlInput').blur();
});

const bar = $('emoteBar');
EMOTE_LIST.forEach((em, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.title = `${em.label} (${i + 1})`;
  b.setAttribute('aria-label', em.label);
  b.style.setProperty('--c', em.color);
  b.innerHTML = `${icon(em.icon)}<kbd>${i + 1}</kbd>`;
  b.addEventListener('click', () => doEmote(em.key));
  bar.appendChild(b);
});
function doEmote(k) { send({ t: 'emote', e: k }); }

// ====================== Danh sách người / HUD ======================
function updateOnline() {
  $('onlineCount').textContent = peers.size;
  updatePeopleList();
}
function updatePeopleList() {
  const box = $('peopleList');
  if (curPanel !== 'people') return;
  box.innerHTML = '';
  [...peers.values()].sort((a, b) => a.id - b.id).forEach((p) => {
    const d = document.createElement('div');
    if (p.isMe) d.className = 'me';
    const n = document.createElement('span');
    n.textContent = p.name + (p.isMe ? ' (bạn)' : '');
    const s = document.createElement('small');
    s.textContent = p.seat !== null && RL.SEATS[p.seat] ? RL.SEATS[p.seat].label : 'đang đứng';
    d.append(n, s);
    box.appendChild(d);
  });
}
$('helpClose').addEventListener('click', () => ($('help').hidden = true));
function updateSeatChip() {
  const chip = $('seatChip');
  if (me.seat === null) { chip.hidden = true; return; }
  chip.hidden = false;
  chip.innerHTML = `${icon('seat')}<span>Bạn đang ngồi <b>${RL.SEATS[me.seat].label}</b></span><kbd>Space</kbd><span class="muted">để đứng dậy</span>`;
}

// ====================== YouTube & đồng bộ ======================
let yt = null;
let ytReady = false;
let pendingVideo = null;
let video = { id: null, serial: 0, paused: true, pausedAt: 0, startedAt: 0, title: '', by: '', rev: 0 };
let loaded = { id: null, serial: -1 };
let queueList = [];
let userVol = store.get('vol', 70);
let userMuted = store.get('muted', false);
let duration = 0;
let seeking = false;

window.onYouTubeIframeAPIReady = () => {
  yt = new YT.Player(ytHostEl, {
    width: SCR_PX.w, height: SCR_PX.h,
    playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0, ...(location.protocol.startsWith('http') ? { origin: location.origin } : {}) },
    events: {
      onReady: () => {
        ytReady = true;
        applyVolume();
        if (pendingVideo) applyVideo(pendingVideo);
      },
      onStateChange: onYtState,
      onError: (e) => {
        toast('Không phát được video này (mã lỗi ' + e.data + '). Có thể chủ video tắt chế độ nhúng.');
      },
    },
  });
};
(function loadYT() {
  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  s.onerror = () => toast('Không tải được YouTube. Kiểm tra kết nối Internet.');
  document.head.appendChild(s);
})();

function applyVolume() {
  if (!ytReady) return;
  try {
    yt.setVolume(userVol);
    userMuted ? yt.mute() : yt.unMute();
  } catch {}
  $('muteIcon').setAttribute('href', userMuted || userVol === 0 ? '#i-mute' : '#i-volume');
  $('volBar').value = userVol;
}

function videoTime() {
  if (!video.id) return 0;
  return video.paused ? video.pausedAt : Math.max(0, (serverNow() - video.startedAt) / 1000);
}

function onYtState(e) {
  const S = YT.PlayerState;
  if (e.data === S.ENDED && video.id) send({ t: 'v_end', serial: video.serial });
  if (e.data === S.PLAYING) {
    try { duration = yt.getDuration() || 0; } catch {}
    if (video.paused) { try { yt.pauseVideo(); } catch {} }
    // lấy tiêu đề thật từ YouTube nếu server chưa có
    if (!video.title) {
      try {
        const t = yt.getVideoData().title;
        if (t) { video.title = t; renderNow(); }
      } catch {}
    }
  }
}

function applyVideo(v) {
  const prev = video;
  video = v;
  renderNow();
  idleEl.style.display = v.id ? 'none' : 'flex';
  if (!ytReady) { pendingVideo = v; return; }
  pendingVideo = null;
  try {
    if (!v.id) { yt.stopVideo(); loaded = { id: null, serial: v.serial }; return; }
    const t = videoTime();
    if (loaded.id !== v.id || loaded.serial !== v.serial) {
      loaded = { id: v.id, serial: v.serial };
      yt.loadVideoById({ videoId: v.id, startSeconds: t });
      if (v.paused) setTimeout(() => { try { yt.pauseVideo(); } catch {} }, 700);
      armAutoplayCheck();
    } else if (v.paused) {
      yt.seekTo(t, true);
      yt.pauseVideo();
    } else {
      const cur = yt.getCurrentTime();
      if (Math.abs(cur - t) > 1) yt.seekTo(t, true);
      yt.playVideo();
    }
  } catch (err) { console.warn(err); }
  if (prev.id !== v.id && v.id) toast('Đang chiếu: ' + (v.title || 'Video mới') + (v.by ? ' · ' + v.by : ''));
}

let autoplayTimer = null;
function armAutoplayCheck() {
  clearTimeout(autoplayTimer);
  autoplayTimer = setTimeout(() => {
    try {
      const st = yt.getPlayerState();
      if (!video.paused && (st === -1 || st === 5 || st === 2)) {
        yt.mute();
        yt.playVideo();
        userMuted = true;
        applyVolume();
        toast('Trình duyệt chặn tự phát tiếng nên đã tắt tiếng. Bấm nút loa trong khung Màn hình để bật lại.');
      }
    } catch {}
  }, 3500);
}

// Hiệu chỉnh lệch thời gian mỗi giây
setInterval(() => {
  if (!ytReady || !video.id || loaded.id !== video.id) return;
  try {
    const st = yt.getPlayerState();
    const t = videoTime();
    if (!video.paused) {
      if (st === YT.PlayerState.PAUSED) yt.playVideo();
      if (st === YT.PlayerState.PLAYING) {
        const cur = yt.getCurrentTime();
        const diff = cur - t;
        if (Math.abs(diff) > 2.2) yt.seekTo(t, true);
      }
    } else if (st === YT.PlayerState.PLAYING) {
      yt.pauseVideo();
    }
  } catch {}
}, 1000);

function fmt(s) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(r).padStart(2, '0');
}
function renderNow() {
  $('npTitle').textContent = video.id ? video.title || 'Đang phát video' : 'Chưa có phim nào';
  $('npBy').textContent = video.id && video.by ? 'Chiếu bởi ' + video.by : '';
  $('playIcon').setAttribute('href', video.id && !video.paused ? '#i-pause' : '#i-play');
}
setInterval(() => {
  if (!ytReady || !video.id) { $('timeLabel').textContent = '0:00'; if (!seeking) $('seekBar').value = 0; return; }
  const t = videoTime();
  if (!duration) { try { duration = yt.getDuration() || 0; } catch {} }
  $('timeLabel').textContent = fmt(t);
  if (!seeking && duration) $('seekBar').value = Math.min(1000, (t / duration) * 1000);
}, 400);

function applyQueue(q) {
  queueList = q;
  const ul = $('queueList');
  ul.innerHTML = '';
  $('qCount').textContent = q.length ? `(${q.length})` : '';
  if (!q.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Chưa có video trong hàng chờ';
    ul.appendChild(li);
    return;
  }
  q.forEach((it) => {
    const li = document.createElement('li');
    const sp = document.createElement('span');
    sp.textContent = it.title || it.id;
    sp.title = (it.title || it.id) + ' · thêm bởi ' + it.by;
    const play = document.createElement('button');
    play.innerHTML = icon('play');
    play.title = 'Chiếu ngay';
    play.setAttribute('aria-label', 'Chiếu ngay');
    play.onclick = () => send({ t: 'q_play', qid: it.qid });
    const del = document.createElement('button');
    del.innerHTML = icon('close');
    del.title = 'Xoá';
    del.setAttribute('aria-label', 'Xoá');
    del.onclick = () => send({ t: 'q_remove', qid: it.qid });
    li.append(sp, play, del);
    ul.appendChild(li);
  });
}

function parseYouTube(input) {
  input = String(input || '').trim();
  if (!input) return null;
  if (/^[\w-]{11}$/.test(input)) return { id: input, t: 0 };
  let u;
  try { u = new URL(/^https?:\/\//i.test(input) ? input : 'https://' + input); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
      if (m) id = m[1];
    }
  }
  if (!id || !/^[\w-]{11}$/.test(id)) return null;
  let t = 0;
  const tp = u.searchParams.get('t') || u.searchParams.get('start');
  if (tp) {
    const m = String(tp).match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
    if (m) t = (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  }
  return { id, t };
}

async function fetchTitle(id) {
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id), { signal: ctl.signal });
    clearTimeout(to);
    if (!r.ok) return '';
    const j = await r.json();
    return String(j.title || '').slice(0, 120);
  } catch { return ''; }
}

async function submitVideo(mode) {
  const parsed = parseYouTube($('urlInput').value);
  if (!parsed) { toast('Link YouTube chưa đúng. Ví dụ: https://www.youtube.com/watch?v=...'); return; }
  const title = await fetchTitle(parsed.id);
  if (mode === 'queue') send({ t: 'q_add', id: parsed.id, title });
  else send({ t: 'v_load', id: parsed.id, title, time: parsed.t });
  $('urlInput').value = '';
  $('urlInput').blur();
}
$('urlForm').addEventListener('submit', (e) => { e.preventDefault(); submitVideo('play'); });
$('queueAddBtn').addEventListener('click', () => submitVideo('queue'));
$('playBtn').addEventListener('click', () => {
  if (!video.id) return toast('Chưa có phim. Dán link YouTube để bắt đầu!');
  send({ t: video.paused ? 'v_play' : 'v_pause' });
});
$('nextBtn').addEventListener('click', () => { if (video.id) send({ t: 'v_next' }); });
$('seekBar').addEventListener('input', () => { seeking = true; $('timeLabel').textContent = fmt((+$('seekBar').value / 1000) * duration); });
$('seekBar').addEventListener('change', () => {
  seeking = false;
  if (video.id && duration) send({ t: 'v_seek', time: (+$('seekBar').value / 1000) * duration });
});
$('volBar').addEventListener('input', () => {
  userVol = +$('volBar').value;
  userMuted = userVol === 0;
  store.set('vol', userVol); store.set('muted', userMuted);
  applyVolume();
});
$('muteBtn').addEventListener('click', () => {
  userMuted = !userMuted;
  if (!userMuted && userVol === 0) userVol = 50;
  store.set('vol', userVol); store.set('muted', userMuted);
  applyVolume();
});
$('fullBtn').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
if (!document.documentElement.requestFullscreen) $('fullBtn').hidden = true;

// ====================== Thanh công cụ dọc ======================
const PANELS = {
  rooms: ['rooms', 'Chọn rạp'],
  screen: ['screen', 'Màn hình'],
  chat: ['chat', 'Trò chuyện'],
  emote: ['smile', 'Biểu cảm'],
  people: ['users', 'Người trong phòng'],
};
let curPanel = null;
function openPanel(name) {
  if (name === 'help') { closePanel(); $('help').hidden = false; return; }
  if (curPanel === name) { closePanel(); return; }
  curPanel = name;
  const [ic, title] = PANELS[name];
  $('flyIcon').setAttribute('href', '#i-' + ic);
  $('flyTitle').textContent = title;
  document.querySelectorAll('.fly').forEach((el) => (el.hidden = el.id !== 'fly-' + name));
  document.querySelectorAll('#toolbar [data-panel]').forEach((b) => b.classList.toggle('on', b.dataset.panel === name));
  $('flyout').hidden = false;
  if (name === 'rooms') renderRooms();
  if (name === 'people') updatePeopleList();
  if (name === 'chat') {
    unread = 0; updateBadge(); $('chatPeek').innerHTML = '';
    const log = $('chatLog'); log.scrollTop = log.scrollHeight;
    if (!TOUCH) setTimeout(() => $('chatInput').focus(), 30);
  }
  if (name === 'screen') {
    const arc = curRoom.kind === 'arcade';
    $('noScreen').hidden = !arc;
    $('screenBody').hidden = arc;
  }
}
function closePanel() {
  curPanel = null;
  $('flyout').hidden = true;
  document.querySelectorAll('#toolbar [data-panel]').forEach((b) => b.classList.remove('on'));
  document.activeElement?.blur?.();
}
document.querySelectorAll('#toolbar [data-panel]').forEach((b) => b.addEventListener('click', () => openPanel(b.dataset.panel)));
$('flyClose').addEventListener('click', closePanel);
$('onlinePill').addEventListener('click', () => openPanel('people'));
$('roomPill').addEventListener('click', () => openPanel('rooms'));

let unread = 0;
function updateBadge() { const b = $('chatBadge'); b.hidden = unread === 0; b.textContent = unread > 9 ? '9+' : unread; }
function noteChat(name, text) {
  if (curPanel === 'chat') return;
  unread++; updateBadge();
  const peek = $('chatPeek');
  const p = document.createElement('p');
  const n = document.createElement('b');
  n.textContent = name + ':'; n.style.color = nameColor(name);
  p.append(n, document.createTextNode(text.length > 80 ? text.slice(0, 80) + '…' : text));
  peek.appendChild(p);
  while (peek.children.length > 3) peek.removeChild(peek.firstChild);
  setTimeout(() => p.remove(), 6000);
}

// ====================== Phòng, vé, thanh toán ======================
const shop = createShop({
  store, toast,
  onToken: (token) => { send({ t: 'pass', token }); toast('Đã nhận vé! Bạn có thể vào phòng mới rồi.'); },
});
shop.onGo((id) => { if (id) goRoom(id); });

function setPasses(list) {
  passes = new Map((list || []).map((p) => [p.room, p.exp]));
  if (curPanel === 'rooms') renderRooms();
}
const hasPass = (id) => {
  const r = L.ROOM_BY_ID[id];
  if (!r || !(r.price > 0)) return true;
  if (!passes.has(id)) return false;
  const exp = passes.get(id);
  return exp === 0 || exp > serverNow();
};
function daysLeft(id) {
  const exp = passes.get(id);
  if (!exp) return 'vĩnh viễn';
  return 'còn ' + Math.max(1, Math.ceil((exp - serverNow()) / 86400000)) + ' ngày';
}
function renderRooms() {
  const box = $('roomList');
  if (!box) return;
  box.innerHTML = '';
  for (const r of L.ROOMS) {
    const here = r.id === curRoom.id;
    const locked = !hasPass(r.id);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `room-card t-${r.id}${here ? ' here' : ''}${locked ? ' locked' : ''}`;
    const price = r.price > 0 ? new Intl.NumberFormat('vi-VN').format(r.price) + 'đ' : 'Miễn phí';
    const n = roomCounts[r.id] || 0;
    const cta = here ? 'Đang ở đây' : locked ? 'Mua vé ' + price : 'Vào';
    const state = here ? '' : (r.price > 0 && !locked ? `<span class="state">Đã có vé · ${daysLeft(r.id)}</span>` : (r.price > 0 ? `<span>${icon('lock')} ${price}</span>` : ''));
    b.innerHTML = `<div class="rc-top"><b>${r.name}</b><span class="tag">${r.tag}</span></div><p>${r.desc}</p>
      <div class="rc-bot"><span>${icon('users')} ${n} người ${state ? '· ' : ''}${state}</span><span class="cta">${cta}</span></div>`;
    b.addEventListener('click', () => { if (!here) goRoom(r.id); });
    box.appendChild(b);
  }
}
let lastRoomSwitch = -9999;
function goRoom(id) {
  const r = L.ROOM_BY_ID[id];
  if (!r || r.id === curRoom.id) return;
  if (!hasPass(id)) { shop.open(r); return; }
  if (performance.now() - lastRoomSwitch < 1100) { toast('Chờ một giây rồi đổi phòng nhé.'); return; }
  lastRoomSwitch = performance.now();
  send({ t: 'room', room: id });
}
$('ticketBtn').addEventListener('click', async () => {
  const ok = await shop.redeem($('ticketInput').value);
  if (ok) { $('ticketInput').value = ''; toast('Đã thêm vé.'); }
});
$('ticketInput').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') $('ticketBtn').click(); });

// ====================== Trò chơi nhỏ + điểm tương tác ======================
let gameOpen = false;
const games = createGames({
  store, send,
  onOpen: () => { gameOpen = true; keys.clear(); },
  onClose: () => { gameOpen = false; },
});
const touch = createTouch({ onAct: () => act() });

let interactId = null;
let nearest = null;
let lastNear = 0;
function updateInteract(force) {
  const now = performance.now();
  if (!force && now - lastNear < 120) return;
  lastNear = now;
  nearest = null;
  if (joined && me.seat === null && !gameOpen) {
    let bd = Infinity;
    for (const it of RL.INTERACT || []) {
      const d = Math.hypot(it.x - me.x, it.z - me.z);
      if (d < it.r && d < bd) { bd = d; nearest = it; }
    }
  }
  const id = nearest ? nearest.id : null;
  if (id !== interactId || force) {
    interactId = id;
    if (nearest) $('actText').textContent = nearest.type === 'door' ? nearest.label : 'Chơi: ' + nearest.label;
    $('prompt').hidden = !nearest;
  }
  // nhãn nút cảm ứng
  if (TOUCH) {
    if (nearest) touch.setAction(nearest.type === 'door' ? 'Vào' : 'Chơi', nearest.type === 'door' ? 'enter' : 'gamepad', false);
    else if (me.seat !== null) touch.setAction('Đứng dậy', 'seat', false);
    else if (RL.SEATS.length) touch.setAction('Ngồi', 'seat', !nearSeat());
    else touch.setAction('—', 'hand', true);
  }
}
function nearSeat() {
  for (const s of RL.SEATS) if (!seatOwner.has(s.i) && Math.hypot(s.x - me.x, s.z - me.z) < 3.6) return true;
  return false;
}
function act() {
  if (!joined) return;
  if (me.seat !== null) { send({ t: 'stand' }); return; }
  if (nearest) {
    if (nearest.type === 'game') { games.open(nearest.game); closePanel(); }
    else if (nearest.type === 'door') goRoom(nearest.go);
    return;
  }
  sitNearest();
}
$('actBtn').addEventListener('click', act);

// ====================== Điều khiển ======================
const keys = new Set();
const typing = () => /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '');
window.addEventListener('keydown', (e) => {
  if (!joined || typing()) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') {
    if (!$('shop').hidden) shop.close();
    else if (gameOpen) games.close();
    else if (!$('help').hidden) $('help').hidden = true;
    else closePanel();
    return;
  }
  if (gameOpen || !$('shop').hidden) return;
  if (k === 'enter') { e.preventDefault(); if (curPanel !== 'chat') openPanel('chat'); else $('chatInput').focus(); return; }
  if (/^[1-7]$/.test(k)) { doEmote(EMOTE_LIST[+k - 1].key); return; }
  if (k === 'e') { act(); return; }
  if (k === ' ') { e.preventDefault(); if (me.seat !== null) send({ t: 'stand' }); return; }
  keys.add(k);
  if (k.startsWith('arrow')) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

function sitNearest() {
  if (me.seat !== null) return;
  let best = null, bd = 3.6;
  for (const s of RL.SEATS) {
    if (seatOwner.has(s.i)) continue;
    const d = Math.hypot(s.x - me.x, s.z - me.z);
    if (d < bd) { bd = d; best = s; }
  }
  if (best) send({ t: 'sit', seat: best.i });
  else toast('Không có ghế trống gần bạn. Hãy bấm trực tiếp vào ghế.');
}

// Chuột: kéo = xoay camera, bấm = chọn ghế / đi tới
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
let drag = null;
const pointers = new Map();
let pinchBase = 0;

function setRay(ev) {
  const r = canvas.getBoundingClientRect();
  ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
}
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId };
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchBase = Math.hypot(a.x - b.x, a.y - b.y);
  }
  document.activeElement?.blur?.();
  if (curPanel && TOUCH && window.innerWidth <= 700) closePanel();
});
canvas.addEventListener('pointermove', (e) => {
  const prevP = pointers.get(e.pointerId);
  if (prevP) { prevP.x = e.clientX; prevP.y = e.clientY; }
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchBase) cam.targetDist = clampDist(cam.targetDist * (pinchBase / d));
    pinchBase = d;
    if (drag) drag.moved = 99;
    return;
  }
  if (drag && drag.id === e.pointerId) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved > 5) {
      if (me.seat !== null) {
        cam.lookYaw = THREE.MathUtils.clamp(cam.lookYaw - dx * 0.004, -1.9, 1.9);
        cam.lookPitch = THREE.MathUtils.clamp(cam.lookPitch + dy * 0.004, -0.8, 0.8);
      } else {
        cam.yaw -= dx * 0.0055;
        cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.004, -0.05, 1.3);
      }
    }
  } else if (e.pointerType === 'mouse' && joined) hover(e);
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchBase = 0;
  if (drag && drag.id === e.pointerId) {
    if (drag.moved <= 5 && e.type === 'pointerup') onClick(e);
    drag = null;
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  cam.targetDist = clampDist(cam.targetDist * (1 + Math.sign(e.deltaY) * 0.1));
}, { passive: false });
const clampDist = (d) => THREE.MathUtils.clamp(d, 2, 11);

function hover(e) {
  setRay(e);
  const hit = ray.intersectObjects(world.pickables, false)[0];
  const si = world.seatFromHit(hit);
  if (si == null) { world.setMarker(null); canvas.style.cursor = 'default'; return; }
  const free = !seatOwner.has(si) || seatOwner.get(si) === me.id;
  world.setMarker(si, free);
  canvas.style.cursor = free ? 'pointer' : 'not-allowed';
}

function onClick(e) {
  if (!joined) return;
  setRay(e);
  const hit = ray.intersectObjects(world.pickables, false)[0];
  const si = world.seatFromHit(hit);
  if (si != null) {
    const owner = seatOwner.get(si);
    if (owner !== undefined && owner !== me.id) {
      const p = peers.get(owner);
      toast(`Ghế ${RL.SEATS[si].label} đã có ${p ? p.name : 'người'} ngồi rồi.`);
    } else if (owner !== me.id) send({ t: 'sit', seat: si });
    return;
  }
  // bấm xuống sàn: đi tới đó
  const pt = groundPoint(ray);
  if (pt) {
    if (me.seat !== null) send({ t: 'stand' });
    autoWalk = { x: pt.x, z: pt.z, stall: 0 };
  }
}
function groundPoint(r) {
  const o = r.ray.origin, d = r.ray.direction;
  if (d.y >= -0.001) return null;
  let t = 0;
  let prevT = 0;
  for (let i = 0; i < 400; i++) {
    t += 0.2;
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if (y <= RL.heightAt(z) + 0.02) {
      // tinh chỉnh bằng chia đôi
      let a = prevT, b = t;
      for (let k = 0; k < 8; k++) {
        const m = (a + b) / 2;
        (o.y + d.y * m <= RL.heightAt(o.z + d.z * m)) ? (b = m) : (a = m);
      }
      const px = o.x + d.x * b, pz = o.z + d.z * b;
      if (px < RL.BOUNDS.minX - 0.5 || px > RL.BOUNDS.maxX + 0.5 || pz < RL.BOUNDS.minZ - 0.5 || pz > RL.BOUNDS.maxZ + 0.5) return null;
      return RL.resolve(px, pz);
    }
    prevT = t;
    if (Math.abs(x) > 40 || Math.abs(z) > 60) return null;
  }
  return null;
}

// ====================== Vòng lặp chính ======================
const clock = new THREE.Clock();
let t_ = 0;
const tmpV = new THREE.Vector3();

function camSnap() {
  cam.yaw = Math.PI * 0 + 0;
  cam.pitch = 0.42;
  cam.dist = cam.targetDist = 5.2;
  cam.lx = me.x; cam.lz = me.z; cam.ly = RL.heightAt(me.z) + 1.4;
}

function updateSelf(dt) {
  const p = selfPeer();
  if (!p) return;
  let mx = 0, mz = 0;
  if (keys.has('w') || keys.has('arrowup')) mz -= 1;
  if (keys.has('s') || keys.has('arrowdown')) mz += 1;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  let analog = 1;
  if (!mx && !mz && touch.state.active && !gameOpen) {
    mx = touch.state.x; mz = touch.state.y;
    analog = Math.min(1, Math.hypot(mx, mz));
  }

  if (me.seat !== null) {
    // đang ngồi: bấm phím di chuyển để đứng dậy
    if (mx || mz) { send({ t: 'stand' }); }
    p.speed = 0;
    return;
  }

  let dx = 0, dz = 0;
  if (mx || mz) {
    autoWalk = null;
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
    const rx = -fz, rz = fx;
    dx = rx * mx + fx * -mz;
    dz = rz * mx + fz * -mz;
    const len = Math.hypot(dx, dz);
    dx /= len; dz /= len;
  } else if (autoWalk) {
    const ax = autoWalk.x - me.x, az = autoWalk.z - me.z;
    const d = Math.hypot(ax, az);
    if (d < 0.12) autoWalk = null;
    else { dx = ax / d; dz = az / d; }
  }

  const sprint = keys.has('shift') || touch.state.run;
  const speed = (sprint ? 5.2 : 3.2) * (dx || dz ? analog : 0);
  if (speed) {
    const nx = me.x + dx * speed * dt, nz = me.z + dz * speed * dt;
    const r = RL.resolve(nx, nz);
    const moved = Math.hypot(r.x - me.x, r.z - me.z);
    if (autoWalk) {
      autoWalk.stall = moved < speed * dt * 0.25 ? autoWalk.stall + dt : 0;
      if (autoWalk.stall > 0.35) autoWalk = null;
    }
    p.speed = moved / dt;
    me.x = r.x; me.z = r.z;
    // quay mặt theo hướng đi
    const target = Math.atan2(dx, dz);
    let diff = target - me.ry;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    me.ry += diff * Math.min(1, dt * 14);
  } else p.speed = 0;

  p.x = me.x; p.z = me.z; p.ry = me.ry;
  // gửi vị trí tối đa ~12 lần/giây khi có thay đổi
  const now = performance.now();
  if (now - lastSent.t > 80 && (Math.abs(me.x - lastSent.x) > 0.01 || Math.abs(me.z - lastSent.z) > 0.01 || Math.abs(me.ry - lastSent.ry) > 0.03)) {
    send({ t: 'move', x: me.x, z: me.z, ry: me.ry });
    lastSent = { x: me.x, z: me.z, ry: me.ry, t: now };
  }
}

function updatePeers(dt, nowMs) {
  const kPos = 1 - Math.exp(-12 * dt);
  for (const p of peers.values()) {
    const g = p.av.group;
    const seated = p.seat !== null;
    let moved = 0;

    if (p.isMe && !seated) {
      // vị trí tự quyết định ở updateSelf
    } else if (seated) {
      const k = 1 - Math.exp(-9 * dt);
      const ox = p.x, oz = p.z;
      p.x += (p.tx - p.x) * k;
      p.z += (p.tz - p.z) * k;
      moved = Math.hypot(p.x - ox, p.z - oz) / dt;
    } else {
      const ox = p.x, oz = p.z;
      p.x += (p.tx - p.x) * kPos;
      p.z += (p.tz - p.z) * kPos;
      moved = Math.hypot(p.x - ox, p.z - oz) / dt;
      let diff = p.try_ - p.ry;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      p.ry += diff * Math.min(1, dt * 12);
      p.speed = moved;
    }
    if (p.isMe && seated) { me.x = p.x; me.z = p.z; p.ry = me.ry; }
    if (seated && !p.isMe) {
      let diff = p.try_ - p.ry;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      p.ry += diff * Math.min(1, dt * 10);
    }

    // độ cao: ngồi -> theo ghế, đứng -> theo sàn
    let y;
    if (seated) {
      const s = RL.SEATS[p.seat];
      y = s.floorY + (s.kind === 'bean' ? 0.25 : 0.52) - HIP_Y + 0.07;
    } else y = RL.heightAt(p.z);
    g.position.set(p.x, y, p.z);
    if (seated) {
      const s = RL.SEATS[p.seat];
      // lùi vào lưng ghế một chút
      g.position.z += s.kind === 'bean' ? 0.08 : 0.1;
    }
    g.rotation.y = p.ry;

    p.av.update(dt, {
      speed: seated ? 0 : p.isMe ? p.speed : Math.min(moved, 6),
      sitting: seated,
      emote: p.emote,
      now: nowMs,
      drop: seated ? HIP_Y - 0.07 - (RL.SEATS[p.seat].kind === 'bean' ? 0.25 : 0.52) + 0.0 : 0,
    });

    // bong bóng chat + emoji nổi
    if (p.bubble && nowMs > p.bubbleUntil) { disposeSprite(p.bubble); p.bubble = null; }
    for (let i = p.floats.length - 1; i >= 0; i--) {
      const f = p.floats[i];
      const a = (nowMs - f.born) / 1700;
      if (a >= 1) { disposeSprite(f.sp); p.floats.splice(i, 1); continue; }
      f.sp.position.y = 2.3 + a * 1.2;
      f.sp.material.opacity = a < 0.7 ? 1 : 1 - (a - 0.7) / 0.3;
    }
    // nhãn tên cao hơn khi có bong bóng
    // góc nhìn thứ nhất: không vẽ cơ thể mình để khỏi che tầm nhìn
    g.visible = !(p.isMe && seated);
  }
}

function updateCamera(dt) {
  const p = selfPeer();
  cam.dist += (cam.targetDist - cam.dist) * (1 - Math.exp(-10 * dt));
  const k = 1 - Math.exp(-9 * dt);

  if (p && me.seat !== null) {
    // góc nhìn thứ nhất từ chỗ ngồi
    const s = RL.SEATS[me.seat];
    const ex = p.x, ez = p.z + 0.1, ey = s.floorY + (s.kind === 'bean' ? 1.15 : 1.42);
    const yaw = me.ry + cam.lookYaw;
    camera.position.lerp(tmpV.set(ex, ey, ez), k * 1.2);
    const lookDir = new THREE.Vector3(Math.sin(yaw) * Math.cos(cam.lookPitch), -Math.sin(cam.lookPitch), Math.cos(yaw) * Math.cos(cam.lookPitch));
    const tgt = camera.position.clone().add(lookDir);
    camera.lookAt(tgt);
    camera.fov += (68 - camera.fov) * k;
    camera.updateProjectionMatrix();
    cam.lx = p.x; cam.lz = p.z; cam.ly = ey;
    return;
  }

  if (p) {
    cam.lx += (p.x - cam.lx) * k * 1.5;
    cam.lz += (p.z - cam.lz) * k * 1.5;
    cam.ly += (RL.heightAt(p.z) + 1.35 - cam.ly) * k;
  }
  const cp = Math.cos(cam.pitch);
  let px = cam.lx + Math.sin(cam.yaw) * cam.dist * cp;
  let py = cam.ly + Math.sin(cam.pitch) * cam.dist;
  let pz = cam.lz + Math.cos(cam.yaw) * cam.dist * cp;
  // không cho camera xuyên tường / trần / sàn
  px = THREE.MathUtils.clamp(px, RL.ROOM.minX + 0.4, RL.ROOM.maxX - 0.4);
  pz = THREE.MathUtils.clamp(pz, RL.ROOM.minZ + 0.6, RL.ROOM.maxZ - 0.4);
  py = THREE.MathUtils.clamp(py, RL.heightAt(pz) + 0.35, RL.ROOM.height - 0.4);
  camera.position.set(px, py, pz);
  camera.lookAt(cam.lx, cam.ly, cam.lz);
  camera.fov += (60 - camera.fov) * k;
  camera.updateProjectionMatrix();
}

// Khi chưa vào phòng: camera quay chậm quanh rạp
function updateIdleCamera(t) {
  const a = t * 0.12;
  camera.position.set(Math.sin(a) * 9, 7 + Math.sin(t * 0.2) * 0.5, 11 + Math.cos(a) * 3);
  camera.lookAt(0, 5.5, -10);
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  t_ += dt;
  const nowMs = performance.now();

  if (joined) {
    updateSelf(dt);
    updatePeers(dt, nowMs);
    updateCamera(dt);
    updateInteract();
  } else updateIdleCamera(t_);

  world.update(dt, t_, { dim: !!video.id && !video.paused, playing: !!video.id && !video.paused });
  renderer.render(scene, camera);
  css.render(cssScene, camera);

  if (pv.r && !$('join').hidden && pv.av) {
    pv.av.group.rotation.y = Math.sin(t_ * 0.9) * 0.8;
    pv.av.update(dt, { speed: 0, sitting: false, emote: { type: 'wave', until: Infinity }, now: nowMs, drop: 0 });
    pv.r.render(pv.scene, pv.cam);
  }
}

// ====================== Khởi động ======================
function enter() {
  const name = $('nameInput').value.replace(/[<>]/g, '').trim().slice(0, 16);
  if (!name) {
    $('joinStatus').textContent = 'Hãy nhập tên của bạn trước nhé.';
    $('nameInput').focus();
    return;
  }
  me.name = name;
  store.set('name', name);
  store.set('look', look);
  $('enterBtn').disabled = true;
  $('joinStatus').textContent = 'Đang vào rạp…';
  connect();
}
$('enterBtn').addEventListener('click', enter);
$('nameInput').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') enter(); });

initPreview();
frame();
(document.fonts?.ready || Promise.resolve()).then(() => {});
