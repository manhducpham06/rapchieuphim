'use strict';
/*
 * Vật lý quả bóng ở sân đá bóng mini (chạy trên server, mọi người chơi cùng một quả bóng).
 * Người chơi chạy vào bóng để sút: bóng nhận vận tốc của người chơi (va chạm đàn hồi với vật nặng vô hạn).
 */
const R_BALL = 0.38;
const R_PLAYER = 0.32;
const MAX_SPEED = 17;
const FRICTION = 1.0; // hệ số cản theo giây (v *= exp(-FRICTION*dt))
const WALL_E = 0.72;
const KICK_E = 0.85;
const RESET_AFTER = 2.6; // giây nằm trong lưới trước khi đặt lại giữa sân

class Football {
  /** pitch: {cx, cz, hx, hz, goalHalf, goalDepth} */
  constructor(pitch) {
    this.p = pitch;
    this.goals = new Map(); // tên -> số bàn
    this.resetBall();
  }

  resetBall() {
    this.x = this.p.cx;
    this.z = this.p.cz;
    this.vx = 0;
    this.vz = 0;
    this.lastTouch = null;
    this.frozen = 0; // > 0: đang nằm trong lưới, đếm ngược
    this.dirty = true;
  }

  get moving() {
    return this.frozen > 0 || Math.abs(this.vx) > 0.03 || Math.abs(this.vz) > 0.03;
  }

  top(n = 3) {
    return [...this.goals.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  }

  /**
   * players: [{id, name, x, z, vx, vz}]. Trả về mảng sự kiện: {type:'goal', by, side:'E'|'W'} | {type:'reset'}.
   */
  step(dt, players) {
    const ev = [];
    const p = this.p;
    if (this.frozen > 0) {
      this.frozen -= dt;
      if (this.frozen <= 0) {
        this.resetBall();
        ev.push({ type: 'reset' });
      }
      return ev;
    }

    // va chạm với người chơi
    for (const q of players) {
      const dx = this.x - q.x;
      const dz = this.z - q.z;
      const rs = R_BALL + R_PLAYER;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rs * rs) continue;
      let d = Math.sqrt(d2);
      let nx, nz;
      if (d < 1e-4) {
        const sp = Math.hypot(q.vx, q.vz);
        nx = sp > 0.1 ? q.vx / sp : 1;
        nz = sp > 0.1 ? q.vz / sp : 0;
        d = 0;
      } else {
        nx = dx / d;
        nz = dz / d;
      }
      // tách ra khỏi người chơi
      this.x = q.x + nx * rs;
      this.z = q.z + nz * rs;
      // vận tốc tương đối dọc theo pháp tuyến
      const bn = this.vx * nx + this.vz * nz;
      const pn = q.vx * nx + q.vz * nz;
      if (bn - pn < 0) {
        const nb = pn - KICK_E * (bn - pn);
        this.vx += (nb - bn) * nx;
        this.vz += (nb - bn) * nz;
      }
      this.lastTouch = q.name;
      this.dirty = true;
    }

    // giới hạn tốc độ + cản
    const sp = Math.hypot(this.vx, this.vz);
    if (sp > MAX_SPEED) {
      this.vx *= MAX_SPEED / sp;
      this.vz *= MAX_SPEED / sp;
    }
    const damp = Math.exp(-FRICTION * dt);
    this.vx *= damp;
    this.vz *= damp;
    if (Math.abs(this.vx) < 0.02 && Math.abs(this.vz) < 0.02) {
      this.vx = 0;
      this.vz = 0;
    }

    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // biên dọc (z): nảy
    const zmin = p.cz - p.hz + R_BALL;
    const zmax = p.cz + p.hz - R_BALL;
    if (this.z < zmin) { this.z = zmin; this.vz = Math.abs(this.vz) * WALL_E; this.dirty = true; }
    if (this.z > zmax) { this.z = zmax; this.vz = -Math.abs(this.vz) * WALL_E; this.dirty = true; }

    // biên ngang (x): có khung thành thì vào gôn
    const inMouth = Math.abs(this.z - p.cz) < p.goalHalf - R_BALL * 0.35;
    const lim = p.hx - R_BALL;
    if (Math.abs(this.x - p.cx) > lim) {
      if (inMouth) {
        if (Math.abs(this.x - p.cx) > p.hx + 0.1) {
          const side = this.x > p.cx ? 'E' : 'W';
          const by = this.lastTouch || 'Ẩn danh';
          this.goals.set(by, (this.goals.get(by) || 0) + 1);
          this.frozen = RESET_AFTER;
          this.vx *= 0.1;
          this.vz *= 0.1;
          this.dirty = true;
          ev.push({ type: 'goal', by, side });
        }
        // nằm trong lưới: chặn ở đáy lưới
        const back = p.cx + Math.sign(this.x - p.cx) * (p.hx + p.goalDepth - R_BALL);
        if (Math.abs(this.x - p.cx) > Math.abs(back - p.cx)) { this.x = back; this.vx = 0; }
      } else {
        this.x = p.cx + Math.sign(this.x - p.cx) * lim;
        this.vx = -this.vx * WALL_E;
        this.dirty = true;
      }
    }
    return ev;
  }

  /** Trạng thái gửi cho client: [x, z, vx, vz] (làm tròn 2 chữ số) */
  state() {
    const r = (v) => Math.round(v * 100) / 100;
    return [r(this.x), r(this.z), r(this.vx), r(this.vz)];
  }
}

module.exports = { Football, R_BALL, R_PLAYER };
