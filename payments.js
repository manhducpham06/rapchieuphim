'use strict';
/*
 * Nạp xu bằng chuyển khoản VietQR.
 *
 * Luồng:
 *   1. Người chơi ĐÃ ĐĂNG NHẬP chọn gói nạp -> server tạo "đơn" gắn với tài khoản, kèm mã nội dung chuyển khoản, ví dụ RAPK7M2QX.
 *   2. Người chơi quét QR / chuyển khoản đúng số tiền, đúng nội dung.
 *   3. Tiền được XÁC NHẬN bởi server (không bao giờ tin client):
 *        a) Tự động: dịch vụ báo biến động số dư (SePay, Casso...) gọi webhook POST /api/webhook.
 *        b) Thủ công: chủ game mở /admin.html, đối chiếu app ngân hàng rồi bấm "Xác nhận".
 *   4. Khi xác nhận, số xu được cộng thẳng vào ví của tài khoản đó (lưu bền trong kho dữ liệu, xem store.js).
 */
const crypto = require('crypto');
const C = require('./public/catalog.js');

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // bỏ I, L, O, 0, 1 cho dễ đọc
const CODE_RE = /RAP([A-HJ-NP-Z2-9]{6})/;

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function createPayments(env = process.env, opts = {}) {
  const warn = opts.warn || ((m) => console.warn(m));
  const store = opts.store;
  const wallet = opts.wallet;
  const onCredit = opts.onCredit || (() => {});
  const cfg = {
    bank: {
      bin: env.BANK_BIN || '970436', // Vietcombank
      name: env.BANK_NAME || 'Vietcombank',
      account: env.BANK_ACCOUNT || '1054794616',
      holder: env.BANK_HOLDER || 'PHAM DUC MANH',
    },
    webhookKey: env.PAYMENT_WEBHOOK_KEY || '',
  };
  let adminKey = env.ADMIN_KEY || '';
  let adminKeyGenerated = false;
  if (!adminKey) {
    adminKey = crypto.randomBytes(9).toString('base64url');
    adminKeyGenerated = true;
    warn(`[cảnh báo] Chưa đặt ADMIN_KEY. Khoá quản trị tạm thời của lần chạy này: ${adminKey}`);
  }

  const recent = new Map(); // code -> đơn (chỉ các đơn của lần chạy này, để chủ game xem)
  const seenTx = new Set();
  const busy = new Set();
  const MAX_RECENT = 1000;

  function normalizeCode(code) {
    const m = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').match(CODE_RE);
    return m ? m[0] : null;
  }

  async function newCode() {
    for (let k = 0; k < 20; k++) {
      let s = '';
      const rnd = crypto.randomBytes(6);
      for (let i = 0; i < 6; i++) s += ALPHABET[rnd[i] % ALPHABET.length];
      const code = 'RAP' + s;
      if (!recent.has(code) && !(await store.get('orders', code))) return code;
    }
    throw new Error('Không tạo được mã');
  }

  async function createOrder(uid, packId) {
    const pack = C.PACK_BY_ID[packId];
    if (!pack) return { error: 'Gói nạp không tồn tại.' };
    if (!uid) return { error: 'Bạn cần đăng nhập để nạp xu.' };
    const code = await newCode();
    const order = { code, uid, pack: pack.id, amount: pack.amount, createdAt: Date.now(), paidAt: 0, source: '', txid: '' };
    await store.set('orders', code, order);
    if (recent.size >= MAX_RECENT) recent.delete(recent.keys().next().value);
    recent.set(code, order);
    return { order: { code, amount: order.amount, pack: pack.id } };
  }

  async function findOrder(code) {
    return recent.get(code) || (await store.get('orders', code));
  }

  /** Đánh dấu đã thanh toán và cộng xu. amount = số tiền thực nhận (VND). */
  async function confirm(rawCode, amount, source, txid) {
    const code = normalizeCode(rawCode);
    if (!code) return { ok: false, reason: 'Không thấy mã đơn trong nội dung chuyển khoản' };
    if (txid && seenTx.has(String(txid))) return { ok: true, already: true, code };
    if (busy.has(code)) return { ok: true, already: true, code };
    busy.add(code);
    try {
      const o = await findOrder(code);
      if (!o) return { ok: false, reason: 'Không có đơn ' + code, code };
      if (o.paidAt) return { ok: true, already: true, code };
      if (!(Number(amount) >= o.amount)) return { ok: false, reason: `Số tiền ${amount} nhỏ hơn đơn ${o.amount}`, code };
      o.paidAt = Date.now();
      o.source = source;
      o.txid = txid ? String(txid) : '';
      await store.set('orders', code, o); // đánh dấu đã trả TRƯỚC khi cộng xu: không bao giờ cộng hai lần
      if (txid) seenTx.add(String(txid));
      recent.set(code, o);
      const w = await wallet.credit(o.uid, o.amount);
      try { onCredit(o.uid, w, o); } catch {}
      return { ok: true, code, uid: o.uid, amount: o.amount };
    } finally {
      busy.delete(code);
    }
  }

  async function status(rawCode) {
    const code = normalizeCode(rawCode);
    if (!code) return { status: 'invalid' };
    const o = await findOrder(code);
    if (!o) return { status: 'invalid' };
    return { status: o.paidAt ? 'paid' : 'pending', amount: o.amount };
  }

  // ---- webhook (SePay / Casso / dịch vụ tương tự) ----
  function webhookAuthOk(headers, query) {
    if (!cfg.webhookKey) return false;
    const h = headers || {};
    const auth = String(h.authorization || '');
    const cands = [auth.replace(/^(Apikey|Bearer)\s+/i, ''), h['secure-token'], h['x-api-key'], query && query.key];
    return cands.some((c) => c && safeEqual(c, cfg.webhookKey));
  }
  async function handleWebhook(headers, query, body) {
    if (!cfg.webhookKey) return { status: 503, json: { success: false, message: 'Webhook chưa được bật (thiếu PAYMENT_WEBHOOK_KEY)' } };
    if (!webhookAuthOk(headers, query)) return { status: 401, json: { success: false, message: 'Sai khoá xác thực' } };
    const txs = [];
    if (body && Array.isArray(body.data)) {
      for (const t of body.data) txs.push({ id: t.id || t.tid, amount: t.amount, text: `${t.description || ''} ${t.content || ''}`, incoming: Number(t.amount) > 0 });
    } else if (body) {
      txs.push({
        id: body.id || body.referenceCode,
        amount: body.transferAmount !== undefined ? body.transferAmount : body.amount,
        text: `${body.content || ''} ${body.description || ''} ${body.code || ''}`,
        incoming: body.transferType ? body.transferType === 'in' : true,
      });
    }
    let confirmed = 0;
    for (const t of txs) {
      if (!t.incoming) continue;
      const r = await confirm(t.text, t.amount, 'webhook', t.id);
      if (r.ok && !r.already) confirmed++;
    }
    return { status: 200, json: { success: true, confirmed } };
  }

  // ---- quản trị ----
  const adminOk = (key) => !!key && safeEqual(key, adminKey);
  function adminList(key) {
    if (!adminOk(key)) return null;
    const all = [...recent.values()];
    return {
      pending: all.filter((o) => !o.paidAt).sort((a, b) => b.createdAt - a.createdAt).slice(0, 200),
      paid: all.filter((o) => o.paidAt).sort((a, b) => b.paidAt - a.paidAt).slice(0, 200),
      total: all.filter((o) => o.paidAt).reduce((s, o) => s + o.amount, 0),
    };
  }
  async function adminConfirm(key, code) {
    if (!adminOk(key)) return null;
    const c = normalizeCode(code);
    if (!c) return { ok: false, reason: 'Mã không hợp lệ' };
    const o = await findOrder(c);
    if (!o) return { ok: false, reason: 'Không có đơn ' + c };
    return confirm(c, o.amount, 'admin', '');
  }

  function publicConfig() {
    return { bank: cfg.bank, autoConfirm: !!cfg.webhookKey, packs: C.PACKS };
  }

  return {
    cfg, publicConfig, createOrder, status, confirm,
    handleWebhook, adminList, adminConfirm, normalizeCode,
    get adminKeyGenerated() { return adminKeyGenerated; },
  };
}

module.exports = { createPayments };
