'use strict';
/*
 * Kho dữ liệu đơn giản: get/set tài liệu JSON theo (bộ sưu tập, id).
 *  - Có FIREBASE_SERVICE_ACCOUNT  -> lưu bền vào Firestore của bạn (REST, không cần thư viện).
 *  - Không có                     -> lưu file JSON trong DATA_DIR (Render gói miễn phí sẽ MẤT khi server khởi động lại).
 * Mỗi tài liệu Firestore chỉ có một trường "j" chứa chuỗi JSON => không cần lo kiểu dữ liệu.
 */
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');

const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function httpsJson(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ method, hostname: u.hostname, path: u.pathname + u.search, headers, timeout: 8000 }, (res) => {
      let s = '';
      res.on('data', (d) => (s += d));
      res.on('end', () => {
        let j = null;
        try { j = s ? JSON.parse(s) : null; } catch {}
        resolve({ status: res.statusCode, json: j });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    if (body) req.write(body);
    req.end();
  });
}

function parseServiceAccount(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  try {
    if (!s.startsWith('{')) s = Buffer.from(s, 'base64').toString('utf8');
    const j = JSON.parse(s);
    if (j.client_email && j.private_key && j.project_id) return j;
  } catch {}
  return null;
}

function createStore(opts = {}) {
  const env = opts.env || process.env;
  const warn = opts.warn || ((m) => console.warn(m));
  const request = opts.request || httpsJson;
  const sa = opts.serviceAccount !== undefined ? opts.serviceAccount : parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT);
  if (env.FIREBASE_SERVICE_ACCOUNT && !sa && opts.serviceAccount === undefined) warn('[cảnh báo] FIREBASE_SERVICE_ACCOUNT không đọc được (phải là nội dung file JSON khoá dịch vụ). Đang dùng lưu file tạm.');

  // ---------- Firestore ----------
  if (sa) {
    let tok = { v: '', exp: 0 };
    async function token() {
      if (tok.v && Date.now() < tok.exp - 60000) return tok.v;
      const now = Math.floor(Date.now() / 1000);
      const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
      const claim = b64u(JSON.stringify({
        iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore',
        aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
      }));
      const sig = b64u(crypto.createSign('RSA-SHA256').update(head + '.' + claim).sign(sa.private_key));
      const form = 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + claim + '.' + sig;
      const r = await request('POST', 'https://oauth2.googleapis.com/token', { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(form) }, form);
      if (r.status !== 200 || !r.json || !r.json.access_token) throw new Error('Không lấy được token Google (' + r.status + ')');
      tok = { v: r.json.access_token, exp: Date.now() + (r.json.expires_in || 3600) * 1000 };
      return tok.v;
    }
    const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/`;
    const okId = (s) => /^[A-Za-z0-9_-]{1,128}$/.test(s);
    return {
      mode: 'firestore',
      async get(col, id) {
        if (!okId(col) || !okId(id)) return null;
        const r = await request('GET', base + col + '/' + id, { Authorization: 'Bearer ' + (await token()) });
        if (r.status === 404) return null;
        if (r.status !== 200) throw new Error('Firestore đọc lỗi ' + r.status);
        try { return JSON.parse(r.json.fields.j.stringValue); } catch { return null; }
      },
      async set(col, id, obj) {
        if (!okId(col) || !okId(id)) throw new Error('id không hợp lệ');
        const body = JSON.stringify({ fields: { j: { stringValue: JSON.stringify(obj) } } });
        const r = await request('PATCH', base + col + '/' + id, { Authorization: 'Bearer ' + (await token()), 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, body);
        if (r.status !== 200) throw new Error('Firestore ghi lỗi ' + r.status);
      },
    };
  }

  // ---------- File ----------
  const dir = opts.dataDir || env.DATA_DIR || path.join(__dirname, 'data');
  const file = path.join(dir, 'store.json');
  let db = {};
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  let timer = null;
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(db)); } catch {}
    }, 200);
    if (timer.unref) timer.unref();
  };
  return {
    mode: 'file',
    async get(col, id) { return db[col] && db[col][id] !== undefined ? JSON.parse(JSON.stringify(db[col][id])) : null; },
    async set(col, id, obj) { (db[col] = db[col] || {})[id] = JSON.parse(JSON.stringify(obj)); save(); },
    flush() { clearTimeout(timer); try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(db)); } catch {} },
  };
}

module.exports = { createStore, parseServiceAccount };
