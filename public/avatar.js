// Nhân vật low-poly dựng từ hình khối, cùng các nhãn tên / bong bóng chat / emoji nổi.
import * as THREE from 'three';
import { EMOTE_META, iconImage } from './icons.js';

export const LOOK_DEFS = {
  shirt: [0xe74c3c, 0xe67e22, 0xf1c40f, 0x2ecc71, 0x1abc9c, 0x3498db, 0x9b59b6, 0xe84393, 0xecf0f1, 0x2d3436],
  skin: [0xffdcb8, 0xf5c9a0, 0xe0ac85, 0xc68642, 0x8d5524, 0x5c3a21],
  hair: [0x1b1b1b, 0x4a2c17, 0x8a5a2b, 0xd8b04a, 0xc0392b, 0x9aa5a8],
  hatNames: ['Không', 'Mũ lưỡi trai', 'Mũ len', 'Tai nghe', 'Kính râm', 'Vương miện'],
};
export const HIP_Y = 0.72; // độ cao hông khi đứng

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

// Hình học dùng chung để tiết kiệm bộ nhớ
const G = {
  torso: new THREE.CapsuleGeometry(0.22, 0.3, 4, 12),
  head: new THREE.SphereGeometry(0.21, 20, 16),
  hairCap: new THREE.SphereGeometry(0.228, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
  eye: new THREE.SphereGeometry(0.028, 8, 8),
  upperArm: new THREE.CapsuleGeometry(0.07, 0.2, 3, 8),
  lowerArm: new THREE.CapsuleGeometry(0.063, 0.18, 3, 8),
  hand: new THREE.SphereGeometry(0.07, 8, 8),
  thigh: new THREE.CapsuleGeometry(0.09, 0.22, 3, 8),
  shin: new THREE.CapsuleGeometry(0.08, 0.2, 3, 8),
  shoe: new THREE.BoxGeometry(0.16, 0.09, 0.27),
  blob: new THREE.CircleGeometry(0.36, 20),
  mouth: new THREE.BoxGeometry(0.07, 0.014, 0.01),
};
const M = {
  eye: new THREE.MeshBasicMaterial({ color: 0x151515 }),
  mouth: new THREE.MeshBasicMaterial({ color: 0x7a2a2a }),
  pants: new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.9 }),
  shoe: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 }),
  blob: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
  gold: new THREE.MeshStandardMaterial({ color: 0xf1c40f, metalness: 0.7, roughness: 0.3 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1d1d22, roughness: 0.5 }),
  lens: new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.2, metalness: 0.4 }),
};
const matCache = new Map();
function std(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.75 }));
  return matCache.get(color);
}

function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}

function buildHat(id, head) {
  const g = new THREE.Group();
  if (id === 1) {
    // mũ lưỡi trai
    const cap = mesh(new THREE.SphereGeometry(0.238, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), std(0xd63031), 0, 0.13, -0.005, g);
    cap.rotation.x = -0.1;
    mesh(new THREE.BoxGeometry(0.28, 0.02, 0.17), std(0xb71c1c), 0, 0.135, 0.2, g).rotation.x = 0.12;
  } else if (id === 2) {
    // mũ len
    mesh(new THREE.SphereGeometry(0.24, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), std(0x2e86de), 0, 0.12, -0.01, g);
    mesh(new THREE.TorusGeometry(0.225, 0.035, 8, 24), std(0x1b5fa8), 0, 0.105, 0, g).rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.055, 10, 8), std(0xffffff), 0, 0.37, -0.01, g);
  } else if (id === 3) {
    // tai nghe
    const band = mesh(new THREE.TorusGeometry(0.24, 0.02, 8, 24, Math.PI), M.dark, 0, 0.12, 0, g);
    band.rotation.z = 0;
    for (const s of [-1, 1]) {
      const cup = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 14), std(0xff4081), s * 0.235, 0.12, 0, g);
      cup.rotation.z = Math.PI / 2;
    }
  } else if (id === 4) {
    // kính râm
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.1, 0.07, 0.015), M.lens, s * 0.082, 0.14, 0.2, g);
    mesh(new THREE.BoxGeometry(0.06, 0.012, 0.012), M.dark, 0, 0.15, 0.2, g);
  } else if (id === 5) {
    // vương miện
    mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.06, 14), M.gold, 0, 0.35, 0, g);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      mesh(new THREE.ConeGeometry(0.04, 0.12, 4), M.gold, Math.sin(a) * 0.14, 0.44, Math.cos(a) * 0.14, g);
    }
  }
  head.add(g);
  return g;
}

