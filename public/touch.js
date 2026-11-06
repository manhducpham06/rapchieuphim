// Điều khiển cảm ứng: cần gạt ảo bên trái (di chuyển), nút hành động, nút chạy.
const $ = (id) => document.getElementById(id);

export const isTouchDevice = () =>
  (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window || navigator.maxTouchPoints > 0;

export function createTouch({ onAct }) {
  const state = { x: 0, y: 0, run: false, active: false };
  const joy = $('joy'), knob = $('joyKnob');
  let pid = null, cx = 0, cy = 0, R = 50;

  function update(e) {
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / R, ny = dy / R;
    const mag = Math.hypot(nx, ny);
    const dead = 0.18;
    if (mag < dead) { state.x = state.y = 0; state.active = false; }
    else { state.x = nx; state.y = ny; state.active = true; }
  }
  function release() {
    pid = null; state.x = state.y = 0; state.active = false;
    knob.style.transform = 'translate(0,0)';
  }
  joy.addEventListener('pointerdown', (e) => {
    if (pid !== null) return;
    e.preventDefault();
    pid = e.pointerId;
    joy.setPointerCapture(pid);
    const r = joy.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = r.width / 2 - 10;
    update(e);
  });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === pid) update(e); });
  joy.addEventListener('pointerup', (e) => { if (e.pointerId === pid) release(); });
  joy.addEventListener('pointercancel', (e) => { if (e.pointerId === pid) release(); });
  window.addEventListener('blur', release);

  $('touchAct').addEventListener('click', () => onAct());
  $('touchRun').addEventListener('click', () => {
    state.run = !state.run;
    $('touchRun').classList.toggle('on', state.run);
  });

  return {
    state,
    show(on) { $('touchUI').hidden = !on; },
    setAction(label, icon, idle) {
      $('touchActText').textContent = label;
      $('touchActIcon').setAttribute('href', '#i-' + icon);
      $('touchAct').classList.toggle('idle', !!idle);
    },
  };
}
