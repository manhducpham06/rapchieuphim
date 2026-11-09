// Mô hình 3D (Kenney, CC0) cho Quảng Trường: nhà, đường, cây, hoa, đèn.
// Nếu tải mô hình lỗi thì quảng trường vẫn dùng đồ dựng sẵn bằng code.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const DIR = 'models/city/';
const cache = new Map();
const loader = new GLTFLoader();

function load(name) {
  if (!cache.has(name)) {
    cache.set(name, new Promise((res) => {
      loader.load(DIR + name + '.glb', (g) => {
        // Kenney xuất vật liệu kim loại => bị đen trong game; ép về vật liệu mờ, màu sáng
        g.scene.traverse((o) => {
          if (!o.isMesh) return;
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => {
            if (!m) return;
            if ('metalness' in m) { m.metalness = 0; m.roughness = 0.9; }
            // màu lá/cỏ gốc của Kenney hơi xanh ngọc, chỉnh về xanh lá tươi cho hợp quảng trường
            const n = (m.name || '').toLowerCase();
            if (n.startsWith('leaf')) m.color.set(0x4fae48);
            else if (n === 'grass') m.color.set(0x62bf4a);
            else if (n.startsWith('woodbark')) m.color.set(0x8a5a3a);
          });
        });
        res(g.scene);
      }, undefined, () => res(null));
    }));
  }
  return cache.get(name);
}

