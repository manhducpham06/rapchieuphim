// Giao diện ví xu: nạp xu (ngang) + cửa hàng thời trang / tủ đồ có nhân vật 3D xem thử.
import * as THREE from 'three';
import { createCharacter, characterReady } from './character.js';
import { icon } from './icons.js';

const C = window.CATALOG;
const $ = (id) => document.getElementById(id);
const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n);
const SLOT_ICON = { skin: 'users', face: 'glasses', head: 'crown', neck: 'scarf', back: 'wings' };
const CLOSE_UP = new Set(['face', 'head', 'neck']);

/** Nền CSS mô phỏng màu / hoạ tiết của món đồ để hiện trong ô lưới. */
function swatchBg(it) {
  const a = it.color || '#888', b = it.color2 || a;
  switch (it.style) {
    case 'stripe': return `repeating-linear-gradient(0deg, ${a} 0 7px, ${b} 7px 14px)`;
    case 'check': return `conic-gradient(${a} 25%, ${b} 0 50%, ${a} 0 75%, ${b} 0) 0 0 / 22px 22px`;
    case 'dots': return `radial-gradient(circle, ${b} 0 3px, transparent 3.5px) 0 0 / 12px 12px, ${a}`;
    case 'shine': return `linear-gradient(135deg, ${a}, ${b} 45%, ${a} 70%, ${b})`;
    case 'stars': return `radial-gradient(circle, #fff 0 1px, transparent 1.5px) 0 0 / 15px 15px, radial-gradient(circle, ${b} 0 1px, transparent 1.5px) 7px 7px / 19px 19px, ${a}`;
    case 'rainbow': return 'linear-gradient(135deg,#ff4d4d,#ffb13b,#ffe84d,#5be36a,#4d9dff,#a06bff)';
    default: return a;
  }
}

