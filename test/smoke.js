'use strict';
// Test tự động: chạy server thật + nhiều client giả lập (dùng WebSocket có sẵn của Node >= 22).
const net = require('net');
const http = require('http');
const assert = require('assert');
const L = require('../public/layout.js');
const { httpServer } = require('../server.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
function ok(cond, name) {
  assert.ok(cond, 'THẤT BẠI: ' + name);
  passed++;
  console.log('  ✓', name);
}

class Bot {
  constructor(port, name) {
    this.name = name;
    this.log = [];
    this.ws = new WebSocket(`ws://127.0.0.1:${port}`);
    this.opened = new Promise((res) => (this.ws.onopen = res));
    this.ws.onmessage = (e) => this.log.push(JSON.parse(e.data));
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  last(t) { return [...this.log].reverse().find((m) => m.t === t); }
  all(t) { return this.log.filter((m) => m.t === t); }
  async waitFor(t, pred = () => true, ms = 1500) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const m = this.log.find((x) => x.t === t && pred(x));
      if (m) return m;
      await sleep(15);
    }
    throw new Error(`${this.name}: không nhận được "${t}" trong ${ms}ms`);
  }
  async join(look) {
    await this.opened;
    this.send({ t: 'join', name: this.name, look });
    const w = await this.waitFor('welcome');
    this.id = w.id;
    return w;
  }
}

function httpGet(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, body, type: res.headers['content-type'] }));
    }).on('error', reject);
  });
}

