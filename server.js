'use strict';
/*
 * Server rạp chiếu phim cộng đồng - không cần cài thư viện nào.
 * - Phục vụ file tĩnh trong /public
 * - WebSocket (tự cài theo RFC 6455) cho phòng chung: vị trí, ghế, chat, emote, video đồng bộ
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const L = require('./public/layout.js');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_PAYLOAD = 16 * 1024;
const MAX_CLIENTS = Number(process.env.MAX_CLIENTS) || 200;
const MAX_QUEUE = 30;
const CHAT_HISTORY = 40;
const EMOTES = new Set(['wave', 'clap', 'heart', 'laugh', 'wow', 'popcorn', 'thumb']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const now = () => Date.now();

// ======================= HTTP =======================
const httpServer = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    return res.end('Bad request');
  }
  if (pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, online: players.size }));
  }
  if (pathname === '/') pathname = '/index.html';
  if (pathname.includes('\0')) {
    res.writeHead(400);
    return res.end('Bad request');
  }
  const filePath = path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Không tìm thấy');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

// ======================= WebSocket (RFC 6455) =======================
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function frame(opcode, payload) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(len, 6);
  }
  return Buffer.concat([header, payload]);
}

httpServer.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  const isWs = String(req.headers.upgrade || '').toLowerCase() === 'websocket';
  if (!isWs || !key) return socket.destroy();

  // Chặn trang web khác kết nối vào server của bạn
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        return socket.destroy();
      }
    } catch {
      return socket.destroy();
    }
  }
  if (clients.size >= MAX_CLIENTS) {
    socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
    return socket.destroy();
  }

  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );
  new Client(socket);
});

class Client {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.frags = [];
    this.fragLen = 0;
    this.alive = true;
    this.lastSeen = now();
    this.player = null;
    this.rate = {};
    this.msgCount = 0;
    this.msgWindow = now();
    clients.add(this);
    socket.setNoDelay(true);
    socket.on('data', (d) => this.onData(d));
    socket.on('close', () => this.onClose());
    socket.on('error', () => {});
  }

  allow(key, minMs) {
    const t = now();
    if (t - (this.rate[key] || 0) < minMs) return false;
    this.rate[key] = t;
    return true;
  }

  send(obj) {
    this.write(frame(0x1, Buffer.from(JSON.stringify(obj))));
  }

  write(buf) {
    if (!this.alive || this.socket.destroyed || !this.socket.writable) return;
    this.socket.write(buf);
  }

  close(code = 1000) {
    if (!this.alive) return;
    const p = Buffer.alloc(2);
    p.writeUInt16BE(code, 0);
    try {
      this.socket.end(frame(0x8, p));
    } catch {}
    setTimeout(() => this.socket.destroy(), 500).unref();
  }

  onData(chunk) {
    this.lastSeen = now();
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    let buf = this.buf;
    while (buf.length >= 2) {
      const b0 = buf[0];
      const b1 = buf[1];
      const fin = !!(b0 & 0x80);
      const op = b0 & 0x0f;
      const masked = !!(b1 & 0x80);
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) {
        if (buf.length < 4) break;
        len = buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (buf.length < 10) break;
        if (buf.readUInt32BE(2) !== 0) return this.close(1009);
        len = buf.readUInt32BE(6);
        off = 10;
      }
      if (len > MAX_PAYLOAD) return this.close(1009);
      if (!masked) return this.close(1002); // client phải luôn che dữ liệu
      if (buf.length < off + 4 + len) break;
      const mask = buf.subarray(off, off + 4);
      const payload = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) payload[i] = buf[off + 4 + i] ^ mask[i & 3];
      buf = buf.subarray(off + 4 + len);
      this.onFrame(fin, op, payload);
      if (!this.alive) return;
    }
    this.buf = buf;
  }

  onFrame(fin, op, payload) {
    if (op === 0x8) return this.close(1000);
    if (op === 0x9) return this.write(frame(0xa, payload));
    if (op === 0xa) return;
    if (op === 0x1 || op === 0x0) {
      this.frags.push(payload);
      this.fragLen += payload.length;
      if (this.fragLen > MAX_PAYLOAD) return this.close(1009);
      if (!fin) return;
      const text = Buffer.concat(this.frags).toString('utf8');
      this.frags = [];
      this.fragLen = 0;
      this.onMessage(text);
    }
  }

  onMessage(text) {
    // chống spam: tối đa 80 tin/giây
    const t = now();
    if (t - this.msgWindow > 1000) {
      this.msgWindow = t;
      this.msgCount = 0;
    }
    if (++this.msgCount > 80) return this.close(1008);
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (!msg || typeof msg.t !== 'string') return;
    try {
      handle(this, msg);
    } catch (e) {
      console.error('Lỗi xử lý tin nhắn:', e);
    }
  }

  onClose() {
    if (!this.alive) return;
    this.alive = false;
    clients.delete(this);
    if (this.player) removePlayer(this.player);
  }
}

// ======================= Trạng thái phòng =======================
const clients = new Set();
const players = new Map(); // id -> player
const seatOwner = new Map(); // seat index -> player id
const dirty = new Set();
const chatLog = [];
let nextId = 1;

const video = { id: null, title: '', by: '', serial: 0, rev: 0, paused: true, pausedAt: 0, startedAt: 0 };
let queue = [];
let nextQid = 1;

function broadcast(obj, exceptId) {
  const data = frame(0x1, Buffer.from(JSON.stringify(obj)));
  for (const c of clients) {
    if (!c.player || c.player.id === exceptId) continue;
    c.write(data);
  }
}

function sys(text) {
  broadcast({ t: 'sys', text });
}

function cleanName(s) {
  return String(s || '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
}
function cleanText(s, max) {
  return String(s || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
function cleanLook(l) {
  l = l && typeof l === 'object' ? l : {};
  const pick = (v, max) => {
    v = Number(v) | 0;
    return v >= 0 && v < max ? v : 0;
  };
  const C = L.LOOK_COUNTS;
  return { shirt: pick(l.shirt, C.shirt), skin: pick(l.skin, C.skin), hair: pick(l.hair, C.hair), hat: pick(l.hat, C.hat) };
}
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const r2 = (v) => Math.round(v * 100) / 100;

function publicPlayer(p) {
  return { id: p.id, name: p.name, look: p.look, x: r2(p.x), z: r2(p.z), ry: r2(p.ry), seat: p.seat };
}

function removePlayer(p) {
  players.delete(p.id);
  dirty.delete(p.id);
  if (p.seat !== null && seatOwner.get(p.seat) === p.id) seatOwner.delete(p.seat);
  broadcast({ t: 'leave', id: p.id });
  sys(`${p.name} đã rời rạp`);
}

// ---- Video ----
function curTime() {
  return video.paused ? video.pausedAt : Math.max(0, (now() - video.startedAt) / 1000);
}
function loadVideo(id, title, by, t = 0) {
  video.id = id;
  video.title = title || '';
  video.by = by || '';
  video.serial++;
  video.rev++;
  video.paused = false;
  video.pausedAt = t;
  video.startedAt = now() - t * 1000;
}
function clearVideo() {
  video.id = null;
  video.title = '';
  video.by = '';
  video.serial++;
  video.rev++;
  video.paused = true;
  video.pausedAt = 0;
  video.startedAt = 0;
}
function pushVideo() {
  broadcast({ t: 'video', video: { ...video } });
}
function pushQueue() {
  broadcast({ t: 'queue', queue });
}
function advance() {
  const nx = queue.shift();
  if (nx) {
    loadVideo(nx.id, nx.title, nx.by, 0);
    sys(`Tiếp theo: ${nx.title || nx.id}`);
  } else {
    clearVideo();
    sys('Hết hàng chờ - màn hình đã tắt');
  }
  pushVideo();
  pushQueue();
}

// ======================= Xử lý tin nhắn =======================
function handle(c, msg) {
  if (msg.t === 'ping') return c.send({ t: 'pong', t0: num(msg.t0), ts: now() });

  if (msg.t === 'join') {
    if (c.player) return;
    const id = nextId++;
    const name = cleanName(msg.name) || 'Khách ' + id;
    const p = {
      id,
      name,
      look: cleanLook(msg.look),
      x: L.SPAWN.x + (Math.random() - 0.5) * 8,
      z: L.SPAWN.z + Math.random() * 1.5,
      ry: Math.PI,
      seat: null,
    };
    const fixed = L.resolve(p.x, p.z);
    p.x = fixed.x;
    p.z = fixed.z;
    p.client = c;
    c.player = p;
    players.set(id, p);
    c.send({
      t: 'welcome',
      id,
      serverTime: now(),
      players: [...players.values()].map(publicPlayer),
      video: { ...video },
      queue,
      chat: chatLog,
    });
    broadcast({ t: 'join', player: publicPlayer(p) }, id);
    sys(`${name} vừa vào rạp`);
    return;
  }

  const p = c.player;
  if (!p) return;

  switch (msg.t) {
    case 'move': {
      if (p.seat !== null) return;
      const x = num(msg.x);
      const z = num(msg.z);
      const ry = num(msg.ry);
      if (x === null || z === null || ry === null) return;
      p.x = L.clamp(x, L.BOUNDS.minX, L.BOUNDS.maxX);
      p.z = L.clamp(z, L.BOUNDS.minZ, L.BOUNDS.maxZ);
      p.ry = ry;
      dirty.add(p.id);
      return;
    }

    case 'sit': {
      if (!c.allow('sit', 250)) return;
      const i = msg.seat;
      if (!Number.isInteger(i) || i < 0 || i >= L.SEATS.length) return;
      const owner = seatOwner.get(i);
      if (owner !== undefined && owner !== p.id) {
        return c.send({ t: 'err', text: 'Ghế này đã có người ngồi rồi.' });
      }
      if (p.seat !== null) seatOwner.delete(p.seat);
      const s = L.SEATS[i];
      p.seat = i;
      seatOwner.set(i, p.id);
      p.x = s.x;
      p.z = s.z;
      p.ry = s.ry;
      dirty.delete(p.id);
      broadcast({ t: 'sit', id: p.id, seat: i, x: s.x, z: s.z, ry: s.ry });
      return;
    }

    case 'stand': {
      if (p.seat === null) return;
      const s = L.SEATS[p.seat];
      seatOwner.delete(p.seat);
      p.seat = null;
      const sp = L.standPos(s);
      p.x = sp.x;
      p.z = sp.z;
      broadcast({ t: 'stand', id: p.id, x: r2(sp.x), z: r2(sp.z) });
      return;
    }

    case 'chat': {
      const text = cleanText(msg.text, 200);
      if (!text) return;
      if (!c.allow('chat', 600)) return c.send({ t: 'err', text: 'Bạn nhắn nhanh quá, chậm lại một chút nhé.' });
      const m = { t: 'chat', id: p.id, name: p.name, text, ts: now() };
      chatLog.push(m);
      if (chatLog.length > CHAT_HISTORY) chatLog.shift();
      broadcast(m);
      return;
    }

    case 'emote': {
      if (!EMOTES.has(msg.e) || !c.allow('emote', 400)) return;
      broadcast({ t: 'emote', id: p.id, e: msg.e });
      return;
    }

    // ---- điều khiển video (ai trong phòng cũng điều khiển được) ----
    case 'v_load': {
      const id = typeof msg.id === 'string' && /^[\w-]{11}$/.test(msg.id) ? msg.id : null;
      if (!id || !c.allow(msg.t, 800)) return;
      const t0 = Math.max(0, Math.min(num(msg.time) || 0, 86400));
      const title = cleanText(msg.title, 120);
      loadVideo(id, title, p.name, t0);
      pushVideo();
      sys(`${p.name} chiếu: ${title || id}`);
      return;
    }
    case 'v_pause': {
      if (!video.id || video.paused || !c.allow(msg.t, 300)) return;
      video.pausedAt = curTime();
      video.paused = true;
      video.rev++;
      pushVideo();
      return;
    }
    case 'v_play': {
      if (!video.id || !video.paused || !c.allow(msg.t, 300)) return;
      video.paused = false;
      video.startedAt = now() - video.pausedAt * 1000;
      video.rev++;
      pushVideo();
      return;
    }
    case 'v_seek': {
      const t = num(msg.time);
      if (!video.id || t === null || !c.allow(msg.t, 200)) return;
      const tt = Math.max(0, Math.min(t, 86400));
      if (video.paused) video.pausedAt = tt;
      else video.startedAt = now() - tt * 1000;
      video.rev++;
      pushVideo();
      return;
    }
    case 'v_next': {
      if (!video.id || !c.allow(msg.t, 800)) return;
      sys(`${p.name} đã chuyển video`);
      advance();
      return;
    }
    case 'v_end': {
      // nhiều người cùng báo video đã hết; chỉ người đầu tiên (đúng serial) có tác dụng
      if (!video.id || msg.serial !== video.serial) return;
      advance();
      return;
    }

    case 'q_add': {
      const id = typeof msg.id === 'string' && /^[\w-]{11}$/.test(msg.id) ? msg.id : null;
      if (!id || !c.allow(msg.t, 700)) return;
      if (queue.length >= MAX_QUEUE) return c.send({ t: 'err', text: 'Hàng chờ đã đầy.' });
      const title = cleanText(msg.title, 120);
      queue.push({ qid: nextQid++, id, title, by: p.name });
      if (!video.id) advance();
      else pushQueue();
      sys(`${p.name} thêm vào hàng chờ: ${title || id}`);
      return;
    }
    case 'q_remove': {
      const before = queue.length;
      queue = queue.filter((q) => q.qid !== msg.qid);
      if (queue.length !== before) pushQueue();
      return;
    }
    case 'q_play': {
      if (!c.allow(msg.t, 800)) return;
      const idx = queue.findIndex((q) => q.qid === msg.qid);
      if (idx < 0) return;
      const [q] = queue.splice(idx, 1);
      loadVideo(q.id, q.title, q.by, 0);
      pushVideo();
      pushQueue();
      sys(`${p.name} chiếu: ${q.title || q.id}`);
      return;
    }
  }
}

// Gửi vị trí gộp 10 lần/giây
setInterval(() => {
  if (!dirty.size) return;
  const list = [];
  for (const id of dirty) {
    const p = players.get(id);
    if (p) list.push([id, r2(p.x), r2(p.z), r2(p.ry)]);
  }
  dirty.clear();
  if (list.length) broadcast({ t: 's', p: list });
}, 100);

// Kiểm tra kết nối còn sống
setInterval(() => {
  const t = now();
  for (const c of clients) {
    if (t - c.lastSeen > 60000) {
      c.socket.destroy();
      continue;
    }
    c.write(frame(0x9, Buffer.alloc(0)));
  }
}, 20000).unref();

// ======================= Khởi động =======================
if (require.main === module) {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log('\n🎬  Rạp chiếu phim cộng đồng đang chạy!\n');
    console.log(`   Máy này:     http://localhost:${PORT}`);
    for (const list of Object.values(os.networkInterfaces())) {
      for (const n of list || []) {
        if (n.family === 'IPv4' && !n.internal) console.log(`   Cùng Wi-Fi:  http://${n.address}:${PORT}`);
      }
    }
    console.log('\n   Muốn bạn bè ngoài mạng vào chơi: xem README (ngrok / cloudflared / deploy).\n');
  });
  const stop = () => {
    for (const c of clients) c.close(1001);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

module.exports = { httpServer, players, video, getQueue: () => queue };