export function createAvatar(look = {}) {
  const shirt = LOOK_DEFS.shirt[look.shirt | 0] ?? LOOK_DEFS.shirt[0];
  const skin = LOOK_DEFS.skin[look.skin | 0] ?? LOOK_DEFS.skin[0];
  const hair = LOOK_DEFS.hair[look.hair | 0] ?? LOOK_DEFS.hair[0];
  const skinMat = std(skin);

  const group = new THREE.Group();
  const blob = mesh(G.blob, M.blob, 0, 0.02, 0, group);
  blob.rotation.x = -Math.PI / 2;

  const body = new THREE.Group();
  group.add(body);

  mesh(G.torso, std(shirt), 0, 1.05, 0, body);

  // Đầu
  const head = new THREE.Group();
  head.position.set(0, 1.5, 0);
  body.add(head);
  mesh(G.head, skinMat, 0, 0.12, 0, head);
  const hairMesh = mesh(G.hairCap, std(hair), 0, 0.125, -0.012, head);
  hairMesh.rotation.x = -0.28;
  for (const s of [-1, 1]) mesh(G.eye, M.eye, s * 0.075, 0.14, 0.188, head);
  mesh(G.mouth, M.mouth, 0, 0.05, 0.2, head);
  buildHat(look.hat | 0, head);

  // Tay: pivot ở vai -> khuỷu
  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.31, 1.33, 0);
    body.add(shoulder);
    mesh(G.upperArm, std(shirt), 0, -0.17, 0, shoulder);
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.3, 0);
    shoulder.add(elbow);
    mesh(G.lowerArm, skinMat, 0, -0.14, 0, elbow);
    mesh(G.hand, skinMat, 0, -0.29, 0, elbow);
    return { shoulder, elbow };
  }
  // Chân: pivot ở hông -> gối
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.115, HIP_Y, 0);
    body.add(hip);
    mesh(G.thigh, M.pants, 0, -0.2, 0, hip);
    const knee = new THREE.Group();
    knee.position.set(0, -0.38, 0);
    hip.add(knee);
    mesh(G.shin, M.pants, 0, -0.18, 0, knee);
    mesh(G.shoe, M.shoe, 0, -0.37, 0.05, knee);
    return { hip, knee };
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  const a = { phase: Math.random() * 6, walk: 0, t: Math.random() * 10 };
  const cur = {
    lh: 0, rh: 0, lk: 0, rk: 0, lax: 0, rax: 0, laz: 0, raz: 0, lex: 0, rex: 0, bz: 0, by: 0, hy: 0,
  };
  const damp = (v, target, k) => v + (target - v) * k;

  /**
   * dt: giây; st = { speed, sitting, emote: {type, until}|null, drop, now }
   * drop: nhân vật đang bị hạ thấp bao nhiêu (ngồi) để vẽ bóng đúng chỗ.
   */
  function update(dt, st) {
    a.t += dt;
    const sitting = !!st.sitting;
    const walkTarget = sitting ? 0 : Math.min(st.speed / 3.2, 1.3);
    a.walk = damp(a.walk, walkTarget, Math.min(1, dt * 10));
    a.phase += dt * (4 + st.speed * 1.5) * (a.walk > 0.05 ? 1 : 0);
    const sw = Math.sin(a.phase);
    const k = Math.min(1, dt * 14);

    let t = {
      lh: sitting ? -1.5 : sw * 0.8 * a.walk,
      rh: sitting ? -1.5 : -sw * 0.8 * a.walk,
      lk: sitting ? 1.5 : Math.max(0, -sw) * 0.9 * a.walk,
      rk: sitting ? 1.5 : Math.max(0, sw) * 0.9 * a.walk,
      lax: sitting ? -0.55 : -sw * 0.7 * a.walk,
      rax: sitting ? -0.55 : sw * 0.7 * a.walk,
      laz: 0,
      raz: 0,
      lex: sitting ? -0.6 : -0.15 - 0.2 * a.walk,
      rex: sitting ? -0.6 : -0.15 - 0.2 * a.walk,
      bz: 0,
      by: Math.sin(a.t * 2) * 0.006 + (a.walk > 0.1 ? Math.abs(sw) * 0.03 * a.walk : 0),
      hy: 0,
    };

    const e = st.emote && st.emote.until > st.now ? st.emote.type : null;
    if (e) {
      const s = st.now / 1000;
      if (e === 'wave') {
        t.raz = 2.5 + Math.sin(s * 11) * 0.28;
        t.rax = 0;
        t.rex = -0.3;
      } else if (e === 'clap') {
        const c = 0.32 + 0.26 * Math.sin(s * 15);
        t.lax = t.rax = -1.3;
        t.lex = t.rex = -0.95;
        t.laz = c;
        t.raz = -c;
      } else if (e === 'thumb') {
        t.rax = -1.9;
        t.rex = -1.2;
        t.raz = -0.1;
      } else if (e === 'laugh') {
        t.bz = Math.sin(s * 22) * 0.06;
        t.by = Math.abs(Math.sin(s * 11)) * 0.05;
        t.lax = -0.9;
        t.rax = -0.9;
        t.lex = t.rex = -1.0;
      } else if (e === 'wow') {
        t.by = Math.abs(Math.sin(s * 7)) * 0.1;
        t.laz = -2.3;
        t.raz = 2.3;
        t.lax = t.rax = 0;
      } else if (e === 'heart') {
        t.laz = -2.6;
        t.raz = 2.6;
        t.lax = t.rax = 0;
        t.by = Math.sin(s * 5) * 0.03;
      } else if (e === 'popcorn') {
        t.rax = -2.0;
        t.rex = -1.6 + Math.sin(s * 14) * 0.15;
      }
    }

    for (const key of Object.keys(t)) cur[key] = damp(cur[key], t[key], k);

    legL.hip.rotation.x = cur.lh;
    legR.hip.rotation.x = cur.rh;
    legL.knee.rotation.x = cur.lk;
    legR.knee.rotation.x = cur.rk;
    armL.shoulder.rotation.x = cur.lax;
    armR.shoulder.rotation.x = cur.rax;
    armL.shoulder.rotation.z = cur.laz;
    armR.shoulder.rotation.z = cur.raz;
    armL.elbow.rotation.x = cur.lex;
    armR.elbow.rotation.x = cur.rex;
    body.rotation.z = cur.bz;
    body.position.y = cur.by;
    blob.position.y = 0.02 + (st.drop || 0);
    blob.scale.setScalar(sitting ? 1.15 : 1 - Math.min(cur.by * 2, 0.2));
  }

  function dispose() {
    group.removeFromParent();
  }

  return { group, update, dispose, head };
}

