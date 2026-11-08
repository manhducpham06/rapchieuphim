import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { buildWorld } from './world.js';
import { buildArcade } from './arcade.js';
import { loadCharacter, characterReady, createCharacter, EMOTE_MS, sitY } from './character.js';
import { initAuth } from './auth.js';
import { createVoice } from './voice.js';
import { buildPlaza, buildShop } from './town.js';
import { createWalletUI } from './wallet-ui.js';
import { loadOutfitMask } from './outfit.js';
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
const mkAvatar = (lk) => (characterReady() ? createCharacter() : createAvatar(lk));
let charState = 'loading';
const charLoad = Promise.all([loadCharacter(), loadOutfitMask()]).then((r) => r[0]).then((ok) => { charState = ok ? 'ok' : 'fail'; if (ok && pv.r) rebuildPreview(); return ok; });
const TOUCH = isTouchDevice();
let RL = L.layoutOf('plaza'); // bố cục của phòng hiện tại
let curRoom = L.ROOM_BY_ID.plaza;
let roomCounts = {};
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
let world = buildPlaza(scene);
let worldKey = 'plaza';

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
  const key = def.id;
  RL = L.layoutOf(def.kind);
  curRoom = def;
  if (key !== worldKey) {
    world.dispose();
    world = def.kind === 'arcade' ? buildArcade(scene)
      : def.kind === 'plaza' ? buildPlaza(scene)
      : def.kind === 'shop' ? buildShop(scene, () => (characterReady() ? createCharacter() : null))
      : buildWorld(scene, 'vip');
    worldKey = key;
  }
  css.domElement.style.display = def.kind === 'theater' ? '' : 'none';
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
  pv.r.setSize(cv.clientWidth || 240, cv.clientHeight || 300, false);
  pv.scene = new THREE.Scene();
  pv.scene.add(new THREE.HemisphereLight(0xffffff, 0x553355, 1.6));
  const dl = new THREE.DirectionalLight(0xffffff, 1.6);
  dl.position.set(2, 3, 4);
  pv.scene.add(dl);
  pv.cam = new THREE.PerspectiveCamera(32, (cv.clientWidth || 240) / (cv.clientHeight || 300), 0.1, 20);
  pv.cam.position.set(0, 1.15, 4.1);
  pv.cam.lookAt(0, 0.98, 0);
  rebuildPreview();
}
function rebuildPreview() {
  if (pv.av) pv.scene.remove(pv.av.group);
  pv.av = mkAvatar(look);
  pv.scene.add(pv.av.group);
}

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

const ringGeo = new THREE.RingGeometry(0.5, 0.62, 40);
function makePeer(p, isMe = false) {
  const av = mkAvatar(p.look || look);
  const label = makeLabel((p.own ? '★ ' : '') + p.name, { self: isMe || !!p.own });
  label.position.set(0, 2.0, 0);
  av.group.add(label);
  scene.add(av.group);
  if (av.setOutfit && p.o) av.setOutfit(p.o);
  const peer = {
    id: p.id, name: p.name, look: p.look, av, label, bubble: null, bubbleUntil: 0, emote: null, floats: [],
    x: p.x, z: p.z, ry: p.ry, tx: p.x, tz: p.z, try_: p.ry, seat: p.seat ?? null, speed: 0, isMe, own: !!p.own,
  };
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x4cff8a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  av.group.add(ring);
  peer.ring = ring;
  peer.speaking = false;
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
    (async () => {
      let idToken = null;
      try { idToken = auth.enabled && acct ? await auth.idToken() : null; } catch {}
      if (mine !== ws) return;
      send({ t: 'join', name: me.name, look, room: curRoom.id, idToken });
      send({ t: 'ping', t0: Date.now() });
    })();
  };
  mine.onmessage = (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    onMessage(m);
  };
  mine.onclose = (ev) => {
    if (mine !== ws) return;
    if (ev && ev.code === 4001) {
      setNet('bad', 'đã đăng nhập nơi khác');
      toast('Tài khoản này đang chơi ở nơi khác nên phiên này bị ngắt. Tải lại trang để vào lại.');
      voice && voice.stop && voice.stop();
      return;
    }
    setNet('bad', 'mất kết nối - đang thử lại…');
    if (joined) toast('Mất kết nối, đang thử vào lại…');
    clearPeers();
    if (!joined) setStatus('Không kết nối được máy chủ, đang thử lại…');
    $('enterBtn').disabled = false; $('enterAcct').disabled = false;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 2000);
  };
  mine.onerror = () => {};
}
setInterval(() => send({ t: 'ping', t0: Date.now() }), 5000);

