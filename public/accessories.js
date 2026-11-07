// Phụ kiện 3D dựng bằng hình khối đơn giản, gắn vào xương của nhân vật.
// Toạ độ tính theo gốc xương (xương Head/Neck/Spine2 của Aj đều thẳng trục: +y lên, +z là phía trước mặt).
import * as THREE from 'three';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...o });
const glow = (color, k = 0.8) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.4 });
const mesh = (g, m, x = 0, y = 0, z = 0, p) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); if (p) p.add(o); return o; };

function polyShape(pts, scale = 1) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x * scale, y * scale) : s.moveTo(x * scale, y * scale)));
  s.closePath();
  return s;
}
function heartGeo(size) {
  const s = new THREE.Shape();
  s.moveTo(0.25, 0.25);
  s.bezierCurveTo(0.25, 0.25, 0.2, 0, 0, 0);
  s.bezierCurveTo(-0.3, 0, -0.3, 0.35, -0.3, 0.35);
  s.bezierCurveTo(-0.3, 0.55, -0.1, 0.77, 0.25, 0.95);
  s.bezierCurveTo(0.6, 0.77, 0.8, 0.55, 0.8, 0.35);
  s.bezierCurveTo(0.8, 0.35, 0.8, 0, 0.5, 0);
  s.bezierCurveTo(0.35, 0, 0.25, 0.25, 0.25, 0.25);
  const g = new THREE.ShapeGeometry(s);
  g.translate(-0.25, -0.47, 0);
  g.scale(size, size, size);
  return g;
}

// ---- mặt (xương Head; mắt ở y≈0.16, x≈±0.075, mặt trước z≈0.24) ----
const FACE = {
  glasses(c) {
    const g = new THREE.Group(); const m = mat(c, { metalness: 0.4 });
    for (const sx of [-1, 1]) {
      const r = mesh(new THREE.TorusGeometry(0.058, 0.007, 8, 24), m, sx * 0.078, 0.165, 0.252, g);
      r.rotation.y = 0;
      mesh(new THREE.BoxGeometry(0.012, 0.012, 0.16), m, sx * 0.145, 0.165, 0.17, g);
    }
    mesh(new THREE.BoxGeometry(0.04, 0.008, 0.008), m, 0, 0.175, 0.252, g);
    return g;
  },
  shades(c) {
    const g = new THREE.Group(); const m = mat(c, { roughness: 0.2, metalness: 0.3 });
    for (const sx of [-1, 1]) {
      mesh(new THREE.BoxGeometry(0.11, 0.07, 0.012), m, sx * 0.078, 0.165, 0.252, g);
      mesh(new THREE.BoxGeometry(0.012, 0.012, 0.16), m, sx * 0.14, 0.18, 0.17, g);
    }
    mesh(new THREE.BoxGeometry(0.04, 0.012, 0.012), m, 0, 0.185, 0.252, g);
    return g;
  },
  heartglasses(c) {
    const g = new THREE.Group(); const m = mat(c, { side: THREE.DoubleSide, roughness: 0.35 });
    for (const sx of [-1, 1]) mesh(heartGeo(0.1), m, sx * 0.078, 0.165, 0.256, g);
    return g;
  },
  visor(c) {
    const g = new THREE.Group();
    mesh(new THREE.BoxGeometry(0.3, 0.075, 0.03), glow(c, 0.9), 0, 0.165, 0.245, g);
    mesh(new THREE.BoxGeometry(0.32, 0.01, 0.04), mat('#222', { metalness: 0.6 }), 0, 0.205, 0.245, g);
    return g;
  },
};

// ---- đầu (xương Head; đỉnh đầu y≈0.45) ----
const HEAD = {
  headphones(c) {
    const g = new THREE.Group(); const m = mat('#222', { metalness: 0.3 }); const cm = mat(c);
    const band = mesh(new THREE.TorusGeometry(0.3, 0.018, 8, 28, Math.PI), m, 0, 0.17, -0.01, g);
    band.scale.set(0.78, 0.98, 1);
    for (const sx of [-1, 1]) {
      const cup = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20), cm, sx * 0.238, 0.17, -0.01, g);
      cup.rotation.z = Math.PI / 2;
    }
    return g;
  },
  catears(c) {
    const g = new THREE.Group(); const m = mat(c); const inner = mat('#ff6fa5');
    for (const sx of [-1, 1]) {
      const e = mesh(new THREE.ConeGeometry(0.075, 0.16, 3), m, sx * 0.15, 0.5, 0.02, g);
      e.rotation.z = -sx * 0.35;
      const i = mesh(new THREE.ConeGeometry(0.04, 0.1, 3), inner, sx * 0.15, 0.495, 0.045, g);
      i.rotation.z = -sx * 0.35;
    }
    return g;
  },
  halo(c) {
    const g = new THREE.Group();
    const t = mesh(new THREE.TorusGeometry(0.19, 0.018, 8, 32), glow(c, 0.9), 0, 0.68, 0, g);
    t.rotation.x = Math.PI / 2 - 0.12;
    return g;
  },
  crown(c) {
    const g = new THREE.Group(); const m = mat(c, { metalness: 0.8, roughness: 0.25 });
    mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.07, 20, 1, true), Object.assign(m.clone(), { side: THREE.DoubleSide }), 0, 0.5, 0, g);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const sp = mesh(new THREE.ConeGeometry(0.035, 0.12, 6), m, Math.sin(a) * 0.19, 0.58, Math.cos(a) * 0.19, g);
      mesh(new THREE.SphereGeometry(0.018, 8, 8), mat(k % 2 ? '#ff3b6b' : '#3bd6ff', { emissive: k % 2 ? '#ff3b6b' : '#3bd6ff', emissiveIntensity: 0.4 }), Math.sin(a) * 0.19, 0.655, Math.cos(a) * 0.19, g);
      sp.rotation.set(0, 0, 0);
    }
    return g;
  },
  horns(c) {
    const g = new THREE.Group(); const m = mat(c);
    for (const sx of [-1, 1]) {
      const h = mesh(new THREE.ConeGeometry(0.04, 0.17, 10), m, sx * 0.12, 0.52, 0.06, g);
      h.rotation.z = -sx * 0.4; h.rotation.x = 0.2;
    }
    return g;
  },
};

