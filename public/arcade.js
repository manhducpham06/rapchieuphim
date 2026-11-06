// Khu Giải Trí: sân đá bóng mini, máy gắp thú, máy game, cổng về sảnh rạp.
import * as THREE from 'three';
import { makeLabel } from './avatar.js';
import { makeDoor, addInteractMarkers, disposeTree } from './themes.js';

const L = window.LAYOUT;
const A = L.ARCADE;
const R = A.ROOM;
const P = A.PITCH;
const PI = Math.PI;
const FONT = '"Be Vietnam Pro","Segoe UI",Roboto,system-ui,sans-serif';

// ---------- texture ----------
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
function neonTex(text, color, w = 512, h = 128, size = 70) {
  return canvasTex(w, h, (c) => {
    c.clearRect(0, 0, w, h);
    c.font = `800 ${size}px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = color;
    c.shadowBlur = 28;
    c.fillStyle = color;
    c.fillText(text, w / 2, h / 2 + 4, w - 30);
    c.shadowBlur = 10;
    c.fillStyle = '#fff';
    c.fillText(text, w / 2, h / 2 + 4, w - 30);
  });
}
function floorTex() {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#0d0a22';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(110,80,255,0.45)';
    c.lineWidth = 2;
    for (let i = 0; i <= w; i += 64) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke();
      c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke();
    }
    c.fillStyle = 'rgba(70,230,255,0.5)';
    for (let x = 32; x < w; x += 128) for (let y = 32; y < h; y += 128) { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,70,200,0.5)';
    for (let x = 96; x < w; x += 128) for (let y = 96; y < h; y += 128) { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); }
  }, [30 / 4, 30 / 4]);
}
function wallTex() {
  return canvasTex(256, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a0c33');
    g.addColorStop(1, '#341560');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      c.fillStyle = 'rgba(255,255,255,0.05)';
      c.fillRect(x, 0, 2, h);
    }
    c.fillStyle = 'rgba(255,90,210,0.35)';
    for (let x = 16; x < w; x += 64) c.fillRect(x, h * 0.62, 28, 4);
    c.fillStyle = 'rgba(80,230,255,0.35)';
    for (let x = 48; x < w; x += 64) c.fillRect(x, h * 0.66, 28, 4);
  }, [8, 2]);
}
function grassTex() {
  const W = 1024;
  const Hh = Math.round((W * (2 * P.hz)) / (2 * P.hx));
  return canvasTex(W, Hh, (c, w, h) => {
    const bands = 10;
    for (let i = 0; i < bands; i++) {
      c.fillStyle = i % 2 ? '#2f9e4a' : '#38b055';
      c.fillRect((i * w) / bands, 0, w / bands + 1, h);
    }
    const px = w / (2 * P.hx);
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 5;
    c.strokeRect(6, 6, w - 12, h - 12);
    c.beginPath(); c.moveTo(w / 2, 6); c.lineTo(w / 2, h - 6); c.stroke();
    c.beginPath(); c.arc(w / 2, h / 2, 1.5 * px, 0, 7); c.stroke();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(w / 2, h / 2, 5, 0, 7); c.fill();
    const boxW = 2.6 * px, boxH = 6 * px * 0.55;
    c.strokeRect(6, h / 2 - boxH / 2, boxW, boxH);
    c.strokeRect(w - 6 - boxW, h / 2 - boxH / 2, boxW, boxH);
    const gaW = 1.0 * px, gaH = 2 * P.goalHalf * px;
    c.strokeRect(6, h / 2 - gaH / 2, gaW, gaH);
    c.strokeRect(w - 6 - gaW, h / 2 - gaH / 2, gaW, gaH);
  });
}
function netTex() {
  return canvasTex(64, 64, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.75)';
    c.lineWidth = 2;
    for (let i = 0; i <= w; i += 16) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke();
      c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke();
    }
  }, [3, 2]);
}
function ballTex() {
  return canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#fafafa';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#1b1b22';
    const pts = [[32, 30], [96, 62], [160, 30], [224, 62], [64, 100], [128, 14], [192, 100], [250, 22], [8, 80]];
    for (const [x, y] of pts) {
      c.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * PI * 2 - PI / 2;
        const px = x + Math.cos(a) * 15, py = y + Math.sin(a) * 15;
        i ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.closePath();
      c.fill();
    }
  });
}
function screenTex(hue) {
  return canvasTex(64, 64, (c, w, h) => {
    c.fillStyle = '#05050d';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `hsl(${(hue + i * 37) % 360},90%,60%)`;
      c.fillRect(((i * 13) % 52) + 3, ((i * 29) % 52) + 3, 6, 6);
    }
    c.fillStyle = '#fff';
    c.fillRect(26, 46, 12, 4);
  });
}

// ---------- hình khối ----------
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const basic = (color, o = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...o });
function add(parent, geo, m, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

const PLUSH_COLORS = [0xff5f7e, 0xffd24a, 0x5fb4ff, 0x3fd6c0, 0xb77bff, 0xff8a4c, 0xffffff, 0x7bff9a];

function clawMachine(root, x, z, idx) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = PI / 2; // mặt máy hướng +x
  const body = mat(idx ? 0x2a6bd6 : 0xd6336c, { roughness: 0.4 });
  const steel = mat(0xcfd6e0, { metalness: 0.8, roughness: 0.3 });
  add(g, new THREE.BoxGeometry(1.9, 1.0, 1.7), body, 0, 0.5, 0);
  // bảng điều khiển nghiêng
  const panel = add(g, new THREE.BoxGeometry(1.9, 0.12, 0.6), mat(0x15151b), 0, 1.04, 0.72);
  panel.rotation.x = -0.25;
  const stick = add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), steel, -0.3, 1.16, 0.74);
  add(g, new THREE.SphereGeometry(0.07, 12, 8), mat(0xff3b3b), -0.3, 1.28, 0.74);
  add(g, new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16), mat(0x43ff7a, { emissive: 0x1a8a3a }), 0.35, 1.1, 0.74);
  // khung kính
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, new THREE.BoxGeometry(0.1, 1.9, 0.1), steel, sx * 0.9, 1.95, sz * 0.8);
  const glass = new THREE.MeshStandardMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide });
  add(g, new THREE.BoxGeometry(1.7, 1.8, 1.5), glass, 0, 1.95, 0).renderOrder = 2;
  add(g, new THREE.BoxGeometry(1.9, 0.12, 1.7), steel, 0, 2.9, 0);
  // biển đèn
  const mq = add(g, new THREE.BoxGeometry(1.9, 0.55, 1.7), mat(0x1a0f2e), 0, 3.22, 0);
  const sign = add(g, new THREE.PlaneGeometry(1.8, 0.45), basic(0xffffff, { map: neonTex('GẮP THÚ', idx ? '#4de1ff' : '#ff6bd6', 512, 128, 76), transparent: true }), 0, 3.22, 0.86);
  sign.renderOrder = 3;
  // thú bông
  const ear = new THREE.SphereGeometry(0.055, 8, 6);
  const bodyG = new THREE.SphereGeometry(0.19, 12, 10);
  const headG = new THREE.SphereGeometry(0.15, 12, 10);
  for (let i = 0; i < 13; i++) {
    const col = PLUSH_COLORS[(i + idx * 3) % PLUSH_COLORS.length];
    const m = mat(col, { roughness: 0.9 });
    const px = (((i * 37) % 11) / 10 - 0.5) * 1.2;
    const pz = (((i * 53) % 9) / 8 - 0.5) * 1.0;
    const py = 1.15 + (i % 3) * 0.15;
    const p = new THREE.Group();
    p.position.set(px, py, pz);
    p.rotation.y = i * 1.3;
    add(p, bodyG, m, 0, 0, 0);
    add(p, headG, m, 0, 0.24, 0.02);
    add(p, ear, m, -0.1, 0.38, 0);
    add(p, ear, m, 0.1, 0.38, 0);
    add(p, new THREE.SphereGeometry(0.02, 6, 6), basic(0x111111), -0.05, 0.27, 0.14);
    add(p, new THREE.SphereGeometry(0.02, 6, 6), basic(0x111111), 0.05, 0.27, 0.14);
    g.add(p);
  }
  // móc
  const claw = new THREE.Group();
  claw.position.set(0, 2.75, 0);
  add(claw, new THREE.CylinderGeometry(0.015, 0.015, 1, 6), steel, 0, 0.5, 0);
  add(claw, new THREE.CylinderGeometry(0.1, 0.1, 0.1, 12), steel, 0, 0, 0);
  const prongs = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * PI * 2;
    const pr = new THREE.Group();
    pr.position.set(Math.cos(a) * 0.08, -0.05, Math.sin(a) * 0.08);
    pr.rotation.y = -a;
    const arm = add(pr, new THREE.BoxGeometry(0.03, 0.26, 0.03), steel, 0.05, -0.13, 0);
    arm.rotation.z = 0.35;
    prongs.push(pr);
    claw.add(pr);
  }
  g.add(claw);
  root.add(g);
  return {
    update(t) {
      const ph = t * 0.6 + idx * 2;
      claw.position.x = Math.sin(ph) * 0.5;
      claw.position.z = Math.sin(ph * 0.7 + 1) * 0.4;
      const dip = Math.max(0, Math.sin(t * 0.8 + idx));
      claw.position.y = 2.75 - dip * dip * 0.9;
      const open = 0.35 + (dip > 0.9 ? 0 : 0.25) ;
      prongs.forEach((pr) => (pr.children[0].rotation.z = open + (dip > 0.85 ? -0.25 : 0)));
    },
  };
}

function cabinet(root, x, z, hue, label, color) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = -PI / 2; // mặt máy hướng -x
  add(g, new THREE.BoxGeometry(0.9, 1.9, 0.8), mat(color, { roughness: 0.5 }), 0, 0.95, 0);
  const scr = add(g, new THREE.PlaneGeometry(0.66, 0.52), basic(0xffffff, { map: screenTex(hue) }), 0, 1.38, 0.41);
  scr.rotation.x = -0.15;
  const mq = add(g, new THREE.PlaneGeometry(0.84, 0.22), basic(0xffffff, { map: neonTex(label, `hsl(${hue},100%,65%)`, 256, 64, 40), transparent: true }), 0, 1.78, 0.41);
  mq.renderOrder = 3;
  add(g, new THREE.BoxGeometry(0.9, 0.08, 0.4), mat(0x15151b), 0, 0.98, 0.5);
  add(g, new THREE.SphereGeometry(0.05, 10, 8), mat(0xff3b3b), -0.15, 1.08, 0.5);
  for (let k = 0; k < 3; k++) add(g, new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), mat([0xffe14d, 0x4dd2ff, 0x6bff7a][k]), 0.08 + k * 0.1, 1.03, 0.5);
  root.add(g);
}

function bench(root, x, z) {
  const wood = mat(0x4a2c1a, { roughness: 0.7 });
  add(root, new THREE.BoxGeometry(2.6, 0.12, 0.7), wood, x, 0.5, z);
  add(root, new THREE.BoxGeometry(2.6, 0.55, 0.1), wood, x, 0.85, z + 0.3);
  for (const s of [-1, 1]) add(root, new THREE.BoxGeometry(0.1, 0.5, 0.6), mat(0x222222), x + s * 1.15, 0.25, z);
}

function plant(root, x, z) {
  add(root, new THREE.CylinderGeometry(0.32, 0.22, 0.5, 14), mat(0xb5651d), x, 0.25, z);
  const leaf = mat(0x2e8b3d, { roughness: 0.7 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * PI * 2;
    const l = add(root, new THREE.SphereGeometry(0.22, 10, 8), leaf, x + Math.cos(a) * 0.2, 0.9 + (i % 3) * 0.12, z + Math.sin(a) * 0.2);
    l.scale.set(0.7, 2.0 + (i % 3) * 0.4, 0.7);
  }
}

function goal(root, sgn) {
  const g = new THREE.Group();
  g.position.set(P.cx + sgn * P.hx, 0, P.cz);
  const white = mat(0xffffff, { roughness: 0.3 });
  const hgt = 1.9;
  for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.07, 0.07, hgt, 10), white, 0, hgt / 2, s * P.goalHalf);
  add(g, new THREE.CylinderGeometry(0.07, 0.07, P.goalHalf * 2, 10), white, 0, hgt, 0).rotation.x = PI / 2;
  const nt = netTex();
  const nm = new THREE.MeshBasicMaterial({ map: nt, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.9 });
  const d = P.goalDepth;
  const back = add(g, new THREE.PlaneGeometry(P.goalHalf * 2, hgt), nm, sgn * d, hgt / 2, 0);
  back.rotation.y = PI / 2;
  const top = add(g, new THREE.PlaneGeometry(d, P.goalHalf * 2), nm, sgn * d / 2, hgt, 0);
  top.rotation.set(-PI / 2, 0, PI / 2);
  for (const s of [-1, 1]) {
    const side = add(g, new THREE.PlaneGeometry(d, hgt), nm, sgn * d / 2, hgt / 2, s * P.goalHalf);
  }
  root.add(g);
}

export function buildArcade(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const H = R.height;
  const cx = 0, cz = 0, W = 30, D = 30;

  // ===== ánh sáng =====
  const ambient = new THREE.AmbientLight(0xcfc4ff, 0.75);
  const hemi = new THREE.HemisphereLight(0xdcd0ff, 0x2a1048, 0.9);
  root.add(ambient, hemi);
  const lights = [new THREE.PointLight(0xff4fd8, 30, 26, 2), new THREE.PointLight(0x4fe8ff, 30, 26, 2), new THREE.PointLight(0xffe066, 22, 22, 2)];
  lights[0].position.set(-8, 7, -8);
  lights[1].position.set(8, 7, -8);
  lights[2].position.set(0, 7, 8);
  lights.forEach((l) => root.add(l));

  // ===== sàn, tường, trần =====
  const floor = add(root, new THREE.PlaneGeometry(W, D), mat(0xffffff, { map: floorTex(), roughness: 0.35, metalness: 0.15 }), 0, 0, 0);
  floor.rotation.x = -PI / 2;
  const wm = mat(0xffffff, { map: wallTex(), roughness: 0.9 });
  add(root, new THREE.BoxGeometry(0.5, H, D + 1), wm, R.minX - 0.25, H / 2, 0);
  add(root, new THREE.BoxGeometry(0.5, H, D + 1), wm, R.maxX + 0.25, H / 2, 0);
  add(root, new THREE.BoxGeometry(W + 1, H, 0.5), wm, 0, H / 2, R.minZ - 0.25);
  add(root, new THREE.BoxGeometry(W + 1, H, 0.5), wm, 0, H / 2, R.maxZ + 0.25);
  add(root, new THREE.BoxGeometry(W + 1, 0.5, D + 1), mat(0x0a0818, { roughness: 1 }), 0, H + 0.25, 0);
  const trimM = basic(0x6ee7ff);
  const trimP = basic(0xff4fd8);
  for (const sx of [-1, 1]) {
    add(root, new THREE.BoxGeometry(0.08, 0.08, D), trimM, sx * (R.maxX - 0.05), 3.4, 0);
    add(root, new THREE.BoxGeometry(0.08, 0.08, D), trimP, sx * (R.maxX - 0.05), 6.4, 0);
  }
  add(root, new THREE.BoxGeometry(W, 0.08, 0.08), trimP, 0, 6.4, R.minZ + 0.05);
  add(root, new THREE.BoxGeometry(W, 0.08, 0.08), trimM, 0, 6.4, R.maxZ - 0.05);

  // sao trên trần
  const starPos = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++) {
    starPos[i * 3] = R.minX + 1 + Math.random() * 28;
    starPos[i * 3 + 1] = H - 0.04;
    starPos[i * 3 + 2] = R.minZ + 1 + Math.random() * 28;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  root.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.8 })));

  // ===== sân bóng =====
  const grass = add(root, new THREE.PlaneGeometry(P.hx * 2, P.hz * 2), mat(0xffffff, { map: grassTex(), roughness: 0.95 }), P.cx, 0.012, P.cz);
  grass.rotation.x = -PI / 2;
  const boardM = mat(0x1f2a44, { roughness: 0.5 });
  const boardTrim = basic(0xffd24a);
  const bz = [P.cz - P.hz - 0.12, P.cz + P.hz + 0.12];
  for (const z of bz) {
    add(root, new THREE.BoxGeometry(P.hx * 2 + 0.5, 0.4, 0.2), boardM, P.cx, 0.2, z);
    add(root, new THREE.BoxGeometry(P.hx * 2 + 0.5, 0.04, 0.22), boardTrim, P.cx, 0.42, z);
  }
  const segLen = P.hz - P.goalHalf;
  for (const sgn of [-1, 1]) for (const s of [-1, 1]) {
    add(root, new THREE.BoxGeometry(0.2, 0.4, segLen), boardM, P.cx + sgn * (P.hx + 0.12), 0.2, P.cz + s * (P.goalHalf + segLen / 2));
  }
  goal(root, -1);
  goal(root, 1);

  // bóng
  const ballMesh = add(root, new THREE.SphereGeometry(0.38, 24, 16), mat(0xffffff, { map: ballTex(), roughness: 0.45 }), P.cx, 0.4, P.cz);
  const ballShadow = add(root, new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }), P.cx, 0.03, P.cz);
  ballShadow.rotation.x = -PI / 2;
  const ball = { sx: P.cx, sz: P.cz, vx: 0, vz: 0, t0: performance.now(), x: P.cx, z: P.cz, frozen: false };

  // bảng điểm trên tường
  const boardCv = document.createElement('canvas');
  boardCv.width = 1024;
  boardCv.height = 320;
  const bctx = boardCv.getContext('2d');
  const boardTex = new THREE.CanvasTexture(boardCv);
  boardTex.colorSpace = THREE.SRGBColorSpace;
  function drawScores(top) {
    const w = boardCv.width, h = boardCv.height;
    bctx.clearRect(0, 0, w, h);
    const g = bctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#12082a');
    g.addColorStop(1, '#2a0f55');
    bctx.fillStyle = g;
    bctx.fillRect(0, 0, w, h);
    bctx.strokeStyle = '#6ee7ff';
    bctx.lineWidth = 8;
    bctx.strokeRect(6, 6, w - 12, h - 12);
    bctx.textAlign = 'center';
    bctx.fillStyle = '#ffd24a';
    bctx.font = `800 54px ${FONT}`;
    bctx.fillText('BẢNG GHI BÀN', w / 2, 78);
    bctx.font = `600 44px ${FONT}`;
    if (!top || !top.length) {
      bctx.fillStyle = 'rgba(255,255,255,0.75)';
      bctx.fillText('Chạy vào bóng để sút - chưa có bàn thắng nào', w / 2, 190);
    } else {
      top.slice(0, 3).forEach(([name, n], i) => {
        bctx.fillStyle = ['#ffd24a', '#dfe6ee', '#e0a060'][i];
        bctx.textAlign = 'left';
        bctx.fillText(`${i + 1}. ${name}`, 150, 150 + i * 56, 560);
        bctx.textAlign = 'right';
        bctx.fillText(`${n} bàn`, w - 150, 150 + i * 56);
      });
    }
    boardTex.needsUpdate = true;
  }
  drawScores([]);
  const scoreboard = add(root, new THREE.PlaneGeometry(9, 2.8), basic(0xffffff, { map: boardTex }), 0, 6.6, R.minZ + 0.04);
  add(root, new THREE.PlaneGeometry(11, 2.2), basic(0xffffff, { map: neonTex('KHU GIẢI TRÍ', '#ff4fd8', 1024, 200, 120), transparent: true, depthWrite: false }), 0, 3.4 + 4.2, R.minZ + 0.05).position.y = 9;

  // hiệu ứng ăn mừng
  const flash = makeLabel('BÀN THẮNG!');
  flash.scale.multiplyScalar(3.2);
  flash.position.set(P.cx, 3.2, P.cz);
  flash.visible = false;
  root.add(flash);
  let flashT = 0;
  const CONF_N = 90;
  const confPos = new Float32Array(CONF_N * 3);
  const confVel = new Float32Array(CONF_N * 3);
  const confGeo = new THREE.BufferGeometry();
  confGeo.setAttribute('position', new THREE.BufferAttribute(confPos, 3));
  const confMat = new THREE.PointsMaterial({ color: 0xffd24a, size: 7, sizeAttenuation: false, transparent: true, depthWrite: false });
  const conf = new THREE.Points(confGeo, confMat);
  conf.visible = false;
  root.add(conf);
  let confT = 0;

  // ===== máy móc =====
  const claws = A.CLAWS.map((c, i) => clawMachine(root, c.x, c.z, i));
  const cabLabels = ['ĐẬP CHUỘT', 'ĐẬP CHUỘT', 'ĐẬP CHUỘT', 'ĐẬP CHUỘT'];
  A.CABINETS.forEach((c, i) => cabinet(root, c.x, c.z, i * 80 + 20, cabLabels[i], [0x6a1b9a, 0x1d3b8b, 0x0b6e4f, 0x9c2a2a][i]));
  A.BENCHES.forEach((b) => bench(root, b.x, b.z));
  plant(root, -13.8, 13.8);
  plant(root, 13.8, 13.8);
  plant(root, -13.8, -13.6);
  plant(root, 13.8, -13.6);

  // quả cầu disco + đèn dây
  const disco = add(root, new THREE.IcosahedronGeometry(0.85, 1), mat(0xdddddd, { metalness: 1, roughness: 0.12, flatShading: true }), 0, H - 1.6, 3);
  add(root, new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), mat(0x888888), 0, H - 0.8, 3);
  const bulbGeo = new THREE.SphereGeometry(0.09, 8, 6);
  const bulbs = new THREE.InstancedMesh(bulbGeo, basic(0xffffff), 90);
  const bm = new THREE.Matrix4();
  const bcol = new THREE.Color();
  let bi = 0;
  for (const zz of [-1, 6, 12]) {
    for (let k = 0; k < 30; k++) {
      const x = -14 + (k / 29) * 28;
      const sag = Math.sin((k / 29) * PI) * 0.9;
      bulbs.setMatrixAt(bi, bm.makeTranslation(x, H - 0.5 - sag, zz));
      bulbs.setColorAt(bi, bcol.setHSL((bi * 0.07) % 1, 1, 0.6));
      bi++;
    }
  }
  root.add(bulbs);

  // cổng về sảnh + điểm tương tác
  const door = makeDoor(root, A.DOOR.x, 0, R.maxZ - 0.1, PI, 'VỀ SẢNH RẠP', '#2ee6ff', '#7a3cff', 0xcfd8e3);
  const markers = addInteractMarkers(root, A.INTERACT, () => 0);

  // ===== API =====
  function setBall(b, frozen) {
    const [x, z, vx, vz] = b;
    ball.sx = x; ball.sz = z; ball.vx = vx; ball.vz = vz; ball.t0 = performance.now(); ball.frozen = !!frozen;
    if (Math.hypot(ball.x - x, ball.z - z) > 3 || (vx === 0 && vz === 0 && Math.hypot(ball.x - x, ball.z - z) > 0.8)) { ball.x = x; ball.z = z; }
  }
  function celebrate(by) {
    flashT = 2.4;
    flash.visible = true;
    confT = 2.4;
    conf.visible = true;
    for (let i = 0; i < CONF_N; i++) {
      confPos[i * 3] = P.cx + (Math.random() - 0.5) * 4;
      confPos[i * 3 + 1] = 1.5;
      confPos[i * 3 + 2] = P.cz + (Math.random() - 0.5) * 3;
      confVel[i * 3] = (Math.random() - 0.5) * 6;
      confVel[i * 3 + 1] = 3 + Math.random() * 5;
      confVel[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
  }

  const K = 1.0;
  const col = new THREE.Color();
  function update(dt, t, o) {
    // bóng: ngoại suy từ trạng thái server rồi làm mượt
    const e = Math.min((performance.now() - ball.t0) / 1000, 1.2);
    const f = (1 - Math.exp(-K * e)) / K;
    let tx = ball.sx + ball.vx * f;
    let tz = ball.sz + ball.vz * f;
    if (ball.frozen) { tx = ball.sx; tz = ball.sz; }
    const k = 1 - Math.exp(-14 * dt);
    const px = ball.x, pz = ball.z;
    ball.x += (tx - ball.x) * k;
    ball.z += (tz - ball.z) * k;
    ballMesh.position.set(ball.x, 0.4, ball.z);
    ballShadow.position.set(ball.x, 0.03, ball.z);
    const mvx = ball.x - px, mvz = ball.z - pz;
    ballMesh.rotation.z -= mvx / 0.38;
    ballMesh.rotation.x += mvz / 0.38;

    claws.forEach((c) => c.update(t));
    disco.rotation.y = t * 0.6;
    lights[0].color.setHSL((t * 0.06) % 1, 1, 0.6);
    lights[1].color.setHSL((t * 0.06 + 0.5) % 1, 1, 0.6);
    door.update(t);
    markers.update(t, false);
    trimM.color.setHSL((t * 0.04 + 0.5) % 1, 1, 0.6);
    trimP.color.setHSL((t * 0.04) % 1, 1, 0.6);

    if (flashT > 0) {
      flashT -= dt;
      flash.position.y = 3.2 + Math.sin(t * 8) * 0.12;
      flash.material.opacity = Math.min(1, flashT * 2);
      if (flashT <= 0) flash.visible = false;
    }
    if (confT > 0) {
      confT -= dt;
      for (let i = 0; i < CONF_N; i++) {
        confVel[i * 3 + 1] -= 9 * dt;
        confPos[i * 3] += confVel[i * 3] * dt;
        confPos[i * 3 + 1] = Math.max(0.05, confPos[i * 3 + 1] + confVel[i * 3 + 1] * dt);
        confPos[i * 3 + 2] += confVel[i * 3 + 2] * dt;
      }
      confGeo.attributes.position.needsUpdate = true;
      confMat.color.setHSL((t * 2) % 1, 1, 0.6);
      confMat.opacity = Math.min(1, confT);
      if (confT <= 0) conf.visible = false;
    }
  }

  function dispose() {
    disposeTree(root);
  }

  return {
    kind: 'arcade',
    update,
    pickables: [],
    seatFromHit: () => null,
    setMarker() {},
    dispose,
    setBall,
    celebrate,
    setScores: drawScores,
  };
}