function syncShopOwner() {
  if (!world.setOwnerVisible) return;
  let real = false;
  for (const p of peers.values()) if (p.own) { real = true; break; }
  world.setOwnerVisible(!real);
}
function clearPeers() {
  for (const p of peers.values()) removePeerVisual(p);
  peers.clear();
  seatOwner.clear();
  updateOnline();
}
function removePeerVisual(p) {
  if (p.ring) p.ring.material.dispose();
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
      const def = L.ROOM_BY_ID[m.room] || L.ROOM_BY_ID.plaza;
      const changed = joined && def.id !== curRoom.id;
      buildRoomWorld(def);
      if (m.w) wal.setWallet(m.w);
      if (m.counts) { roomCounts = m.counts; }
      games.close(true);
      voice.reset();
      voice.start();
      interactId = null;
      me.id = m.id;
      for (const p of m.players) {
        const peer = makePeer(p, p.id === m.id);
        peers.set(p.id, peer);
        if (p.seat !== null) seatOwner.set(p.seat, p.id);
      }
      const s = peers.get(m.id);
      me.x = s.x; me.z = s.z; me.ry = s.ry; me.seat = null;
      syncShopOwner();
      camSnap();
      $('chatLog').innerHTML = '';
      m.chat.forEach((c) => addChat(c.name, c.text, c.id === me.id, true));
      addSys(WELCOME[def.kind] || `Bạn vừa vào ${def.name}.`);
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
      syncShopOwner();
      updateOnline();
      return;
    }
    case 'leave': {
      const p = peers.get(m.id);
      if (!p) return;
      removePeerVisual(p);
      voice.peerLeft(m.id);
      peers.delete(m.id);
      for (const [s, id] of seatOwner) if (id === m.id) seatOwner.delete(s);
      syncShopOwner();
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
    case 'err': toast(m.text); return;
    case 'wallet': wal.setWallet(m.w); if (m.toast) toast(m.toast); return;
    case 'buyres': wal.onBuyRes(m); return;
    case 'outfit': {
      const p = peers.get(m.id);
      if (p && p.av.setOutfit) p.av.setOutfit(m.o || {});
      return;
    }
    case 'rtc': voice.onSignal(m.from, m.d); return;
    case 'rooms': roomCounts = m.counts || {}; if (curPanel === 'rooms') renderRooms(); return;
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
  p.emote = { type: e, until: performance.now() + (EMOTE_MS[e] || 2200) };
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
    if (p.speaking) { const dot = document.createElement('i'); dot.className = 'speakdot'; n.prepend(dot); }
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
    const arc = curRoom.kind !== 'theater';
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

// ====================== Voice chat ======================
const voice = createVoice({
  send,
  getPeers: () => peers,
  getMe: () => me,
  getMyId: () => me.id,
  toast,
  onSpeaking: (id, on) => {
    const p = id === 'me' ? selfPeer() : peers.get(id);
    if (p) p.speaking = on;
    if (id === 'me') $('micBtn').classList.toggle('talk', on);
    if (curPanel === 'people') updatePeopleList();
  },
  onState: ({ mic, spk }) => {
    $('micBtn').classList.toggle('live', mic);
    $('micIcon').setAttribute('href', mic ? '#i-mic' : '#i-micoff');
    $('micBtn').setAttribute('aria-pressed', String(mic));
    $('spkBtn').classList.toggle('off', !spk);
    $('spkIcon').setAttribute('href', spk ? '#i-volume' : '#i-mute');
    $('micLabel').textContent = mic ? 'Mic bật' : 'Mic';
  },
});
window.__voice = voice; // chỉ để kiểm thử
$('micBtn').addEventListener('click', () => voice.setMic(!voice.mic));
$('spkBtn').addEventListener('click', () => voice.setSpeaker(!voice.spk));

// ====================== Phòng, ví xu, thời trang ======================
const WELCOME = {
  plaza: 'Chào mừng đến Phố Vui! Đi qua cổng để vào Rạp Chiếu Phim, Khu Giải Trí hoặc Shop Thời Trang.',
  theater: 'Chào mừng đến Rạp Chiếu Phim! Bấm vào một ghế trống để ngồi xem, dán link YouTube ở mục Màn hình.',
  arcade: 'Chào mừng đến Khu Giải Trí! Chạy vào quả bóng để sút, lại gần máy game và bấm E / nút Chơi.',
  shop: 'Chào mừng đến Shop Thời Trang! Lại gần quầy để mua đồ, lại gần gương để thử đồ.',
};
const wal = createWalletUI({
  send, toast,
  getIdToken: () => auth.idToken(),
  isAccount: () => !!acct,
  onNeedLogin: () => { toast('Đang đưa bạn về màn hình đăng nhập…'); setTimeout(() => location.reload(), 700); },
});
$('wardBtn').addEventListener('click', () => { closePanel(); wal.open('ward'); });
$('topBtn').addEventListener('click', () => { closePanel(); wal.openTopup(); });
function renderRooms() {
  const box = $('roomList');
  if (!box) return;
  box.innerHTML = '';
  for (const r of L.ROOMS) {
    const here = r.id === curRoom.id;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `room-card t-${r.id}${here ? ' here' : ''}`;
    const n = roomCounts[r.id] || 0;
    b.innerHTML = `<div class="rc-top"><b>${r.name}</b><span class="tag">${r.tag}</span></div><p>${r.desc}</p>
      <div class="rc-bot"><span>${icon('users')} ${n} người</span><span class="cta">${here ? 'Đang ở đây' : 'Đi tới'}</span></div>`;
    b.addEventListener('click', () => { if (!here) goRoom(r.id); });
    box.appendChild(b);
  }
}
let lastRoomSwitch = -9999;
function goRoom(id) {
  const r = L.ROOM_BY_ID[id];
  if (!r || r.id === curRoom.id) return;
  if (performance.now() - lastRoomSwitch < 1100) { toast('Chờ một giây rồi đổi phòng nhé.'); return; }
  lastRoomSwitch = performance.now();
  send({ t: 'room', room: id });
}

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
    if (nearest) $('actText').textContent = nearest.type === 'game' ? 'Chơi: ' + nearest.label : nearest.label;
    $('prompt').hidden = !nearest;
  }
  // nhãn nút cảm ứng
  if (TOUCH) {
    if (nearest) touch.setAction(nearest.type === 'door' ? 'Vào' : nearest.type === 'game' ? 'Chơi' : nearest.type === 'shop' ? 'Mua sắm' : 'Thử đồ', nearest.type === 'door' ? 'enter' : nearest.type === 'game' ? 'gamepad' : 'hanger', false);
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
    else if (nearest.type === 'shop') { closePanel(); wal.open('shop'); }
    else if (nearest.type === 'wardrobe') { closePanel(); wal.open('ward'); }
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
    if (wal.isOpen()) wal.close();
    else if (gameOpen) games.close();
    else if (!$('help').hidden) $('help').hidden = true;
    else closePanel();
    return;
  }
  if (gameOpen || wal.isOpen()) return;
  if (k === 'enter') { e.preventDefault(); if (curPanel !== 'chat') openPanel('chat'); else $('chatInput').focus(); return; }
  if (/^[1-9]$/.test(k)) { doEmote(EMOTE_LIST[+k - 1].key); return; }
  if (k === 'e') { act(); return; }
  if (k === 'm') { voice.setMic(!voice.mic); return; }
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
  const speed = (sprint ? 4.4 : 2.2) * (dx || dz ? analog : 0);
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
      const top = s.floorY + (s.kind === 'bean' ? 0.25 : 0.52);
      y = p.av.isChar ? sitY(top, s.floorY) : top - HIP_Y + 0.07;
    } else y = RL.heightAt(p.z);
    g.position.set(p.x, y, p.z);
    if (seated) {
      const s = RL.SEATS[p.seat];
      g.position.z += s.kind === 'bean' ? 0.08 : (p.av.isChar ? 0.02 : 0.1);
    }
    g.rotation.y = p.ry;
    if (p.ring) {
      p.ring.visible = p.speaking;
      if (p.speaking) {
        const k = 1 + 0.18 * Math.sin(nowMs / 130);
        p.ring.scale.set(k, k, k);
        p.ring.position.y = seated ? RL.SEATS[p.seat].floorY - y + 0.04 : 0.04;
      }
    }

    if (!seated && (p.isMe ? p.speed : moved) > 0.6) p.emote = null;
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

