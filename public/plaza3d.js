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

/** Dựng thêm cảnh 3D quanh quảng trường. Trả về { ok, hide: [nhóm đồ code cần ẩn] } */
export async function decoratePlaza(root, P, hideWhenReady) {
  const NAMES = [
    'building-a', 'building-b', 'building-c', 'building-d', 'building-e', 'building-f', 'building-g', 'building-h',
    'building-i', 'building-j', 'building-k', 'building-l', 'building-m', 'building-n',
    'building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-c', 'building-skyscraper-d', 'building-skyscraper-e',
    'low-detail-building-a', 'low-detail-building-b', 'low-detail-building-c', 'low-detail-building-d', 'low-detail-building-e', 'low-detail-building-f',
    'road-straight', 'road-crossroad', 'road-bend', 'light-square', 'light-curved',
    'tree_default', 'tree_oak', 'tree_fat', 'tree_simple', 'tree_detailed', 'tree_pineRoundA',
    'plant_bush', 'plant_bushLarge', 'flower_redA', 'flower_redB', 'flower_yellowA', 'flower_yellowB', 'flower_purpleA', 'flower_purpleB',
    'statue_column', 'pot_large', 'rock_smallA', 'stone_largeA',
  ];
  const models = {};
  await Promise.all(NAMES.map(async (n) => { models[n] = await load(n); }));
  if (!models['building-a'] || !models['road-straight'] || !models['tree_default']) return false;

  const g = new THREE.Group();
  root.add(g);
  const put = (name, x, z, ry = 0, s = 1, y = 0) => {
    const m = models[name];
    if (!m) return null;
    const o = m.clone(true);
    o.position.set(x, y, z);
    o.rotation.y = ry;
    o.scale.setScalar(s);
    g.add(o);
    return o;
  };
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const PI = Math.PI;

  // ---- đường vòng quanh quảng trường (ô 4m) ----
  const T = 4, RC = 26; // tâm đường cách gốc 26m
  for (let i = -RC; i <= RC; i += T) {
    for (const [x, z, ry] of [[i, -RC, 0], [i, RC, 0], [-RC, i, PI / 2], [RC, i, PI / 2]]) {
      if (Math.abs(i) === RC) continue; // góc làm riêng
      put('road-straight', x, z, ry, T, 0.01);
    }
  }
  for (const [x, z, ry] of [[-RC, -RC, 0], [RC, -RC, PI / 2], [RC, RC, PI], [-RC, RC, -PI / 2]]) put('road-bend', x, z, ry, T, 0.01);

  // ---- hai dãy nhà ngoài đường: cao dần về phía xa ----
  const MID = ['building-a', 'building-b', 'building-c', 'building-d', 'building-e', 'building-f', 'building-g', 'building-h', 'building-i', 'building-j', 'building-k', 'building-l', 'building-m', 'building-n'];
  const SKY = ['building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-c', 'building-skyscraper-d', 'building-skyscraper-e'];
  const LOW = ['low-detail-building-a', 'low-detail-building-b', 'low-detail-building-c', 'low-detail-building-d', 'low-detail-building-e', 'low-detail-building-f'];
  // dãy sát đường (cách 32m) + dãy xa (cách 44m)
  for (const side of [0, 1, 2, 3]) {
    const ry = [0, PI / 2, PI, -PI / 2][side]; // mặt nhà quay vào quảng trường
    for (let t = -36; t <= 36; t += 6.2) {
      const near = 33.5 + rnd() * 0.6;
      const far = 46 + rnd() * 3;
      const place = (d, name, s) => {
        const [x, z] = side === 0 ? [t, -d] : side === 1 ? [d, t] : side === 2 ? [t, d] : [-d, t];
        put(name, x, z, ry, s);
      };
      place(near, pick(MID), 6.2);
      place(far, rnd() > 0.5 ? pick(SKY) : pick(MID), rnd() > 0.5 ? 6.5 : 7.5);
    }
  }
  // nhà thấp lấp khoảng trống xa hơn nữa
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * PI * 2;
    put(pick(LOW), Math.cos(a) * 64, Math.sin(a) * 64, -a + PI / 2, 9 + rnd() * 4);
  }

  // ---- hai bên 3 toà chính: nhà nhỏ khép góc quảng trường ----
  const corner = (x, z, ry, name) => put(name, x, z, ry, 6.5);
  corner(-16, -21, 0, 'building-c'); corner(16, -21, 0, 'building-f');
  corner(21, -16, -PI / 2, 'building-h'); corner(21, 16, -PI / 2, 'building-k');
  corner(-21, -16, PI / 2, 'building-b'); corner(-21, 16, PI / 2, 'building-m');

  // ---- cây quanh quảng trường: thay cây dựng bằng code ----
  const TREES = ['tree_default', 'tree_oak', 'tree_fat', 'tree_detailed'];
  P.TREES.forEach((tr, i) => put(TREES[i % TREES.length], tr.x, tr.z, rnd() * PI * 2, 3.6));
  // hàng cây ven rìa phía nam (phía sau người chơi) và hai bên
  for (let x = -18; x <= 18; x += 6) put(pick(TREES), x + (rnd() - 0.5) * 1.4, 22.5, rnd() * 6, 3.4);
  for (let z = -18; z <= 18; z += 6) {
    if (Math.abs(z) < 4) continue;
    put(pick(TREES), -22.5, z, rnd() * 6, 3.4);
    put(pick(TREES), 22.5, z, rnd() * 6, 3.4);
  }
  // bụi cây, hoa quanh đài phun nước và mép bãi
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * PI * 2 + 0.2;
    put(k % 2 ? 'plant_bush' : 'plant_bushLarge', Math.cos(a) * 6.2, Math.sin(a) * 6.2, rnd() * 6, 3);
  }
  const FL = ['flower_redA', 'flower_redB', 'flower_yellowA', 'flower_yellowB', 'flower_purpleA', 'flower_purpleB'];
  for (let k = 0; k < 90; k++) {
    const a = rnd() * PI * 2, r = 5.4 + rnd() * 1.4;
    put(pick(FL), Math.cos(a) * r, Math.sin(a) * r, rnd() * 6, 3.2);
  }
  // chậu cây, đá cảnh
  for (const [x, z] of [[-4.5, -15], [4.5, -15], [-15, -4.5], [-15, 4.5], [15, -4.5], [15, 4.5]]) put('pot_large', x, z, 0, 3);
  for (const [x, z] of [[-17, 8], [17, 8], [-10, 17.5], [10, 17.5]]) put('rock_smallA', x, z, rnd() * 6, 3);

  // ---- đèn đường dọc rìa quảng trường ----
  for (const [lx, lz, ry] of [[-12, 12, PI], [12, 12, PI], [-12, -12, 0], [12, -12, 0], [0, 17, PI], [-17, 17, PI], [17, 17, PI]]) {
    put('light-curved', lx, lz, ry, 7, 0);
  }

  // mô hình thật đã sẵn sàng: ẩn đồ dựng bằng code
  if (hideWhenReady) hideWhenReady();
  return true;
}
