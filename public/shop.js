// Cửa hàng vé: tạo đơn, hiện QR VietQR + thông tin chuyển khoản, chờ tiền về rồi nhận vé.
const $ = (id) => document.getElementById(id);

export function createShop({ store, toast, onToken }) {
  let cfg = null;
  let cur = null; // { room, order, timer }

  const tokens = () => (Array.isArray(store.get('tokens', [])) ? store.get('tokens', []) : []);
  function addToken(t) {
    const list = tokens().filter((x) => x !== t);
    list.push(t);
    store.set('tokens', list.slice(-8));
  }

  async function loadConfig() {
    if (cfg) return cfg;
    try {
      const r = await fetch('/api/config');
      cfg = await r.json();
    } catch { cfg = null; }
    return cfg;
  }

  const money = (n) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

  function qrUrl(order) {
    const b = cfg.bank;
    const q = new URLSearchParams({ amount: String(order.amount), addInfo: order.code, accountName: b.holder });
    return `https://img.vietqr.io/image/${b.bin}-${b.account}-compact2.png?${q}`;
  }

  function show(step) {
    $('shopStep1').hidden = step !== 1;
    $('shopStep2').hidden = step !== 2;
    $('shopDone').hidden = step !== 3;
  }

  function stopPoll() { if (cur && cur.timer) { clearInterval(cur.timer); cur.timer = null; } }
  function close() { stopPoll(); $('shop').hidden = true; cur = null; }

  async function open(room) {
    const c = await loadConfig();
    if (!c) { toast('Không tải được thông tin thanh toán. Thử lại sau nhé.'); return; }
    cur = { room, order: null, timer: null };
    const tier = room.tier || 1;
    $('shopTitle').textContent = room.name;
    $('shopDesc').textContent = room.desc;
    $('shopPrice').textContent = money(room.price);
    $('shopDays').textContent = c.passDays ? `/ ${c.passDays} ngày` : '/ vĩnh viễn';
    $('shopBadge').className = 'tier-badge t-' + room.id;
    $('shopFoot').textContent = 'Tiền chuyển khoản được dùng để duy trì máy chủ rạp. Không thu thêm khoản nào khác.';
    // còn đơn cũ chưa thanh toán của phòng này? mở lại để người chơi khỏi tạo đơn mới
    const saved = store.get('order:' + room.id, null);
    show(1);
    $('shop').hidden = false;
    if (saved && saved.code && Date.now() - saved.createdAt < 24 * 3600 * 1000) { cur.order = saved; await showOrder(); }
  }

  async function createOrder() {
    $('shopBuy').disabled = true;
    try {
      const r = await fetch('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: cur.room.id }) });
      const j = await r.json();
      if (!r.ok || j.error) { toast(j.error || 'Không tạo được đơn.'); return; }
      cur.order = j;
      store.set('order:' + cur.room.id, j);
      await showOrder();
    } catch { toast('Mất kết nối khi tạo đơn.'); } finally { $('shopBuy').disabled = false; }
  }

  async function showOrder() {
    const o = cur.order, b = cfg.bank;
    $('bkName').textContent = b.name;
    $('bkHolder').textContent = b.holder;
    $('bkAcc').textContent = b.account;
    $('bkAmt').textContent = money(o.amount);
    $('bkAmtRaw').textContent = String(o.amount);
    $('bkCode').textContent = o.code;
    const img = $('qrImg');
    $('qrFallback').hidden = true;
    img.hidden = false;
    img.onerror = () => { img.hidden = true; $('qrFallback').hidden = false; };
    img.src = qrUrl(o);
    $('shopManual').textContent = cfg.autoConfirm
      ? 'Hệ thống tự nhận tiền, thường mất dưới 1 phút.'
      : 'Chủ rạp đối chiếu và xác nhận thủ công nên có thể mất vài phút. Bạn có thể đóng cửa sổ này, mã đơn đã được lưu; mở lại phòng này để kiểm tra.';
    setState(false, 'Đang chờ tiền về…');
    show(2);
    stopPoll();
    check();
    cur.timer = setInterval(check, 4000);
  }

  function setState(ok, text) {
    $('shopState').className = 'state' + (ok ? ' ok' : '');
    $('shopStateText').textContent = text;
  }

  async function check() {
    if (!cur || !cur.order) return;
    try {
      const r = await fetch('/api/order/' + encodeURIComponent(cur.order.code));
      const j = await r.json();
      if (j.status === 'paid' && j.token) {
        stopPoll();
        store.set('order:' + cur.room.id, null);
        addToken(j.token);
        $('shopToken').value = j.token;
        show(3);
        onToken(j.token, cur.room.id);
      } else if (j.status === 'invalid') {
        setState(false, 'Mã đơn không hợp lệ, hãy tạo đơn mới.');
        store.set('order:' + cur.room.id, null);
        stopPoll();
      }
    } catch { /* mạng chập chờn: thử lại lần sau */ }
  }

  async function redeem(token) {
    token = String(token || '').trim();
    if (!token) return false;
    try {
      const r = await fetch('/api/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      const j = await r.json();
      if (!j.ok) { toast(j.error || 'Vé không hợp lệ.'); return false; }
      addToken(token);
      onToken(token, j.room);
      return true;
    } catch { toast('Không kiểm tra được vé, thử lại sau.'); return false; }
  }

  function copy(id, btn) {
    const text = $(id).textContent;
    const done = () => { btn.classList.add('done'); setTimeout(() => btn.classList.remove('done'), 1200); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch {}
    ta.remove();
  }

  $('shopBuy').addEventListener('click', createOrder);
  $('shopClose').addEventListener('click', close);
  $('shop').addEventListener('pointerdown', (e) => { if (e.target === $('shop')) close(); });
  document.querySelectorAll('.copy').forEach((b) => b.addEventListener('click', () => copy(b.dataset.copy, b)));

  return {
    open, close, redeem, tokens, addToken,
    onGo(fn) { $('shopGo').addEventListener('click', () => { const id = cur && cur.room.id; close(); fn(id); }); },
  };
}
