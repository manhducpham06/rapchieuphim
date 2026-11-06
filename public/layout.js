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

  // ---- Danh sách phòng (server là nơi quyết định giá) ----
  const ROOMS = [
    { id: 'std', name: 'Rạp Tiêu Chuẩn', kind: 'theater', tier: 0, price: 0, tag: 'Miễn phí',
      desc: 'Rạp đỏ nhung cổ điển, đủ ghế cho cả hội.' },
    { id: 'silver', name: 'Rạp Bạc', kind: 'theater', tier: 1, price: 5000, tag: 'Cấp 1',
      desc: 'Tông xanh bạc sang trọng, cột trụ, đèn LED lối đi và đèn rọi trần.' },
    { id: 'gold', name: 'Rạp Vàng', kind: 'theater', tier: 2, price: 8000, tag: 'Cấp 2',
      desc: 'Rèm vàng, đèn chùm pha lê, thảm đỏ viền vàng và sảnh đá hoa.' },
    { id: 'vip', name: 'Rạp Kim Cương', kind: 'theater', tier: 3, price: 10000, tag: 'Cấp 3 · VIP',
      desc: 'Kính neon đổi màu, trần thiên hà, kim cương xoay và đom đóm ánh sáng.' },
    { id: 'arcade', name: 'Khu Giải Trí', kind: 'arcade', tier: 0, price: 0, tag: 'Miễn phí',
      desc: 'Sân đá bóng mini nhiều người, máy gắp thú, máy game.' },
  ];
  const ROOM_BY_ID = {};
  ROOMS.forEach((r) => (ROOM_BY_ID[r.id] = r));

  // ---- Điểm tương tác ở sảnh rạp ----
  const DOOR_ARCADE = { x: 13.1, z: 14.6 };
  const INTERACT = [
    { id: 'lobby-mole', type: 'game', game: 'mole', x: 12.6, z: 9.6, r: 2.0, label: 'Đập chuột chũi' },
    { id: 'lobby-claw', type: 'game', game: 'claw', x: 12.6, z: 11.2, r: 2.0, label: 'Gắp thú' },
    { id: 'door-arcade', type: 'door', go: 'arcade', x: DOOR_ARCADE.x, z: DOOR_ARCADE.z, r: 1.9, label: 'Vào Khu Giải Trí' },
  ];

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
    { id: 'door-lobby', type: 'door', go: 'std', x: AR.DOOR.x, z: AR.DOOR.z - 1.0, r: 2.0, label: 'Về sảnh rạp' },
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
  function layoutOf(kind) { return kind === 'arcade' ? AR : THEATER; }

  return {
    ROOM, BOUNDS, ROWS, ROW_GAP, ROW0_Z, STEP_H, RAMP, SEAT_GAP, BLOCKS, ZA, ZB, TOP_Y,
    SCREEN, PLAYER_R, SEAT_R, LOOK_COUNTS, SEATS, BEANBAGS, PROPS, OBSTACLES, COLLIDERS, SPAWN,
    clamp, heightAt, resolve, standPos,
    ROOMS, ROOM_BY_ID, INTERACT, DOOR_ARCADE, ARCADE: AR, layoutOf,
  };
});