// ====================== Tài khoản & khởi động ======================
let auth = { enabled: false };
let acct = null;
let tab = 'guest';
const setStatus = (t, cls = '') => { const el = $('joinStatus'); el.textContent = t; el.className = 'status ' + cls; };
function showTab(t) {
  tab = t;
  document.querySelectorAll('#authTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('.tabpane').forEach((p) => (p.hidden = p.dataset.pane !== t));
  setStatus('');
}
function renderAuth() {
  const tabs = $('authTabs');
  $('nameInput').hidden = !!acct;
  wal.showGuestCoin(!acct);
  if (!auth.enabled) { tabs.hidden = true; showTab('guest'); $('guestNote').hidden = true; return; }
  $('guestNote').hidden = false;
  if (acct) {
    tabs.hidden = true;
    const nm = acct.displayName || (acct.email || '').split('@')[0] || 'Người chơi';
    $('acctName').textContent = nm;
    $('acctMail').textContent = acct.email || '';
    $('acctInit').textContent = nm.trim().charAt(0).toUpperCase() || '?';
    showTab('account');
  } else {
    tabs.hidden = false;
    showTab(tab === 'account' ? 'login' : tab === 'guest' && !$('authTabs').dataset.init ? 'login' : tab);
    $('authTabs').dataset.init = '1';
  }
}
async function onAuth(u) {
  acct = u || null;
  renderAuth();
}
document.querySelectorAll('#authTabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
const busy = (btn, on) => { btn.disabled = on; };
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('liEmail').value.trim(), pw = $('liPass').value;
  if (!email || !pw) return setStatus('Hãy nhập email và mật khẩu.', 'err');
  busy($('liBtn'), true); setStatus('Đang đăng nhập…');
  const r = await auth.login(email, pw);
  busy($('liBtn'), false);
  setStatus(r.ok ? '' : r.error, r.ok ? '' : 'err');
});
$('regForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('rgName').value.replace(/[<>]/g, '').trim().slice(0, 16);
  const email = $('rgEmail').value.trim(), pw = $('rgPass').value;
  if (!name) return setStatus('Hãy nhập tên hiển thị.', 'err');
  if (!email) return setStatus('Hãy nhập email.', 'err');
  if (pw.length < 6) return setStatus('Mật khẩu cần ít nhất 6 ký tự.', 'err');
  if (pw !== $('rgPass2').value) return setStatus('Hai mật khẩu chưa giống nhau.', 'err');
  busy($('rgBtn'), true); setStatus('Đang tạo tài khoản…');
  const r = await auth.register(email, pw, name);
  busy($('rgBtn'), false);
  if (r.ok) { acct = auth.user; renderAuth(); setStatus('Tạo tài khoản thành công!', 'ok'); } else setStatus(r.error, 'err');
});
$('forgotBtn').addEventListener('click', async () => {
  const email = $('liEmail').value.trim();
  if (!email) return setStatus('Nhập email vào ô trên rồi bấm lại “Quên mật khẩu”.', 'err');
  const r = await auth.reset(email);
  setStatus(r.ok ? 'Đã gửi email đặt lại mật khẩu (xem cả hộp thư rác).' : r.error, r.ok ? 'ok' : 'err');
});
$('logoutBtn').addEventListener('click', async () => { await auth.logout(); });