export function createWalletUI({ send, toast, getIdToken, isAccount, onNeedLogin, getLook }) {
  let w = { coins: 0, owned: [], equip: {}, admin: false };
  let mode = 'shop';
  let slot = 'skin';
  let sel = null;
  let pendingBuy = null;
  const owns = (id) => w.admin || w.owned.includes(id);

  // ================= Ví chung =================
  function setWallet(nw) {
    if (!nw) return;
    w = { coins: nw.coins | 0, owned: nw.owned || [], equip: nw.equip || {}, admin: !!nw.admin };
    $('coinAmt').textContent = fmt(w.coins);
    $('tuBal').textContent = fmt(w.coins);
    $('fsCoins').textContent = fmt(w.coins);
    if (!$('fashion').hidden) { renderFashion(); }
  }
  const wallet = () => w;
  function showGuestCoin(guest) {
    $('coinAmt').textContent = guest ? 'Khách' : fmt(w.coins);
  }

  // ================= Nạp xu =================
  let cfg = null;
  let pack = 'p5';
  let order = null;
  let pollTimer = null;

  async function loadCfg() {
    if (cfg) return cfg;
    try { cfg = await (await fetch('/api/config', { cache: 'no-store' })).json(); } catch { cfg = null; }
    if (!cfg || !cfg.packs) cfg = { packs: C.PACKS, bank: null, autoConfirm: false };
    return cfg;
  }
  function renderPacks() {
    const box = $('tuPacks');
    box.innerHTML = '';
    for (const p of (cfg ? cfg.packs : C.PACKS)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tu-pack' + (p.id === pack ? ' on' : '');
      b.innerHTML = `${p.id === 'p5' ? '<em>Phổ biến</em>' : ''}${icon('coin')}<b>${fmt(p.amount)}đ</b><small>nhận ${fmt(p.amount + (p.bonus || 0))} xu</small>`;
      b.addEventListener('click', () => { pack = p.id; if (!order) renderPacks(); });
      box.appendChild(b);
    }
  }
  function resetTopup() {
    clearInterval(pollTimer); pollTimer = null; order = null;
    $('tuEmpty').hidden = false; $('tuPay').hidden = true; $('tuDone').hidden = true;
    $('tuCreate').disabled = false; $('tuCreate').lastChild.textContent = 'Tạo mã chuyển khoản';
    renderPacks();
  }
  async function openTopup() {
    closeFashion();
    $('topup').hidden = false;
    $('tuBal').textContent = fmt(w.coins);
    await loadCfg();
    resetTopup();
    $('tuNote').textContent = isAccount() ? 'Mỗi lần nạp tối đa 10.000đ. Xu không đổi lại thành tiền.' : 'Bạn cần đăng nhập tài khoản để nạp xu (khách không có ví).';
  }
  function closeTopup() { $('topup').hidden = true; clearInterval(pollTimer); pollTimer = null; }

  async function createOrder() {
    if (!isAccount()) { toast('Hãy đăng nhập để nạp xu.'); onNeedLogin && onNeedLogin(); return; }
    const btn = $('tuCreate');
    btn.disabled = true;
    try {
      const idToken = await getIdToken();
      const r = await fetch('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pack, idToken }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Không tạo được đơn');
      order = j;
      showPay();
    } catch (e) {
      toast(e.message || 'Không tạo được đơn, thử lại nhé.');
      btn.disabled = false;
    }
  }
  function showPay() {
    const b = (cfg && cfg.bank) || {};
    $('bkName').textContent = b.name || '';
    $('bkHolder').textContent = b.holder || '';
    $('bkAcc').textContent = b.account || '';
    $('bkAmt').textContent = fmt(order.amount) + 'đ';
    $('bkAmtRaw').textContent = String(order.amount);
    $('bkCode').textContent = order.code;
    const img = $('qrImg');
    $('qrFallback').hidden = true; img.hidden = false;
    img.onerror = () => { img.hidden = true; $('qrFallback').hidden = false; };
    img.src = `https://img.vietqr.io/image/${b.bin}-${b.account}-compact2.png?amount=${order.amount}&addInfo=${encodeURIComponent(order.code)}&accountName=${encodeURIComponent(b.holder || '')}`;
    $('tuEmpty').hidden = true; $('tuPay').hidden = false; $('tuDone').hidden = true;
    $('tuState').className = 'state'; $('tuStateText').textContent = 'Đang chờ tiền về…';
    $('tuManual').textContent = cfg && cfg.autoConfirm ? 'Hệ thống tự cộng xu trong ít giây sau khi tiền về.' : 'Chủ game sẽ đối chiếu và xác nhận (thường trong vài phút). Xu sẽ tự vào ví của bạn.';
    $('tuCreate').lastChild.textContent = 'Đã tạo mã - hãy chuyển khoản';
    let tries = 0;
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (!order || ++tries > 400) { clearInterval(pollTimer); return; }
      try {
        const s = await (await fetch('/api/order/' + order.code, { cache: 'no-store' })).json();
        if (s.status === 'paid') {
          clearInterval(pollTimer);
          $('tuPay').hidden = true; $('tuDone').hidden = false;
          $('tuDoneText').textContent = `Đã cộng ${fmt(order.amount)} xu vào ví của bạn.`;
          order = null;
        }
      } catch {}
    }, 3000);
  }
  $('tuCreate').addEventListener('click', createOrder);
  $('tuClose').addEventListener('click', closeTopup);
  $('tuShop').addEventListener('click', () => { closeTopup(); open('shop'); });
  document.querySelectorAll('#topup .copy').forEach((b) => b.addEventListener('click', async () => {
    const t = $(b.dataset.copy).textContent;
    try { await navigator.clipboard.writeText(t); } catch {
      const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove();
    }
    b.classList.add('done'); setTimeout(() => b.classList.remove('done'), 1200);
  }));
  $('coinPill').addEventListener('click', () => openTopup());

  // ================= Xem thử 3D =================
  const pv = { r: null, scene: null, cam: null, ch: null, raf: 0, ry: 0.35, drag: null, last: 0, camY: 1.0, camZ: 5.2, ly: 0.95 };
  function initPreview() {
    if (pv.r) return;
    const cv = $('fsCanvas');
    pv.r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    pv.r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    pv.scene = new THREE.Scene();
    pv.scene.add(new THREE.HemisphereLight(0xffffff, 0x7a5a8a, 1.5));
    const dl = new THREE.DirectionalLight(0xffffff, 1.8);
    dl.position.set(2, 4, 5);
    pv.scene.add(dl);
    const rim = new THREE.DirectionalLight(0xff9ad0, 0.9);
    rim.position.set(-3, 2, -4);
    pv.scene.add(rim);
    pv.cam = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
    cv.addEventListener('pointerdown', (e) => { pv.drag = { x: e.clientX, ry: pv.ry }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (pv.drag) pv.ry = pv.drag.ry + (e.clientX - pv.drag.x) * 0.012; });
    const end = () => { pv.drag = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }
  function buildChar() {
    if (pv.ch || !characterReady()) return;
    pv.ch = createCharacter(getLook ? getLook() : null);
    pv.scene.add(pv.ch.group);
    applyTryOn();
  }
  function tryOn() {
    const o = { ...w.equip };
    if (sel && C.BY_ID[sel]) o[C.BY_ID[sel].slot] = sel;
    return o;
  }
  function applyTryOn() { if (pv.ch && pv.ch.setOutfit) pv.ch.setOutfit(tryOn()); }
  function resizePreview() {
    const cv = $('fsCanvas');
    const r = cv.getBoundingClientRect();
    if (!pv.r || r.width < 10) return;
    pv.r.setSize(r.width, r.height, false);
    pv.cam.aspect = r.width / r.height;
    pv.cam.updateProjectionMatrix();
  }
  function loop(t) {
    pv.raf = requestAnimationFrame(loop);
    if ($('fashion').hidden) return;
    const dt = Math.min(0.05, (t - (pv.last || t)) / 1000); pv.last = t;
    buildChar();
    const close = CLOSE_UP.has(slot);
    const tz = close ? 2.6 : 4.4, ty = close ? 1.25 : 0.95, tl = close ? 1.2 : 0.7;
    const k = 1 - Math.exp(-5 * dt);
    pv.camZ += (tz - pv.camZ) * k; pv.camY += (ty - pv.camY) * k; pv.ly += (tl - pv.ly) * k;
    pv.cam.position.set(0, pv.camY, pv.camZ);
    pv.cam.lookAt(0, pv.ly, 0);
    if (pv.ch) {
      if (!pv.drag) pv.ry += dt * 0.5;
      pv.ch.group.rotation.y = pv.ry;
      pv.ch.update(dt, { speed: 0, sitting: false, emote: null, now: performance.now() });
    }
    pv.r.render(pv.scene, pv.cam);
  }

  // ================= Cửa hàng / Tủ đồ =================
  function open(m) {
    closeTopup();
    mode = m === 'ward' ? 'ward' : 'shop';
    $('fashion').hidden = false;
    initPreview();
    resizePreview();
    sel = null;
    if (!pv.raf) pv.raf = requestAnimationFrame(loop);
    document.querySelectorAll('#fashion .fs-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    renderFashion();
    applyTryOn();
    setTimeout(resizePreview, 60);
  }
  function closeFashion() {
    if ($('fashion').hidden) return;
    $('fashion').hidden = true;
    if (pv.raf) { cancelAnimationFrame(pv.raf); pv.raf = 0; }
    sel = null;
  }
  const isOpen = () => !$('fashion').hidden || !$('topup').hidden;
  const close = () => { closeFashion(); closeTopup(); };

  function renderFashion() {
    $('fsTitle').textContent = mode === 'shop' ? 'Shop Thời Trang' : 'Tủ đồ của tôi';
    $('fsOwnerTag').hidden = !w.admin;
    $('fsCoins').textContent = fmt(w.coins);
    // ô trang bị
    const sb = $('fsSlots');
    sb.innerHTML = '';
    for (const s of C.SLOTS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = s.id === slot ? 'on' : '';
      b.innerHTML = `${icon(s.icon)}${s.name}`;
      b.addEventListener('click', () => { slot = s.id; sel = null; renderFashion(); applyTryOn(); });
      sb.appendChild(b);
    }
    // lưới món
    const grid = $('fsGrid');
    grid.innerHTML = '';
    let items = C.ITEMS.filter((i) => i.slot === slot);
    if (mode === 'ward') items = items.filter((i) => owns(i.id));
    if (!items.length) {
      grid.innerHTML = `<div class="fs-empty">${isAccount() ? 'Bạn chưa có món nào ở mục này. Ra Cửa hàng để mua nhé!' : 'Khách không có tủ đồ. Hãy đăng nhập để mua và lưu đồ.'}</div>`;
    }
    for (const it of items) {
      const b = document.createElement('button');
      b.type = 'button';
      const worn = w.equip[it.slot] === it.id;
      b.className = 'fs-item' + (sel === it.id ? ' sel' : '') + (worn ? ' worn' : '');
      const state = owns(it.id) ? `<span class="own">${w.admin ? 'Miễn phí' : 'Đã sở hữu'}</span>` : `<span class="pr">${icon('coin')}${fmt(it.price)}</span>`;
      b.innerHTML = `${worn ? '<span class="badge">ĐANG MẶC</span>' : ''}<div class="fs-sw" style="background:${it.img ? '#f3ead6' : swatchBg(it)}">${it.img ? `<img src="img/chars/${it.img}.png" alt="" style="width:100%;height:100%;object-fit:contain;image-rendering:auto">` : it.acc ? icon(SLOT_ICON[it.slot]) : ''}</div><b>${it.name}</b>${state}`;
      b.addEventListener('click', () => { sel = it.id; renderFashion(); applyTryOn(); });
      grid.appendChild(b);
    }
    renderBar();
  }
  function renderBar() {
    const btn = $('fsAct');
    const info = $('fsInfo');
    const it = sel ? C.BY_ID[sel] : null;
    btn.className = 'primary';
    btn.disabled = false;
    if (!it) {
      const cur = C.BY_ID[w.equip[slot]];
      info.innerHTML = cur ? `Đang mặc: <b>${cur.name}</b>` : 'Chọn một món để mặc thử.';
      if (cur) { btn.textContent = 'Cởi món này'; btn.dataset.act = 'unequip'; }
      else { btn.textContent = 'Chọn món'; btn.disabled = true; btn.dataset.act = ''; btn.classList.add('off'); }
      return;
    }
    if (owns(it.id)) {
      const worn = w.equip[it.slot] === it.id;
      info.innerHTML = `<b>${it.name}</b> · ${w.admin ? 'chủ shop dùng miễn phí' : 'bạn đã sở hữu'}`;
      btn.textContent = worn ? 'Cởi ra' : 'Mặc vào';
      btn.dataset.act = worn ? 'unequip' : 'equip';
    } else if (!isAccount()) {
      info.innerHTML = `<b>${it.name}</b> · ${fmt(it.price)} xu. Khách chưa mua được đồ.`;
      btn.textContent = 'Đăng nhập để mua'; btn.dataset.act = 'login'; btn.classList.add('buy');
    } else if (w.coins < it.price) {
      info.innerHTML = `<b>${it.name}</b> · ${fmt(it.price)} xu. Bạn còn thiếu <b>${fmt(it.price - w.coins)}</b> xu.`;
      btn.textContent = 'Nạp thêm xu'; btn.dataset.act = 'topup'; btn.classList.add('buy');
    } else {
      info.innerHTML = `<b>${it.name}</b> · ${fmt(it.price)} xu (còn ${fmt(w.coins - it.price)} sau khi mua).`;
      btn.textContent = `Mua · ${fmt(it.price)} xu`; btn.dataset.act = 'buy'; btn.classList.add('buy');
    }
  }
  $('fsAct').addEventListener('click', () => {
    const act = $('fsAct').dataset.act;
    const it = sel ? C.BY_ID[sel] : null;
    if (act === 'buy' && it) { pendingBuy = it.id; $('fsAct').disabled = true; send({ t: 'buy', item: it.id }); }
    else if (act === 'equip' && it) send({ t: 'equip', slot: it.slot, item: it.id });
    else if (act === 'unequip') send({ t: 'equip', slot: it ? it.slot : slot, item: null });
    else if (act === 'topup') openTopup();
    else if (act === 'login') { onNeedLogin && onNeedLogin(); }
  });
  document.querySelectorAll('#fashion .fs-tabs button').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode; sel = null;
    document.querySelectorAll('#fashion .fs-tabs button').forEach((x) => x.classList.toggle('on', x === b));
    renderFashion(); applyTryOn();
  }));
  $('fsClose').addEventListener('click', closeFashion);
  $('fsTop').addEventListener('click', () => openTopup());
  window.addEventListener('resize', () => { if (!$('fashion').hidden) resizePreview(); });

  /** Kết quả mua từ server. */
  function onBuyRes(m) {
    const it = C.BY_ID[m.item];
    if (m.ok && it) {
      toast(`Đã mua ${it.name}!`);
      if (pendingBuy === it.id) send({ t: 'equip', slot: it.slot, item: it.id }); // mặc luôn
    } else {
      toast(m.error || 'Không mua được.');
      if (m.short) openTopup();
    }
    pendingBuy = null;
    if (!$('fashion').hidden) renderBar();
  }

  return { open, openTopup, close, isOpen, setWallet, wallet, onBuyRes, showGuestCoin, closeTopup, closeFashion };
}
