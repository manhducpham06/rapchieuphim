'use strict';
// Test: xác minh token Firebase, đăng nhập tài khoản trong WebSocket, chuyển tiếp tín hiệu voice.
const os = require('os');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const crypto = require('crypto');

process.env.SECRET = 'bi-mat-thu-nghiem-0123456789';
process.env.ADMIN_KEY = 'khoa-admin-test';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rap-'));

const { createFirebaseAuth } = require('../fbauth.js');
const { httpServer, fbauth, accounts } = require('../server.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
function ok(cond, name) { assert.ok(cond, 'THẤT BẠI: ' + name); passed++; console.log('  ✓', name); }

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function makeToken(priv, { kid = 'k1', alg = 'RS256', aud = 'rap-test', iss, exp, iat, sub = 'user1', name = 'Lan' } = {}) {
  const t = Math.floor(Date.now() / 1000);
  const head = b64({ alg, kid, typ: 'JWT' });
  const body = b64({ aud, iss: iss || 'https://securetoken.google.com/' + aud, exp: exp ?? t + 3600, iat: iat ?? t - 5, sub, name, email: 'a@b.c' });
  const sig = crypto.createSign('RSA-SHA256').update(head + '.' + body).sign(priv).toString('base64url');
  return head + '.' + body + '.' + sig;
}

class Bot {
  constructor(port, name) {
    this.name = name; this.log = []; this.closed = null;
    this.ws = new WebSocket(`ws://127.0.0.1:${port}`);
    this.opened = new Promise((res) => (this.ws.onopen = res));
    this.ws.onmessage = (e) => this.log.push(JSON.parse(e.data));
    this.ws.onclose = (e) => (this.closed = e.code);
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  all(t) { return this.log.filter((m) => m.t === t); }
  async waitFor(t, pred = () => true, ms = 2000) {
    const end = Date.now() + ms;
    while (Date.now() < end) { const m = this.log.find((x) => x.t === t && pred(x)); if (m) return m; await sleep(15); }
    throw new Error(`${this.name}: không nhận được "${t}"`);
  }
  async join(extra = {}) {
    await this.opened;
    this.send({ t: 'join', name: this.name, look: {}, ...extra });
    const w = await this.waitFor('welcome'); this.id = w.id; return w;
  }
}

(async () => {
  console.log('\n[1] Xác minh ID token Firebase');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = publicKey.export({ type: 'spki', format: 'pem' });
  let fetches = 0;
  const fa = createFirebaseAuth({ projectId: 'rap-test', fetchCerts: async () => { fetches++; return { certs: { k1: pem }, ttl: 60000 }; } });
  const u = await fa.verify(makeToken(privateKey));
  ok(u && u.uid === 'user1' && u.name === 'Lan', 'token hợp lệ: lấy được uid và tên hiển thị');
  await fa.verify(makeToken(privateKey));
  ok(fetches === 1, 'chứng chỉ Google được lưu đệm, không tải lại mỗi lần');
  ok((await fa.verify(makeToken(other.privateKey))) === null, 'chữ ký giả (ký bằng khoá khác) bị từ chối');
  ok((await fa.verify(makeToken(privateKey, { aud: 'du-an-khac' }))) === null, 'token của dự án Firebase khác bị từ chối');
  ok((await fa.verify(makeToken(privateKey, { exp: Math.floor(Date.now() / 1000) - 600 }))) === null, 'token hết hạn bị từ chối');
  ok((await fa.verify(makeToken(privateKey, { alg: 'HS256' }))) === null, 'thuật toán lạ (HS256) bị từ chối');
  ok((await fa.verify(makeToken(privateKey, { kid: 'khong-co' }))) === null, 'kid lạ bị từ chối');
  ok((await fa.verify('abc.def')) === null && (await fa.verify(null)) === null && (await fa.verify('x'.repeat(5000))) === null, 'chuỗi rác không làm hỏng server');
  ok((await createFirebaseAuth({ projectId: '' }).verify(makeToken(privateKey))) === null, 'chưa cấu hình Firebase thì không chấp nhận token nào');

  console.log('\n[2] Đăng nhập tài khoản qua WebSocket');
  await new Promise((r) => httpServer.listen(0, '127.0.0.1', r));
  const port = httpServer.address().port;
  fbauth.verify = async (t) => ({ 'tok-alice': { uid: 'u-alice', name: 'Alice', email: 'a@x' }, 'tok-bob': { uid: 'u-bob', name: 'Bob', email: 'b@x' } })[t] || null;

  const G = new Bot(port, 'Khách'); await G.join();
  const A1 = new Bot(port, 'GiảMạo');
  const wa = await A1.join({ idToken: 'tok-alice' });
  const me = wa.players.find((p) => p.id === A1.id) || (await G.waitFor('join', (m) => m.player.id === A1.id)).player;
  ok(me.name === 'Alice' && me.v === 1, 'tài khoản đã xác minh: tên lấy từ tài khoản (bỏ qua tên client gửi), gắn dấu xác minh');
  ok(accounts.get('u-alice') !== undefined, 'server ghi nhận phiên của tài khoản');
  const guestPub = (await G.waitFor('join', (m) => m.player.id === A1.id)).player;
  ok(guestPub.v === 1, 'người khác thấy dấu xác minh của Alice');

  const bad = new Bot(port, 'TokenSai');
  const wb = await bad.join({ idToken: 'tok-gia' });
  const bp = wb.players.find((p) => p.id === bad.id);
  ok(bad.all('err').length === 1 && bp.v === 0 && bp.name === 'TokenSai', 'token sai: báo lỗi và vào như khách (không cướp được tên người khác)');

  const A2 = new Bot(port, 'Alice2');
  await A2.join({ idToken: 'tok-alice' });
  await sleep(150);
  ok(A1.closed === 4001 && A1.all('err').length >= 1, 'đăng nhập lần hai cùng tài khoản: phiên cũ bị ngắt (mã 4001)');
  ok(accounts.get('u-alice') !== undefined, 'phiên mới thay thế phiên cũ');

  console.log('\n[3] Chuyển tiếp tín hiệu voice (WebRTC)');
  const B = new Bot(port, 'Bob'); await B.join({ idToken: 'tok-bob' });
  A2.send({ t: 'rtc', to: B.id, d: { s: { type: 'offer', sdp: 'v=0...' } } });
  const got = await B.waitFor('rtc');
  ok(got.from === A2.id && got.d.s.type === 'offer', 'Bob nhận được offer từ Alice, kèm id người gửi đúng');
  B.send({ t: 'rtc', to: A2.id, d: { c: { candidate: 'x' } } });
  ok((await A2.waitFor('rtc')).d.c.candidate === 'x', 'ICE candidate đi chiều ngược lại');
  const n0 = G.all('rtc').length;
  A2.send({ t: 'rtc', to: G.id, d: { w: 1 } });
  await B.waitFor('rtc', (m) => true);
  await G.waitFor('rtc', (m) => m.d.w === 1);
  ok(G.all('rtc').length === n0 + 1, 'tín hiệu “muốn kết nối” cũng được chuyển');
  A2.send({ t: 'rtc', to: B.id, d: { s: 'x'.repeat(9000) } });
  A2.send({ t: 'rtc', to: 99999, d: { s: 1 } });
  A2.send({ t: 'rtc', to: A2.id, d: { s: 1 } });
  await sleep(150);
  ok(B.all('rtc').length === 1 && A2.all('rtc').length === 1, 'gói quá lớn / gửi cho người không tồn tại / gửi cho chính mình bị bỏ qua');
  // người ở phòng khác không nhận được
  const C = new Bot(port, 'Cường'); await C.join();
  C.send({ t: 'room', room: 'arcade' });
  await C.waitFor('welcome', (m) => m.room === 'arcade' && C.all('welcome').length === 2 || m.room === 'arcade');
  await sleep(100);
  const before = B.all('rtc').length;
  C.send({ t: 'rtc', to: B.id, d: { s: 1 } });
  await sleep(150);
  ok(B.all('rtc').length === before, 'người ở phòng khác không gửi được tín hiệu tới bạn');
  // chống tràn
  for (let i = 0; i < 200; i++) A2.send({ t: 'rtc', to: B.id, d: { c: i } });
  await sleep(400);
  ok(B.all('rtc').length - before <= 125, 'gửi dồn dập bị giới hạn (' + (B.all('rtc').length - before) + ' gói lọt qua)');

  console.log(`\n✅ ${passed} kiểm tra đạt\n`);
  process.exit(0);
})().catch((e) => { console.error('\n❌', e.message); process.exit(1); });
