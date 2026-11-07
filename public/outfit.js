// Đổi màu / hoạ tiết quần áo của Aj: vẽ lại ảnh da (texture) theo "mặt nạ" vùng áo - quần - giày - mũ.
import * as THREE from 'three';

const S = 1024;
const REG = { top: 64, bottom: 128, shoes: 192, cap: 255 };
let ids = null; // Uint8Array S*S: 0 = giữ nguyên, 64/128/192/255 = vùng
let meanLum = null;
const cache = new Map(); // key -> material

export function loadOutfitMask(url = 'models/outfit_mask.png') {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = S;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(img, 0, 0, S, S);
        const d = x.getImageData(0, 0, S, S).data;
        ids = new Uint8Array(S * S);
        for (let i = 0; i < S * S; i++) ids[i] = d[i * 4];
        resolve(true);
      } catch { resolve(false); }
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}
export const outfitReady = () => !!ids;

const hex = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function hsl(h, s, l) {
  const k = (n) => (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** Màu hoạ tiết tại điểm ảnh (x,y) cho một món. */
function patternAt(it, x, y, c1, c2) {
  switch (it.style) {
    case 'stripe': return ((y / 26) | 0) % 2 ? c2 : c1;
    case 'check': return (((x / 34) | 0) + ((y / 34) | 0)) % 2 ? c2 : c1;
    case 'dots': { const dx = (x % 30) - 15, dy = (y % 30) - 15; return dx * dx + dy * dy < 36 ? c2 : c1; }
    case 'shine': { const t = 0.35 * (0.5 + 0.5 * Math.sin((x + y) / 38)); return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t]; }
    case 'stars': return hash((x / 5) | 0, (y / 5) | 0) > 0.988 ? c2 : [c1[0] * 0.9 + 10, c1[1] * 0.9 + 6, c1[2] * 0.9 + 20];
    case 'rainbow': return hsl((((x + y) / 700) % 1 + 1) % 1, 0.85, 0.55);
    default: return c1;
  }
}

function lumOf(d, i) { return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; }

function buildKey(eq, C) { return ['top', 'bottom', 'shoes', 'cap'].map((s) => (C.BY_ID[eq[s]] && C.BY_ID[eq[s]].slot === s ? eq[s] : '')).join('|'); }

/** Trả về vật liệu thân nhân vật đã đổi màu theo bộ đồ (có cache). base = vật liệu gốc. */
export function bodyMaterialFor(base, eq, C) {
  const key = buildKey(eq || {}, C);
  if (!key.replace(/\|/g, '') || !ids || !base || !base.map || !base.map.image) return base;
  if (cache.has(key)) return cache.get(key);
  try {
    const c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(base.map.image, 0, 0, S, S);
    const im = x.getImageData(0, 0, S, S); const d = im.data;
    if (!meanLum) { // độ sáng trung bình mỗi vùng trên ảnh gốc
      const sum = {}, n = {};
      for (let p = 0; p < S * S; p++) { const r = ids[p]; if (r) { sum[r] = (sum[r] || 0) + lumOf(d, p * 4); n[r] = (n[r] || 0) + 1; } }
      meanLum = {};
      for (const r in sum) meanLum[r] = Math.max(20, sum[r] / n[r]);
    }
    const parts = key.split('|');
    const items = { [REG.top]: C.BY_ID[parts[0]], [REG.bottom]: C.BY_ID[parts[1]], [REG.shoes]: C.BY_ID[parts[2]], [REG.cap]: C.BY_ID[parts[3]] };
    const cols = {};
    for (const r in items) if (items[r]) cols[r] = [hex(items[r].color), hex(items[r].color2 || items[r].color)];
    for (let p = 0; p < S * S; p++) {
      const r = ids[p]; const it = items[r];
      if (!r || !it) continue;
      const i = p * 4;
      const k = Math.min(1.9, Math.max(0.35, lumOf(d, i) / meanLum[r]));
      const px = p % S, py = (p / S) | 0;
      const col = patternAt(it, px, py, cols[r][0], cols[r][1]);
      d[i] = Math.min(255, col[0] * k); d[i + 1] = Math.min(255, col[1] * k); d[i + 2] = Math.min(255, col[2] * k);
    }
    x.putImageData(im, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = base.map.flipY; tex.colorSpace = base.map.colorSpace; tex.wrapS = base.map.wrapS; tex.wrapT = base.map.wrapT;
    tex.anisotropy = 4; tex.needsUpdate = true;
    const m = base.clone(); m.map = tex;
    cache.set(key, m);
    return m;
  } catch (e) {
    console.warn('Không đổi được màu đồ', e);
    return base;
  }
}
