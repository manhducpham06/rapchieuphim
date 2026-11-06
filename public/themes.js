// Chủ đề trang trí theo cấp rạp + các thành phần dùng chung (cửa, vòng sáng tương tác, dọn bộ nhớ).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeLabel } from './avatar.js';

const L = window.LAYOUT;
const R = L.ROOM;
const H = R.height;
const PI = Math.PI;

// ---------- Bảng màu từng cấp ----------
export const THEMES = {
  std: {
    title: 'RẠP CHIẾU PHIM', neon: '#ff5fa8',
    carpet: ['#4a0c19', 'rgba(214,172,92,0.34)', 'rgba(214,172,92,0.5)'], wall: ['#2c1020', '#46182c'],
    tiers: 0x4a0f1d, led: 0xffc766, trim: 0xd9ad4b, ceil: 0xffe3b0, sconce: 0xffcf8a, light: 0xffb870,
    velvet: 0xb3152c, frame: 0x24242b, curtain: 0x8e1226, curtainEm: 0x1e0208,
    tile: ['#1c1b24', '#d8ccb2'], ambient: 0xffe6d0, hemi: [0xfff0e0, 0x3a1020],
  },
  silver: {
    title: 'RẠP BẠC', neon: '#58d8ff',
    carpet: ['#0f2238', 'rgba(190,210,235,0.30)', 'rgba(190,225,255,0.5)'], wall: ['#14202e', '#22364b'],
    tiers: 0x13263b, led: 0x55e0ff, trim: 0xcfd8e3, ceil: 0xdfeeff, sconce: 0x9fd8ff, light: 0x9fd0ff,
    velvet: 0x2f6fb5, frame: 0x9aa7b5, curtain: 0x1f4a8a, curtainEm: 0x050f20,
    tile: ['#243445', '#cfd8e3'], ambient: 0xdfeeff, hemi: [0xe6f1ff, 0x10202e],
  },
  gold: {
    title: 'RẠP VÀNG', neon: '#ffd24a',
    carpet: ['#3a0a1a', 'rgba(245,200,90,0.42)', 'rgba(255,215,110,0.6)'], wall: ['#3a1a10', '#5a2c18'],
    tiers: 0x4a0f1d, led: 0xffd36a, trim: 0xffd15a, ceil: 0xfff0c8, sconce: 0xffd98a, light: 0xffc878,
    velvet: 0x6a1b6e, frame: 0xc9a13a, curtain: 0xb8860b, curtainEm: 0x2a1a02,
    tile: ['#2a1e12', '#f0e4c8'], ambient: 0xfff0d8, hemi: [0xfff2dc, 0x40200c],
  },
  vip: {
    title: 'RẠP KIM CƯƠNG', neon: '#ff4fd8',
    carpet: ['#0a0a14', 'rgba(255,70,200,0.40)', 'rgba(70,230,255,0.55)'], wall: ['#0a0a18', '#161432'],
    tiers: 0x0d0a1c, led: 0xff4fd8, trim: 0x6ee7ff, ceil: 0xb0c8ff, sconce: 0xff6ae0, light: 0xff7ae8,
    velvet: 0xf2f2f7, frame: 0x2a1a40, curtain: 0x2a0a50, curtainEm: 0x14052a,
    tile: ['#12102a', '#2a1c5a'], ambient: 0xb8b0ff, hemi: [0xc0b8ff, 0x1a0a2a],
  },
};

// ---------- Tiện ích ----------
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const basic = (color, o = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...o });
function add(parent, geo, m, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
const ni = (g) => (g.index ? g.toNonIndexed() : g);

/** Giải phóng hình học / vật liệu / texture của một nhánh cảnh */
export function disposeTree(root) {
  const mats = new Set();
  const texs = new Set();
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    ms.forEach((m) => mats.add(m));
    if (o.userData && o.userData.dispose) o.userData.dispose();
  });
  mats.forEach((m) => {
    for (const k of Object.keys(m)) if (m[k] && m[k].isTexture) texs.add(m[k]);
    m.dispose();
  });
  texs.forEach((t) => t.dispose());
  root.removeFromParent();
}

