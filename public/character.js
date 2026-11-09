// Nhân vật 3D (Kenney Mini Characters, CC0): 6 nữ + 7 nam tự chọn, thêm nhân vật đặc biệt mua bằng xu.
// Mỗi nhân vật là 1 file .glb có sẵn khung xương + hoạt ảnh; tải một lần rồi nhân bản cho mọi người chơi.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { buildAccessory } from './accessories.js';

const DIR = 'models/chars/';
const SCALE = 2.2; // mô hình gốc cao 0.67 => ~1.5m trong game
const cache = new Map(); // tên -> Promise<gltf|null>
const loader = new GLTFLoader();

export function loadChar(key) {
  if (!cache.has(key)) {
    cache.set(key, new Promise((res) => {
      loader.load(DIR + 'character-' + key + '.glb', (g) => {
        g.scene.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; if (o.material) { o.material.metalness = 0; o.material.roughness = 0.9; } } });
        res(g);
      }, undefined, () => res(null));
    }));
  }
  return cache.get(key);
}
const loaded = new Map();
/** Tải sẵn mọi nhân vật mặc định (nam + nữ) trước khi vào game. */
export function loadCharacter() {
  const L = window.LAYOUT;
  const keys = L && L.CHARS ? L.CHARS.map((c) => c.key) : ['female-a', 'male-a'];
  return Promise.all(keys.map((k) => loadChar(k).then((g) => { if (g) loaded.set(k, g); }))).then(() => loaded.size > 0);
}
export const characterReady = () => loaded.size > 0;

// biểu cảm -> clip của Kenney (idle, walk, sprint, jump, sit, emote-yes, emote-no, interact-*, pick-up...)
const EMOTE_ANIM = { wave: 'interact-right', clap: 'emote-yes', heart: 'emote-yes', laugh: 'jump', wow: 'jump', popcorn: 'pick-up', thumb: 'emote-yes', dance: 'jump', phone: 'interact-left' };
export const EMOTE_MS = { dance: 6000, phone: 6000, laugh: 2500, popcorn: 3000, wave: 2600, heart: 2600, clap: 3000, wow: 2500, thumb: 3000 };
// clip ngồi: mông cách gốc ~0.05m, chân thõng xuống ~0.45m => đặt gốc cao hơn mặt ghế một chút
export const sitY = (seatTop, floorY) => Math.max(floorY - 0.02, seatTop - 0.05);

const blobGeo = new THREE.CircleGeometry(0.5, 24);
const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });

// vị trí gắn phụ kiện theo từng ô (xương: head / torso). Phụ kiện dựng theo cỡ nhân vật cũ nên cần dịch/co cho vừa đầu to của nhân vật mini.
const FIT = {
  face: { bone: 'head', pos: [0, 0.0, -0.075], scale: [1.2, 1.0, 1.0] },
  head: { bone: 'head', pos: [0, -0.07, 0], scale: [1.0, 0.85, 1.0] },
  neck: { bone: 'head', pos: [0, -0.13, 0], scale: [1.1, 0.8, 1.1] },
  back: { bone: 'torso', pos: [0, -0.02, 0], scale: [0.85, 0.6, 0.8] },
};

/** look: { char: số thứ tự trong LAYOUT.CHARS }. Nhân vật có thể đổi sau bằng setLook / setOutfit (ô 'skin'). */
export function createCharacter(look) {
  const group = new THREE.Group();
  const blob = new THREE.Mesh(blobGeo, blobMat);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  group.add(blob);

  const holder = new THREE.Group();
  holder.scale.setScalar(SCALE);
  group.add(holder);

  let model = null, mixer = null, actions = {}, cur = null, curName = '', key = '';
  let outfitEq = {};
  let worn = [];
  let wantKey = '';

  function play(name, ts = 1) {
    const next = actions[name] || actions.idle;
    if (!next) return;
    next.timeScale = ts;
    if (curName === name) return;
    next.reset().fadeIn(0.2).play();
    if (cur) cur.fadeOut(0.2);
    cur = next; curName = name;
  }

  function attach() {
    for (const o of worn) o.removeFromParent();
    worn = [];
    if (!model) return;
    const C = window.CATALOG;
    if (!C) return;
    for (const slot of ['face', 'head', 'neck', 'back']) {
      const it = C.BY_ID[outfitEq[slot]];
      if (!it || it.slot !== slot || !it.acc) continue;
      const f = FIT[slot];
      const bone = model.getObjectByName(f.bone);
      const acc = bone && buildAccessory(it);
      if (!acc) continue;
      const wrap = new THREE.Group();
      wrap.position.set(...f.pos);
      wrap.scale.set(...f.scale);
      wrap.add(acc);
      bone.add(wrap);
      worn.push(wrap);
    }
  }

  function swap(g, k) {
    if (model) { mixer.stopAllAction(); holder.remove(model); }
    model = cloneSkinned(g.scene);
    holder.add(model);
    mixer = new THREE.AnimationMixer(model);
    actions = {};
    for (const clip of g.animations) {
      const a = mixer.clipAction(clip);
      a.setLoop(THREE.LoopRepeat, Infinity);
      actions[clip.name] = a;
    }
    cur = null; curName = '';
    key = k;
    play('idle');
    mixer.update(Math.random() * 1.2); // lệch pha cho khỏi đồng loạt
    attach();
  }

  function charKey() {
    const L = window.LAYOUT, C = window.CATALOG;
    const sk = C && C.BY_ID[outfitEq.skin];
    if (sk && sk.char) return sk.char;
    const list = L.CHARS;
    const i = look && look.char >= 0 && look.char < list.length ? look.char | 0 : 0;
    return list[i].key;
  }
  function want() {
    const k = charKey();
    if (k === key || k === wantKey) return;
    wantKey = k;
    const have = loaded.get(k);
    if (have) { swap(have, k); return; }
    // chưa tải: tạm dùng nhân vật có sẵn rồi đổi khi tải xong
    if (!model) { const any = loaded.values().next().value; if (any) swap(any, ''); }
    loadChar(k).then((g) => { if (g) { loaded.set(k, g); if (wantKey === k) swap(g, k); } });
  }

  function update(dt, st) {
    if (!mixer) return;
    const e = st.emote && st.emote.until > st.now ? st.emote.type : null;
    if (st.sitting) play('sit');
    else if (st.speed > 0.35) {
      if (st.speed < 3.3) play('walk', THREE.MathUtils.clamp(st.speed / 2.6, 0.7, 1.8));
      else play('sprint', THREE.MathUtils.clamp(st.speed / 4.2, 0.8, 1.5));
    } else if (e && EMOTE_ANIM[e]) play(EMOTE_ANIM[e]);
    else play('idle');
    blob.visible = !st.sitting;
    mixer.update(dt);
  }

  function setOutfit(eq) {
    eq = eq || {};
    const sig = JSON.stringify(eq);
    if (sig === JSON.stringify(outfitEq) && model) return;
    outfitEq = eq;
    want();
    attach();
  }
  function setLook(l) { look = l; want(); }
  function dispose() { if (mixer) mixer.stopAllAction(); group.removeFromParent(); }

  want();
  return { group, update, dispose, setOutfit, setLook, isChar: true };
}
