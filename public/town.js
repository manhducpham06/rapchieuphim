// Quảng Trường (sảnh chính ngoài trời) và Shop Thời Trang (cửa hàng của ông chủ).
import * as THREE from 'three';
import { makeLabel } from './avatar.js';
import { makeDoor, addInteractMarkers, disposeTree } from './themes.js';
import { buildAccessory } from './accessories.js';
import { decoratePlaza } from './plaza3d.js';

const L = window.LAYOUT;
const PI = Math.PI;
const FONT = '"Be Vietnam Pro","Segoe UI",Roboto,system-ui,sans-serif';

function ctex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const basic = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });
function box(w, h, d, m, x, y, z, p) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  if (p) p.add(o);
  return o;
}
function cyl(rt, rb, h, m, x, y, z, p, seg = 20) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  o.position.set(x, y, z);
  if (p) p.add(o);
  return o;
}
function sph(r, m, x, y, z, p) {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
  o.position.set(x, y, z);
  if (p) p.add(o);
  return o;
}
function signTex(text, color, bg, w = 1024, h = 256, size = 120) {
  return ctex(w, h, (c) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.strokeStyle = color; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28);
    c.font = `800 ${size}px ${FONT}`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = color; c.shadowBlur = 26; c.fillStyle = color;
    c.fillText(text, w / 2, h / 2 + 6, w - 90);
    c.shadowBlur = 8; c.fillStyle = '#fff';
    c.fillText(text, w / 2, h / 2 + 6, w - 90);
  });
}
function facadeTex(base, seed = 1) {
  return ctex(512, 512, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    let s = seed * 9301;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let y = 24; y < h - 110; y += 64) {
      for (let x = 24; x < w - 40; x += 62) {
        c.fillStyle = rnd() > 0.45 ? '#ffe8a8' : '#27324e';
        c.fillRect(x, y, 38, 44);
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + 20, 38, 4);
      }
    }
    c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(0, h - 90, w, 90);
  });
}
function skyTex() {
  return ctex(8, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3b8be0'); g.addColorStop(0.55, '#8fd0ff'); g.addColorStop(0.85, '#ffe7c2'); g.addColorStop(1, '#ffd3a1');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
}

// ===================================================================
//                         QUẢNG TRƯỜNG
// ===================================================================
export function buildPlaza(scene) {
  const P = L.PLAZA;
  const root = new THREE.Group();
  scene.add(root);

  root.add(new THREE.AmbientLight(0xffffff, 0.75));
  root.add(new THREE.HemisphereLight(0xcfe8ff, 0x7a9a5a, 0.9));
  const sun = new THREE.DirectionalLight(0xfff1d0, 1.5);
  sun.position.set(-18, 30, 12);
  root.add(sun);

  // bầu trời
  const sky = new THREE.Mesh(new THREE.SphereGeometry(70, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, depthWrite: false }));
  sky.renderOrder = -10;
  root.add(sky);
  // mây
  const cloudMat = basic(0xffffff, { transparent: true, opacity: 0.85 });
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const cg = new THREE.Group();
    for (let k = 0; k < 4; k++) sph(2.2 + Math.random() * 1.6, cloudMat, k * 2.4 - 3, Math.random() * 0.8, Math.random() * 1.2, cg);
    cg.position.set(-55 + i * 18, 34 + (i % 3) * 5, -40 + (i % 4) * 18);
    cg.scale.y = 0.55;
    root.add(cg);
    clouds.push(cg);
  }

  // mặt đất: sảnh lát gạch + cỏ xung quanh
  const tiles = ctex(256, 256, (c, w, h) => {
    c.fillStyle = '#e6dcc6'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#d8cbb0';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) c.fillRect(x * 64, y * 64, 64, 64);
    c.strokeStyle = 'rgba(120,100,70,0.35)'; c.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, h); c.stroke(); c.beginPath(); c.moveTo(0, i * 64); c.lineTo(w, i * 64); c.stroke(); }
  }, [10, 10]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), std(0xffffff, { map: tiles, roughness: 0.9 }));
  floor.rotation.x = -PI / 2;
  root.add(floor);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), std(0x5fa04a, { roughness: 1 }));
  grass.rotation.x = -PI / 2;
  grass.position.y = -0.03;
  root.add(grass);
  // Toàn bộ nhà, cây, đèn, đá, hoa là mô hình 3D thật, dựng trong plaza3d.js (va chạm lấy từ layout.js).
  // Biển hiệu trên 3 toà nhà chính
  function signOn(x, z, ry, text, color, bg) {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = ry;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), basic(0xffffff, { map: signTex(text, color, bg), toneMapped: false }));
    sign.position.set(0, 6.4, 0);
    g.add(sign);
    root.add(g);
  }
  signOn(0, -19.62, 0, 'RẠP CHIẾU PHIM', '#ffd24a', '#1a1030');
  signOn(19.62, 0, -PI / 2, 'KHU GIẢI TRÍ', '#2ee6ff', '#0d0a22');
  signOn(-19.62, 0, PI / 2, 'SHOP THỜI TRANG', '#ff7ec7', '#2a0f26');

  // cổng
  const doors = [
    makeDoor(root, 0, 0, -19.55, 0, 'RẠP CHIẾU PHIM', '#ff9a3c', '#ff2d95', 0xd9ad4b),
    makeDoor(root, 19.55, 0, 0, -PI / 2, 'KHU GIẢI TRÍ', '#2ee6ff', '#7a3cff', 0xcfd8e3),
    makeDoor(root, -19.55, 0, 0, PI / 2, 'SHOP THỜI TRANG', '#ff7ec7', '#ffd23f', 0xf0e2c0),
  ];
  const markers = addInteractMarkers(root, P.INTERACT, () => 0);

  decoratePlaza(root, P).catch((e) => console.warn('Không tải được mô hình quảng trường', e));

  function update(dt, t) {
    clouds.forEach((c, i) => { c.position.x += dt * (0.4 + (i % 3) * 0.15); if (c.position.x > 70) c.position.x = -70; });
    doors.forEach((d) => d.update(t));
    markers.update(t, false);
  }
  return { kind: 'plaza', update, pickables: [], seatFromHit: () => null, setMarker() {}, dispose: () => disposeTree(root) };
}

