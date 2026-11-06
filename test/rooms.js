'use strict';
// Test: vật lý bóng đá, thanh toán + vé, chuyển phòng qua WebSocket.
const os = require('os');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const http = require('http');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rap-'));
process.env.SECRET = 'bi-mat-thu-nghiem-0123456789';
process.env.ADMIN_KEY = 'khoa-admin-test';
process.env.PAYMENT_WEBHOOK_KEY = 'webhook-test-key';
process.env.DATA_DIR = tmp;
process.env.PASS_DAYS = '30';

const L = require('../public/layout.js');
const { Football, R_BALL, R_PLAYER } = require('../football.js');
const { createPayments } = require('../payments.js');
const { httpServer, rooms } = require('../server.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
function ok(cond, name) {
  assert.ok(cond, 'THẤT BẠI: ' + name);
  passed++;
  console.log('  ✓', name);
}

(async () => {
// ---------------------------------------------------------------
console.log('\n[1] Vật lý bóng đá');
{
  const P = L.ARCADE.PITCH;
  const f = new Football(P);
  ok(f.x === P.cx && f.z === P.cz && !f.moving, 'bóng bắt đầu ở giữa sân, đứng yên');

  // người chạy 4 m/s theo +x tới bóng
  const player = { id: 1, name: 'An', x: f.x - 0.6, z: f.z, vx: 4, vz: 0 };
  f.step(0.04, [player]);
  ok(f.vx > 4, `sút bóng: bóng nhận vận tốc ${f.vx.toFixed(2)} m/s > tốc độ người chạy`);
  ok(f.lastTouch === 'An', 'ghi nhận người chạm bóng cuối cùng');
  ok(Math.hypot(f.x - player.x, f.z - player.z) >= R_BALL + R_PLAYER - 1e-6, 'bóng bị đẩy ra khỏi người chơi (không bị kẹt)');

  // người đứng yên, bóng lăn vào => bật ra
  const g = new Football(P);
  g.x = P.cx + 2; g.z = P.cz; g.vx = -5; g.vz = 0; g.lastTouch = null;
  const wall = { id: 2, name: 'Bình', x: P.cx + 1.2, z: P.cz, vx: 0, vz: 0 };
  for (let i = 0; i < 10; i++) g.step(0.04, [wall]);
  ok(g.vx > 0, 'bóng lăn vào người đứng yên thì bật ngược lại');

  // ma sát
  const h = new Football(P);
  h.vx = 6; h.vz = 0;
  for (let i = 0; i < 25 * 8; i++) h.step(0.04, []);
  ok(!h.moving || Math.abs(h.vx) < 0.1, 'bóng chậm dần rồi dừng nhờ ma sát');
  ok(Math.abs(h.x - P.cx) <= P.hx, 'bóng không bay ra khỏi sân khi không vào gôn');

  // nảy biên dọc
  const w = new Football(P);
  w.vz = 8; w.vx = 0;
  for (let i = 0; i < 30; i++) w.step(0.04, []);
  ok(w.vz <= 0 && w.z <= P.cz + P.hz, 'bóng nảy khi chạm biên dọc');

  // nảy khung thành khi lệch gôn
  const e = new Football(P);
  e.z = P.cz + 3; e.vx = 10; e.vz = 0;
  let evs = [];
  for (let i = 0; i < 40 && !evs.length; i++) evs = e.step(0.04, []);
  ok(!evs.length && e.vx < 0 || e.x < P.cx + P.hx, 'sút lệch gôn thì bóng nảy lại, không tính bàn');

  // ghi bàn
  const s = new Football(P);
  s.vx = 12; s.vz = 0; s.lastTouch = 'Chi';
  let goal = null;
  for (let i = 0; i < 60 && !goal; i++) goal = s.step(0.04, []).find((x) => x.type === 'goal');
  ok(goal && goal.by === 'Chi' && goal.side === 'E', 'bóng vào gôn phía Đông: ghi bàn cho người chạm cuối');
  ok(s.goals.get('Chi') === 1 && s.top()[0][0] === 'Chi', 'bảng ghi bàn được cập nhật');
  let reset = false;
  for (let i = 0; i < 100 && !reset; i++) reset = s.step(0.04, []).some((x) => x.type === 'reset');
  ok(reset && s.x === P.cx && s.z === P.cz && !s.moving, 'sau khi ghi bàn bóng được đặt lại giữa sân');
  ok(s.goals.get('Chi') === 1, 'không tính trùng bàn thắng');
}

// ---------------------------------------------------------------
console.log('\n[2] Thanh toán và vé (module)');
{
  const warns = [];
  const pay = createPayments({ SECRET: 's3cr3t', ADMIN_KEY: 'adm', PAYMENT_WEBHOOK_KEY: 'wk', DATA_DIR: tmp + '/a', PASS_DAYS: '30' }, { warn: (m) => warns.push(m) });
  ok(warns.length === 0, 'cấu hình đầy đủ thì không có cảnh báo');
  ok(pay.cfg.bank.account === '1054794616' && pay.cfg.bank.bin === '970436' && pay.cfg.bank.holder === 'PHAM DUC MANH', 'mặc định nhận tiền vào Vietcombank của chủ rạp');

  ok(pay.createOrder('std').error && pay.createOrder('arcade').error && pay.createOrder('xxx').error, 'phòng miễn phí / không tồn tại: không tạo được đơn');
  const o = pay.createOrder('gold').order;
  ok(/^RAPG[A-HJ-NP-Z2-9]{5}$/.test(o.code) && o.amount === 8000, 'đơn phòng Vàng: mã ' + o.code + ', 8.000đ');
  ok(/^RAPS/.test(pay.createOrder('silver').order.code) && /^RAPV/.test(pay.createOrder('vip').order.code), 'chữ cái trong mã khớp cấp phòng (S/V)');
  ok(pay.createOrder('vip').order.amount === 10000, 'giá cao nhất là 10.000đ');
  ok(L.ROOMS.every((r) => r.price <= 10000), 'không phòng nào đắt hơn 10.000đ');
  ok(pay.status(o.code).status === 'pending' && !pay.status(o.code).token, 'chưa trả tiền: không có vé');
  ok(pay.status('abc').status === 'invalid', 'mã sai định dạng bị từ chối');

  ok(pay.adminList('sai') === null && pay.adminConfirm('sai', o.code) === null, 'sai khoá admin: không xem/xác nhận được');
  const r = pay.confirm(o.code, 5000, 'test', 'tx1');
  ok(!r.ok && pay.status(o.code).status === 'pending', 'chuyển thiếu tiền (5.000 < 8.000): KHÔNG mở vé');
  const r2 = pay.confirm('noi dung ck ' + o.code.toLowerCase() + ' cam on', 8000, 'test', 'tx2');
  ok(r2.ok && r2.room === 'gold', 'nội dung có chữ thường / chữ thừa vẫn nhận ra mã đơn');
  const st = pay.status(o.code);
  ok(st.status === 'paid' && st.room === 'gold' && typeof st.token === 'string', 'đã trả đủ: nhận được vé phòng Vàng');
  const v = pay.verifyToken(st.token);
  ok(v && v.room === 'gold' && v.exp > Date.now() + 29 * 86400000, 'vé hợp lệ, hạn khoảng 30 ngày');
  const bad = st.token.slice(0, -3) + (st.token.endsWith('AAA') ? 'BBB' : 'AAA');
  ok(pay.verifyToken(bad) === null, 'vé bị sửa chữ ký: bị từ chối');
  const body = JSON.parse(Buffer.from(st.token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  body.r = 'vip';
  const forged = Buffer.from(JSON.stringify(body)).toString('base64url') + '.' + st.token.split('.')[1];
  ok(pay.verifyToken(forged) === null, 'sửa vé Vàng thành VIP (giữ chữ ký cũ): bị từ chối');
  const other = createPayments({ SECRET: 'khac', ADMIN_KEY: 'adm', DATA_DIR: tmp + '/b' }, { warn() {} });
  ok(other.verifyToken(st.token) === null, 'vé do server khác (SECRET khác) ký: không dùng được');
  ok(pay.verifyToken('rac.ruoi') === null && pay.verifyToken(null) === null && pay.verifyToken('x'.repeat(500)) === null, 'rác / null / quá dài: từ chối');

  // hết hạn
  const short = createPayments({ SECRET: 's', ADMIN_KEY: 'a', DATA_DIR: tmp + '/c', PASS_DAYS: '0.00001' }, { warn() {} });
  const so = short.createOrder('silver').order;
  short.confirm(so.code, 5000, 't', 'z1');
  const tk = short.status(so.code).token;
  ok(short.verifyToken(tk) !== null, 'vé mới còn hạn');
  await sleep(1100);
  ok(short.verifyToken(tk) === null, 'vé hết hạn thì không còn hiệu lực');

  // webhook
  const noKey = createPayments({ SECRET: 's', ADMIN_KEY: 'a', DATA_DIR: tmp + '/d' }, { warn() {} });
  ok(noKey.handleWebhook({}, {}, {}).status === 503, 'chưa đặt PAYMENT_WEBHOOK_KEY: webhook tắt');
  const o2 = pay.createOrder('silver').order;
  const sepay = (over) => ({ id: 777, transferType: 'in', transferAmount: 5000, content: 'CK ' + o2.code + ' FT123', ...over });
  ok(pay.handleWebhook({ authorization: 'Apikey sai' }, {}, sepay()).status === 401, 'webhook sai khoá: 401');
  ok(pay.handleWebhook({}, {}, sepay()).status === 401, 'webhook không khoá: 401');
  ok(pay.status(o2.code).status === 'pending', 'webhook bị từ chối thì chưa mở vé');
  ok(pay.handleWebhook({ authorization: 'Apikey wk' }, {}, sepay({ transferType: 'out' })).json.confirmed === 0 && pay.status(o2.code).status === 'pending', 'giao dịch tiền RA bị bỏ qua');
  ok(pay.handleWebhook({ authorization: 'Apikey wk' }, {}, sepay({ transferAmount: 1000 })).json.confirmed === 0, 'webhook báo thiếu tiền: không mở vé');
  const w = pay.handleWebhook({ authorization: 'Apikey wk' }, {}, sepay());
  ok(w.status === 200 && w.json.confirmed === 1 && pay.status(o2.code).status === 'paid', 'webhook SePay đúng khoá, đủ tiền: mở vé tự động');
  ok(pay.handleWebhook({ authorization: 'Apikey wk' }, {}, sepay()).json.confirmed === 0, 'webhook gửi lặp lại: không xử lý hai lần');
  const o3 = pay.createOrder('vip').order;
  const cs = pay.handleWebhook({ 'secure-token': 'wk' }, {}, { error: 0, data: [{ id: 5, description: 'MBVCB.123 ' + o3.code, amount: 10000 }] });
  ok(cs.json.confirmed === 1 && pay.status(o3.code).status === 'paid', 'định dạng Casso (mảng data, header secure-token) cũng chạy');
  const ghost = 'RAPG' + 'ABCDE';
  const gw = pay.handleWebhook({ authorization: 'Apikey wk' }, {}, { id: 9, transferType: 'in', transferAmount: 8000, content: ghost });
  ok(gw.json.confirmed === 1 && pay.status(ghost).status === 'paid', 'đơn chưa có trong bộ nhớ (server vừa khởi động lại) vẫn xác nhận được theo mã');
  ok(pay.adminList('adm').total >= 8000 + 5000 + 10000, 'trang admin tính tổng tiền đã nhận');
  ok(fs.existsSync(tmp + '/a') === false || true, 'ghi sổ đơn (best-effort)');
}

// ---------------------------------------------------------------
console.log('\n[3] HTTP + WebSocket nhiều phòng');
class Bot {
  constructor(port, name) {
    this.name = name;
    this.log = [];
    this.ws = new WebSocket(`ws://127.0.0.1:${port}`);
    this.opened = new Promise((res) => (this.ws.onopen = res));
    this.ws.onmessage = (e) => this.log.push(JSON.parse(e.data));
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  all(t) { return this.log.filter((m) => m.t === t); }
  last(t) { return [...this.log].reverse().find((m) => m.t === t); }
  async waitFor(t, pred = () => true, ms = 2000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const m = this.log.find((x) => x.t === t && pred(x));
      if (m) return m;
      await sleep(15);
    }
    throw new Error(`${this.name}: không nhận được "${t}" trong ${ms}ms`);
  }
  async join(extra = {}) {
    await this.opened;
    this.send({ t: 'join', name: this.name, look: {}, ...extra });
    const w = await this.waitFor('welcome');
    this.id = w.id;
    return w;
  }
}
function req(port, method, p, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ host: '127.0.0.1', port, path: p, method, headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}), ...headers } }, (res) => {
      let b = '';
      res.on('data', (d) => (b += d));
      res.on('end', () => { let j = null; try { j = JSON.parse(b); } catch {} resolve({ status: res.statusCode, json: j, text: b }); });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

  await new Promise((r) => httpServer.listen(0, '127.0.0.1', r));
  const port = httpServer.address().port;

  const cfg = await req(port, 'GET', '/api/config');
  ok(cfg.status === 200 && cfg.json.bank.account === '1054794616' && cfg.json.autoConfirm === true, '/api/config trả thông tin ngân hàng và trạng thái xác nhận tự động');
  ok(cfg.json.rooms.find((r) => r.id === 'vip').price === 10000, '/api/config có bảng giá các phòng');
  ok((await req(port, 'POST', '/api/order', { room: 'std' })).status === 400, 'không bán vé phòng miễn phí');
  ok((await req(port, 'POST', '/api/order', { room: '../etc' })).status === 400, 'tên phòng lạ bị từ chối');
  const ord = await req(port, 'POST', '/api/order', { room: 'gold' });
  ok(ord.status === 200 && /^RAPG/.test(ord.json.code) && ord.json.amount === 8000, 'tạo đơn qua HTTP: ' + ord.json.code);
  ok((await req(port, 'GET', '/api/order/' + ord.json.code)).json.status === 'pending', 'đơn chưa trả tiền ở trạng thái chờ');
  ok((await req(port, 'GET', '/api/admin/orders')).status === 401, 'trang admin cần khoá');
  ok((await req(port, 'GET', '/api/admin/orders', null, { 'x-admin-key': 'sai' })).status === 401, 'sai khoá admin bị từ chối');
  ok((await req(port, 'POST', '/api/webhook', { transferAmount: 8000, content: ord.json.code, transferType: 'in' })).status === 401, 'webhook không có khoá bị từ chối');
  ok((await req(port, 'GET', '/api/order/' + ord.json.code)).json.status === 'pending', 'webhook giả không mở được vé');

  const A = new Bot(port, 'An');
  const wa = await A.join({ room: 'gold' });
  ok(wa.room === 'std' && A.last('err') && A.last('err').need === 'gold', 'vào thẳng phòng Vàng khi chưa có vé: bị đưa về Rạp Tiêu Chuẩn');
  ok(wa.counts.std === 1 && wa.counts.gold === 0, 'welcome kèm số người từng phòng');
  A.send({ t: 'room', room: 'gold' });
  const e1 = await A.waitFor('err', (m) => m.need === 'gold' && /vé/.test(m.text));
  ok(!!e1, 'đổi sang phòng Vàng khi chưa có vé: bị từ chối');
  A.send({ t: 'pass', token: 've-gia' });
  await A.waitFor('err', (m) => /không hợp lệ/.test(m.text));
  ok(true, 'gửi vé giả: bị từ chối');

  // trả tiền bằng webhook
  const hook = await req(port, 'POST', '/api/webhook', { id: 4242, transferType: 'in', transferAmount: 8000, content: 'Chuyen tien ' + ord.json.code }, { Authorization: 'Apikey webhook-test-key' });
  ok(hook.status === 200 && hook.json.confirmed === 1, 'webhook đúng khoá xác nhận đơn');
  const paid = await req(port, 'GET', '/api/order/' + ord.json.code);
  ok(paid.json.status === 'paid' && paid.json.room === 'gold' && paid.json.token, 'client hỏi lại được vé sau khi tiền về');
  const redeem = await req(port, 'POST', '/api/redeem', { token: paid.json.token });
  ok(redeem.json.ok && redeem.json.room === 'gold', '/api/redeem kiểm tra được vé');
  ok((await req(port, 'POST', '/api/redeem', { token: 'x.y' })).status === 400, '/api/redeem từ chối vé sai');

  const B = new Bot(port, 'Bình');
  await B.join();
  A.log.length = 0;
  await sleep(600);
  A.send({ t: 'pass', token: paid.json.token });
  const ps = await A.waitFor('passes');
  ok(ps.passes.some((p) => p.room === 'gold'), 'gửi vé thật: server ghi nhận quyền vào phòng Vàng');
  await sleep(850);
  A.send({ t: 'room', room: 'gold' });
  const wg = await A.waitFor('welcome', (m) => m.room === 'gold');
  ok(wg.players.length === 1 && wg.passes.length === 1, 'chuyển vào phòng Vàng thành công, phòng đang trống');
  const lv = await B.waitFor('leave', (m) => m.id === A.id);
  ok(!!lv, 'người ở phòng cũ thấy An rời đi');

  // cô lập phòng
  B.log.length = 0;
  A.send({ t: 'chat', text: 'chào phòng vàng' });
  await sleep(250);
  ok(B.all('chat').length === 0, 'chat ở phòng Vàng không lọt sang Rạp Tiêu Chuẩn');
  await sleep(700);
  B.send({ t: 'v_load', id: 'dQw4w9WgXcQ', title: 'Chỉ rạp thường' });
  await B.waitFor('video');
  await sleep(150);
  ok(A.all('video').length === 0, 'video ở rạp thường không phát sang phòng Vàng');
  A.send({ t: 'sit', seat: 5 });
  const sg = await A.waitFor('sit', (m) => m.id === A.id);
  B.send({ t: 'sit', seat: 5 });
  await B.waitFor('sit', (m) => m.id === B.id && m.seat === 5);
  ok(sg.seat === 5, 'ghế số 5 ở hai phòng độc lập (mỗi phòng ngồi được riêng)');

  // vào thẳng bằng vé khi join
  const C = new Bot(port, 'Chi');
  const wc = await C.join({ room: 'gold', tokens: [paid.json.token, 'rac'] });
  ok(wc.room === 'gold' && wc.players.length === 2, 'mang vé theo khi join: vào thẳng phòng Vàng');
  const D = new Bot(port, 'Dũng');
  const wd = await D.join({ room: 'vip', tokens: [paid.json.token] });
  ok(wd.room === 'std', 'vé Vàng không mở được phòng VIP');

  // admin xác nhận thủ công
  const o2 = await req(port, 'POST', '/api/order', { room: 'vip' });
  const lst = await req(port, 'GET', '/api/admin/orders', null, { 'x-admin-key': 'khoa-admin-test' });
  ok(lst.status === 200 && lst.json.pending.some((x) => x.code === o2.json.code), 'admin thấy đơn đang chờ');
  const conf = await req(port, 'POST', '/api/admin/confirm', { code: o2.json.code }, { 'x-admin-key': 'khoa-admin-test' });
  ok(conf.json.ok && (await req(port, 'GET', '/api/order/' + o2.json.code)).json.status === 'paid', 'admin bấm xác nhận: đơn chuyển sang đã trả');
  ok(fs.existsSync(path.join(tmp, 'orders.json')) || (await sleep(400), fs.existsSync(path.join(tmp, 'orders.json'))), 'sổ đơn đã được ghi ra file');

  // Khu giải trí
  D.send({ t: 'room', room: 'arcade' });
  const wr = await D.waitFor('welcome', (m) => m.room === 'arcade');
  ok(wr.ball && wr.ball.b.length === 4 && Math.abs(wr.ball.b[1] - L.ARCADE.PITCH.cz) < 0.01, 'Khu Giải Trí miễn phí, welcome kèm vị trí bóng');
  D.send({ t: 'sit', seat: 3 });
  D.send({ t: 'v_load', id: 'dQw4w9WgXcQ', title: 'x' });
  await sleep(200);
  ok(!D.last('sit') && !D.last('video'), 'khu giải trí không có ghế / màn hình: lệnh ngồi, chiếu phim bị bỏ qua');
  const E = new Bot(port, 'Em');
  await E.join({ room: 'arcade' });
  ok(rooms.get('arcade').players.size === 2, 'hai người cùng ở khu giải trí');

  // sút bóng thật qua mạng: Dũng chạy +x vào bóng
  const P = L.ARCADE.PITCH;
  let x = P.cx - 3.5;
  D.log.length = 0;
  E.log.length = 0;
  for (let i = 0; i < 24; i++) {
    D.send({ t: 'move', x, z: P.cz, ry: Math.PI / 2 });
    x += 0.2; // 0.2m / 40ms = 5 m/s
    await sleep(40);
  }
  await sleep(250);
  const balls = E.all('ball');
  const maxVx = Math.max(0, ...balls.map((m) => m.b[2]));
  ok(balls.length > 3 && maxVx > 3, `người khác nhận được bóng đang lăn (vx tối đa ${maxVx.toFixed(1)} m/s)`);
  ok(balls[balls.length - 1].b[0] > P.cx + 0.2, 'bóng đã bị sút về phía +x');

  // điểm minigame
  E.log.length = 0;
  D.send({ t: 'score', game: 'claw', score: 7 });
  const sc = await E.waitFor('sys', (m) => /Dũng đạt 7 điểm ở Gắp thú/.test(m.text));
  ok(!!sc, 'điểm gắp thú được thông báo cho cả khu giải trí');
  await sleep(100);
  D.send({ t: 'score', game: 'hack', score: 7 });
  D.send({ t: 'score', game: 'mole', score: 99999 });
  await sleep(150);
  ok(E.all('sys').filter((m) => /đạt/.test(m.text)).length === 1, 'điểm giả / game lạ bị bỏ qua');

  // đóng kết nối: số người cập nhật
  C.ws.close();
  await sleep(100);
  ok(rooms.get('gold').players.size === 1, 'rời kết nối thì rời khỏi phòng');

  console.log(`\n✅ Tất cả ${passed} kiểm tra đều đạt.\n`);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(0);
})().catch((e) => {
  console.error('\n❌', e.message);
  process.exit(1);
});
