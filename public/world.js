// Dựng toàn bộ không gian rạp chiếu phim (Three.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeLabel } from './avatar.js';
import { THEMES, buildExtras, makeDoor, addInteractMarkers, disposeTree } from './themes.js';

const L = window.LAYOUT;
const R = L.ROOM;
const FONT = '"Be Vietnam Pro","Segoe UI",Roboto,system-ui,sans-serif';

// ---------- Texture vẽ bằng canvas ----------
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}
const cloneTex = (t, rx, ry) => {
  const n = t.clone();
  n.needsUpdate = true;
  n.wrapS = n.wrapT = THREE.RepeatWrapping;
  n.repeat.set(rx, ry);
  return n;
};

function carpetTexture(base = '#4a0c19', line = 'rgba(214,172,92,0.34)', dot = 'rgba(214,172,92,0.5)') {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = line;
    c.lineWidth = 2;
    for (let i = -h; i < w + h; i += 64) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i + h, h);
      c.stroke();
      c.beginPath();
      c.moveTo(i + h, 0);
      c.lineTo(i, h);
      c.stroke();
    }
    c.fillStyle = dot;
    for (let x = 32; x < w; x += 64)
      for (let y = 32; y < h; y += 64) {
        c.beginPath();
        c.arc(x, y, 5, 0, 7);
        c.fill();
      }
    for (let i = 0; i < 1600; i++) {
      c.fillStyle = `rgba(0,0,0,${Math.random() * 0.14})`;
      c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

function wallTexture(a = '#2c1020', b = '#46182c') {
  return canvasTex(256, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      c.fillStyle = 'rgba(0,0,0,0.28)';
      c.fillRect(x, 0, 3, h);
      c.fillStyle = 'rgba(255,200,150,0.07)';
      c.fillRect(x + 3, 0, 2, h);
    }
  });
}

function tileTexture(dark = '#1c1b24', light = '#d8ccb2') {
  return canvasTex(128, 128, (c, w, h) => {
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        c.fillStyle = (i + j) % 2 ? dark : light;
        c.fillRect((i * w) / 2, (j * h) / 2, w / 2, h / 2);
      }
  });
}

function rugTexture() {
  return canvasTex(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#7b1224';
    c.beginPath();
    c.arc(128, 128, 126, 0, 7);
    c.fill();
    c.strokeStyle = '#e0b95b';
    c.lineWidth = 6;
    c.beginPath();
    c.arc(128, 128, 112, 0, 7);
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    c.arc(128, 128, 94, 0, 7);
    c.stroke();
    c.fillStyle = '#e0b95b';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.beginPath();
      c.arc(128 + Math.cos(a) * 68, 128 + Math.sin(a) * 68, 7, 0, 7);
      c.fill();
    }
  });
}

function posterTexture(title, sub, hue) {
  return canvasTex(256, 384, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `hsl(${hue},70%,16%)`);
    g.addColorStop(0.6, `hsl(${hue + 30},75%,38%)`);
    g.addColorStop(1, `hsl(${hue + 60},80%,58%)`);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = `hsla(${hue + 180},90%,88%,0.92)`;
    c.beginPath();
    c.arc(w * 0.5, h * 0.36, 46, 0, 7);
    c.fill();
    c.fillStyle = `hsl(${hue},55%,9%)`;
    c.beginPath();
    c.moveTo(0, h * 0.72);
    for (let x = 0; x <= w; x += 12) c.lineTo(x, h * 0.62 + Math.sin(x * 0.05 + hue) * 20 + Math.sin(x * 0.14) * 9);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.fill();
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.font = `800 33px ${FONT}`;
    const words = title.split(' ');
    const lines = [];
    let line = '';
    for (const wd of words) {
      const test = line ? line + ' ' + wd : wd;
      if (c.measureText(test).width > 210 && line) {
        lines.push(line);
        line = wd;
      } else line = test;
    }
    lines.push(line);
    lines.forEach((l, i) => c.fillText(l, w / 2, h * 0.8 + i * 36 - (lines.length - 1) * 14));
    c.font = `600 13px ${FONT}`;
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.fillText(sub, w / 2, h - 22);
    c.strokeStyle = 'rgba(255,255,255,0.65)';
    c.lineWidth = 4;
    c.strokeRect(8, 8, w - 16, h - 16);
  });
}

