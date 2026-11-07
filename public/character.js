// Nhân vật 3D thật (Aj, từ file FBX của chủ game) + 8 cử chỉ. Tải một lần, nhân bản cho mọi người chơi.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { bodyMaterialFor } from './outfit.js';
import { buildAccessory, boneForSlot } from './accessories.js';

let gltf = null;
export function loadCharacter(url = 'models/character.glb') {
  return new Promise((resolve) => {
    try {
      new GLTFLoader().load(url, (g) => { gltf = g; resolve(true); }, undefined, () => resolve(false));
    } catch { resolve(false); }
  });
}
export const characterReady = () => !!gltf;

// biểu cảm -> clip
const EMOTE_ANIM = { wave: 'Waving', clap: 'Cheering', heart: 'Waving', laugh: 'Dancing', wow: 'Cheering', popcorn: 'Dancing', thumb: 'Cheering', dance: 'Dancing', phone: 'Phone' };
export const EMOTE_MS = { dance: 9000, phone: 10000, laugh: 4000, popcorn: 4000, wave: 2600, heart: 2600, clap: 3000, wow: 3000, thumb: 3000 };
const SIT_HIP = 0.45; // độ cao hông của clip ngồi
export const sitY = (seatTop, floorY) => Math.max(floorY - 0.02, seatTop - SIT_HIP + 0.05);

const blobGeo = new THREE.CircleGeometry(0.42, 24);
const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });

export function createCharacter() {
  const group = new THREE.Group();
  const blob = new THREE.Mesh(blobGeo, blobMat);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  group.add(blob);

  const model = cloneSkinned(gltf.scene);
  model.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  group.add(model);

  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const clip of gltf.animations) {
    const a = mixer.clipAction(clip);
    a.setLoop(THREE.LoopRepeat, Infinity);
    actions[clip.name] = a;
  }
  let cur = null;
  let curName = '';
  function play(name, ts = 1) {
    const next = actions[name] || actions.Idle;
    if (!next) return;
    next.timeScale = ts;
    if (curName === name) return;
    next.reset().fadeIn(0.25).play();
    if (cur) cur.fadeOut(0.25);
    cur = next; curName = name;
  }
  play('Idle');
  mixer.update(Math.random() * 3); // lệch pha cho khỏi đồng loạt

  function update(dt, st) {
    const e = st.emote && st.emote.until > st.now ? st.emote.type : null;
    if (st.sitting) play('Sitting');
    else if (st.speed > 0.35) {
      if (st.speed < 3.3) play('Walking', THREE.MathUtils.clamp(st.speed / 1.41, 0.7, 2.2));
      else play('Running', THREE.MathUtils.clamp(st.speed / 3.73, 0.8, 1.6));
    } else if (e && EMOTE_ANIM[e]) play(EMOTE_ANIM[e]);
    else play('Idle');
    blob.visible = !st.sitting;
    mixer.update(dt);
  }
  // ---- Trang phục ----
  let bodyMesh = null, baseMat = null;
  model.traverse((o) => { if (o.isMesh && o.name === 'Boy01_Body_Geo') { bodyMesh = o; baseMat = o.material; } });
  const findBone = (n) => model.getObjectByName('mixamorig:' + n) || model.getObjectByName('mixamorig' + n);
  let worn = []; // phụ kiện đang đeo
  let outfitSig = '';
  function setOutfit(eq) {
    eq = eq || {};
    const C = window.CATALOG;
    if (!C) return;
    const sig = JSON.stringify(eq);
    if (sig === outfitSig) return;
    outfitSig = sig;
    if (bodyMesh) bodyMesh.material = bodyMaterialFor(baseMat, eq, C);
    for (const o of worn) o.removeFromParent();
    worn = [];
    for (const slot of ['face', 'head', 'neck', 'back']) {
      const it = C.BY_ID[eq[slot]];
      if (!it || it.slot !== slot || !it.acc) continue;
      const bone = findBone(boneForSlot(slot));
      const acc = bone && buildAccessory(it);
      if (acc) { bone.add(acc); worn.push(acc); }
    }
  }
  function dispose() { mixer.stopAllAction(); group.removeFromParent(); }
  return { group, update, dispose, setOutfit, isChar: true };
}