function enter(asAccount) {
  let name;
  if (asAccount && acct) name = (acct.displayName || (acct.email || '').split('@')[0] || 'Người chơi').slice(0, 16);
  else {
    name = $('nameInput').value.replace(/[<>]/g, '').trim().slice(0, 16);
    if (!name) { setStatus('Hãy nhập tên của bạn trước nhé.', 'err'); $('nameInput').focus(); return; }
    store.set('name', name);
  }
  me.name = name;
  store.set('look', look);
  $('enterBtn').disabled = true; $('enterAcct').disabled = true;
  setStatus(charState === 'loading' ? 'Đang tải nhân vật…' : 'Đang vào thế giới…');
  charLoad.then(() => { setStatus('Đang vào thế giới…'); connect(); });
}
$('enterBtn').addEventListener('click', () => enter(!!acct));
$('enterAcct').addEventListener('click', () => enter(true));
$('nameInput').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') enter(false); });
for (const id of ['liEmail', 'liPass', 'rgName', 'rgEmail', 'rgPass', 'rgPass2']) $(id).addEventListener('keydown', (e) => e.stopPropagation());

showTab('guest');
initAuth(onAuth).then((a) => {
  auth = a;
  if (a.error) setStatus(a.error, 'err');
  renderAuth();
});
initPreview();
frame();

