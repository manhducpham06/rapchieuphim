'use strict';
/*
 * Thanh toán vé phòng bằng chuyển khoản VietQR.
 *
 * Luồng:
 *   1. Người chơi chọn phòng trả phí -> server tạo "đơn" với mã nội dung chuyển khoản, ví dụ RAPG7K2QM
 *      (chữ cái thứ 4 cho biết cấp phòng: S=Bạc, G=Vàng, V=Kim Cương).
 *   2. Người chơi quét QR / chuyển khoản đúng số tiền, đúng nội dung.
 *   3. Tiền được XÁC NHẬN bởi server theo một trong hai cách (không bao giờ tin client):
 *        a) Tự động: dịch vụ báo biến động số dư (SePay, Casso...) gọi webhook POST /api/webhook.
 *        b) Thủ công: chủ rạp mở /admin.html, đối chiếu app ngân hàng rồi bấm "Xác nhận".
 *   4. Server cấp "vé" là một chuỗi ký HMAC (có hạn dùng). Vé lưu ở trình duyệt người chơi và
 *      được kiểm tra lại mỗi lần vào phòng => không cần database, khởi động lại server vẫn còn vé
 *      miễn là biến môi trường SECRET không đổi.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const L = require('./public/layout.js');

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // bỏ I, L, O, 0, 1 cho dễ đọc
const LETTER_OF = { silver: 'S', gold: 'G', vip: 'V' };
const ROOM_OF = { S: 'silver', G: 'gold', V: 'vip' };
const CODE_RE = /RAP([SGV])([A-HJ-NP-Z2-9]{5})/;

function b64u(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64u(s) {
  return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function createPayments(env = process.env, opts = {}) {
  const warn = opts.warn || ((m) => console.warn(m));
  const cfg = {
    bank: {
      bin: env.BANK_BIN || '970436', // Vietcombank
      name: env.BANK_NAME || 'Vietcombank',
      account: env.BANK_ACCOUNT || '1054794616',
      holder: env.BANK_HOLDER || 'PHAM DUC MANH',
    },
    passDays: env.PASS_DAYS !== undefined && env.PASS_DAYS !== '' ? Math.max(0, Number(env.PASS_DAYS) || 0) : 30,
    webhookKey: env.PAYMENT_WEBHOOK_KEY || '',
    dataDir: env.DATA_DIR || path.join(__dirname, 'data'),
  };

  let secret = env.SECRET || '';
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    warn('[cảnh báo] Chưa đặt biến môi trường SECRET: vé đã bán sẽ mất hiệu lực mỗi lần server khởi động lại. Hãy đặt SECRET là một chuỗi ngẫu nhiên dài.');
  }
  let adminKey = env.ADMIN_KEY || '';
  let adminKeyGenerated = false;
  if (!adminKey) {
    adminKey = crypto.randomBytes(9).toString('base64url');
    adminKeyGenerated = true;
    warn(`[cảnh báo] Chưa đặt ADMIN_KEY. Khoá quản trị tạm thời của lần chạy này: ${adminKey}`);
  }

  const pending = new Map(); // code -> {code, room, amount, createdAt}
  const paid = new Map(); // code -> {code, room, amount, paidAt, source, txid}
  const seenTx = new Set();
  const MAX_PENDING = 2000;

  // ---- lưu danh sách đơn đã thanh toán (để chủ rạp tra cứu; vé không phụ thuộc file này) ----
  const file = path.join(cfg.dataDir, 'orders.json');
  try {
    const old = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const o of old.paid || []) paid.set(o.code, o);
  } catch {}
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        fs.mkdirSync(cfg.dataDir, { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ paid: [...paid.values()] }, null, 1));
      } catch {}
    }, 200);
    if (saveTimer.unref) saveTimer.unref();
  }

  // ---- vé ----
  function signToken(payload) {
    const body = b64u(JSON.stringify(payload));
    const sig = b64u(crypto.createHmac('sha256', secret).update(body).digest());
    return body + '.' + sig;
  }
  function issueToken(room, code) {
    const e = cfg.passDays > 0 ? Date.now() + cfg.passDays * 86400000 : 0;
    return signToken({ r: room, e, c: code });
  }
  /** Trả về {room, exp, code} nếu vé hợp lệ và còn hạn, ngược lại null. */
  function verifyToken(token) {
    if (typeof token !== 'string' || token.length > 400) return null;
    const i = token.indexOf('.');
    if (i < 1) return null;
    const body = token.slice(0, i);
    const sig = token.slice(i + 1);
    const good = b64u(crypto.createHmac('sha256', secret).update(body).digest());
    if (!safeEqual(sig, good)) return null;
    let p;
    try { p = JSON.parse(fromB64u(body).toString('utf8')); } catch { return null; }
    if (!p || !L.ROOM_BY_ID[p.r] || L.ROOM_BY_ID[p.r].price <= 0) return null;
    if (p.e && Date.now() > p.e) return null;
    return { room: p.r, exp: p.e || 0, code: p.c };
  }

  // ---- đơn ----
  function newCode(room) {
    for (let k = 0; k < 20; k++) {
      let s = '';
      const rnd = crypto.randomBytes(5);
      for (let i = 0; i < 5; i++) s += ALPHABET[rnd[i] % ALPHABET.length];
      const code = 'RAP' + LETTER_OF[room] + s;
      if (!pending.has(code) && !paid.has(code)) return code;
    }
    throw new Error('Không tạo được mã');
  }

  function createOrder(roomId) {
    const room = L.ROOM_BY_ID[roomId];
    if (!room || !(room.price > 0)) return { error: 'Phòng này miễn phí, không cần mua vé.' };
    if (pending.size >= MAX_PENDING) {
      // dọn đơn cũ nhất
      const oldest = [...pending.values()].sort((a, b) => a.createdAt - b.createdAt).slice(0, 200);
      oldest.forEach((o) => pending.delete(o.code));
    }
    const code = newCode(roomId);
    const order = { code, room: roomId, amount: room.price, createdAt: Date.now() };
    pending.set(code, order);
    return { order };
  }

  function normalizeCode(code) {
    const m = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').match(CODE_RE);
    return m ? m[0] : null;
  }

  /** Đánh dấu đã thanh toán. amount = số tiền thực nhận (VND). */
  function confirm(rawCode, amount, source, txid) {
    const code = normalizeCode(rawCode);
    if (!code) return { ok: false, reason: 'Không thấy mã đơn trong nội dung chuyển khoản' };
    const room = ROOM_OF[code[3]];
    const def = L.ROOM_BY_ID[room];
    if (paid.has(code)) return { ok: true, already: true, code, room };
    if (txid && seenTx.has(String(txid))) return { ok: true, already: true, code, room };
    if (!(Number(amount) >= def.price)) {
      return { ok: false, reason: `Số tiền ${amount} nhỏ hơn giá vé ${def.price}`, code };
    }
    const rec = { code, room, amount: Number(amount), paidAt: Date.now(), source, txid: txid ? String(txid) : '' };
    paid.set(code, rec);
    pending.delete(code);
    if (txid) seenTx.add(String(txid));
    save();
    return { ok: true, code, room };
  }

  function status(rawCode) {
    const code = normalizeCode(rawCode);
    if (!code) return { status: 'invalid' };
    const rec = paid.get(code);
    if (!rec) return { status: 'pending' };
    return { status: 'paid', room: rec.room, token: issueToken(rec.room, code) };
  }

  // ---- webhook (SePay / Casso / dịch vụ tương tự) ----
  function webhookAuthOk(headers, query) {
    if (!cfg.webhookKey) return false;
    const h = headers || {};
    const auth = String(h.authorization || '');
    const cands = [auth.replace(/^(Apikey|Bearer)\s+/i, ''), h['secure-token'], h['x-api-key'], query && query.key];
    return cands.some((c) => c && safeEqual(c, cfg.webhookKey));
  }
  function handleWebhook(headers, query, body) {
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
      const r = confirm(t.text, t.amount, 'webhook', t.id);
      if (r.ok && !r.already) confirmed++;
    }
    return { status: 200, json: { success: true, confirmed } };
  }

  // ---- quản trị ----
  const adminOk = (key) => !!key && safeEqual(key, adminKey);
  function adminList(key) {
    if (!adminOk(key)) return null;
    return {
      pending: [...pending.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 200),
      paid: [...paid.values()].sort((a, b) => b.paidAt - a.paidAt).slice(0, 200),
      total: [...paid.values()].reduce((s, o) => s + o.amount, 0),
    };
  }
  function adminConfirm(key, code) {
    if (!adminOk(key)) return null;
    const c = normalizeCode(code);
    if (!c) return { ok: false, reason: 'Mã không hợp lệ' };
    const def = L.ROOM_BY_ID[ROOM_OF[c[3]]];
    return confirm(c, def.price, 'admin', '');
  }

  function publicConfig() {
    return {
      bank: cfg.bank,
      passDays: cfg.passDays,
      autoConfirm: !!cfg.webhookKey,
      rooms: L.ROOMS,
    };
  }

  return {
    cfg, publicConfig, createOrder, status, confirm, verifyToken, issueToken,
    handleWebhook, adminList, adminConfirm, normalizeCode,
    get adminKeyGenerated() { return adminKeyGenerated; },
    _state: { pending, paid },
  };
}

module.exports = { createPayments, LETTER_OF, ROOM_OF };