// ---------- Cửa / cổng ----------
function portalTexture(c1, c2) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, c1);
  gr.addColorStop(1, c2);
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(255,255,255,0.16)';
  for (let i = 0; i < 9; i++) g.fillRect(0, i * 30 + 6, 128, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Cổng phát sáng ở sát tường. (x,z) là tâm cổng, ry = hướng mặt cổng nhìn ra phòng */
export function makeDoor(root, x, y0, z, ry, text, c1 = '#2ee6ff', c2 = '#7a3cff', trimColor = 0xdddddd) {
  const g = new THREE.Group();
  g.position.set(x, y0, z);
  g.rotation.y = ry;
  const trim = mat(trimColor, { metalness: 0.7, roughness: 0.3 });
  add(g, new THREE.BoxGeometry(0.25, 3.8, 0.3), trim, -1.35, 1.9, 0);
  add(g, new THREE.BoxGeometry(0.25, 3.8, 0.3), trim, 1.35, 1.9, 0);
  add(g, new THREE.BoxGeometry(2.95, 0.28, 0.3), trim, 0, 3.8, 0);
  const tex = portalTexture(c1, c2);
  const panel = add(g, new THREE.PlaneGeometry(2.45, 3.65), basic(0xffffff, { map: tex }), 0, 1.83, 0.02);
  const label = makeLabel(text);
  label.scale.multiplyScalar(0.9);
  label.position.set(0, 4.15, 0.1);
  g.add(label);
  root.add(g);
  return { group: g, update: (t) => (panel.material.color.setScalar(0.82 + 0.18 * Math.sin(t * 2.2))) };
}

// ---------- Vòng sáng chỉ điểm tương tác ----------
export function addInteractMarkers(root, list, heightAt) {
  const rings = [];
  const gameMat = basic(0xffd24a, { transparent: true, opacity: 0.9, depthWrite: false });
  const doorMat = basic(0x4cf0ff, { transparent: true, opacity: 0.9, depthWrite: false });
  for (const it of list) {
    const ring = add(root, new THREE.RingGeometry(0.55, 0.7, 40), it.type === 'door' ? doorMat : gameMat, it.x, heightAt(it.z) + 0.04, it.z);
    ring.rotation.x = -PI / 2;
    ring.renderOrder = 3;
    rings.push(ring);
    const lab = makeLabel(it.label);
    lab.scale.multiplyScalar(0.62);
    lab.position.set(it.x, heightAt(it.z) + 2.15, it.z);
    root.add(lab);
  }
  return {
    update(t, dim) {
      const s = 1 + Math.sin(t * 3) * 0.07;
      rings.forEach((r) => r.scale.setScalar(s));
      gameMat.opacity = doorMat.opacity = (dim ? 0.45 : 0.9) * (0.75 + 0.25 * Math.sin(t * 3));
    },
  };
}

// ---------- Đèn chùm (gộp hình học để nhẹ máy) ----------
let chandCache = null;
function chandelierGeos() {
  if (chandCache) return chandCache;
  const frame = [ni(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8).translate(0, 1.2, 0)), ni(new THREE.SphereGeometry(0.17, 12, 8))];
  const crystal = [];
  const bulb = [];
  for (let k = 0; k < 3; k++) {
    const r = 0.9 + k * 0.55;
    const yy = -0.2 - k * 0.55;
    frame.push(ni(new THREE.TorusGeometry(r, 0.045, 8, 40).rotateX(PI / 2).translate(0, yy, 0)));
    for (let s = 0; s < 4; s++) frame.push(ni(new THREE.CylinderGeometry(0.02, 0.02, r, 6).rotateZ(PI / 2).translate(r / 2, yy, 0).rotateY((s * PI) / 2)));
    const n = 10 + k * 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      bulb.push(ni(new THREE.SphereGeometry(0.075, 8, 6).translate(cx, yy + 0.15, cz)));
      crystal.push(ni(new THREE.OctahedronGeometry(0.11, 0).scale(0.7, 1.7, 0.7).translate(cx, yy - 0.24, cz)));
    }
  }
  chandCache = { frame: mergeGeometries(frame), crystal: mergeGeometries(crystal), bulb: mergeGeometries(bulb) };
  return chandCache;
}
function chandelier(root, x, z, scale, frameMat, crystalMat, bulbMat) {
  const g = new THREE.Group();
  g.position.set(x, H - 2.4 * scale, z);
  g.scale.setScalar(scale);
  const geo = chandelierGeos();
  g.add(new THREE.Mesh(geo.frame, frameMat), new THREE.Mesh(geo.crystal, crystalMat), new THREE.Mesh(geo.bulb, bulbMat));
  root.add(g);
  return g;
}

function aisleX() {
  return [-5.6, 5.6];
}