// ====================== Màn hình chờ: phong cảnh, menu, số người online ======================
(function landing() {
  const svg = $('ldCity');
  if (svg) {
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    let out = '';
    for (const [layer, fill, wmin, hmax] of [[0, '#8fb4e6', 50, 230], [1, '#6a8fd0', 60, 300], [2, '#4a6fb8', 70, 360]]) {
      let x = -20 + layer * 15;
      while (x < 1620) {
        const w = wmin + rnd() * 70, h = 90 + rnd() * (hmax - 90);
        out += `<rect x="${x.toFixed(0)}" y="${(400 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${fill}" opacity="${0.55 + layer * 0.2}"/>`;
        if (layer > 0) for (let wy = 400 - h + 14; wy < 392; wy += 22) for (let wx = x + 8; wx < x + w - 10; wx += 16) if (rnd() > 0.62) out += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="7" height="10" fill="#ffeeb0" opacity=".85"/>`;
        x += w + 4 + rnd() * 14;
      }
    }
    svg.innerHTML = out;
  }
  const scroll = (id) => { const el = $(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  document.querySelectorAll('.ld-nav [data-go], .ld-tile[data-go]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const g = a.dataset.go;
    if (g === 'help') $('help').hidden = false;
    else if (g === 'top') $('join').scrollTo({ top: 0, behavior: 'smooth' });
    else scroll('ldTiles');
    document.querySelectorAll('.ld-nav nav a').forEach((x) => x.classList.toggle('on', x === a));
  }));
  async function online() {
    try { const j = await (await fetch('/healthz', { cache: 'no-store' })).json(); $('ldOnline').textContent = j.online ?? j.players ?? 0; } catch {}
  }
  online();
  setInterval(() => { if (!$('join').hidden) online(); }, 10000);
})();