function neonTexture(text, color, w = 1024, h = 256, size = 120) {
  return canvasTex(w, h, (c) => {
    c.clearRect(0, 0, w, h);
    c.font = `800 ${size}px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = color;
    c.shadowBlur = 40;
    c.fillStyle = color;
    c.fillText(text, w / 2, h / 2 + 6, w - 40);
    c.shadowBlur = 14;
    c.fillStyle = '#ffffff';
    c.fillText(text, w / 2, h / 2 + 6, w - 40);
  });
}

function stripeTexture() {
  return canvasTex(128, 64, (c, w, h) => {
    for (let x = 0; x < w; x += 16) {
      c.fillStyle = (x / 16) % 2 ? '#f4eee2' : '#c0232f';
      c.fillRect(x, 0, 16, h);
    }
  });
}

function arcadeScreenTexture(hue) {
  return canvasTex(64, 64, (c, w, h) => {
    c.fillStyle = '#05050d';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) {
      c.fillStyle = `hsl(${(hue + i * 37) % 360},90%,60%)`;
      c.fillRect(((i * 13) % 56) + 2, ((i * 29) % 56) + 2, 6, 6);
    }
  });
}

// ---------- Tiện ích dựng hình ----------
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}
const lerp = (a, b, t) => a + (b - a) * t;

export function buildWorld(scene, themeId = 'std') {
  const T = THEMES[themeId] || THEMES.std;
  const root = new THREE.Group();
  scene.add(root);
  const H = R.height;
  const centerZ = (R.minZ + R.maxZ) / 2;
  const roomLen = R.maxZ - R.minZ;

  // ===== Ánh sáng =====
  const ambient = new THREE.AmbientLight(T.ambient, 0.62);
  const hemi = new THREE.HemisphereLight(T.hemi[0], T.hemi[1], 0.85);
  root.add(ambient, hemi);
  const sconceLights = [];
  for (const sx of [-1, 1])
    for (const z of [-9, 3, 13]) {
      const l = new THREE.PointLight(T.light, 26, 18, 2);
      l.position.set(sx * 13.5, 5, z);
      root.add(l);
      sconceLights.push(l);
    }
  const screenLight = new THREE.PointLight(0x9bb8ff, 0, 30, 1.5);
  screenLight.position.set(0, 7, -13.5);
  root.add(screenLight);

  // ===== Sàn =====
  const carpet = carpetTexture(...T.carpet);
  const floorFront = new THREE.Mesh(
    new THREE.PlaneGeometry(30, L.ZA - R.minZ),
    std(0xffffff, { map: cloneTex(carpet, 30 / 4, (L.ZA - R.minZ) / 4), roughness: 0.95 })
  );
  floorFront.rotation.x = -Math.PI / 2;
  floorFront.position.set(0, 0, (R.minZ + L.ZA) / 2);
  root.add(floorFront);

  // Bậc thang ghế ngồi (mặt cắt có đoạn dốc nhỏ giống L.heightAt)
  const shape = new THREE.Shape();
  shape.moveTo(L.ZA, -0.1);
  shape.lineTo(L.ZA, 0);
  for (let r = 0; r < L.ROWS; r++) {
    shape.lineTo(L.ZA + r * L.ROW_GAP + L.RAMP * L.ROW_GAP, (r + 1) * L.STEP_H);
    shape.lineTo(L.ZA + (r + 1) * L.ROW_GAP, (r + 1) * L.STEP_H);
  }
  shape.lineTo(R.maxZ, L.TOP_Y);
  shape.lineTo(R.maxZ, -0.1);
  shape.closePath();
  const tiers = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 30, bevelEnabled: false }),
    std(T.tiers, { roughness: 0.95 })
  );
  tiers.rotation.y = -Math.PI / 2;
  tiers.position.x = 15;
  root.add(tiers);

  const ledMat = new THREE.MeshBasicMaterial({ color: T.led, toneMapped: false });
  for (let r = 0; r < L.ROWS; r++) {
    box(29.6, 0.03, 0.07, ledMat, 0, (r + 1) * L.STEP_H + 0.016, L.ZA + r * L.ROW_GAP + L.RAMP * L.ROW_GAP, root);
    // đèn đánh dấu lối đi
    for (const ax of [-5.35, 5.35]) box(0.14, 0.02, 0.14, ledMat, ax, (r + 1) * L.STEP_H + 0.02, L.ROW0_Z + r * L.ROW_GAP, root);
  }

  // Sàn khu sảnh (caro)
  const lobby = new THREE.Mesh(
    new THREE.PlaneGeometry(30, R.maxZ - L.ZB),
    std(0xffffff, { map: cloneTex(tileTexture(...T.tile), 15, (R.maxZ - L.ZB) / 2), roughness: 0.35, metalness: 0.1 })
  );
  lobby.rotation.x = -Math.PI / 2;
  lobby.position.set(0, L.TOP_Y + 0.006, (L.ZB + R.maxZ) / 2);
  root.add(lobby);

  const under = new THREE.Mesh(new THREE.PlaneGeometry(30, roomLen), std(0x120810));
  under.rotation.x = -Math.PI / 2;
  under.position.set(0, -0.02, centerZ);
  root.add(under);

  // ===== Tường & trần =====
  const wallT = wallTexture(...T.wall);
  const matSide = std(0xffffff, { map: cloneTex(wallT, roomLen / 3, 2), roughness: 0.9 });
  const matBack = std(0xffffff, { map: cloneTex(wallT, 10, 2), roughness: 0.9 });
  box(0.5, H, roomLen + 1, matSide, R.minX - 0.25, H / 2, centerZ, root);
  box(0.5, H, roomLen + 1, matSide, R.maxX + 0.25, H / 2, centerZ, root);
  box(31, H, 0.5, matBack, 0, H / 2, R.maxZ + 0.25, root);
  box(31, H, 0.5, std(0x050508), 0, H / 2, R.minZ - 0.25, root);
  box(31, 0.5, roomLen + 1, std(0x0d0d1c, { roughness: 1 }), 0, H + 0.25, centerZ, root);

  // Viền vàng chạy quanh tường
  const gold = std(T.trim, { metalness: 0.75, roughness: 0.3 });
  box(0.08, 0.1, roomLen, gold, R.minX + 0.04, 1.05, centerZ, root);
  box(0.08, 0.1, roomLen, gold, R.maxX - 0.04, 1.05, centerZ, root);
  box(30, 0.1, 0.08, gold, 0, 1.05 + L.TOP_Y, R.maxZ - 0.04, root);
  box(0.08, 0.14, roomLen, gold, R.minX + 0.04, H - 0.9, centerZ, root);
  box(0.08, 0.14, roomLen, gold, R.maxX - 0.04, H - 0.9, centerZ, root);

  // Đèn trần + bầu trời sao
  const ceilBase = new THREE.Color(T.ceil);
  const ceilMat = new THREE.MeshBasicMaterial({ color: ceilBase.clone(), toneMapped: false });
  for (const x of [-9, 0, 9]) box(0.35, 0.05, roomLen - 4, ceilMat, x, H - 0.03, centerZ, root);
  const starPos = new Float32Array(600 * 3);
  for (let i = 0; i < 600; i++) {
    starPos[i * 3] = R.minX + 1 + Math.random() * 28;
    starPos[i * 3 + 1] = H - 0.04;
    starPos[i * 3 + 2] = R.minZ + 1 + Math.random() * (roomLen - 2);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  root.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.85 })));

  // Máy chiếu trên trần (trang trí)
  const proj = new THREE.Group();
  box(0.9, 0.36, 0.8, std(0x2a2a33, { metalness: 0.5 }), 0, 0, 0, proj);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.25, 16), std(0x111118, { metalness: 0.8, roughness: 0.2 }));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0, -0.48);
  proj.add(lens);
  box(0.06, 0.9, 0.06, std(0x1b1b20), 0, 0.6, 0, proj);
  proj.position.set(0, H - 1.5, 15.2);
  root.add(proj);

  // Đèn tường
  const sconceBase = new THREE.Color(T.sconce);
  const sconceMat = new THREE.MeshBasicMaterial({ color: sconceBase.clone(), toneMapped: false });
  for (const z of [-11, -4, 3, 10, 16]) {
    box(0.18, 0.55, 0.3, sconceMat, R.minX + 0.12, 4.2, z, root);
    box(0.18, 0.55, 0.3, sconceMat, R.maxX - 0.12, 4.2, z, root);
  }

  // ===== Sân khấu + màn hình + rèm =====
  const wood = std(0x2b1a12, { roughness: 0.6 });
  box(24, 0.5, 4, wood, 0, 0.25, -15.5, root);
  box(24, 0.05, 0.06, gold, 0, 0.52, -13.52, root);
  const footMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false });
  for (let i = -5; i <= 5; i++) box(0.3, 0.1, 0.12, footMat, i * 2, 0.56, -13.75, root);

  const S = L.SCREEN;
  box(S.w + 0.5, S.h + 0.5, 0.05, new THREE.MeshBasicMaterial({ color: 0x000000 }), S.x, S.y, S.z - 0.05, root);
  const trim = std(T.trim, { metalness: 0.8, roughness: 0.25 });
  box(S.w + 0.8, 0.26, 0.26, trim, S.x, S.y + S.h / 2 + 0.13, S.z + 0.05, root);
  box(S.w + 0.8, 0.26, 0.26, trim, S.x, S.y - S.h / 2 - 0.13, S.z + 0.05, root);
  box(0.26, S.h + 0.5, 0.26, trim, S.x - S.w / 2 - 0.13, S.y, S.z + 0.05, root);
  box(0.26, S.h + 0.5, 0.26, trim, S.x + S.w / 2 + 0.13, S.y, S.z + 0.05, root);

  // "Lỗ" trong suốt: lớp CSS3D chứa video YouTube hiện xuyên qua đây
  const hole = new THREE.Mesh(
    new THREE.PlaneGeometry(S.w, S.h),
    new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, side: THREE.DoubleSide })
  );
  hole.position.set(S.x, S.y, S.z);
  root.add(hole);

  // Rèm nhung xếp nếp
  const curtainMat = std(T.curtain, { roughness: 0.85, side: THREE.DoubleSide, emissive: T.curtainEm });
  const curtainW = R.maxX - (S.w / 2 + 0.1);
  for (const sgn of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(curtainW, 13.2, 64, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin((x / curtainW) * Math.PI * 2 * 6) * 0.2);
    }
    geo.computeVertexNormals();
    const cm = new THREE.Mesh(geo, curtainMat);
    cm.position.set(sgn * (S.w / 2 + 0.1 + curtainW / 2), 6.6, -16.75);
    root.add(cm);
  }
  box(30, 1.2, 0.6, curtainMat, 0, 12.95, -16.65, root);
  box(30, 0.08, 0.62, gold, 0, 12.35, -16.65, root);

  // ===== Ghế ngồi =====
  const rowSeats = L.SEATS.filter((s) => s.kind === 'row');
  const baseGeo = new THREE.BoxGeometry(1.1, 0.26, 0.98).translate(0, 0.38, 0);
  const backGeo = new THREE.BoxGeometry(1.1, 1.0, 0.22).translate(0, 0.98, 0.44).rotateX(0.12);
  const armGeo = mergeGeometries([
    new THREE.BoxGeometry(0.12, 0.34, 0.9).translate(-0.62, 0.58, 0.02),
    new THREE.BoxGeometry(0.12, 0.34, 0.9).translate(0.62, 0.58, 0.02),
    new THREE.BoxGeometry(0.5, 0.3, 0.5).translate(0, 0.15, 0.1),
  ]);
  const velvet = std(T.velvet, { roughness: 0.55 });
  const frame = std(T.frame, { roughness: 0.5, metalness: 0.3 });
  const seatBase = new THREE.InstancedMesh(baseGeo, velvet, rowSeats.length);
  const seatBack = new THREE.InstancedMesh(backGeo, velvet, rowSeats.length);
  const seatArms = new THREE.InstancedMesh(armGeo, frame, rowSeats.length);
  const m4 = new THREE.Matrix4();
  rowSeats.forEach((s, i) => {
    m4.makeTranslation(s.x, s.floorY, s.z);
    seatBase.setMatrixAt(i, m4);
    seatBack.setMatrixAt(i, m4);
    seatArms.setMatrixAt(i, m4);
  });
  [seatBase, seatBack, seatArms].forEach((m) => {
    m.instanceMatrix.needsUpdate = true;
    root.add(m);
  });

  // Chữ cái hàng ghế
  for (let r = 0; r < L.ROWS; r++) {
    for (const sx of [-1, 1]) {
      const lab = makeLabel('ABCDEFGHIJ'[r]);
      lab.scale.multiplyScalar(0.8);
      lab.position.set(sx * 13.6, (r + 1) * L.STEP_H + 0.55, L.ROW0_Z + r * L.ROW_GAP);
      root.add(lab);
    }
  }

  // Ghế lười
  const beanMeshes = [];
  L.BEANBAGS.forEach((b, n) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.7, 22, 16), std(b.color, { roughness: 0.7 }));
    m.scale.set(1.1, 0.62, 1.1);
    m.position.set(b.x, L.TOP_Y + 0.42, b.z);
    m.userData.seat = L.SEATS.find((s) => s.kind === 'bean' && s.col === n + 1).i;
    root.add(m);
    beanMeshes.push(m);
  });

  // Dấu chọn ghế khi rê chuột
  const marker = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x4cff8a, transparent: true, opacity: 0.9, depthTest: false, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 10;
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 4), ringMat);
  arrow.rotation.x = Math.PI;
  arrow.position.y = 1.9;
  arrow.renderOrder = 10;
  marker.add(ring, arrow);
  marker.visible = false;
  root.add(marker);

  // ===== Poster =====
  const posters = [
    ['VŨ TRỤ BÊN KIA', 'SẮP CHIẾU', 215],
    ['MÙA HOA ANH ĐÀO', 'TÌNH CẢM • LÃNG MẠN', 330],
    ['THÁM TỬ MÈO', 'HÀI • PHIÊU LƯU', 35],
    ['BIỂN SÂU', 'KỲ ẢO', 180],
    ['HÀNH TRÌNH XA', 'CHUYỂN THỂ TỪ SÁCH', 100],
    ['ĐÊM HOÀI NIỆM', 'ÂM NHẠC • TÂM LÝ', 270],
  ].map(([t, s, h]) => posterTexture(t, s, h));
  const posterSlots = [
    ...[-11, -6.8, 6.8, 11].map((x) => ({ x, y: 6.8 + L.TOP_Y * 0, z: R.maxZ - 0.06, ry: Math.PI })),
    ...[-9, -2.5, 4, 10.5].map((z) => ({ x: R.minX + 0.06, y: 6.2, z, ry: Math.PI / 2 })),
    ...[-9, -2.5, 4, 10.5].map((z) => ({ x: R.maxX - 0.06, y: 6.2, z, ry: -Math.PI / 2 })),
  ];
  const frameMat = std(0x16110f, { roughness: 0.5 });
  posterSlots.forEach((p, i) => {
    const g = new THREE.Group();
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = p.ry;
    box(2.45, 3.55, 0.06, frameMat, 0, 0, -0.02, g);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.3), new THREE.MeshStandardMaterial({ map: posters[i % posters.length], roughness: 0.6, emissive: 0xffffff, emissiveMap: posters[i % posters.length], emissiveIntensity: 0.18 }));
    pl.position.z = 0.02;
    g.add(pl);
    box(1.4, 0.06, 0.12, sconceMat, 0, 1.95, 0.05, g);
    root.add(g);
  });

  // ===== Biển neon =====
  const neon = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2.5),
    new THREE.MeshBasicMaterial({ map: neonTexture(T.title, T.neon), transparent: true, toneMapped: false, depthWrite: false })
  );
  neon.position.set(0, 10.2, R.maxZ - 0.07);
  neon.rotation.y = Math.PI;
  root.add(neon);
  const neon2 = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 1.3),
    new THREE.MeshBasicMaterial({ map: neonTexture('BẮP RANG • NƯỚC NGỌT', '#ffd24a', 1024, 200, 78), transparent: true, toneMapped: false, depthWrite: false })
  );
  neon2.position.set(-9.25, L.TOP_Y + 3.6, R.maxZ - 0.07);
  neon2.rotation.y = Math.PI;
  root.add(neon2);
  const exitTex = neonTexture('LỐI THOÁT', '#3dff86', 512, 128, 64);
  for (const sx of [-1, 1]) {
    const ex = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: exitTex, transparent: true, toneMapped: false, depthWrite: false }));
    ex.position.set(sx * (R.maxX - 0.07), 8.2, 14);
    ex.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
    root.add(ex);
  }

  // ===== Khu sảnh: quầy bắp, bàn, máy chơi game, cây cảnh =====
  const Y0 = L.TOP_Y;
  const P = L.PROPS;

  // thảm tròn + bàn + ghế đẩu
  const rug = new THREE.Mesh(new THREE.CircleGeometry(3.2, 40), new THREE.MeshStandardMaterial({ map: rugTexture(), transparent: true, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(P.table.x, Y0 + 0.014, P.table.z);
  root.add(rug);
  const tbl = new THREE.Group();
  tbl.position.set(P.table.x, Y0, P.table.z);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(P.table.r, P.table.r, 0.07, 28), std(0xe9dcc0, { roughness: 0.4 }));
  top.position.y = 1.0;
  tbl.add(top);
  tbl.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 10), std(0x2a2a2f)).translateY(0.5));
  tbl.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.05, 20), std(0x2a2a2f)).translateY(0.025));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.12, 16), std(0xc0392b));
    st.position.set(Math.cos(a) * 1.05, 0.62, Math.sin(a) * 1.05);
    tbl.add(st);
    tbl.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), std(0x2a2a2f)).translateX(Math.cos(a) * 1.05).translateY(0.3).translateZ(Math.sin(a) * 1.05));
  }
  root.add(tbl);

  // quầy bắp rang
  const c = P.counter;
  box(c.w, 1.15, c.d, std(0x3b2418, { roughness: 0.55 }), c.x, Y0 + 0.575, c.z, root);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(c.w - 0.2, 0.9), new THREE.MeshStandardMaterial({ map: cloneTex(stripeTexture(), 7, 1), roughness: 0.7 }));
  front.position.set(c.x, Y0 + 0.62, c.z - c.d / 2 - 0.01);
  front.rotation.y = Math.PI;
  root.add(front);
  box(c.w + 0.1, 0.08, c.d + 0.1, gold, c.x, Y0 + 1.17, c.z, root);
  const glass = box(c.w - 0.3, 0.5, c.d - 0.5, new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2 }), c.x, Y0 + 1.46, c.z, root);
  glass.renderOrder = 2;
  const popMat = std(0xfff0b8, { roughness: 0.9 });
  const popGeo = new THREE.IcosahedronGeometry(0.1, 0);
  const pops = new THREE.InstancedMesh(popGeo, popMat, 90);
  for (let i = 0; i < 90; i++) {
    m4.makeTranslation(c.x + (Math.random() - 0.5) * (c.w - 0.8), Y0 + 1.27 + Math.random() * 0.12, c.z + (Math.random() - 0.5) * 0.6);
    pops.setMatrixAt(i, m4);
  }
  root.add(pops);

  // máy bắp rang
  const pm = P.popcornMachine;
  const pmg = new THREE.Group();
  pmg.position.set(pm.x, Y0, pm.z);
  box(0.9, 0.95, 0.9, std(0xc0232f, { roughness: 0.4 }), 0, 0.475, 0, pmg);
  const pmGlass = box(0.82, 0.85, 0.82, new THREE.MeshStandardMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.25, roughness: 0.05 }), 0, 1.38, 0, pmg);
  pmGlass.renderOrder = 2;
  const pops2 = new THREE.InstancedMesh(popGeo, popMat, 70);
  for (let i = 0; i < 70; i++) {
    m4.makeTranslation((Math.random() - 0.5) * 0.65, 1.0 + Math.random() * 0.55, (Math.random() - 0.5) * 0.65);
    pops2.setMatrixAt(i, m4);
  }
  pmg.add(pops2);
  box(1.0, 0.12, 1.0, gold, 0, 1.86, 0, pmg);
  box(0.9, 0.3, 0.9, std(0xc0232f, { roughness: 0.4 }), 0, 2.07, 0, pmg);
  root.add(pmg);

  // máy chơi game
  P.arcade.forEach((a, i) => {
    const g = new THREE.Group();
    g.position.set(a.x, Y0, a.z);
    g.rotation.y = -Math.PI / 2;
    box(0.9, 1.9, 0.8, std(i ? 0x1d3b8b : 0x6a1b9a, { roughness: 0.5 }), 0, 0.95, 0, g);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.52), new THREE.MeshBasicMaterial({ map: arcadeScreenTexture(i * 140), toneMapped: false }));
    scr.position.set(0, 1.38, 0.41);
    scr.rotation.x = -0.15;
    g.add(scr);
    const mq = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.22), new THREE.MeshBasicMaterial({ map: neonTexture('ARCADE', i ? '#4de1ff' : '#ff6bd6', 256, 64, 40), transparent: true, toneMapped: false }));
    mq.position.set(0, 1.78, 0.41);
    g.add(mq);
    box(0.9, 0.08, 0.4, std(0x15151b), 0, 0.98, 0.5, g);
    const stick = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), std(0xff3b3b));
    stick.position.set(-0.15, 1.08, 0.5);
    g.add(stick);
    for (let k = 0; k < 3; k++) {
      const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), std([0xffe14d, 0x4dd2ff, 0x6bff7a][k]));
      bt.position.set(0.08 + k * 0.1, 1.03, 0.5);
      g.add(bt);
    }
    root.add(g);
  });

  // cây cảnh
  P.plants.forEach((p) => {
    const g = new THREE.Group();
    const fy = L.heightAt(p.z);
    g.position.set(p.x, fy, p.z);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.22, 0.5, 14), std(0xb5651d, { roughness: 0.8 }));
    pot.position.y = 0.25;
    g.add(pot);
    const leaf = std(0x2e8b3d, { roughness: 0.7 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), leaf);
      l.scale.set(0.7, 2.0 + (i % 3) * 0.4, 0.7);
      l.position.set(Math.cos(a) * 0.2, 0.9 + (i % 3) * 0.12, Math.sin(a) * 0.2);
      l.rotation.z = Math.cos(a) * 0.5;
      l.rotation.x = -Math.sin(a) * 0.5;
      g.add(l);
    }
    root.add(g);
  });

  // ===== Cổng sang Khu Giải Trí + điểm tương tác =====
  const door = makeDoor(root, L.DOOR_ARCADE.x + 1.8, L.TOP_Y, L.DOOR_ARCADE.z, -Math.PI / 2, 'KHU GIẢI TRÍ', '#ff9a3c', '#ff2d95', 0xd9ad4b);
  const markers = addInteractMarkers(root, L.INTERACT, L.heightAt);
  const extras = buildExtras(themeId, root);

  // ===== API =====
  let dimCur = 0;
  const pickables = [seatBase, seatBack, seatArms, ...beanMeshes];

  function seatFromHit(hit) {
    if (!hit) return null;
    if (hit.object.isInstancedMesh) return hit.instanceId == null ? null : rowSeats[hit.instanceId].i;
    return hit.object.userData.seat ?? null;
  }

  function setMarker(seatIndex, free = true) {
    if (seatIndex == null) {
      marker.visible = false;
      return;
    }
    const s = L.SEATS[seatIndex];
    marker.position.set(s.x, s.floorY + 0.55, s.z);
    ringMat.color.set(free ? 0x4cff8a : 0xff5a5a);
    marker.visible = true;
  }

  function update(dt, t, o) {
    const target = o.dim ? 1 : 0;
    dimCur += (target - dimCur) * (1 - Math.exp(-1.6 * dt));
    const d = dimCur;
    ambient.intensity = lerp(0.62, 0.16, d);
    hemi.intensity = lerp(0.85, 0.2, d);
    for (const l of sconceLights) l.intensity = lerp(26, 6, d);
    sconceMat.color.copy(sconceBase).multiplyScalar(1 - 0.68 * d);
    ceilMat.color.copy(ceilBase).multiplyScalar(1 - 0.93 * d);
    screenLight.intensity = o.playing ? 30 * (0.9 + 0.1 * Math.sin(t * 3.1)) : 0;
    screenLight.color.setHSL((t * 0.015) % 1, 0.35, 0.72);
    door.update(t);
    markers.update(t, d > 0.5);
    if (extras) extras.update(dt, t, { dim: d > 0.5 });
    if (marker.visible) {
      arrow.position.y = 1.9 + Math.sin(t * 5) * 0.08;
      ring.scale.setScalar(1 + Math.sin(t * 5) * 0.05);
    }
  }

  function dispose() {
    disposeTree(root);
  }

  return { kind: 'theater', update, pickables, seatFromHit, setMarker, dispose };
}