// ---- cổ (xương Neck, gốc ở y≈1.33) ----
const NECK = {
  scarf(c) {
    const g = new THREE.Group(); const m = mat(c, { roughness: 0.95 });
    const r = mesh(new THREE.TorusGeometry(0.15, 0.05, 10, 24), m, 0, 0.03, 0.0, g);
    r.rotation.x = Math.PI / 2;
    const tail = mesh(new THREE.BoxGeometry(0.08, 0.3, 0.035), m, 0.07, -0.14, 0.16, g);
    tail.rotation.z = 0.1;
    mesh(new THREE.BoxGeometry(0.08, 0.03, 0.037), mat('#ffffff'), 0.075, -0.24, 0.16, g).rotation.z = 0.1;
    return g;
  },
  bow(c) {
    const g = new THREE.Group(); const m = mat(c);
    for (const sx of [-1, 1]) { const w = mesh(new THREE.ConeGeometry(0.06, 0.1, 3), m, sx * 0.06, -0.02, 0.17, g); w.rotation.z = -sx * Math.PI / 2; }
    mesh(new THREE.SphereGeometry(0.03, 10, 10), m, 0, -0.02, 0.17, g);
    return g;
  },
  chain(c) {
    const g = new THREE.Group(); const m = mat(c, { metalness: 0.9, roughness: 0.25 });
    const r = mesh(new THREE.TorusGeometry(0.16, 0.012, 8, 28), m, 0, -0.04, 0.02, g);
    r.rotation.x = Math.PI / 2 - 0.25;
    mesh(new THREE.SphereGeometry(0.03, 12, 12), m, 0, -0.16, 0.14, g);
    return g;
  },
};

// ---- lưng (xương Spine2, gốc ở y≈1.145; lưng sau ba lô z≈-0.34) ----
function wingPair(c, pts, scale, opts = {}) {
  const g = new THREE.Group();
  const m = mat(c, { side: THREE.DoubleSide, roughness: 0.7, ...opts });
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.ShapeGeometry(polyShape(pts, scale)), m);
    w.scale.x = sx;
    w.position.set(sx * 0.1, 0.22, -0.4);
    w.rotation.set(0, sx * -0.55, sx * 0.12);
    g.add(w);
  }
  return g;
}
const BACK = {
  wings: (c) => wingPair(c, [[0, 0], [0.1, 0.2], [0.28, 0.3], [0.5, 0.28], [0.68, 0.18], [0.6, 0.11], [0.66, 0.02], [0.55, -0.04], [0.58, -0.14], [0.44, -0.16], [0.42, -0.27], [0.28, -0.22], [0.2, -0.34], [0.1, -0.2]], 1.0, { emissive: '#bfe3ff', emissiveIntensity: 0.18 }),
  batwings: (c) => wingPair(c, [[0, 0], [0.12, 0.34], [0.42, 0.5], [0.78, 0.42], [0.68, 0.24], [0.74, 0.0], [0.56, 0.08], [0.54, -0.14], [0.38, -0.02], [0.3, -0.3], [0.18, -0.1], [0.06, -0.24]], 0.95),
  cape(c) {
    const g = new THREE.Group();
    const m = mat(c, { side: THREE.DoubleSide, roughness: 0.9 });
    const cape = new THREE.Mesh(new THREE.ShapeGeometry(polyShape([[-0.22, 0], [0.22, 0], [0.36, -0.95], [-0.36, -0.95]])), m);
    cape.position.set(0, 0.2, -0.38);
    cape.rotation.x = -0.1;
    g.add(cape);
    return g;
  },
  jetpack(c) {
    const g = new THREE.Group(); const m = mat(c, { metalness: 0.7, roughness: 0.35 });
    for (const sx of [-1, 1]) {
      mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.36, 14), m, sx * 0.1, 0.0, -0.44, g);
      mesh(new THREE.ConeGeometry(0.06, 0.16, 12), glow('#ff8a2a', 1.0), sx * 0.1, -0.26, -0.44, g).rotation.x = Math.PI;
    }
    return g;
  },
};

const BUILDERS = { ...FACE, ...HEAD, ...NECK, ...BACK };
const BONE_OF = { face: 'Head', head: 'Head', neck: 'Neck', back: 'Spine2' };
export const boneForSlot = (slot) => BONE_OF[slot];

/** Dựng phụ kiện cho một món (item.acc). Trả về Group hoặc null nếu lỗi. */
export function buildAccessory(item) {
  try {
    const b = BUILDERS[item.acc];
    if (!b) return null;
    const g = b(item.color || '#ffffff');
    g.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    return g;
  } catch (e) {
    console.warn('Lỗi dựng phụ kiện', item.id, e);
    return null;
  }
}
