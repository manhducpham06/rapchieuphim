// Hai trò chơi nhỏ chơi ngay trong trang (DOM thuần): Đập chuột chũi và Gắp thú.
const $ = (id) => document.getElementById(id);

export function createGames({ store, send, onOpen, onClose }) {
  let cur = null; // { game, stop() }

  const best = (g) => store.get('best:' + g, 0);
  function setBest(g, s) { if (s > best(g)) store.set('best:' + g, s); $('gBest').textContent = best(g); }

  function open(game) {
    close(true);
    $('game').hidden = false;
    $('gScore').textContent = '0';
    $('gTime').textContent = '';
    $('gBest').textContent = best(game);
    $('gameArea').innerHTML = '';
    $('gameStart').hidden = false;
    $('gameStart').lastChild.textContent = 'Bắt đầu';
    if (game === 'mole') {
      $('gameTitle').textContent = 'Đập chuột chũi';
      $('gameHint').textContent = 'Bấm vào chú chuột vừa nhô lên. Càng về sau chuột càng nhanh. Thời gian 30 giây.';
    } else {
      $('gameTitle').textContent = 'Gắp thú';
      $('gameHint').textContent = 'Móc chạy qua lại. Bấm “Thả móc” đúng lúc nó ở trên con thú. Có 6 lượt.';
    }
    cur = { game, stop: null };
    onOpen && onOpen(game);
  }

  function close(silent) {
    if (cur && cur.stop) cur.stop();
    cur = null;
    $('game').hidden = true;
    if (!silent && onClose) onClose();
  }

  function finish(score) {
    const g = cur.game;
    cur.stop = null;
    setBest(g, score);
    $('gameStart').hidden = false;
    $('gameStart').lastChild.textContent = 'Chơi lại';
    $('gTime').textContent = `Kết thúc: ${score} điểm`;
    if (score > 0) send({ t: 'score', game: g, score });
  }

  // ---------- Đập chuột chũi ----------
  function startMole() {
    const area = $('gameArea');
    area.innerHTML = '<div class="mole-grid"></div>';
    const grid = area.firstChild;
    const holes = [];
    for (let i = 0; i < 9; i++) {
      const h = document.createElement('button');
      h.type = 'button';
      h.className = 'hole';
      h.setAttribute('aria-label', 'Hang ' + (i + 1));
      h.innerHTML = '<div class="mole"><i></i></div>';
      grid.appendChild(h);
      holes.push({ el: h, up: false, until: 0 });
    }
    let score = 0, over = false;
    const END = performance.now() + 30000;
    let nextSpawn = performance.now() + 500;
    const setScore = (s) => { score = s; $('gScore').textContent = s; };
    setScore(0);
    holes.forEach((h) => {
      h.el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (over || !h.up) return;
        h.up = false;
        h.el.classList.remove('up');
        h.el.classList.add('hit');
        setTimeout(() => h.el.classList.remove('hit'), 160);
        setScore(score + 1);
      });
    });
    let raf = 0;
    function tick(now) {
      const left = Math.max(0, END - now);
      $('gTime').textContent = `Còn ${Math.ceil(left / 1000)} giây`;
      const prog = 1 - left / 30000;
      for (const h of holes) if (h.up && now > h.until) { h.up = false; h.el.classList.remove('up'); }
      if (left > 0 && now >= nextSpawn) {
        const free = holes.filter((h) => !h.up);
        if (free.length) {
          const h = free[Math.floor(Math.random() * free.length)];
          h.up = true;
          h.until = now + 900 - prog * 450;
          h.el.classList.add('up');
        }
        nextSpawn = now + 720 - prog * 420 + Math.random() * 160;
      }
      if (left <= 0) {
        over = true;
        holes.forEach((h) => h.el.classList.remove('up'));
        finish(score);
        return;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    cur.stop = () => { over = true; cancelAnimationFrame(raf); };
  }

  // ---------- Gắp thú ----------
  const COLORS = ['#ff7aa8', '#ffd24a', '#6bd6ff', '#9bff8a', '#c79bff', '#ff9f5a'];
  function startClaw() {
    const area = $('gameArea');
    const W = 320, H = 300;
    area.innerHTML = '<div class="claw-box"><div class="claw-rail"></div><div class="claw-head"></div><div class="claw-ground"></div></div><div class="row center" style="margin-top:10px"><button type="button" id="dropBtn" class="primary"><span>Thả móc</span></button></div>';
    const box = area.querySelector('.claw-box');
    const head = area.querySelector('.claw-head');
    const prizes = [];
    const xs = [34, 92, 150, 208, 266].sort(() => Math.random() - 0.5);
    xs.forEach((x, i) => {
      const p = document.createElement('div');
      p.className = 'prize';
      p.style.left = (x - 17 + (Math.random() * 14 - 7)) + 'px';
      p.style.background = COLORS[i % COLORS.length];
      p.dataset.pts = String(5 + (i % 3) * 5);
      box.appendChild(p);
      prizes.push({ el: p, x: parseFloat(p.style.left) + 17, pts: +p.dataset.pts, got: false });
    });
    let tries = 6, score = 0, x = 20, dir = 1, state = 'sweep', y = 28, speed = 130, over = false, caught = null, last = performance.now();
    const setScore = (s) => { score = s; $('gScore').textContent = s; };
    setScore(0);
    const tr = () => ($('gTime').textContent = `Còn ${tries} lượt`);
    tr();
    const btn = $('dropBtn');
    btn.addEventListener('click', () => { if (state === 'sweep' && !over) state = 'down'; });
    let raf = 0;
    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (state === 'sweep') {
        x += dir * speed * dt;
        if (x > W - 20) { x = W - 20; dir = -1; }
        if (x < 20) { x = 20; dir = 1; }
      } else if (state === 'down') {
        y += 220 * dt;
        if (y >= H - 62) {
          y = H - 62;
          caught = prizes.find((p) => !p.got && Math.abs(p.x - x) < 16) || null;
          state = 'up';
        }
      } else if (state === 'up') {
        y -= 200 * dt;
        if (caught) caught.el.style.transform = `translateY(${-(H - 62 - y)}px)`;
        if (y <= 28) {
          y = 28;
          if (caught) {
            caught.got = true;
            caught.el.style.display = 'none';
            setScore(score + caught.pts);
          }
          caught = null;
          tries--;
          tr();
          speed += 14;
          state = 'sweep';
          if (tries <= 0 || prizes.every((p) => p.got)) { over = true; finish(score); return; }
        }
      }
      head.style.left = x + 'px';
      head.style.height = y - 8 + 20 + 'px';
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    cur.stop = () => { over = true; cancelAnimationFrame(raf); };
  }

  $('gameStart').addEventListener('click', () => {
    if (!cur) return;
    if (cur.stop) cur.stop();
    $('gameStart').hidden = true;
    $('gTime').textContent = '';
    cur.game === 'mole' ? startMole() : startClaw();
  });
  $('gameClose').addEventListener('click', () => close());
  $('game').addEventListener('pointerdown', (e) => { if (e.target === $('game')) close(); });

  return { open, close, get active() { return !!cur; } };
}