// ---------- Nhãn chữ (sprite) ----------
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const FONT = '"Be Vietnam Pro", "Segoe UI", Roboto, system-ui, sans-serif';

function spriteFromCanvas(canvas, scaleDiv, depthTest = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(canvas.width / scaleDiv, canvas.height / scaleDiv, 1);
  sp.userData.dispose = () => {
    tex.dispose();
    mat.dispose();
  };
  return sp;
}

/** Nhãn tên nằm trên đầu nhân vật */
export function makeLabel(text, { self = false } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const fs = 30;
  ctx.font = `600 ${fs}px ${FONT}`;
  const w = Math.min(420, Math.ceil(ctx.measureText(text).width) + 36);
  c.width = w;
  c.height = 52;
  ctx.font = `600 ${fs}px ${FONT}`;
  roundRect(ctx, 1, 1, w - 2, 50, 24);
  ctx.fillStyle = 'rgba(12,10,20,0.62)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = self ? '#f5c451' : 'rgba(255,255,255,0.28)';
  ctx.stroke();
  ctx.fillStyle = self ? '#ffe9a8' : '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, 27, w - 24);
  const sp = spriteFromCanvas(c, 150);
  sp.center.set(0.5, 0);
  return sp;
}

/** Bong bóng chat trên đầu */
export function makeBubble(text) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const fs = 28;
  const maxW = 380;
  ctx.font = `500 ${fs}px ${FONT}`;
  // ngắt dòng theo từ
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 4);
  if (lines.length > 4) shown[3] = shown[3].replace(/.{0,2}$/, '…');
  const textW = Math.max(...shown.map((l) => ctx.measureText(l).width));
  const w = Math.ceil(Math.min(maxW, textW)) + 40;
  const lh = 36;
  const h = shown.length * lh + 30;
  c.width = w;
  c.height = h + 14;
  ctx.font = `500 ${fs}px ${FONT}`;
  roundRect(ctx, 2, 2, w - 4, h - 4, 18);
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fill();
  // đuôi bong bóng
  ctx.beginPath();
  ctx.moveTo(w / 2 - 10, h - 3);
  ctx.lineTo(w / 2, h + 11);
  ctx.lineTo(w / 2 + 10, h - 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1b1b24';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  shown.forEach((l, i) => ctx.fillText(l, w / 2, 17 + lh / 2 + i * lh + 2, maxW));
  const sp = spriteFromCanvas(c, 150);
  sp.center.set(0.5, 0);
  return sp;
}

/** Huy hiệu biểu cảm nổi lên trên đầu: vòng tròn có màu + icon vector trắng */
export function makeEmote(key) {
  const meta = EMOTE_META.find((e) => e.key === key) || EMOTE_META[0];
  const S = 160;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const base = new THREE.Color(meta.color);
  const light = '#' + base.clone().lerp(new THREE.Color(0xffffff), 0.35).getHexString();
  const dark = '#' + base.clone().multiplyScalar(0.62).getHexString();
  const cx = S / 2, cy = S / 2 - 4, r = 56;
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  const g = ctx.createRadialGradient(cx - 18, cy - 22, 6, cx, cy, r);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.stroke();
  const sp = spriteFromCanvas(c, 190, false);
  const img = iconImage(meta.icon, '#ffffff');
  const paint = () => {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 6;
    ctx.drawImage(img, cx - 33, cy - 33, 66, 66);
    ctx.restore();
    if (sp.material.map) sp.material.map.needsUpdate = true;
  };
  if (img.complete && img.naturalWidth) paint();
  else img.addEventListener('load', paint, { once: true });
  return sp;
}

export function disposeSprite(sp) {
  if (!sp) return;
  sp.removeFromParent();
  if (sp.userData.dispose) sp.userData.dispose();
}

export { hex };