/** Sofa đơn giản dựa tường */
function sofa(root, x, z, ry, color, y0) {
  const g = new THREE.Group();
  g.position.set(x, y0, z);
  g.rotation.y = ry;
  const m = mat(color, { roughness: 0.7 });
  add(g, new THREE.BoxGeometry(3, 0.5, 1.1), m, 0, 0.35, 0);
  add(g, new THREE.BoxGeometry(3, 0.8, 0.3), m, 0, 0.85, -0.45);
  add(g, new THREE.BoxGeometry(0.3, 0.7, 1.1), m, -1.5, 0.6, 0);
  add(g, new THREE.BoxGeometry(0.3, 0.7, 1.1), m, 1.5, 0.6, 0);
  root.add(g);
}

function pillars(root, bodyMat, capMat, ringMat, zs, flat) {
  for (const sx of [-1, 1]) {
    for (const z of zs) {
      const x = sx * 14.7;
      const y0 = L.heightAt(z);
      const h = H - y0;
      add(root, new THREE.CylinderGeometry(0.34, 0.4, h, flat ? 12 : 24), bodyMat, x, y0 + h / 2, z).material.flatShading = !!flat;
      add(root, new THREE.CylinderGeometry(0.52, 0.52, 0.3, 24), capMat, x, y0 + 0.15, z);
      add(root, new THREE.CylinderGeometry(0.52, 0.52, 0.3, 24), capMat, x, H - 0.15, z);
      if (ringMat) {
        for (const yy of [y0 + 1.4, H - 2.2]) {
          const r = add(root, new THREE.TorusGeometry(0.38, 0.03, 8, 28), ringMat, x, yy, z);
          r.rotation.x = PI / 2;
        }
      }
    }
  }
}

