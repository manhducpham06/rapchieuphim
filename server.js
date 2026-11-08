'use strict';
/*
 * Server rạp chiếu phim cộng đồng - không cần cài thư viện nào.
 * - Phục vụ file tĩnh trong /public
 * - API thanh toán vé phòng (xem payments.js)
 * - WebSocket (tự cài theo RFC 6455): nhiều phòng độc lập, mỗi phòng có người chơi, ghế, chat, video riêng
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const L = require('./public/layout.js');
const { createPayments } = require('./payments.js');
const { createStore } = require('./store.js');
const { createWallet } = require('./wallet.js');
const CAT = require('./public/catalog.js');
const { Football } = require('./football.js');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_PAYLOAD = 16 * 1024;
const MAX_CLIENTS = Number(process.env.MAX_CLIENTS) || 200;
const MAX_QUEUE = 30;
const CHAT_HISTORY = 40;
const EMOTES = new Set(['wave', 'clap', 'heart', 'laugh', 'wow', 'popcorn', 'thumb', 'dance', 'phone']);
const GAMES = { claw: 'Gắp thú', mole: 'Đập chuột chũi' };

const { createFirebaseAuth } = require('./fbauth.js');
const fbauth = createFirebaseAuth();
const accounts = new Map(); // uid -> Client đang đăng nhập
// Ông chủ cửa hàng: danh sách UID Firebase (cách nhau bởi dấu phẩy) trong biến môi trường ADMIN_UIDS
const ADMIN_UIDS = new Set(String(process.env.ADMIN_UIDS || '').split(',').map((x) => x.trim()).filter(Boolean));
const store = createStore();
if (store.mode === 'file') console.warn('[cảnh báo] Chưa có FIREBASE_SERVICE_ACCOUNT: ví xu và đồ đã mua chỉ lưu tạm trong file, sẽ MẤT khi Render khởi động lại. Xem README để bật lưu bền.');
const wallet = createWallet(store, { isAdmin: (uid) => ADMIN_UIDS.has(uid) });
const payments = createPayments(process.env, {
  store,
  wallet,
  onCredit: (uid, w) => {
    const c = accounts.get(uid);
    if (c && c.alive) { c.send({ t: 'wallet', w, toast: 'Nạp xu thành công!' }); }
  },
});

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
  '.glb': 'model/gltf-binary',
};

const now = () => Date.now();

// ======================= HTTP =======================
const rateMap = new Map(); // ip -> {n, t}
function rateLimited(ip, max, windowMs) {
  const t = now();
  let r = rateMap.get(ip + '|' + max);
  if (!r || t - r.t > windowMs) {
    r = { n: 0, t };
    rateMap.set(ip + '|' + max, r);
  }
  r.n++;
  return r.n > max;
}
setInterval(() => {
  const t = now();
  for (const [k, r] of rateMap) if (t - r.t > 120000) rateMap.delete(k);
}, 60000).unref();

function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || req.socket.remoteAddress || '?';
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function readJson(req, max = 10 * 1024) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on('data', (d) => {
      size += d.length;
      if (size > max) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(d);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

async function handleApi(req, res, url) {
  const p = url.pathname;
  const ip = clientIp(req);

  if (p === '/api/webhook' && req.method === 'POST') {
    const body = await readJson(req, 64 * 1024);
    const q = Object.fromEntries(url.searchParams);
    const r = await payments.handleWebhook(req.headers, q, body);
    if (r.json && r.json.confirmed) console.log(`[thanh toán] webhook xác nhận ${r.json.confirmed} đơn`);
    return sendJson(res, r.status, r.json);
  }

  if (p.startsWith('/api/admin/')) {
    if (rateLimited(ip, 30, 60000)) return sendJson(res, 429, { error: 'Thử lại sau' });
    const key = req.headers['x-admin-key'];
    if (p === '/api/admin/orders' && req.method === 'GET') {
      const r = payments.adminList(key);
      return r ? sendJson(res, 200, r) : sendJson(res, 401, { error: 'Sai khoá quản trị' });
    }
    if (p === '/api/admin/confirm' && req.method === 'POST') {
      const body = await readJson(req);
      const r = await payments.adminConfirm(key, body && body.code);
      if (!r) return sendJson(res, 401, { error: 'Sai khoá quản trị' });
      if (r.ok && !r.already) console.log(`[thanh toán] chủ game xác nhận đơn ${r.code}`);
      return sendJson(res, r.ok ? 200 : 400, r);
    }
    return sendJson(res, 404, { error: 'Không có' });
  }

  if (rateLimited(ip, 90, 60000)) return sendJson(res, 429, { error: 'Bạn thao tác quá nhanh, thử lại sau.' });

  if (p === '/api/config' && req.method === 'GET') return sendJson(res, 200, payments.publicConfig());

  if (p === '/api/order' && req.method === 'POST') {
    if (rateLimited(ip, 12, 10 * 60000)) return sendJson(res, 429, { error: 'Tạo quá nhiều đơn, thử lại sau ít phút.' });
    const body = await readJson(req);
    if (!body) return sendJson(res, 400, { error: 'Dữ liệu không hợp lệ' });
    const user = await fbauth.verify(String(body.idToken || '')).catch(() => null);
    if (!user) return sendJson(res, 401, { error: 'Bạn cần đăng nhập để nạp xu.' });
    const r = await payments.createOrder(user.uid, String(body.pack || ''));
    if (r.error) return sendJson(res, 400, { error: r.error });
    return sendJson(res, 200, r.order);
  }

  const m = p.match(/^\/api\/order\/([A-Za-z0-9]{1,20})$/);
  if (m && req.method === 'GET') return sendJson(res, 200, await payments.status(m[1]));

  return sendJson(res, 404, { error: 'Không có' });
}

const httpServer = http.createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    res.writeHead(400);
    return res.end('Bad request');
  }
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    return res.end('Bad request');
  }
  if (pathname === '/healthz') {
    let online = 0;
    for (const r of rooms.values()) online += r.players.size;
    return sendJson(res, 200, { ok: true, online });
  }
  if (pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((e) => {
      console.error('Lỗi API:', e);
      if (!res.headersSent) sendJson(res, 500, { error: 'Lỗi máy chủ' });
    });
    return;
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
      'Cache-Control': filePath.endsWith('.glb') ? 'public, max-age=86400' : 'no-cache',
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
    if (this.uid && accounts.get(this.uid) === this) accounts.delete(this.uid);
    if (this.player) {
      leaveRoom(this.player, true);
      this.player = null;
    }
  }
}

// ======================= Phòng =======================
const clients = new Set();
let nextId = 1;

class Room {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.kind = def.kind;
    this.layout = L.layoutOf(def.kind);
    this.players = new Map(); // id -> player
    this.seatOwner = new Map();
    this.dirty = new Set();
    this.chatLog = [];
    this.video = { id: null, title: '', by: '', serial: 0, rev: 0, paused: true, pausedAt: 0, startedAt: 0 };
    this.queue = [];
    this.nextQid = 1;
    this.ball = def.kind === 'arcade' ? new Football(L.ARCADE.PITCH) : null;
    this.ballWasMoving = false;
  }

  broadcast(obj, exceptId) {
    const data = frame(0x1, Buffer.from(JSON.stringify(obj)));
    for (const p of this.players.values()) {
      if (p.id === exceptId) continue;
      p.client.write(data);
    }
  }

  sys(text) {
    this.broadcast({ t: 'sys', text });
  }

  curTime() {
    const v = this.video;
    return v.paused ? v.pausedAt : Math.max(0, (now() - v.startedAt) / 1000);
  }
  loadVideo(id, title, by, t = 0) {
    const v = this.video;
    v.id = id;
    v.title = title || '';
    v.by = by || '';
    v.serial++;
    v.rev++;
    v.paused = false;
    v.pausedAt = t;
    v.startedAt = now() - t * 1000;
  }
  clearVideo() {
    const v = this.video;
    v.id = null;
    v.title = '';
    v.by = '';
    v.serial++;
    v.rev++;
    v.paused = true;
    v.pausedAt = 0;
    v.startedAt = 0;
  }
  pushVideo() {
    this.broadcast({ t: 'video', video: { ...this.video } });
  }
  pushQueue() {
    this.broadcast({ t: 'queue', queue: this.queue });
  }
  advance() {
    const nx = this.queue.shift();
    if (nx) {
      this.loadVideo(nx.id, nx.title, nx.by, 0);
      this.sys(`Tiếp theo: ${nx.title || nx.id}`);
    } else {
      this.clearVideo();
      this.sys('Hết hàng chờ - màn hình đã tắt');
    }
    this.pushVideo();
    this.pushQueue();
  }
}

const rooms = new Map();
for (const def of L.ROOMS) rooms.set(def.id, new Room(def));

function counts() {
  const o = {};
  for (const r of rooms.values()) o[r.id] = r.players.size;
  return o;
}
let countsTimer = null;
function scheduleCounts() {
  if (countsTimer) return;
  countsTimer = setTimeout(() => {
    countsTimer = null;
    const msg = frame(0x1, Buffer.from(JSON.stringify({ t: 'rooms', counts: counts() })));
    for (const c of clients) if (c.player) c.write(msg);
  }, 800);
  countsTimer.unref();
}

// ---- tiện ích ----
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
  return { id: p.id, name: p.name, v: p.verified ? 1 : 0, own: p.admin ? 1 : 0, o: p.equip || {}, look: p.look, x: r2(p.x), z: r2(p.z), ry: r2(p.ry), seat: p.seat };
}


function enterRoom(c, room) {
  const p = c.player;
  const lay = room.layout;
  p.room = room;
  p.seat = null;
  p.vx = p.vz = 0;
  p.pt = 0;
  const fixed = lay.resolve(lay.SPAWN.x + (Math.random() - 0.5) * 8, lay.SPAWN.z + Math.random() * 1.5);
  p.x = fixed.x;
  p.z = fixed.z;
  p.px = p.x;
  p.pz = p.z;
  p.ry = Math.PI;
  room.players.set(p.id, p);
  c.send({
    t: 'welcome',
    id: p.id,
    room: room.id,
    serverTime: now(),
    players: [...room.players.values()].map(publicPlayer),
    video: { ...room.video },
    queue: room.queue,
    chat: room.chatLog,
    w: c.wallet || null,
    counts: counts(),
    ball: room.ball ? { b: room.ball.state(), top: room.ball.top() } : null,
  });
  room.broadcast({ t: 'join', player: publicPlayer(p) }, p.id);
  room.sys(`${p.name} vừa vào ${room.def.name}`);
  scheduleCounts();
}

function leaveRoom(p, announce) {
  const room = p.room;
  if (!room) return;
  room.players.delete(p.id);
  room.dirty.delete(p.id);
  if (p.seat !== null && room.seatOwner.get(p.seat) === p.id) room.seatOwner.delete(p.seat);
  p.seat = null;
  room.broadcast({ t: 'leave', id: p.id });
  if (announce) room.sys(`${p.name} đã rời ${room.def.name}`);
  p.room = null;
  scheduleCounts();
}

async function doJoin(c, msg, user) {
  if (user) {
    const old = accounts.get(user.uid);
    if (old && old !== c && old.alive) {
      old.send({ t: 'err', text: 'Tài khoản này vừa đăng nhập ở nơi khác.' });
      old.close(4001);
    }
    accounts.set(user.uid, c);
    c.uid = user.uid;
  }
  let w = null;
  if (user) {
    try { w = await wallet.get(user.uid); } catch (e) { console.error('Lỗi đọc ví:', e.message); }
    if (!c.alive) return;
  }
  c.wallet = w;
  const id = nextId++;
  const p = {
    id,
    name: (user && cleanName(user.name)) || cleanName(msg.name) || 'Khách ' + id,
    verified: !!user,
    look: cleanLook(msg.look),
    admin: !!(w && w.admin),
    equip: w ? { ...w.equip } : {},
    x: 0, z: 0, ry: Math.PI, seat: null, room: null,
    vx: 0, vz: 0, px: 0, pz: 0, pt: 0,
    client: c,
  };
  c.player = p;
  const target = typeof msg.room === 'string' && rooms.has(msg.room) ? msg.room : L.DEFAULT_ROOM;
  enterRoom(c, rooms.get(target));
}

// ======================= Xử lý tin nhắn =======================
function handle(c, msg) {
  if (msg.t === 'ping') return c.send({ t: 'pong', t0: num(msg.t0), ts: now() });

  if (msg.t === 'join') {
    if (c.player || c.joining) return;
    c.joining = true;
    Promise.resolve(typeof msg.idToken === 'string' && msg.idToken ? fbauth.verify(msg.idToken) : null)
      .catch(() => null)
      .then((user) => {
        c.joining = false;
        if (!c.alive || c.player) return;
        if (typeof msg.idToken === 'string' && msg.idToken && !user) c.send({ t: 'err', text: 'Phiên đăng nhập hết hạn, bạn đang chơi như khách. Hãy đăng nhập lại.' });
        doJoin(c, msg, user);
      });
    return;
  }

  const p = c.player;
  if (!p || !p.room) return;
  const room = p.room;

  switch (msg.t) {
    case 'room': {
      if (!c.allow('room', 800)) return;
      const target = typeof msg.room === 'string' ? rooms.get(msg.room) : null;
      if (!target || target === room) return;
      leaveRoom(p, true);
      enterRoom(c, target);
      return;
    }

    case 'buy': {
      if (!c.uid) return c.send({ t: 'err', text: 'Bạn cần đăng nhập để mua đồ.' });
      if (!c.allow('buy', 400)) return;
      {
        // Shop chỉ bán khi chủ shop (admin) đang đứng trong phòng shop.
        const shopRoom = rooms.get('shop');
        let open = false;
        if (shopRoom) for (const q of shopRoom.players.values()) if (q.admin) { open = true; break; }
        if (!open) return c.send({ t: 'buyres', ok: false, item: String(msg.item || ''), error: 'Shop đang đóng cửa, ông chủ đang vắng. Quay lại sau nhé!', short: false });
      }
      wallet.buy(c.uid, String(msg.item || '')).then((r) => {
        if (!c.alive) return;
        if (r.w) { c.wallet = r.w; c.send({ t: 'wallet', w: r.w }); }
        c.send({ t: 'buyres', ok: r.ok, item: r.item || String(msg.item || ''), error: r.error || '', short: !!r.short });
      }).catch((e) => { console.error('Lỗi mua:', e.message); c.send({ t: 'err', text: 'Hệ thống đang bận, thử lại sau.' }); });
      return;
    }

    case 'equip': {
      if (!c.uid) return c.send({ t: 'err', text: 'Bạn cần đăng nhập để thay đồ.' });
      if (!c.allow('equip', 200)) return;
      const item = msg.item === null ? null : String(msg.item || '');
      wallet.equip(c.uid, String(msg.slot || ''), item).then((r) => {
        if (!c.alive) return;
        if (!r.ok) return c.send({ t: 'err', text: r.error });
        c.wallet = r.w;
        c.send({ t: 'wallet', w: r.w });
        if (p.room) {
          p.equip = { ...r.w.equip };
          p.room.broadcast({ t: 'outfit', id: p.id, o: p.equip });
        }
      }).catch((e) => { console.error('Lỗi đổi đồ:', e.message); c.send({ t: 'err', text: 'Hệ thống đang bận, thử lại sau.' }); });
      return;
    }

    case 'move': {
      if (p.seat !== null) return;
      const x = num(msg.x);
      const z = num(msg.z);
      const ry = num(msg.ry);
      if (x === null || z === null || ry === null) return;
      const B = room.layout.BOUNDS;
      const nx = L.clamp(x, B.minX, B.maxX);
      const nz = L.clamp(z, B.minZ, B.maxZ);
      const t = now();
      if (p.pt && t - p.pt >= 25) {
        const dt = (t - p.pt) / 1000;
        const vx = (nx - p.x) / dt;
        const vz = (nz - p.z) / dt;
        const sp = Math.hypot(vx, vz);
        const k = sp > 9 ? 9 / sp : 1; // giới hạn chống gian lận tốc độ
        p.vx = p.vx * 0.4 + vx * k * 0.6;
        p.vz = p.vz * 0.4 + vz * k * 0.6;
        p.pt = t;
      } else if (!p.pt) p.pt = t;
      p.x = nx;
      p.z = nz;
      p.ry = ry;
      room.dirty.add(p.id);
      return;
    }

    case 'sit': {
      if (room.kind !== 'theater') return;
      if (!c.allow('sit', 250)) return;
      const i = msg.seat;
      if (!Number.isInteger(i) || i < 0 || i >= L.SEATS.length) return;
      const owner = room.seatOwner.get(i);
      if (owner !== undefined && owner !== p.id) {
        return c.send({ t: 'err', text: 'Ghế này đã có người ngồi rồi.' });
      }
      if (p.seat !== null) room.seatOwner.delete(p.seat);
      const s = L.SEATS[i];
      p.seat = i;
      room.seatOwner.set(i, p.id);
      p.x = s.x;
      p.z = s.z;
      p.ry = s.ry;
      room.dirty.delete(p.id);
      room.broadcast({ t: 'sit', id: p.id, seat: i, x: s.x, z: s.z, ry: s.ry });
      return;
    }

    case 'stand': {
      if (p.seat === null) return;
      const s = L.SEATS[p.seat];
      room.seatOwner.delete(p.seat);
      p.seat = null;
      const sp = L.standPos(s);
      p.x = sp.x;
      p.z = sp.z;
      room.broadcast({ t: 'stand', id: p.id, x: r2(sp.x), z: r2(sp.z) });
      return;
    }

    case 'chat': {
      const text = cleanText(msg.text, 200);
      if (!text) return;
      if (!c.allow('chat', 600)) return c.send({ t: 'err', text: 'Bạn nhắn nhanh quá, chậm lại một chút nhé.' });
      const m = { t: 'chat', id: p.id, name: p.name, text, ts: now() };
      room.chatLog.push(m);
      if (room.chatLog.length > CHAT_HISTORY) room.chatLog.shift();
      room.broadcast(m);
      return;
    }

    case 'emote': {
      if (!EMOTES.has(msg.e) || !c.allow('emote', 400)) return;
      room.broadcast({ t: 'emote', id: p.id, e: msg.e });
      return;
    }

    // ---- voice chat: chuyển tiếp tín hiệu WebRTC giữa hai người cùng phòng ----
    case 'rtc': {
      const to = room.players.get(num(msg.to));
      if (!to || to.id === p.id || !msg.d || typeof msg.d !== 'object') return;
      const t = now();
      if (t - (c.rtcWin || 0) > 2000) { c.rtcWin = t; c.rtcN = 0; }
      if (++c.rtcN > 120) return;
      const raw = JSON.stringify(msg.d);
      if (raw.length > 8000) return;
      to.client.send({ t: 'rtc', from: p.id, d: msg.d });
      return;
    }

    case 'score': {
      const name = GAMES[msg.game];
      const sc = num(msg.score);
      if (!name || sc === null || sc < 1 || sc > 9999 || !c.allow('score', 4000)) return;
      room.sys(`${p.name} đạt ${Math.floor(sc)} điểm ở ${name}`);
      return;
    }

    // ---- điều khiển video (ai trong phòng cũng điều khiển được) ----
    case 'v_load': {
      if (room.kind !== 'theater') return;
      const id = typeof msg.id === 'string' && /^[\w-]{11}$/.test(msg.id) ? msg.id : null;
      if (!id || !c.allow(msg.t, 800)) return;
      const t0 = Math.max(0, Math.min(num(msg.time) || 0, 86400));
      const title = cleanText(msg.title, 120);
      room.loadVideo(id, title, p.name, t0);
      room.pushVideo();
      room.sys(`${p.name} chiếu: ${title || id}`);
      return;
    }
    case 'v_pause': {
      const v = room.video;
      if (!v.id || v.paused || !c.allow(msg.t, 300)) return;
      v.pausedAt = room.curTime();
      v.paused = true;
      v.rev++;
      room.pushVideo();
      return;
    }
    case 'v_play': {
      const v = room.video;
      if (!v.id || !v.paused || !c.allow(msg.t, 300)) return;
      v.paused = false;
      v.startedAt = now() - v.pausedAt * 1000;
      v.rev++;
      room.pushVideo();
      return;
    }
    case 'v_seek': {
      const v = room.video;
      const t = num(msg.time);
      if (!v.id || t === null || !c.allow(msg.t, 200)) return;
      const tt = Math.max(0, Math.min(t, 86400));
      if (v.paused) v.pausedAt = tt;
      else v.startedAt = now() - tt * 1000;
      v.rev++;
      room.pushVideo();
      return;
    }
    case 'v_next': {
      if (!room.video.id || !c.allow(msg.t, 800)) return;
      room.sys(`${p.name} đã chuyển video`);
      room.advance();
      return;
    }
    case 'v_end': {
      // nhiều người cùng báo video đã hết; chỉ người đầu tiên (đúng serial) có tác dụng
      if (!room.video.id || msg.serial !== room.video.serial) return;
      room.advance();
      return;
    }

    case 'q_add': {
      if (room.kind !== 'theater') return;
      const id = typeof msg.id === 'string' && /^[\w-]{11}$/.test(msg.id) ? msg.id : null;
      if (!id || !c.allow(msg.t, 700)) return;
      if (room.queue.length >= MAX_QUEUE) return c.send({ t: 'err', text: 'Hàng chờ đã đầy.' });
      const title = cleanText(msg.title, 120);
      room.queue.push({ qid: room.nextQid++, id, title, by: p.name });
      if (!room.video.id) room.advance();
      else room.pushQueue();
      room.sys(`${p.name} thêm vào hàng chờ: ${title || id}`);
      return;
    }
    case 'q_remove': {
      const before = room.queue.length;
      room.queue = room.queue.filter((q) => q.qid !== msg.qid);
      if (room.queue.length !== before) room.pushQueue();
      return;
    }
    case 'q_play': {
      if (!c.allow(msg.t, 800)) return;
      const idx = room.queue.findIndex((q) => q.qid === msg.qid);
      if (idx < 0) return;
      const [q] = room.queue.splice(idx, 1);
      room.loadVideo(q.id, q.title, q.by, 0);
      room.pushVideo();
      room.pushQueue();
      room.sys(`${p.name} chiếu: ${q.title || q.id}`);
      return;
    }
  }
}

// Gửi vị trí gộp 10 lần/giây cho từng phòng
setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.dirty.size) continue;
    const list = [];
    for (const id of room.dirty) {
      const p = room.players.get(id);
      if (p) list.push([id, r2(p.x), r2(p.z), r2(p.ry)]);
    }
    room.dirty.clear();
    if (list.length) room.broadcast({ t: 's', p: list });
  }
}, 100);

// Vật lý bóng đá: 25 lần/giây khi có người trong sân
const BALL_DT = 0.04;
let lastBall = now();
function tickBalls() {
  const t = now();
  const dt = Math.min((t - lastBall) / 1000, 0.1);
  lastBall = t;
  for (const room of rooms.values()) {
    if (!room.ball || !room.players.size) continue;
    const list = [];
    for (const p of room.players.values()) {
      const fresh = t - p.pt < 220;
      list.push({ id: p.id, name: p.name, x: p.x, z: p.z, vx: fresh ? p.vx : 0, vz: fresh ? p.vz : 0 });
    }
    const ev = room.ball.step(dt, list);
    for (const e of ev) {
      if (e.type === 'goal') {
        room.broadcast({ t: 'goal', by: e.by, side: e.side, top: room.ball.top() });
        room.sys(`Bàn thắng! ${e.by} vừa ghi bàn.`);
      }
    }
    const mv = room.ball.moving;
    if (mv || room.ballWasMoving || room.ball.dirty || ev.length) {
      room.broadcast({ t: 'ball', b: room.ball.state(), frozen: room.ball.frozen > 0 });
    }
    room.ballWasMoving = mv;
    room.ball.dirty = false;
  }
}
const ballTimer = setInterval(tickBalls, BALL_DT * 1000);
ballTimer.unref();

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
    console.log(`\n   Trang quản trị xác nhận thanh toán: http://localhost:${PORT}/admin.html`);
    console.log(`   Nhận tiền vào: ${payments.cfg.bank.name} · ${payments.cfg.bank.account} · ${payments.cfg.bank.holder}`);
    console.log(`   Xác nhận tự động (webhook): ${payments.cfg.webhookKey ? 'BẬT' : 'tắt - xác nhận thủ công ở trang quản trị'}\n`);
  });
  const stop = () => {
    for (const c of clients) c.close(1001);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

module.exports = { httpServer, rooms, payments, tickBalls, fbauth, accounts, wallet, store };
