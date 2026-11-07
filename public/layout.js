/*
 * Bố cục rạp chiếu phim - dùng chung cho server (Node) và client (trình duyệt).
 * Một nguồn dữ liệu duy nhất để vị trí ghế, va chạm và độ cao sàn luôn khớp nhau.
 *
 * Hệ trục: x = ngang, y = cao, z = sâu. Màn hình ở phía z âm, khán giả nhìn về -z.
 * Hướng nhìn của nhân vật: vector (sin ry, cos ry) trên mặt phẳng xz, ry = PI là nhìn về màn hình.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LAYOUT = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ROOM = { minX: -15, maxX: 15, minZ: -17.5, maxZ: 18.5, height: 13.5 };
  // Vùng người chơi được đi (trừ sân khấu trước màn hình)
  const BOUNDS = { minX: -14.3, maxX: 14.3, minZ: -13.2, maxZ: 17.8 };

  const ROWS = 7;
  const ROW_GAP = 2.2;
  const ROW0_Z = -6.5;
  const STEP_H = 0.3; // mỗi hàng ghế cao hơn hàng trước
  const RAMP = 0.25; // phần đầu mỗi bậc là dốc thoải
  const SEAT_GAP = 1.5;
  const BLOCKS = [
    { n: 4, cx: -9.2 },
    { n: 6, cx: 0 },
    { n: 4, cx: 9.2 },
  ];
  const ZA = ROW0_Z - ROW_GAP / 2; // bắt đầu bậc thang
  const ZB = ZA + ROWS * ROW_GAP; // kết thúc bậc thang, bắt đầu khu sảnh
  const TOP_Y = ROWS * STEP_H; // độ cao sàn khu sảnh phía sau

  const SCREEN = { x: 0, y: 7, z: -16.95, w: 18, h: 10.125 };

  const PLAYER_R = 0.2;
  const SEAT_R = 0.6;

  const LOOK_COUNTS = { shirt: 10, skin: 6, hair: 6, hat: 6 };

  const ROW_LETTERS = 'ABCDEFGHIJ';

  // ---- Ghế ----
  const SEATS = [];
  for (let r = 0; r < ROWS; r++) {
    let col = 0;
    for (const b of BLOCKS) {
      for (let k = 0; k < b.n; k++) {
        col++;
        SEATS.push({
          i: SEATS.length,
          kind: 'row',
          row: r,
          col,
          label: ROW_LETTERS[r] + col,
          x: b.cx + (k - (b.n - 1) / 2) * SEAT_GAP,
          z: ROW0_Z + r * ROW_GAP,
          ry: Math.PI,
          floorY: (r + 1) * STEP_H,
          sitH: 0.5,
        });
      }
    }
  }

  // Ghế lười ở khu sảnh phía sau
  const BEANBAGS = [
    { x: 8.5, z: 13.2, color: 0xe74c3c },
    { x: 10.9, z: 14.9, color: 0x3498db },
    { x: 12.7, z: 12.7, color: 0xf1c40f },
  ];
  BEANBAGS.forEach((b, n) => {
    SEATS.push({
      i: SEATS.length,
      kind: 'bean',
      row: -1,
      col: n + 1,
      label: 'Ghế lười ' + (n + 1),
      x: b.x,
      z: b.z,
      ry: Math.PI,
      floorY: TOP_Y,
      sitH: 0.38,
    });
  });

  // ---- Đồ đạc khu sảnh (vừa để dựng mô hình, vừa để va chạm) ----
  const PROPS = {
    counter: { x: -9.25, z: 16.8, w: 6, d: 1.4 },
    popcornMachine: { x: -13, z: 13.6 },
    table: { x: 0, z: 14.2, r: 0.85 },
    arcade: [
      { x: 14.1, z: 9.6 },
      { x: 14.1, z: 11.2 },
    ],
    plants: [
      { x: -13.9, z: -12.6 },
      { x: 13.9, z: -12.6 },
      { x: -13.9, z: 17.2 },
      { x: 13.9, z: 17.2 },
    ],
  };

  const OBSTACLES = [];
  for (const cx of [-11.5, -10, -8.5, -7]) OBSTACLES.push({ x: cx, z: PROPS.counter.z, r: 0.85 });
  OBSTACLES.push({ x: PROPS.popcornMachine.x, z: PROPS.popcornMachine.z, r: 0.8 });
  OBSTACLES.push({ x: PROPS.table.x, z: PROPS.table.z, r: 1.45 });
  for (const a of PROPS.arcade) OBSTACLES.push({ x: a.x - 0.2, z: a.z, r: 0.7 });
  for (const p of PROPS.plants) OBSTACLES.push({ x: p.x, z: p.z, r: 0.5 });

  const COLLIDERS = [];
  for (const s of SEATS) COLLIDERS.push({ x: s.x, z: s.z, r: s.kind === 'bean' ? 0.75 : SEAT_R, seat: s.i });
  for (const o of OBSTACLES) COLLIDERS.push({ x: o.x, z: o.z, r: o.r });

  const SPAWN = { x: 0, z: 10.4 };

  // ---- Hàm tiện ích ----
  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  /** Độ cao sàn tại vị trí z (bậc thang có đoạn dốc ngắn để đi lên được). */
  function heightAt(z) {
    const t = (z - ZA) / ROW_GAP;
    if (t <= 0) return 0;
    if (t >= ROWS) return TOP_Y;
    const fl = Math.floor(t);
    const fr = t - fl;
    return STEP_H * (fl + Math.min(fr / RAMP, 1));
  }

  /** Đẩy điểm (x,z) ra khỏi vật cản và giữ trong phòng. Trả về {x,z}. */
  function resolve(x, z, ignoreSeat) {
    x = clamp(x, BOUNDS.minX, BOUNDS.maxX);
    z = clamp(z, BOUNDS.minZ, BOUNDS.maxZ);
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k < COLLIDERS.length; k++) {
        const o = COLLIDERS[k];
        if (o.seat !== undefined && o.seat === ignoreSeat) continue;
        const min = o.r + PLAYER_R;
        let dx = x - o.x;
        let dz = z - o.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min) {
          let d = Math.sqrt(d2);
          if (d < 1e-4) {
            dx = 0;
            dz = 1;
            d = 1;
          }
          x = o.x + (dx / d) * min;
          z = o.z + (dz / d) * min;
        }
      }
      x = clamp(x, BOUNDS.minX, BOUNDS.maxX);
      z = clamp(z, BOUNDS.minZ, BOUNDS.maxZ);
    }
    return { x, z };
  }

  /** Vị trí đứng lên khi rời ghế (khoảng trống để chân giữa hai hàng). */
  function standPos(seat) {
    const back = seat.kind === 'bean' ? 1.4 : 1.1;
    return resolve(seat.x, seat.z - back, seat.i);
  }

  // ---- Danh sách phòng ----
  const ROOMS = [
    { id: 'plaza', name: 'Quảng Trường', kind: 'plaza', tag: 'Sảnh chính',
      desc: 'Nơi gặp gỡ mọi người, đài phun nước, cổng đi tới mọi khu.' },
    { id: 'cinema', name: 'Rạp Chiếu Phim', kind: 'theater', tag: 'Miễn phí',
      desc: 'Rạp VIP duy nhất: màn hình khổng lồ, kính neon, trần thiên hà.' },
    { id: 'arcade', name: 'Khu Giải Trí', kind: 'arcade', tag: 'Miễn phí',
      desc: 'Sân đá bóng mini nhiều người, máy gắp thú, máy game.' },
    { id: 'shop', name: 'Shop Thời Trang', kind: 'shop', tag: 'Mua sắm',
      desc: 'Cửa hàng quần áo, phụ kiện của ông chủ. Dùng xu để mua và thử đồ.' },
  ];
  const ROOM_BY_ID = {};
  ROOMS.forEach((r) => (ROOM_BY_ID[r.id] = r));
  const DEFAULT_ROOM = 'plaza';

  // ---- Cửa ra Quảng Trường ở sảnh rạp + điểm tương tác ----
  const DOOR_ARCADE = { x: 13.1, z: 14.6 };
  const INTERACT = [
    { id: 'lobby-mole', type: 'game', game: 'mole', x: 12.6, z: 9.6, r: 2.0, label: 'Đập chuột chũi' },
    { id: 'lobby-claw', type: 'game', game: 'claw', x: 12.6, z: 11.2, r: 2.0, label: 'Gắp thú' },
    { id: 'door-plaza', type: 'door', go: 'plaza', x: DOOR_ARCADE.x, z: DOOR_ARCADE.z, r: 1.9, label: 'Ra Quảng Trường' },
  ];

  /** Phòng phẳng (không ghế, không bậc): dùng chung cho Quảng Trường, Shop, Khu Giải Trí. */
  function makeFlat(def) {
    const F = { ROOM: def.ROOM, BOUNDS: def.BOUNDS, SPAWN: def.SPAWN, SEATS: [], INTERACT: def.INTERACT, COLLIDERS: def.COLLIDERS };
    F.heightAt = function () { return 0; };
    F.resolve = function (x, z) {
      const B = F.BOUNDS;
      x = clamp(x, B.minX, B.maxX);
      z = clamp(z, B.minZ, B.maxZ);
      for (let pass = 0; pass < 2; pass++) {
        for (const o of F.COLLIDERS) {
          const min = o.r + PLAYER_R;
          let dx = x - o.x, dz = z - o.z;
          const d2 = dx * dx + dz * dz;
          if (d2 < min * min) {
            let d = Math.sqrt(d2);
            if (d < 1e-4) { dx = 0; dz = 1; d = 1; }
            x = o.x + (dx / d) * min;
            z = o.z + (dz / d) * min;
          }
        }
        x = clamp(x, B.minX, B.maxX);
        z = clamp(z, B.minZ, B.maxZ);
      }
      return { x, z };
    };
    return F;
  }

  // ---- Quảng Trường (sảnh chính) ----
  const PZ_DEF = {
    ROOM: { minX: -20, maxX: 20, minZ: -20, maxZ: 20, height: 30 },
    BOUNDS: { minX: -19.3, maxX: 19.3, minZ: -19.3, maxZ: 19.3 },
    SPAWN: { x: 0, z: 12 },
    COLLIDERS: [{ x: 0, z: 0, r: 3.3 }],
    INTERACT: [
      { id: 'door-cinema', type: 'door', go: 'cinema', x: 0, z: -16.2, r: 2.4, label: 'Vào Rạp Chiếu Phim' },
      { id: 'door-arcade', type: 'door', go: 'arcade', x: 16.2, z: 0, r: 2.4, label: 'Vào Khu Giải Trí' },
      { id: 'door-shop', type: 'door', go: 'shop', x: -16.2, z: 0, r: 2.4, label: 'Vào Shop Thời Trang' },
    ],
  };
  PZ_DEF.BENCHES = [{ x: -8, z: 8 }, { x: 8, z: 8 }, { x: -8, z: -8 }, { x: 8, z: -8 }];
  PZ_DEF.TREES = [{ x: -14, z: 12 }, { x: 14, z: 12 }, { x: -14, z: -12 }, { x: 14, z: -12 }, { x: -6, z: 16 }, { x: 6, z: 16 }];
  PZ_DEF.BENCHES.forEach((b) => { for (const k of [-0.8, 0, 0.8]) PZ_DEF.COLLIDERS.push({ x: b.x + k, z: b.z, r: 0.5 }); });
  PZ_DEF.TREES.forEach((t) => PZ_DEF.COLLIDERS.push({ x: t.x, z: t.z, r: 0.6 }));
  const PZ = makeFlat(PZ_DEF);
  PZ.BENCHES = PZ_DEF.BENCHES;
  PZ.TREES = PZ_DEF.TREES;

  // ---- Shop Thời Trang ----
  const SH_DEF = {
    ROOM: { minX: -12, maxX: 12, minZ: -10, maxZ: 10, height: 7 },
    BOUNDS: { minX: -11.3, maxX: 11.3, minZ: -9.3, maxZ: 9.3 },
    SPAWN: { x: 0, z: 7 },
    COLLIDERS: [],
    INTERACT: [],
  };
  SH_DEF.COUNTER = { x: 0, z: -6.6, w: 6, d: 1.2 };
  SH_DEF.OWNER = { x: 0, z: -8.1 };
  SH_DEF.RACKS = [];
  for (const z of [-3.5, 0.5, 4.5]) { SH_DEF.RACKS.push({ x: -10.4, z, ry: Math.PI / 2 }); SH_DEF.RACKS.push({ x: 10.4, z, ry: -Math.PI / 2 }); }
  SH_DEF.MANNEQUINS = [{ x: -5.2, z: -2.2 }, { x: -2.6, z: 1.4 }, { x: 2.6, z: 1.4 }, { x: 5.2, z: -2.2 }];
  SH_DEF.MIRROR = { x: -7, z: -9.3 };
  for (const k of [-2.4, -1.2, 0, 1.2, 2.4]) SH_DEF.COLLIDERS.push({ x: SH_DEF.COUNTER.x + k, z: SH_DEF.COUNTER.z, r: 0.75 });
  SH_DEF.RACKS.forEach((r) => { for (const k of [-1.1, 0, 1.1]) SH_DEF.COLLIDERS.push({ x: r.x, z: r.z + k, r: 0.55 }); });
  SH_DEF.MANNEQUINS.forEach((m) => SH_DEF.COLLIDERS.push({ x: m.x, z: m.z, r: 0.55 }));
  SH_DEF.INTERACT = [
    { id: 'shop-counter', type: 'shop', x: 0, z: -4.7, r: 2.6, label: 'Mua sắm' },
    { id: 'shop-mirror', type: 'wardrobe', x: SH_DEF.MIRROR.x, z: SH_DEF.MIRROR.z + 1.6, r: 2.0, label: 'Thử đồ trước gương' },
    { id: 'door-plaza', type: 'door', go: 'plaza', x: 0, z: 8.6, r: 2.0, label: 'Ra Quảng Trường' },
  ];
  const SH = makeFlat(SH_DEF);
  ['COUNTER', 'OWNER', 'RACKS', 'MANNEQUINS', 'MIRROR'].forEach((k) => (SH[k] = SH_DEF[k]));

  // ---- Khu Giải Trí (phòng riêng) ----
  const AR = {};
  AR.ROOM = { minX: -15, maxX: 15, minZ: -15, maxZ: 15, height: 9 };
  AR.BOUNDS = { minX: -14.3, maxX: 14.3, minZ: -14.3, maxZ: 14.3 };
  AR.SPAWN = { x: 0, z: 11 };
  AR.PITCH = { cx: 0, cz: -7.4, hx: 8.2, hz: 4.4, goalHalf: 1.9, goalDepth: 1.5 };
  AR.CLAWS = [{ x: -12.9, z: 1.6 }, { x: -12.9, z: 5.2 }];
  AR.CABINETS = [{ x: 13.3, z: 1.0 }, { x: 13.3, z: 3.2 }, { x: 13.3, z: 5.4 }, { x: 13.3, z: 7.6 }];
  AR.DOOR = { x: 0, z: 14.6 };
  AR.BENCHES = [{ x: -6, z: 9 }, { x: 6, z: 9 }];
  AR.COLLIDERS = [];
  AR.CLAWS.forEach((c) => AR.COLLIDERS.push({ x: c.x, z: c.z, r: 1.0 }));
  AR.CABINETS.forEach((c) => AR.COLLIDERS.push({ x: c.x, z: c.z, r: 0.75 }));
  AR.BENCHES.forEach((b) => { for (const k of [-1, 0, 1]) AR.COLLIDERS.push({ x: b.x + k * 0.8, z: b.z, r: 0.5 }); });
  AR.INTERACT = [
    ...AR.CLAWS.map((c, i) => ({ id: 'claw' + i, type: 'game', game: 'claw', x: c.x + 1.6, z: c.z, r: 2.0, label: 'Gắp thú' })),
    ...AR.CABINETS.map((c, i) => ({ id: 'cab' + i, type: 'game', game: 'mole', x: c.x - 1.4, z: c.z, r: 1.6, label: 'Đập chuột chũi' })),
    { id: 'door-plaza', type: 'door', go: 'plaza', x: AR.DOOR.x, z: AR.DOOR.z - 1.0, r: 2.0, label: 'Ra Quảng Trường' },
  ];
  AR.SEATS = [];
  AR.heightAt = function () { return 0; };
  AR.resolve = function (x, z) {
    x = clamp(x, AR.BOUNDS.minX, AR.BOUNDS.maxX);
    z = clamp(z, AR.BOUNDS.minZ, AR.BOUNDS.maxZ);
    for (let pass = 0; pass < 2; pass++) {
      for (const o of AR.COLLIDERS) {
        const min = o.r + PLAYER_R;
        let dx = x - o.x, dz = z - o.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min) {
          let d = Math.sqrt(d2);
          if (d < 1e-4) { dx = 0; dz = 1; d = 1; }
          x = o.x + (dx / d) * min;
          z = o.z + (dz / d) * min;
        }
      }
      x = clamp(x, AR.BOUNDS.minX, AR.BOUNDS.maxX);
      z = clamp(z, AR.BOUNDS.minZ, AR.BOUNDS.maxZ);
    }
    return { x, z };
  };

  /** Bố cục theo loại phòng: dùng chung API {ROOM,BOUNDS,SPAWN,resolve,heightAt,SEATS,INTERACT} */
  const THEATER = { ROOM, BOUNDS, SPAWN, resolve, heightAt, SEATS, INTERACT };
  function layoutOf(kind) { return kind === 'arcade' ? AR : kind === 'plaza' ? PZ : kind === 'shop' ? SH : THEATER; }

  return {
    ROOM, BOUNDS, ROWS, ROW_GAP, ROW0_Z, STEP_H, RAMP, SEAT_GAP, BLOCKS, ZA, ZB, TOP_Y,
    SCREEN, PLAYER_R, SEAT_R, LOOK_COUNTS, SEATS, BEANBAGS, PROPS, OBSTACLES, COLLIDERS, SPAWN,
    clamp, heightAt, resolve, standPos,
    ROOMS, ROOM_BY_ID, DEFAULT_ROOM, INTERACT, DOOR_ARCADE, ARCADE: AR, PLAZA: PZ, SHOP: SH, layoutOf,
  };
});