// ---------- Trang trí bổ sung theo cấp ----------
function silverExtras(root) {
  const steel = mat(0xc7d0dc, { metalness: 0.9, roughness: 0.25 });
  const cyan = basic(0x55e0ff);
  pillars(root, steel, steel, cyan, [-12.5, -6, 0.5, 7, 13.5]);

  // đèn rọi tròn trên trần
  const spotGeo = new THREE.CircleGeometry(0.28, 20).rotateX(PI / 2);
  const spotMat = basic(0xdff2ff);
  const spots = new THREE.InstancedMesh(spotGeo, spotMat, 28);
  const m4 = new THREE.Matrix4();
  let i = 0;
  for (const x of [-12, -6, 0, 6, 12]) for (const z of [-12, -6, 0, 6, 12, 16].slice(0, 6)) if (i < 28) spots.setMatrixAt(i++, m4.makeTranslation(x, H - 0.06, z));
  spots.count = i;
  root.add(spots);

  // chùm sáng xuyên bụi
  const shaftMat = basic(0x9fd8ff, { transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const shaftGeo = new THREE.CylinderGeometry(0.25, 2.1, H - 1.5, 24, 1, true);
  for (const [x, z] of [[-9, -8], [9, -8], [-9, 4], [9, 4], [0, -2], [0, 10]]) add(root, shaftGeo, shaftMat, x, (H - 1.5) / 2 + 1.5, z);

  // dải LED lối đi
  const strip = basic(0x55e0ff);
  for (const ax of aisleX()) {
    for (const off of [-1.3, 1.3]) {
      for (let r = 0; r < L.ROWS; r++) {
        add(root, new THREE.BoxGeometry(0.06, 0.03, L.ROW_GAP - 0.08), strip, ax + off, (r + 1) * L.STEP_H + 0.03, L.ROW0_Z + r * L.ROW_GAP);
      }
    }
  }

  // sofa sảnh + vòng LED quanh sảnh
  sofa(root, -4.2, 17.55, PI, 0x2f6fb5, L.TOP_Y);
  sofa(root, 4.2, 17.55, PI, 0x2f6fb5, L.TOP_Y);
  const lobbyRing = add(root, new THREE.TorusGeometry(2.1, 0.04, 8, 48), cyan, L.PROPS.table.x, L.TOP_Y + 0.05, L.PROPS.table.z);
  lobbyRing.rotation.x = PI / 2;

  return {
    update(dt, t, o) {
      shaftMat.opacity = o.dim ? 0.015 : 0.05 + Math.sin(t * 0.8) * 0.01;
      cyan.color.setRGB(0.33, 0.88, 1).multiplyScalar(o.dim ? 0.35 : 1);
      strip.color.copy(cyan.color);
    },
  };
}

function goldExtras(root) {
  const goldM = mat(0xffd15a, { metalness: 0.9, roughness: 0.22 });
  const crystalM = new THREE.MeshStandardMaterial({ color: 0xfff6dc, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.8, emissive: 0x6a5320, emissiveIntensity: 0.6 });
  const bulbM = basic(0xffe9a8);
  chandelier(root, 0, -3, 1.5, goldM, crystalM, bulbM);
  chandelier(root, 0, 6, 1.5, goldM, crystalM, bulbM);
  chandelier(root, 0, 14.2, 1.25, goldM, crystalM, bulbM);
  chandelier(root, -9, 2, 0.95, goldM, crystalM, bulbM);
  chandelier(root, 9, 2, 0.95, goldM, crystalM, bulbM);

  const marble = mat(0xf2e8d0, { roughness: 0.3 });
  pillars(root, marble, goldM, null, [-12.5, -6, 0.5, 7, 13.5], true);

  // trần ô lưới vàng
  const gridM = mat(0xd9ad4b, { metalness: 0.85, roughness: 0.3 });
  for (let x = -12; x <= 12; x += 6) add(root, new THREE.BoxGeometry(0.15, 0.12, 36), gridM, x, H - 0.06, 0.5);
  for (let z = -15; z <= 17; z += 4) add(root, new THREE.BoxGeometry(30, 0.12, 0.15), gridM, 0, H - 0.06, z);

  // thảm đỏ viền vàng trên hai lối đi
  const red = mat(0x9b0f2c, { roughness: 0.95 });
  const border = mat(0xffd15a, { metalness: 0.6, roughness: 0.5 });
  for (const ax of aisleX()) {
    for (let r = 0; r < L.ROWS; r++) {
      const y = (r + 1) * L.STEP_H + 0.012;
      const z = L.ROW0_Z + r * L.ROW_GAP;
      add(root, new THREE.BoxGeometry(1.5, 0.014, L.ROW_GAP - 0.04), red, ax, y, z);
      for (const s of [-1, 1]) add(root, new THREE.BoxGeometry(0.07, 0.018, L.ROW_GAP - 0.04), border, ax + s * 0.7, y + 0.003, z);
    }
  }

  // tượng vàng hai bên sân khấu
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(sx * 12.2, 0.5, -14.2);
    add(g, new THREE.BoxGeometry(1.1, 1.0, 1.1), marble, 0, 0.5, 0);
    add(g, new THREE.CylinderGeometry(0.28, 0.2, 1.7, 12), goldM, 0, 1.85, 0);
    add(g, new THREE.SphereGeometry(0.26, 16, 12), goldM, 0, 2.95, 0);
    add(g, new THREE.BoxGeometry(0.16, 0.9, 0.16), goldM, -0.34, 2.15, 0).rotation.z = 0.35;
    add(g, new THREE.BoxGeometry(0.16, 0.9, 0.16), goldM, 0.34, 2.15, 0).rotation.z = -0.35;
    root.add(g);
  }

  const bulbBase = bulbM.color.clone();
  return {
    update(dt, t, o) {
      bulbM.color.copy(bulbBase).multiplyScalar(o.dim ? 0.3 : 0.85 + Math.sin(t * 1.3) * 0.15);
      crystalM.emissiveIntensity = o.dim ? 0.15 : 0.6;
    },
  };
}

function vipExtras(root) {
  const neonMats = [];
  const neon = (hue) => {
    const m = basic(0xffffff);
    m.userData.hue = hue;
    neonMats.push(m);
    return m;
  };

  // ống neon dọc hai bên tường + trần + chân sân khấu
  const nA = neon(0.88), nB = neon(0.5), nC = neon(0.12);
  for (const sx of [-1, 1]) {
    add(root, new THREE.BoxGeometry(0.08, 0.08, 34), nA, sx * 14.9, 3.2, 0.5);
    add(root, new THREE.BoxGeometry(0.08, 0.08, 34), nB, sx * 14.9, 10.6, 0.5);
    add(root, new THREE.BoxGeometry(0.08, 6.2, 0.08), nC, sx * 14.9, 6.9, -16.2);
  }
  add(root, new THREE.BoxGeometry(24, 0.08, 0.08), nB, 0, 0.62, -13.4);
  add(root, new THREE.BoxGeometry(29.8, 0.08, 0.08), nA, 0, 12.4, 17.9);

  // vòng neon dưới bàn sảnh
  const ringM = neon(0.6);
  const ring = add(root, new THREE.TorusGeometry(2.3, 0.05, 8, 56), ringM, L.PROPS.table.x, L.TOP_Y + 0.06, L.PROPS.table.z);
  ring.rotation.x = PI / 2;

  // kim cương xoay phía trên sân khấu
  const diaMat = new THREE.MeshStandardMaterial({ color: 0x9bf5ff, emissive: 0x1ab8d8, emissiveIntensity: 1.1, roughness: 0.1, metalness: 0.4, flatShading: true });
  const dia = add(root, new THREE.OctahedronGeometry(1.15, 0), diaMat, 0, 11.4, -12.2);
  dia.scale.set(1, 1.5, 1);
  const orbit = new THREE.Group();
  orbit.position.set(0, 11.4, -12.2);
  const miniGeo = new THREE.OctahedronGeometry(0.28, 0);
  const minis = [];
  for (let i = 0; i < 6; i++) {
    const mm = basic(0xffffff);
    mm.userData.hue = i / 6;
    neonMats.push(mm);
    const d = add(orbit, miniGeo, mm, Math.cos((i / 6) * PI * 2) * 2.2, 0, Math.sin((i / 6) * PI * 2) * 2.2);
    d.scale.set(1, 1.5, 1);
    minis.push(d);
  }
  root.add(orbit);

  // đèn chùm pha lê neon
  const frameM = mat(0x8888aa, { metalness: 0.9, roughness: 0.2 });
  const crystalM = new THREE.MeshStandardMaterial({ color: 0xcfe9ff, roughness: 0.05, transparent: true, opacity: 0.75, emissive: 0x5a8cff, emissiveIntensity: 0.8 });
  const bulbM = neon(0.55);
  chandelier(root, 0, 2, 1.3, frameM, crystalM, bulbM);
  chandelier(root, 0, 12.5, 1.1, frameM, crystalM, bulbM);

  // sao nhấp nháy + đom đóm
  const mkPoints = (n, size, color, opacity, y0, spread) => {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = R.minX + 1 + Math.random() * 28;
      pos[i * 3 + 1] = y0 + Math.random() * spread;
      pos[i * 3 + 2] = R.minZ + 1 + Math.random() * (R.maxZ - R.minZ - 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(geo, m);
    root.add(pts);
    return { pts, pos, geo, m, base: Float32Array.from(pos) };
  };
  const stars = mkPoints(260, 3, 0xcfe0ff, 0.9, R.height - 0.08, 0);
  const flies = mkPoints(70, 4.5, 0xffe9a0, 0.9, 1.5, 7);

  // hai đèn màu chạy
  const lA = new THREE.PointLight(0xff4fd8, 18, 22, 2);
  lA.position.set(-9, 9, -9);
  const lB = new THREE.PointLight(0x4fe8ff, 18, 22, 2);
  lB.position.set(9, 9, -9);
  root.add(lA, lB);

  const col = new THREE.Color();
  return {
    update(dt, t, o) {
      const k = o.dim ? 0.3 : 1;
      for (const m of neonMats) {
        col.setHSL((m.userData.hue + t * 0.05) % 1, 1, 0.58).multiplyScalar(k);
        m.color.copy(col);
      }
      dia.rotation.y = t * 0.8;
      dia.position.y = 11.4 + Math.sin(t * 1.1) * 0.25;
      orbit.rotation.y = -t * 0.5;
      orbit.position.y = dia.position.y;
      diaMat.emissiveIntensity = o.dim ? 0.3 : 0.9 + Math.sin(t * 2) * 0.3;
      stars.m.opacity = (o.dim ? 0.35 : 0.65) + Math.sin(t * 2.3) * 0.25;
      const p = flies.pos;
      for (let i = 0; i < 70; i++) {
        p[i * 3] = flies.base[i * 3] + Math.sin(t * 0.4 + i) * 1.2;
        p[i * 3 + 1] = flies.base[i * 3 + 1] + Math.sin(t * 0.6 + i * 1.7) * 0.8;
        p[i * 3 + 2] = flies.base[i * 3 + 2] + Math.cos(t * 0.35 + i * 0.9) * 1.2;
      }
      flies.geo.attributes.position.needsUpdate = true;
      flies.m.opacity = o.dim ? 0.3 : 0.9;
      lA.intensity = lB.intensity = o.dim ? 4 : 18;
      lA.color.setHSL((t * 0.05) % 1, 1, 0.6);
      lB.color.setHSL((t * 0.05 + 0.5) % 1, 1, 0.6);
    },
  };
}

export function buildExtras(themeId, root) {
  if (themeId === 'silver') return silverExtras(root);
  if (themeId === 'gold') return goldExtras(root);
  if (themeId === 'vip') return vipExtras(root);
  return null;
}
