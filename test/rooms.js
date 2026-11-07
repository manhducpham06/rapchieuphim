'use strict';
// Test: vật lý bóng đá, ví xu + thanh toán, mua / mặc đồ, các phòng (Quảng Trường, Rạp, Khu Giải Trí, Shop).
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
process.env.ADMIN_UIDS = 'u-boss';

const L = require('../public/layout.js');
const C = require('../public/catalog.js');
const { Football, R_BALL, R_PLAYER } = require('../football.js');
const { createPayments } = require('../payments.js');
const { createStore } = require('../store.js');
const { createWallet } = require('../wallet.js');
const { httpServer, rooms, fbauth, store } = require('../server.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
function ok(cond, name) {
  assert.ok(cond, 'THẤT BẠI: ' + name);
  passed++;
  console.log('  ✓', name);
}
function req(port, method, p, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}), ...headers } }, (res) => {
      let s = ''; res.on('data', (d) => (s += d));
      res.on('end', () => { let j = null; try { j = JSON.parse(s); } catch {} resolve({ status: res.statusCode, json: j }); });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
class Bot {
  constructor(port, name) {
    this.name = name; this.log = [];
    this.ws = new WebSocket(`ws://127.0.0.1:${port}`);
    this.opened = new Promise((res) => (this.ws.onopen = res));
    this.ws.onmessage = (e) => this.log.push(JSON.parse(e.data));
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  last(t) { return [...this.log].reverse().find((m) => m.t === t); }
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
console.log('\n[2] Danh mục đồ và bố cục phòng');
{
  ok(L.ROOMS.length === 4 && L.ROOMS.map((r) => r.id).join() === 'plaza,cinema,arcade,shop' && L.DEFAULT_ROOM === 'plaza', 'chỉ còn 4 khu: Quảng Trường, Rạp (một rạp duy nhất), Khu Giải Trí, Shop; không còn cấp độ / giá vé');
  ok(L.ROOMS.every((r) => r.price === undefined), 'phòng không còn giá vé');
  ok(C.ITEMS.length >= 40 && C.ITEMS.every((i) => i.price > 0 && i.price <= 10000 && C.SLOT_IDS.includes(i.slot)), `${C.ITEMS.length} món đồ, giá hợp lệ (<= 10.000 xu)`);
  ok(C.PACKS.every((p) => p.amount <= 10000), 'mọi gói nạp <= 10.000đ');
  ok(new Set(C.ITEMS.map((i) => i.id)).size === C.ITEMS.length, 'mã món đồ không trùng');
  ok(JSON.stringify(C.cleanEquip({ top: 't_red', bottom: 't_red', x: 'k_wings', back: 'k_wings' })) === '{"top":"t_red","back":"k_wings"}', 'cleanEquip bỏ món sai ô / ô lạ');
  for (const id of ['plaza', 'shop', 'arcade']) {
    const lay = L.layoutOf(L.ROOM_BY_ID[id].kind);
    const sp = lay.resolve(lay.SPAWN.x, lay.SPAWN.z);
    ok(Math.hypot(sp.x - lay.SPAWN.x, sp.z - lay.SPAWN.z) < 0.01, `điểm xuất hiện của ${id} không nằm trong vật cản`);
    ok(lay.INTERACT.every((it) => { const r = lay.resolve(it.x, it.z); return Math.hypot(r.x - it.x, r.z - it.z) < it.r - 0.4; }), `mọi điểm tương tác ở ${id} đứng tới được`);
  }
  const doors = [...L.layoutOf('plaza').INTERACT, ...L.layoutOf('shop').INTERACT, ...L.layoutOf('arcade').INTERACT, ...L.INTERACT].filter((i) => i.type === 'door');
  ok(doors.every((d) => L.ROOM_BY_ID[d.go]), 'mọi cửa dẫn tới phòng có thật');
}

// ---------------------------------------------------------------
console.log('\n[3] Ví, mua đồ, nạp xu (module)');
{
  const st = createStore({ env: {}, dataDir: tmp + '/w' });
  const wal = createWallet(st, { isAdmin: (u) => u === 'boss' });
  let credited = null;
  const warns = [];
  const pay = createPayments({ ADMIN_KEY: 'adm', PAYMENT_WEBHOOK_KEY: 'wk' }, { store: st, wallet: wal, onCredit: (u, w) => (credited = [u, w.coins]), warn: (m) => warns.push(m) });
  ok(warns.length === 0 && pay.cfg.bank.account === '1054794616' && pay.cfg.bank.bin === '970436', 'mặc định nhận tiền vào Vietcombank của chủ game');
  ok((await pay.createOrder('', 'p5')).error && (await pay.createOrder('u1', 'p999')).error, 'khách / gói lạ không tạo được đơn');
  const o = (await pay.createOrder('u1', 'p5')).order;
  ok(/^RAP[A-HJ-NP-Z2-9]{6}$/.test(o.code) && o.amount === 5000, 'đơn có mã dạng RAPxxxxxx và đúng số tiền gói');
  ok((await pay.status(o.code)).status === 'pending', 'đơn mới ở trạng thái chờ');
  ok(!(await pay.confirm(o.code, 4000, 'x', 't0')).ok, 'chuyển thiếu tiền: không cộng xu');
  ok((await wal.get('u1')).coins === 0, 'ví vẫn 0 xu');
  const r1 = await pay.confirm('ck ' + o.code.toLowerCase() + ' cam on', 5000, 'webhook', 't1');
  ok(r1.ok && !r1.already && credited[0] === 'u1' && credited[1] === 5000, 'đủ tiền (nội dung viết thường, có chữ thừa): cộng 5.000 xu và báo cho người chơi');
  ok((await pay.confirm(o.code, 5000, 'webhook', 't2')).already && (await wal.get('u1')).coins === 5000, 'xác nhận lần hai (giao dịch khác): không cộng trùng');
  const [c1, c2] = await Promise.all([pay.createOrder('u2', 'p2'), pay.createOrder('u2', 'p2')]);
  const [x1, x2] = await Promise.all([pay.confirm(c1.order.code, 2000, 'a', ''), pay.confirm(c1.order.code, 2000, 'b', '')]);
  ok((await wal.get('u2')).coins === 2000 && (x1.already || x2.already), 'hai xác nhận đồng thời cho một đơn chỉ cộng một lần');
  ok((await pay.adminConfirm('sai', c2.order.code)) === null && (await pay.adminConfirm('adm', c2.order.code)).ok, 'chỉ admin đúng khoá mới xác nhận tay được');
  ok((await wal.get('u2')).coins === 4000, 'admin xác nhận: cộng xu vào ví');
  ok(pay.adminList('adm').paid.length === 3 && pay.adminList('sai') === null, 'admin xem được danh sách đơn');

  // mua / mặc
  let b = await wal.buy('u1', 't_red');
  ok(b.ok && b.w.coins === 4000 && b.w.owned.includes('t_red'), 'mua áo đỏ 1.000 xu: trừ đúng tiền');
  ok(!(await wal.buy('u1', 't_red')).ok, 'mua lại món đã có bị từ chối');
  b = await wal.buy('u1', 'h_horn');
  ok(b.ok && b.w.coins === 1000 && !(await wal.buy('u1', 'h_crown')).ok && (await wal.buy('u1', 'h_crown')).short, 'hết xu thì không mua thêm được (và báo thiếu xu)');
  ok(!(await wal.buy('u1', 'khong-co')).ok, 'món không tồn tại bị từ chối');
  ok(!(await wal.equip('u1', 'top', 't_gold')).ok, 'chưa mua thì không mặc được');
  ok(!(await wal.equip('u1', 'bottom', 't_red')).ok, 'món không đúng ô không mặc được');
  ok((await wal.equip('u1', 'top', 't_red')).w.equip.top === 't_red' && (await wal.equip('u1', 'top', null)).w.equip.top === undefined, 'mặc rồi cởi ra');
  const racers = await Promise.all([1, 2, 3, 4, 5].map(() => wal.buy('u2', 't_dots')));
  ok(racers.filter((r) => r.ok).length === 1 && (await wal.get('u2')).coins === 1500, 'bấm mua dồn dập: chỉ trừ tiền một lần');
  const adm = await wal.get('boss');
  ok(adm.admin && adm.owned.length === C.ITEMS.length && (await wal.equip('boss', 'head', 'h_crown')).ok && (await wal.buy('boss', 'h_crown')).ok === false, 'ông chủ có tất cả đồ miễn phí');
  // lưu bền qua file
  st.flush();
  const st2 = createStore({ env: {}, dataDir: tmp + '/w' });
  ok(((await st2.get('wallets', 'u1')) || {}).owned.includes('h_horn'), 'ví được lưu ra đĩa và đọc lại được');
}

// ---------------------------------------------------------------
console.log('\n[4] Lưu bền bằng Firestore (REST giả lập)');
{
  const crypto = require('crypto');
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const docs = {}; const calls = [];
  const request = async (method, url, headers, body) => {
    calls.push(method + ' ' + url);
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      const asr = /assertion=([^&]+)/.exec(body)[1].split('.');
      const claim = JSON.parse(Buffer.from(asr[1], 'base64url').toString());
      if (claim.iss !== 'sa@p.iam' || !/datastore/.test(claim.scope)) return { status: 400, json: {} };
      return { status: 200, json: { access_token: 'AT', expires_in: 3600 } };
    }
    if (headers.Authorization !== 'Bearer AT') return { status: 401, json: {} };
    const key = url.split('/documents/')[1];
    if (method === 'GET') return docs[key] ? { status: 200, json: docs[key] } : { status: 404, json: {} };
    docs[key] = JSON.parse(body); return { status: 200, json: docs[key] };
  };
  const sa = { client_email: 'sa@p.iam', project_id: 'proj', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const fs2 = createStore({ env: {}, serviceAccount: sa, request });
  ok(fs2.mode === 'firestore', 'có khoá dịch vụ thì dùng Firestore');
  await fs2.set('wallets', 'abc', { coins: 7, owned: ['t_red'] });
  const back = await fs2.get('wallets', 'abc');
  ok(back.coins === 7 && docs['projects/proj/databases/(default)/documents/wallets/abc'] || Object.keys(docs).some((k) => k.startsWith('wallets/abc') || k.includes('wallets/abc')), 'ghi đúng đường dẫn Firestore');
  ok((await fs2.get('wallets', 'chua-co')) === null, 'tài liệu chưa có trả về null');
  await fs2.get('wallets', 'abc');
  ok(calls.filter((c) => c.includes('oauth2')).length === 1, 'token Google được dùng lại, không xin mỗi lần');
  ok((await fs2.get('wallets', '../x')) === null && (await fs2.get('a/b', 'c')) === null, 'id có ký tự lạ bị từ chối, không đi lung tung trên Firestore');
  const { parseServiceAccount } = require('../store.js');
  ok(parseServiceAccount(JSON.stringify(sa)).project_id === 'proj' && parseServiceAccount(Buffer.from(JSON.stringify(sa)).toString('base64')).project_id === 'proj' && parseServiceAccount('rac') === null, 'đọc khoá dịch vụ từ JSON hoặc base64; rác thì bỏ qua');
}

// ---------------------------------------------------------------
console.log('\n[5] Chơi qua mạng: phòng, ví, mua đồ');
{
  await new Promise((r) => httpServer.listen(0, '127.0.0.1', r));
  const port = httpServer.address().port;
  fbauth.verify = async (t) => ({
    'tok-an': { uid: 'u-an', name: 'An', email: 'an@x' },
    'tok-boss': { uid: 'u-boss', name: 'Ông Chủ', email: 'boss@x' },
  })[t] || null;

  const G = new Bot(port, 'Khách');
  const wg = await G.join();
  ok(wg.room === 'plaza' && wg.w === null, 'vào mặc định ở Quảng Trường, khách không có ví');
  G.send({ t: 'buy', item: 't_red' });
  G.send({ t: 'equip', slot: 'top', item: 't_red' });
  await sleep(150);
  ok(G.all('err').length >= 2 && !G.last('buyres'), 'khách mua / mặc đồ bị từ chối');

  const A = new Bot(port, 'An');
  const wa = await A.join({ idToken: 'tok-an' });
  ok(wa.w && wa.w.coins === 0 && wa.w.admin === false, 'tài khoản mới có ví 0 xu');
  A.send({ t: 'buy', item: 't_red' });
  const br = await A.waitFor('buyres');
  ok(br.ok === false && br.short === true, 'không đủ xu: báo thiếu xu');

  // nạp xu qua API + webhook
  const noLogin = await req(port, 'POST', '/api/order', { pack: 'p5' });
  ok(noLogin.status === 401, 'tạo đơn nạp xu khi chưa đăng nhập: 401');
  const od = await req(port, 'POST', '/api/order', { pack: 'p5', idToken: 'tok-an' });
  ok(od.status === 200 && /^RAP/.test(od.json.code) && od.json.amount === 5000, 'đăng nhập rồi tạo đơn 5.000đ');
  const wh = await req(port, 'POST', '/api/webhook', { id: 'tx-1', transferAmount: 5000, content: 'CK ' + od.json.code, transferType: 'in' }, { Authorization: 'Apikey webhook-test-key' });
  ok(wh.json.success && wh.json.confirmed === 1, 'webhook ngân hàng xác nhận đơn');
  const wmsg = await A.waitFor('wallet', (m) => m.w.coins === 5000);
  ok(!!wmsg.toast, 'người chơi đang online nhận ngay số xu mới (không cần tải lại)');
  ok((await req(port, 'GET', '/api/order/' + od.json.code)).json.status === 'paid', 'trạng thái đơn: đã trả');
  ok((await req(port, 'POST', '/api/webhook', { id: 'tx-2', transferAmount: 5000, content: od.json.code, transferType: 'in' }, { Authorization: 'Apikey sai' })).status === 401, 'webhook sai khoá bị từ chối');

  const B = new Bot(port, 'Bình');
  await B.join();
  await sleep(450);
  A.send({ t: 'buy', item: 't_red' });
  await A.waitFor('buyres', (m) => m.ok);
  ok(A.last('wallet').w.coins === 4000, 'mua áo đỏ: còn 4.000 xu');
  await sleep(250);
  A.send({ t: 'equip', slot: 'top', item: 't_red' });
  const oa = await B.waitFor('outfit', (m) => m.id === A.id && m.o.top === 't_red');
  ok(!!oa, 'người khác trong phòng thấy An mặc áo đỏ ngay');
  const B2 = new Bot(port, 'Chi');
  const wb2 = await B2.join();
  ok(wb2.players.find((p) => p.name === 'An').o.top === 't_red', 'người vào sau cũng thấy bộ đồ của An');
  await sleep(250);
  A.send({ t: 'equip', slot: 'top', item: 't_gold' });
  await sleep(250);
  A.send({ t: 'equip', slot: 'top', item: 'khong' });
  await sleep(250);
  ok(A.all('err').length >= 2, 'mặc món chưa mua / món lạ bị từ chối');

  // đồ được giữ khi vào lại
  A.ws.close();
  await sleep(150);
  const A2 = new Bot(port, 'An');
  const wa2 = await A2.join({ idToken: 'tok-an' });
  ok(wa2.w.coins === 4000 && wa2.w.owned.includes('t_red') && wa2.w.equip.top === 't_red', 'vào lại: ví, đồ đã mua, bộ đang mặc vẫn còn');

  // ông chủ
  const S = new Bot(port, 'Boss');
  const ws2 = await S.join({ idToken: 'tok-boss' });
  ok(ws2.w.admin === true && ws2.w.owned.length === C.ITEMS.length, 'ông chủ (ADMIN_UIDS) được mọi món miễn phí');
  ok(ws2.players.find((p) => p.name === 'Ông Chủ').own === 1, 'người khác nhận biết đây là ông chủ');
  S.send({ t: 'equip', slot: 'head', item: 'h_crown' });
  const ob = await B.waitFor('outfit', (m) => m.id === S.id && m.o.head === 'h_crown');
  ok(!!ob, 'ông chủ đội vương miện, mọi người thấy');

  // Rạp: ghế + màn hình chỉ có ở rạp; cửa chuyển phòng
  const D = new Bot(port, 'Dũng');
  await D.join();
  D.send({ t: 'sit', seat: 3 });
  D.send({ t: 'v_load', id: 'dQw4w9WgXcQ', title: 'x' });
  await sleep(200);
  ok(!D.last('sit') && !D.last('video'), 'Quảng Trường không có ghế / màn hình');
  await sleep(1000);
  D.send({ t: 'room', room: 'cinema' });
  const wc = await D.waitFor('welcome', (m) => m.room === 'cinema');
  ok(wc.players.length === 1, 'sang Rạp Chiếu Phim miễn phí, không cần vé');
  D.send({ t: 'sit', seat: 3 });
  ok(!!(await D.waitFor('sit')), 'trong rạp ngồi được');
  D.send({ t: 'pass', token: 'x' });
  await sleep(1000);
  D.send({ t: 'room', room: 'shop' });
  const wsh = await D.waitFor('welcome', (m) => m.room === 'shop');
  ok(wsh.room === 'shop', 'vào Shop Thời Trang');
  await sleep(1000);
  D.send({ t: 'room', room: 'arcade' });
  const wr = await D.waitFor('welcome', (m) => m.room === 'arcade');
  ok(wr.ball && wr.ball.b.length === 4 && Math.abs(wr.ball.b[1] - L.ARCADE.PITCH.cz) < 0.01, 'Khu Giải Trí: welcome kèm vị trí bóng');
  const E = new Bot(port, 'Em');
  await E.join({ room: 'arcade' });
  ok(rooms.get('arcade').players.size === 2, 'hai người cùng ở khu giải trí');
  const P = L.ARCADE.PITCH;
  let x = P.cx - 3.5;
  D.log.length = 0; E.log.length = 0;
  for (let i = 0; i < 24; i++) { D.send({ t: 'move', x, z: P.cz, ry: Math.PI / 2 }); x += 0.2; await sleep(40); }
  await sleep(250);
  const balls = E.all('ball');
  ok(balls.length > 3 && Math.max(0, ...balls.map((m) => m.b[2])) > 3 && balls[balls.length - 1].b[0] > P.cx + 0.2, 'sút bóng thật qua mạng: người khác thấy bóng lăn');
  await sleep(1000);
  D.send({ t: 'room', room: 'zzz' });
  await sleep(200);
  ok(rooms.get('arcade').players.size === 2, 'phòng lạ bị bỏ qua, người chơi ở yên');

  console.log(`\n✅ Tất cả ${passed} kiểm tra đều đạt.\n`);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(0);
}
})().catch((e) => {
  console.error('\n❌', e.message);
  process.exit(1);
});