// ===================================================================
//                         SHOP THỜI TRANG
// ===================================================================
const BOSS_OUTFIT = { top: 't_gold', bottom: 'b_black', shoes: 's_gold', cap: 'c_gold', face: 'f_shades', head: 'h_crown', neck: 'n_bow', back: 'k_cape' };

/** makeOwner: hàm trả về nhân vật (createCharacter) để làm ông chủ đứng quầy; có thể null. */
export function buildShop(scene, makeOwner) {
  const S = L.SHOP;
  const R = S.ROOM;
  const root = new THREE.Group();
  scene.add(root);
  const C = window.CATALOG;
  const H = R.height;

  root.add(new THREE.AmbientLight(0xfff4ea, 0.85));
  root.add(new THREE.HemisphereLight(0xfff8f0, 0xd9b8a0, 0.7));
  const lights = [];
  for (const [lx, lz] of [[-6, -4], [6, -4], [-6, 4], [6, 4], [0, -7]]) {
    const pl = new THREE.PointLight(0xffe9cc, 22, 15, 2);
    pl.position.set(lx, H - 0.8, lz);
    root.add(pl); lights.push(pl);
  }

  // sàn gỗ
  const wood = ctex(256, 256, (c, w, h) => {
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#b98a5a' : '#c79a69'; c.fillRect(0, i * 32, w, 32); c.fillStyle = 'rgba(80,50,20,0.25)'; c.fillRect(0, i * 32, w, 2); }
  }, [12, 10]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 20), std(0xffffff, { map: wood, roughness: 0.55 }));
  floor.rotation.x = -PI / 2;
  root.add(floor);
  // thảm đỏ trung tâm
  box(3.2, 0.02, 14, std(0xb01e3c, { roughness: 1 }), 0, 0.015, 1, root);
  box(3.5, 0.015, 14.3, std(0xffd27a, { roughness: 1 }), 0, 0.01, 1, root);

  // tường + trần
  const wallTex = ctex(256, 256, (c, w, h) => {
    c.fillStyle = '#f6e7da'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#eed7c6'; for (let x = 0; x < w; x += 64) c.fillRect(x, 0, 32, h);
    c.fillStyle = '#d78aa4'; c.fillRect(0, h - 40, w, 12);
  }, [6, 1.2]);
  const wm = std(0xffffff, { map: wallTex, roughness: 0.95 });
  box(24, H, 0.3, wm, 0, H / 2, R.minZ - 0.15, root);
  box(24, H, 0.3, wm, 0, H / 2, R.maxZ + 0.15, root);
  box(0.3, H, 20, wm, R.minX - 0.15, H / 2, 0, root);
  box(0.3, H, 20, wm, R.maxX + 0.15, H / 2, 0, root);
  box(24, 0.3, 20, std(0xfdf6ee), 0, H + 0.15, 0, root);
  // dải đèn trần
  const stripMat = basic(0xfff6e0, { toneMapped: false });
  for (const z of [-7, -2, 3, 8]) box(16, 0.06, 0.3, stripMat, 0, H - 0.02, z, root);

  // biển hiệu lớn trên tường sau
  const bigSign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), basic(0xffffff, { map: signTex('BOSS FASHION', '#ff7ec7', '#2a0f26', 1024, 256, 130), toneMapped: false }));
  bigSign.position.set(0, 5.1, R.minZ + 0.02);
  root.add(bigSign);
  const subSign = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.9), basic(0xffffff, { map: signTex('Mua xu · Mặc đẹp · Toả sáng', '#ffd23f', '#2a0f26', 1024, 150, 66), toneMapped: false }));
  subSign.position.set(0, 3.7, R.minZ + 0.02);
  root.add(subSign);

  // quầy thu ngân
  const ct = S.COUNTER;
  box(ct.w, 1.0, ct.d, std(0x6a3d2a, { roughness: 0.5 }), ct.x, 0.5, ct.z, root);
  box(ct.w + 0.3, 0.1, ct.d + 0.3, std(0xf4ead8, { roughness: 0.3 }), ct.x, 1.05, ct.z, root);
  box(ct.w - 0.4, 0.5, 0.05, basic(0xffffff, { map: signTex('THANH TOÁN', '#ffd23f', '#3a2018', 512, 128, 64) }), ct.x, 0.55, ct.z + ct.d / 2 + 0.03, root);
  box(0.5, 0.35, 0.4, std(0x2a2f3a), ct.x + 1.8, 1.3, ct.z, root); // máy tính tiền
  box(0.42, 0.28, 0.05, basic(0x7affc2), ct.x + 1.8, 1.42, ct.z + 0.22, root);

  // ông chủ
  let owner = null;
  let nextWave = 0;
  const ownerTag = makeLabel('ÔNG CHỦ');
  if (makeOwner) {
    try {
      owner = makeOwner();
      if (owner) {
        owner.group.position.set(S.OWNER.x, 0, S.OWNER.z);
        owner.group.rotation.y = 0;
        root.add(owner.group);
        if (owner.setOutfit) owner.setOutfit(BOSS_OUTFIT);
      }
    } catch (e) { console.warn('Không dựng được ông chủ', e); owner = null; }
  }
  ownerTag.position.set(S.OWNER.x, 2.5, S.OWNER.z);
  root.add(ownerTag);
  // Chỉ chủ shop thật mới bán hàng. NPC luôn ẩn; khi chủ vắng thì hiện biển đóng cửa.
  if (owner) owner.group.visible = false;
  ownerTag.visible = false;
  const closedSign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.2), basic(0xffffff, { map: signTex('SHOP ĐANG ĐÓNG CỬA', '#ff5a5a', '#2a0f12', 1024, 340, 100), toneMapped: false }));
  closedSign.position.set(S.OWNER.x, 1.9, S.COUNTER.z);
  root.add(closedSign);

  // giá treo quần áo
  const topItems = C.ITEMS.filter((i) => i.slot === 'top');
  const botItems = C.ITEMS.filter((i) => i.slot === 'bottom');
  const hangMat = std(0xcfd3da, { metalness: 0.8, roughness: 0.3 });
  S.RACKS.forEach((r, ri) => {
    const g = new THREE.Group();
    g.position.set(r.x, 0, r.z); g.rotation.y = r.ry;
    cyl(0.03, 0.03, 3.4, hangMat, 0, 1.6, 0, g, 8).rotation.x = PI / 2;
    for (const sz of [-1.6, 1.6]) cyl(0.03, 0.03, 1.6, hangMat, 0, 0.8, sz, g, 8);
    for (let k = 0; k < 7; k++) {
      const it = k % 3 === 2 ? botItems[(ri + k) % botItems.length] : topItems[(ri * 2 + k) % topItems.length];
      const cm = std(it.color, { roughness: 0.9 });
      const z = -1.4 + k * 0.46;
      if (it.slot === 'top') { box(0.14, 0.6, 0.4, cm, 0, 1.2, z, g); box(0.14, 0.18, 0.62, cm, 0, 1.4, z, g); }
      else { box(0.14, 0.75, 0.2, cm, 0, 1.1, z - 0.07, g); box(0.14, 0.75, 0.2, cm, 0, 1.1, z + 0.07, g); }
    }
    // kệ giày dưới giá
    box(0.5, 0.05, 3.2, std(0xe8d9c3), 0.3, 0.25, 0, g);
    for (let k = 0; k < 6; k++) {
      const sc = C.ITEMS.filter((i) => i.slot === 'shoes')[k % 6];
      box(0.3, 0.12, 0.22, std(sc.color), 0.3, 0.34, -1.3 + k * 0.52, g);
    }
    root.add(g);
  });

  // ma-nơ-canh
  const mannequins = [];
  S.MANNEQUINS.forEach((m, mi) => {
    const g = new THREE.Group();
    g.position.set(m.x, 0, m.z);
    const t = topItems[(mi * 3 + 1) % topItems.length], b = botItems[(mi * 2 + 1) % botItems.length];
    cyl(0.4, 0.45, 0.06, std(0x30343e, { metalness: 0.5 }), 0, 0.03, 0, g);
    cyl(0.07, 0.07, 0.35, std(0x30343e), 0, 0.22, 0, g, 8);
    for (const sx of [-1, 1]) cyl(0.09, 0.07, 0.62, std(b.color), sx * 0.1, 0.62, 0, g, 12);
    cyl(0.21, 0.17, 0.62, std(t.color), 0, 1.22, 0, g, 16);
    for (const sx of [-1, 1]) cyl(0.055, 0.045, 0.5, std(t.color), sx * 0.27, 1.22, 0, g, 8);
    sph(0.15, std(0xe9d9c6), 0, 1.7, 0, g);
    const hat = ['h_crown', 'h_halo', 'h_ears', 'h_phones'][mi % 4];
    const acc = buildAccessory(C.BY_ID[hat]);
    if (acc) { acc.position.set(0, 1.52 - 0.17, 0); acc.scale.setScalar(0.75); g.add(acc); }
    root.add(g);
    mannequins.push(g);
  });

  // bục trưng bày phụ kiện quay tròn
  const pedestals = [];
  const showcase = ['k_wings', 'h_crown', 'k_bat', 'k_jet'];
  [[-9.2, -8.4], [-4.2, -8.7], [4.2, -8.7], [9.2, -8.4]].forEach(([px, pz], i) => {
    cyl(0.55, 0.65, 0.9, std(0x2f2a3a, { roughness: 0.4 }), px, 0.45, pz, root, 20);
    cyl(0.6, 0.6, 0.06, basic(0xff7ec7, { toneMapped: false }), px, 0.93, pz, root, 24);
    const it = C.BY_ID[showcase[i]];
    const acc = it && buildAccessory(it);
    if (acc) {
      const holder = new THREE.Group();
      holder.position.set(px, 0, pz);
      const off = it.slot === 'back' ? 1.0 - 1.145 : it.slot === 'head' ? 1.0 - 0.45 : 1.3 - 1.33;
      acc.position.y = off + 0.4; acc.scale.setScalar(1.0);
      holder.add(acc); root.add(holder);
      pedestals.push(holder);
    }
    if (i === 0 || i === 3) { /* bục mép góc */ }
  });

  // gương thử đồ
  const mr = S.MIRROR;
  box(2.6, 3.4, 0.12, std(0xd6a84b, { metalness: 0.7, roughness: 0.3 }), mr.x, 1.8, mr.z + 0.04, root);
  const glass = ctex(64, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#dff3ff'); g.addColorStop(0.5, '#9fd0ee'); g.addColorStop(1, '#e8f7ff');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.1), basic(0xffffff, { map: glass }));
  mirror.position.set(mr.x, 1.8, mr.z + 0.11);
  root.add(mirror);

  // cửa ra + vòng sáng tương tác
  const door = makeDoor(root, 0, 0, R.maxZ - 0.1, PI, 'RA QUẢNG TRƯỜNG', '#2ee6ff', '#7a3cff', 0xf0e2c0);
  const markers = addInteractMarkers(root, S.INTERACT, () => 0);

  const ownerSt = { speed: 0, sitting: false, emote: null, now: 0 };
  function update(dt, t) {
    mannequins.forEach((m, i) => { m.rotation.y = t * 0.5 + i; });
    pedestals.forEach((p, i) => { p.rotation.y = t * 0.8 + i; });
    bigSign.material.color.setScalar(0.88 + 0.12 * Math.sin(t * 2.4));
    door.update(t);
    markers.update(t, false);
    if (owner) {
      ownerSt.now = performance.now();
      if (ownerSt.now > nextWave) { ownerSt.emote = { type: 'wave', until: ownerSt.now + 2600 }; nextWave = ownerSt.now + 9000 + Math.random() * 6000; }
      owner.update(dt, ownerSt);
    }
  }
  return {
    kind: 'shop', update, pickables: [], seatFromHit: () => null, setMarker() {},
    // Ẩn ông chủ NPC khi chủ shop thật đang ở trong phòng
    // v = true: chủ shop thật có mặt (mở cửa). v = false: hiện NPC không, chỉ hiện biển đóng cửa.
    setOwnerVisible(v) {
      if (owner) owner.group.visible = false;
      ownerTag.visible = false;
      closedSign.visible = !v;
    },
    dispose() { if (owner && owner.dispose) owner.dispose(); disposeTree(root); },
  };
}