/** Dựng toàn bộ cảnh 3D của quảng trường bằng mô hình thật (nhà, đường, cây, đèn, đá, chậu hoa). */
export async function decoratePlaza(root, P) {
  const NAMES = new Set([
    'building-a', 'building-b', 'building-c', 'building-d', 'building-e', 'building-f', 'building-g', 'building-h',
    'building-i', 'building-j', 'building-k', 'building-l', 'building-m', 'building-n',
    'building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-c', 'building-skyscraper-d', 'building-skyscraper-e',
    'low-detail-building-a', 'low-detail-building-b', 'low-detail-building-c', 'low-detail-building-d', 'low-detail-building-e', 'low-detail-building-f',
    'road-straight', 'road-bend', 'plant_bush', 'plant_bushLarge',
    'flower_redA', 'flower_redB', 'flower_yellowA', 'flower_yellowB', 'flower_purpleA', 'flower_purpleB', 'rock_smallA',
  ]);
  P.PROPS.forEach((o) => NAMES.add(o.m));
  const models = {};
  await Promise.all([...NAMES].map(async (n) => { models[n] = await load(n); }));

  const g = new THREE.Group();
  root.add(g);
  const put = (name, x, z, ry = 0, s = 1, y = 0, parent = g) => {
    const m = models[name];
    if (!m) return null;
    const o = m.clone(true);
    o.position.set(x, y, z);
    o.rotation.y = ry;
    o.scale.setScalar(s);
    parent.add(o);
    return o;
  };
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const PI = Math.PI;

  // ---- đồ vật trong quảng trường (cùng danh sách với va chạm trong layout.js) ----
  P.PROPS.forEach((o) => put(o.m, o.x, o.z, o.ry !== undefined ? o.ry : rnd() * PI * 2, o.s));

  // ---- 3 toà nhà chính (cửa vào rạp / khu giải trí / shop) ----
  // Mỗi mặt tiền: nhà giữa to + hai nhà hai bên. Mặt trước nằm ở khoảng cách 19.75 so với tâm.
  const FRONT = 19.75;
  const facade = (x, z, ry, centre, sideL, sideR) => {
    const f = new THREE.Group();
    f.position.set(x, 0, z);
    f.rotation.y = ry;
    g.add(f);
    const wid = (n, s) => ({ 'building-n': 2.32, 'building-k': 2.08, 'building-j': 2.08, 'building-i': 1.24, 'building-m': 1.24, 'building-l': 1.37, 'building-e': 1.64, 'building-g': 0.97 }[n] || 1) * s;
    const dep = (n, s) => ({ 'building-n': 1.82, 'building-k': 0.94, 'building-j': 1.34, 'building-i': 1.3, 'building-m': 1.24, 'building-l': 1.4, 'building-e': 1.01, 'building-g': 0.92 }[n] || 1) * s;
    const [cn, cs] = centre;
    put(cn, 0, -dep(cn, cs) / 2, 0, cs, 0, f);
    let off = wid(cn, cs) / 2;
    for (const [n, s] of sideR) { off += wid(n, s) / 2; put(n, off, -dep(n, s) / 2, 0, s, 0, f); off += wid(n, s) / 2; }
    off = wid(cn, cs) / 2;
    for (const [n, s] of sideL) { off += wid(n, s) / 2; put(n, -off, -dep(n, s) / 2, 0, s, 0, f); off += wid(n, s) / 2; }
  };
  facade(0, -FRONT, 0, ['building-n', 7], [['building-k', 7], ['building-i', 7]], [['building-j', 7], ['building-m', 7]]); // rạp (phía bắc)
  facade(FRONT, 0, -PI / 2, ['building-j', 7.5], [['building-i', 7.5], ['building-g', 7.5]], [['building-k', 7.5], ['building-l', 7.5]]); // khu giải trí (đông)
  facade(-FRONT, 0, PI / 2, ['building-n', 6.5], [['building-j', 6.5], ['building-l', 6.5]], [['building-k', 6.5], ['building-m', 6.5]]); // shop (tây)

  // ---- đường vòng + hai dãy nhà phía ngoài ----
  const T = 4, RC = 32;
  for (let i = -RC + T; i <= RC - T; i += T) {
    for (const [x, z, ry] of [[i, -RC, 0], [i, RC, 0], [-RC, i, PI / 2], [RC, i, PI / 2]]) put('road-straight', x, z, ry, T, 0.01);
  }
  for (const [x, z, ry] of [[-RC, -RC, 0], [RC, -RC, PI / 2], [RC, RC, PI], [-RC, RC, -PI / 2]]) put('road-bend', x, z, ry, T, 0.01);
  const MID = ['building-a', 'building-b', 'building-c', 'building-d', 'building-f', 'building-g', 'building-h', 'building-l', 'building-m'];
  const SKY = ['building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-c', 'building-skyscraper-d', 'building-skyscraper-e'];
  const LOW = ['low-detail-building-a', 'low-detail-building-b', 'low-detail-building-c', 'low-detail-building-d', 'low-detail-building-e', 'low-detail-building-f'];
  for (let side = 0; side < 4; side++) {
    const ry = [0, PI / 2, PI, -PI / 2][side];
    for (let t = -44; t <= 44; t += 6.4) {
      for (const [d, nm, s] of [[39.5 + rnd(), pick(MID), 6.2], [52 + rnd() * 3, rnd() > 0.4 ? pick(SKY) : pick(MID), 7]]) {
        const [x, z] = side === 0 ? [t, -d] : side === 1 ? [d, t] : side === 2 ? [t, d] : [-d, t];
        put(nm, x, z, ry, s);
      }
    }
  }
  for (let k = 0; k < 24; k++) { const a = (k / 24) * PI * 2; put(pick(LOW), Math.cos(a) * 66, Math.sin(a) * 66, -a + PI / 2, 10 + rnd() * 4); }

  // ---- cây và bụi hai bên, phía sau người chơi (ngoài vùng đi lại) ----
  const TR = ['tree_default', 'tree_oak', 'tree_fat', 'tree_detailed'];
  for (let x = -26; x <= 26; x += 5.2) put(pick(TR), x + (rnd() - 0.5) * 1.4, 23.5 + rnd() * 2.5, rnd() * 6, 4);
  for (let z = -24; z <= 24; z += 5.2) { if (Math.abs(z) < 12) continue; put(pick(TR), 23.5, z, rnd() * 6, 4); put(pick(TR), -23.5, z, rnd() * 6, 4); }

  // ---- hoa, bụi cây quanh gốc cây lớn giữa quảng trường (đi xuyên được, chỉ để trang trí) ----
  for (let k = 0; k < 14; k++) { const a = (k / 14) * PI * 2 + 0.2; put(k % 2 ? 'plant_bush' : 'plant_bushLarge', Math.cos(a) * 2.6, Math.sin(a) * 2.6, rnd() * 6, 3.2); }
  const FL = ['flower_redA', 'flower_redB', 'flower_yellowA', 'flower_yellowB', 'flower_purpleA', 'flower_purpleB'];
  for (let k = 0; k < 70; k++) { const a = rnd() * PI * 2, r = 3.2 + rnd() * 1.6; put(pick(FL), Math.cos(a) * r, Math.sin(a) * r, rnd() * 6, 3.2); }
  return true;
}