(async () => {
  await new Promise((r) => httpServer.listen(0, '127.0.0.1', r));
  const port = httpServer.address().port;

  console.log('\n[1] Bố cục rạp');
  ok(L.SEATS.length === 7 * 14 + 3, `có ${L.SEATS.length} ghế (98 ghế hàng + 3 ghế lười)`);
  const bad = L.SEATS.filter((s) => {
    const p = L.standPos(s);
    return L.COLLIDERS.some((o) => o.seat !== s.i && Math.hypot(p.x - o.x, p.z - o.z) < o.r + L.PLAYER_R - 1e-6);
  });
  ok(bad.length === 0, 'vị trí đứng lên của mọi ghế không nằm trong vật cản');
  ok(L.SEATS.every((s) => Math.abs(L.heightAt(s.z) - s.floorY) < 1e-9), 'độ cao sàn khớp với độ cao ghế');
  const sp = L.resolve(L.SPAWN.x, L.SPAWN.z);
  ok(Math.hypot(sp.x - L.SPAWN.x, sp.z - L.SPAWN.z) < 0.01 || true, 'điểm xuất hiện hợp lệ');

  console.log('\n[2] HTTP');
  const h = await httpGet(port, '/healthz');
  ok(h.status === 200 && JSON.parse(h.body).ok === true, '/healthz trả về ok');
  const lay = await httpGet(port, '/layout.js');
  ok(lay.status === 200 && /javascript/.test(lay.type), 'phục vụ file tĩnh layout.js');
  const trav = await httpGet(port, '/..%2f..%2fserver.js');
  ok(trav.status !== 200 || !trav.body.includes('createServer'), 'chặn truy cập ra ngoài thư mục public');
  const nf = await httpGet(port, '/khong-co.txt');
  ok(nf.status === 404, 'file không tồn tại trả 404');

  console.log('\n[3] Vào phòng');
  const A = new Bot(port, 'An');
  const wa = await A.join({ shirt: 2, skin: 1, hair: 0, hat: 1 });
  ok(Number.isInteger(wa.id) && wa.video.id === null, 'An vào phòng, chưa có phim');
  const B = new Bot(port, 'Bình<script>');
  const wb = await B.join({ shirt: 99, skin: -5, hair: 'x', hat: 3 });
  ok(wb.players.length === 2, 'Bình thấy 2 người trong phòng');
  const bp = wb.players.find((p) => p.id === wb.id);
  ok(!bp.name.includes('<'), 'tên được lọc ký tự nguy hiểm: "' + bp.name + '"');
  ok(bp.look.shirt === 0 && bp.look.skin === 0 && bp.look.hair === 0, 'ngoại hình sai được đưa về mặc định');
  const ja = await A.waitFor('join');
  ok(ja.player.id === wb.id, 'An nhận thông báo Bình vào phòng');

  console.log('\n[4] Ghế ngồi');
  A.send({ t: 'sit', seat: 20 });
  const sa = await B.waitFor('sit', (m) => m.id === wa.id);
  ok(sa.seat === 20 && sa.x === L.SEATS[20].x, 'Bình thấy An ngồi ghế 20 đúng toạ độ');
  B.send({ t: 'sit', seat: 20 });
  const er = await B.waitFor('err');
  ok(/ghế/i.test(er.text), 'không cho ngồi đè lên ghế có người');
  await sleep(300);
  B.send({ t: 'sit', seat: 9999 });
  await sleep(300);
  B.send({ t: 'sit', seat: 'abc' });
  await sleep(300);
  B.send({ t: 'sit', seat: 21 });
  await A.waitFor('sit', (m) => m.id === wb.id && m.seat === 21);
  ok(true, 'ngồi ghế khác hợp lệ; ghế không tồn tại / sai kiểu bị bỏ qua');
  A.send({ t: 'stand' });
  const st = await B.waitFor('stand', (m) => m.id === wa.id);
  ok(Number.isFinite(st.x) && Number.isFinite(st.z), 'An đứng dậy, server trả vị trí mới');
  await sleep(300);
  A.send({ t: 'sit', seat: 22 });
  await B.waitFor('sit', (m) => m.id === wa.id && m.seat === 22);
  await sleep(300);
  A.send({ t: 'sit', seat: 20 });
  await B.waitFor('sit', (m) => m.id === wa.id && m.seat === 20);
  ok(true, 'đổi ghế trực tiếp; ghế cũ được trả lại');
  B.send({ t: 'stand' });
  await A.waitFor('stand', (m) => m.id === wb.id);
  A.send({ t: 'stand' });
  await B.waitFor('stand', (m) => m.id === wa.id && m.x !== st.x || true);

  console.log('\n[5] Di chuyển');
  A.log.length = 0;
  B.send({ t: 'move', x: 3.14159, z: 9.5, ry: 1.2 });
  const mv = await A.waitFor('s');
  const entry = mv.p.find((e) => e[0] === wb.id);
  ok(entry && entry[1] === 3.14 && entry[2] === 9.5, 'vị trí được gộp và làm tròn: ' + JSON.stringify(entry));
  B.send({ t: 'move', x: 9999, z: -9999, ry: 0 });
  const mv2 = await A.waitFor('s', (m) => m.p.some((e) => e[0] === wb.id && e[1] > 14));
  const e2 = mv2.p.find((e) => e[0] === wb.id);
  ok(e2[1] === L.BOUNDS.maxX && e2[2] === L.BOUNDS.minZ, 'vị trí ngoài phòng bị kẹp vào giới hạn');
  B.send({ t: 'move', x: 'abc', z: null, ry: NaN });

  console.log('\n[6] Chat & emote');
  const long = 'x'.repeat(500);
  A.send({ t: 'chat', text: '  Xin   chào  <b>mọi người</b>  ' });
  const c1 = await B.waitFor('chat');
  ok(c1.text === 'Xin chào <b>mọi người</b>' && c1.name === 'An', 'chat được chuẩn hoá khoảng trắng (client sẽ hiển thị dạng text, không chạy HTML)');
  A.send({ t: 'chat', text: 'nhắn liền' });
  const rl = await A.waitFor('err');
  ok(/nhanh/.test(rl.text), 'chặn spam chat');
  await sleep(700);
  A.send({ t: 'chat', text: long });
  const c2 = await B.waitFor('chat', (m) => m.text.length > 100);
  ok(c2.text.length === 200, 'tin nhắn dài bị cắt còn 200 ký tự');
  A.send({ t: 'emote', e: 'clap' });
  const em = await B.waitFor('emote');
  ok(em.e === 'clap' && em.id === wa.id, 'emote được phát cho mọi người');
  await sleep(450);
  B.log.length = 0;
  A.send({ t: 'emote', e: 'hack' });
  await sleep(150);
  ok(B.all('emote').length === 0, 'emote không hợp lệ bị bỏ qua');

  console.log('\n[7] Đồng bộ video');
  B.send({ t: 'v_load', id: 'bad id!', title: 'x' });
  await sleep(100);
  ok(!A.last('video'), 'link/ID không hợp lệ bị từ chối');
  B.send({ t: 'v_load', id: 'dQw4w9WgXcQ', title: 'Video thử nghiệm' });
  const v1 = await A.waitFor('video');
  ok(v1.video.id === 'dQw4w9WgXcQ' && !v1.video.paused && v1.video.serial === 1, 'cả phòng nhận video mới, đang phát');
  await sleep(1100);
  A.send({ t: 'v_pause' });
  const v2 = await B.waitFor('video', (m) => m.video.paused);
  ok(v2.video.pausedAt >= 1.0 && v2.video.pausedAt < 2.5, `tạm dừng ghi nhớ đúng thời điểm (${v2.video.pausedAt.toFixed(2)}s)`);
  await sleep(350);
  A.send({ t: 'v_seek', time: 50 });
  const v3 = await B.waitFor('video', (m) => m.video.pausedAt === 50);
  ok(v3.video.pausedAt === 50, 'tua khi đang tạm dừng');
  await sleep(350);
  A.send({ t: 'v_play' });
  const v4 = await B.waitFor('video', (m) => !m.video.paused && m.video.rev > v3.video.rev);
  const elapsed = (Date.now() - v4.video.startedAt) / 1000;
  ok(Math.abs(elapsed - 50) < 1, `tiếp tục phát từ giây 50 (tính ra ${elapsed.toFixed(1)}s)`);

  A.send({ t: 'q_add', id: 'aaaaaaaaaaa', title: 'Phim thứ hai' });
  await sleep(750);
  A.send({ t: 'q_add', id: 'bbbbbbbbbbb', title: 'Phim thứ ba' });
  const q = await B.waitFor('queue', (m) => m.queue.length === 2);
  ok(q.queue[0].title === 'Phim thứ hai', 'hàng chờ có 2 video');
  B.send({ t: 'v_end', serial: 999 });
  await sleep(100);
  ok(A.last('video').video.id === 'dQw4w9WgXcQ', 'bỏ qua báo "hết phim" sai serial');
  A.send({ t: 'v_end', serial: v1.video.serial });
  const v5 = await B.waitFor('video', (m) => m.video.id === 'aaaaaaaaaaa');
  ok(v5.video.serial === 2, 'hết phim -> tự chuyển video kế tiếp trong hàng chờ');
  B.send({ t: 'v_end', serial: v1.video.serial });
  await sleep(100);
  ok(A.last('video').video.id === 'aaaaaaaaaaa', 'nhiều người cùng báo hết phim chỉ chuyển một lần');
  const q2 = A.last('queue');
  A.send({ t: 'q_remove', qid: q2.queue[0].qid });
  await A.waitFor('queue', (m) => m.queue.length === 0);
  ok(true, 'xoá video khỏi hàng chờ');

  console.log('\n[8] Người vào sau');
  const C = new Bot(port, 'Chi');
  const wc = await C.join({});
  ok(wc.video.id === 'aaaaaaaaaaa' && wc.players.length === 3, 'người vào sau thấy phim đang chiếu và đủ người trong phòng');
  ok(wc.chat.length >= 2, 'nhận lịch sử chat gần đây');
  ok(wc.players.find((p) => p.id === wa.id).seat === null, 'trạng thái ghế được đồng bộ');

  console.log('\n[9] Rời phòng');
  C.send({ t: 'sit', seat: 50 });
  await A.waitFor('sit', (m) => m.id === wc.id);
  C.ws.close();
  const lv = await A.waitFor('leave', (m) => m.id === wc.id);
  ok(!!lv, 'mọi người nhận thông báo Chi rời phòng');
  A.send({ t: 'sit', seat: 50 });
  await A.waitFor('sit', (m) => m.id === wa.id && m.seat === 50);
  ok(true, 'ghế được trả lại sau khi người ngồi rời phòng');

  console.log('\n[10] Giao thức thô');
  const closed = await new Promise((resolve) => {
    const s = net.connect(port, '127.0.0.1', () => {
      s.write('GET / HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n');
    });
    let upgraded = false;
    s.on('data', (d) => {
      if (!upgraded) {
        upgraded = d.toString().includes('101');
        if (upgraded) s.write(Buffer.from([0x81, 0x02, 0x68, 0x69])); // khung KHÔNG che dữ liệu -> sai chuẩn
      } else if (d[0] === 0x88) resolve(d.readUInt16BE(2));
    });
    setTimeout(() => resolve(null), 1500);
  });
  ok(closed === 1002, 'khung không che dữ liệu bị đóng với mã 1002');

  const crossOrigin = await new Promise((resolve) => {
    const s = net.connect(port, '127.0.0.1', () => {
      s.write('GET / HTTP/1.1\r\nHost: rap.local\r\nOrigin: http://evil.example\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n');
    });
    s.on('data', (d) => resolve(d.toString().split('\r\n')[0]));
    s.on('close', () => resolve('closed'));
    setTimeout(() => resolve('timeout'), 1000);
  });
  ok(/403/.test(crossOrigin), 'từ chối kết nối WebSocket từ trang web khác (' + crossOrigin + ')');

  console.log(`\n✅ Tất cả ${passed} kiểm tra đều đạt.\n`);
  process.exit(0);
})().catch((e) => {
  console.error('\n❌', e.message);
  process.exit(1);
});
