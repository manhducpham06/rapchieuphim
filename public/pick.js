// Màn hình chọn nhân vật: chọn nam / nữ, xem 3D xoay, chọn một trong 13 nhân vật.
import * as THREE from 'three';
import { createCharacter } from './character.js';

const $ = (id) => document.getElementById(id);
const L = window.LAYOUT;
let r = null, scene = null, cam = null, ch = null, raf = 0, ry = 0.3, drag = null;

function init() {
  if (r) return;
  const cv = $('pkCanvas');
  r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  r.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd8c0, 0.9));
  const sun = new THREE.DirectionalLight(0xfff3dc, 1.8);
  sun.position.set(3, 5, 4);
  scene.add(sun);
  cam = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
  cam.position.set(0, 1.0, 4.9);
  cam.lookAt(0, 0.7, 0);
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, ry }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => { if (drag) ry = drag.ry + (e.clientX - drag.x) * 0.012; });
  const end = () => { drag = null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
}
function resize() {
  const cv = $('pkCanvas'), b = cv.getBoundingClientRect();
  if (b.width < 10) return;
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  r.setSize(b.width, b.height, false);
  cam.aspect = b.width / b.height;
  cam.updateProjectionMatrix();
}

/** Mở màn hình chọn. current = số thứ tự đang chọn. Trả về Promise<số thứ tự> (hoặc null nếu huỷ). */
export function pickCharacter(current = 0, { cancellable = false } = {}) {
  return new Promise((resolve) => {
    init();
    let sel = current >= 0 && current < L.CHARS.length ? current : 0;
    let gender = L.CHARS[sel].g;
    $('pick').hidden = false;
    $('pkCancel').hidden = !cancellable;
    const show = () => {
      if (ch) { scene.remove(ch.group); ch.dispose(); }
      ch = createCharacter({ char: sel });
      scene.add(ch.group);
    };
    const renderGrid = () => {
      document.querySelectorAll('#pkTabs button').forEach((b) => b.classList.toggle('on', b.dataset.g === gender));
      const grid = $('pkGrid');
      grid.innerHTML = '';
      L.CHARS.forEach((c, i) => {
        if (c.g !== gender) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = i === sel ? 'on' : '';
        b.innerHTML = `<img src="img/chars/${c.key}.png" alt=""><span>${c.name}</span>`;
        b.addEventListener('click', () => { sel = i; renderGrid(); show(); });
        grid.appendChild(b);
      });
    };
    document.querySelectorAll('#pkTabs button').forEach((b) => (b.onclick = () => {
      gender = b.dataset.g;
      if (L.CHARS[sel].g !== gender) sel = L.CHARS.findIndex((c) => c.g === gender);
      renderGrid(); show();
    }));
    const done = (v) => {
      cancelAnimationFrame(raf); raf = 0;
      $('pick').hidden = true;
      if (ch) { scene.remove(ch.group); ch.dispose(); ch = null; }
      resolve(v);
    };
    $('pkGo').onclick = () => done(sel);
    $('pkCancel').onclick = () => done(null);
    renderGrid(); show(); resize();
    let last = performance.now();
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (ch) {
        if (!drag) ry += dt * 0.7;
        ch.group.rotation.y = ry;
        ch.update(dt, { speed: 0, sitting: false, emote: null, now: t });
      }
      r.render(scene, cam);
    };
    raf = requestAnimationFrame(loop);
    setTimeout(resize, 60);
  });
}
