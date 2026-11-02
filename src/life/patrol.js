// 평소 모드 — 부대 외곽 경계: 4족 보행 경계로봇 RQ-01(울타리 안쪽 순찰), 외곽 숲 상공 정찰 드론 2기,
// CCTV 바깥 감시(울타리 바깥쪽으로 회전), 큰길 양 끝 차단 바리케이드.
// job A의 정비고 RQ-03(정밀 점검 패드)과는 별개 기체다.
import { pick, rnd } from './text.js';
// 좌표는 새 배치(layout.js): 울타리는 맵 가장자리(x 4~1596, y 12~812), 정문은 아래쪽 가운데(x 708~844).

const FENCE = { x0: 4, x1: 1596, y0: 12, y1: 812 };
// 울타리 안쪽 순찰로 (시계 방향). 정문 앞은 위병소 아래로 돌아간다. stop: 잠시 멈춰 바깥쪽을 비춘다
const QLOOP = [[12, 22, 1], [800, 22, 1], [1590, 22, 1], [1592, 300, 1], [1592, 806, 1], [850, 806, 0], [850, 772, 0], [700, 772, 0], [620, 772, 0], [620, 806, 0], [12, 806, 1], [12, 300, 1]];
const DETOUR = [5, 6, 7, 8]; // 정문 우회 구간(사건 지점으로 쓰지 않는다)
// 숲 상공 드론 순찰로 (울타리 바로 바깥 — 맵 가장자리를 따라 돈다)
const DLOOP = [[6, 30], [1594, 30], [1594, 834], [6, 834]];
// 건물 앞에 있던 CCTV 3대를 울타리로 옮긴다 (원래 기둥은 가로등처럼 남는다)
const MOVE = { 11: [982, 26, '북측 울타리 C'], 12: [1590, 560, '동측 울타리 B'], 13: [10, 560, '서측 울타리 B'] };

function mkLoop(P) {
  const seg = []; let acc = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    seg.push({ i, a, b, d, s0: acc, dx: (b[0] - a[0]) / (d || 1), dy: (b[1] - a[1]) / (d || 1) }); acc += d;
  }
  return { P, seg, len: acc };
}
function at(L, s) {
  s = ((s % L.len) + L.len) % L.len;
  for (const g of L.seg) if (s <= g.s0 + g.d) { const u = s - g.s0; return { x: g.a[0] + g.dx * u, y: g.a[1] + g.dy * u, g }; }
  const g = L.seg[0]; return { x: g.a[0], y: g.a[1], g };
}
export function sideOf(x, y) {
  const d = [[y - FENCE.y0, '북측'], [FENCE.x1 - x, '동측'], [FENCE.y1 - y, '남측'], [x - FENCE.x0, '서측']].sort((a, b) => a[0] - b[0]);
  return d[0][1];
}
const DIRS = ['down', 'up', 'left', 'right'];

export class Patrol {
  constructor(life) { this.life = life; this.map = life.map; this.t = 0; this.repT = rnd(40, 70); this.qrepT = rnd(60, 100); }

  // ---------------- 맵 굽기: CCTV 기둥 옮기기 · 큰길 끝 바리케이드 · 사열대 훈련장 카메라 ----------------
  bake(c) {
    const map = this.map, rect = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    (map.cams || []).forEach((q, i) => {
      if (i === 10 && q[3] === '수송부 주차장') q[3] = '북측 울타리 D (수송부 후방)'; // 이제 울타리 바깥을 본다
      const mv = MOVE[i]; if (!mv) return;
      q[0] = mv[0]; q[1] = mv[1]; q[3] = mv[2];
      rect(q[0] - 0.75, q[1] - 18, 1.5, 18, '#7D848C'); rect(q[0] - 0.75, q[1] - 18, 0.5, 18, '#B3B9C0'); rect(q[0] - 2, q[1] - 1, 4, 2, '#5B626A'); rect(q[0] - 1, q[1] + 1, 6, 1.5, 'rgba(0,0,0,0.2)');
    });
    // 큰길(y 304~352)은 울타리 안에서 끝난다: 양 끝에 차량 차단 바리케이드
    const barricade = (x) => {
      rect(x + 3, 306, 4, 46, 'rgba(0,0,0,0.18)');
      for (let y = 306; y < 350; y += 6) { rect(x, y, 5, 3, '#E8B923'); rect(x, y + 3, 5, 3, '#1F1F1F'); }
      rect(x, 305, 5, 1, '#F6D25A'); rect(x - 1, 304, 1, 48, '#5B626A'); rect(x + 5, 304, 1, 48, '#5B626A');
      [312, 328, 344].forEach((y) => { rect(x + 1.5, y, 2, 2, '#FF4D4D'); });
      rect(x - 2, 350, 9, 2, '#2A2A2A'); rect(x - 2, 302, 9, 2, '#2A2A2A');
    };
    barricade(14); barricade(1581);
    // 사열대 모서리 훈련장 CCTV (드론·CCTV 훈련 분석 시나리오에서 쓴다) — 연병장 블록 좌표
    map.inBlock(c, 'parade', () => { rect(667.25, 498, 1.5, 16, '#7D848C'); rect(667.25, 498, 0.5, 16, '#B3B9C0'); rect(665.5, 497, 5, 3, '#2A2F36'); rect(666, 497.5, 4, 0.5, '#4A525C'); }, [0, 80, 0, 0]);
  }

  // ---------------- 준비 ----------------
  init() {
    const map = this.map;
    // CCTV는 모두 가장 가까운 울타리 바깥쪽을 본다 (모서리는 대각선)
    (map.cams || []).forEach((q) => {
      const dl = q[0] - FENCE.x0, dr = FENCE.x1 - q[0], dt = q[1] - FENCE.y0, db = FENCE.y1 - q[1];
      const hx = dl < dr ? -1 : 1, hy = dt < db ? -1 : 1, nx = Math.min(dl, dr), ny = Math.min(dt, db);
      let vx = 0, vy = 0;
      if (nx < 70 && ny < 70) { vx = hx; vy = hy; } else if (nx < ny) vx = hx; else vy = hy;
      q[2] = Math.atan2(vy, vx);
    });
    // 4족 보행 경계로봇 RQ-01 — 진짜 캐릭터(map.ents)로 넣어 미니맵·마우스 정보에 잡히게
    this.paintQuad();
    this.L = mkLoop(QLOOP);
    const e = { kind: 'ch', type: 'quad', rank: '', x: QLOOP[11][0], y: QLOOP[11][1], dir: 'up', moving: false, speed: 22, path: null, i: 0, wait: 0, fadeW: 0, alpha: 1, bubble: null, label: '', alertT: 0, anim: 0 };
    e.q = { s: this.L.seg[11].s0, mode: 'patrol', pause: 0, scan: 0, face: 'left', nx: -1, ny: 0, last: 11, tgt: null, cb: null };
    e.brain = (en, dt) => { try { this.quadBrain(en, dt); } catch (err) { if (!map.modWarned['life.quad']) { map.modWarned['life.quad'] = true; console.warn('life.quad', err); } } };
    map.ents.push(e); this.quad = e;
    this.setQuadLabel('서측');
    // 숲 상공 정찰 드론 2기 (반 바퀴 간격)
    this.D = mkLoop(DLOOP);
    this.drones = [0, 0.5].map((k, i) => ({ k: 'drone', id: 'D-' + (i + 2), s: this.D.len * k + 200, x: 0, y: 0, alt: 22, sp: 44, mode: 'loop', tgt: null, cb: null, repT: rnd(40, 90) + i * 45, sweep: Math.random() * 6, bubble: null }));
    this.drones.forEach((d) => { const p = at(this.D, d.s); d.x = p.x; d.y = p.y; });
  }
  paintQuad() {
    const map = this.map;
    if (!map.TYPES.quad) map.TYPES.quad = Object.assign({}, map.TYPES.robot);
    const OL = '#5B6548', OL2 = '#7A8560', OD = '#3E4530', LG = '#30353A', LG2 = '#23272B', V = '#29BDFD', HD = '#3A3F44';
    DIRS.forEach((dir) => [0, 1, 2].forEach((f) => {
      const g = map.gridNew(32, 48), set = (x, y, col) => { if (x >= 0 && x < 32 && y >= 0 && y < 48) g[y][x] = col; };
      const F = (x, y, w, h, col) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, col); };
      const st = f === 1 ? 1 : (f === 2 ? -1 : 0);
      if (dir === 'left' || dir === 'right') {
        const leg = (hx, ph, far) => { const col = far ? LG2 : LG; F(hx, 36, 2, 5, col); F(hx + ph, 41, 2, 5, col); F(hx + ph - 1, 46, 3, 1, '#15181B'); };
        leg(10, st, true); leg(22, -st, true);
        F(6, 28, 21, 8, OL); F(6, 28, 21, 1, OL2); F(6, 35, 21, 1, OD); F(10, 30, 5, 2, OD); F(18, 30, 6, 2, OD); set(15, 31, '#C9A93A');
        leg(8, -st, false); leg(24, st, false);
        F(26, 27, 5, 6, HD); F(28, 29, 3, 2, V); set(28, 29, '#BFF1FF');
        F(13, 24, 1, 4, HD); F(11, 22, 5, 2, '#2A2F36'); set(12, 22, '#7FE3FF'); set(6, 29, '#45F08A');
        if (dir === 'left') for (let y = 0; y < 48; y++) g[y].reverse();
      } else {
        const down = dir === 'down';
        F(9, 37, 2, 9 - (st > 0 ? 1 : 0), LG); F(21, 37, 2, 9 - (st < 0 ? 1 : 0), LG); F(12, 38, 2, 8 - (st < 0 ? 1 : 0), LG2); F(18, 38, 2, 8 - (st > 0 ? 1 : 0), LG2);
        F(8, 46, 4, 1, '#15181B'); F(20, 46, 4, 1, '#15181B');
        F(9, 28, 14, 10, OL); F(9, 28, 14, 1, OL2); F(9, 37, 14, 1, OD); F(11, 30, 4, 2, OD); F(17, 30, 4, 2, OD);
        if (down) { F(12, 33, 8, 5, HD); F(13, 34, 6, 2, V); set(13, 34, '#BFF1FF'); } else { F(14, 32, 4, 3, OD); set(15, 33, '#D53939'); set(16, 33, '#D53939'); }
        F(15, 24, 2, 4, HD); F(13, 22, 6, 2, '#2A2F36'); set(14, 22, '#7FE3FF');
      }
      map.SC['quad||' + dir + '|' + f] = map.toCanvas(map.outline(g));
    }));
  }
  setQuadLabel(side, act) { this.quad.label = '경계로봇 RQ-01 · 4족 보행 · ' + (act || side + ' 울타리 순찰'); }

  // ---------------- 경계로봇 이동 ----------------
  quadBrain(e, dt) {
    const map = this.map, q = e.q, L = this.L;
    if (e.actor) { map.stepEnt(e, dt); return; }
    if (e.bubble) { e.bubble.life -= dt; if (e.bubble.life <= 0) e.bubble = null; }
    e.alpha = Math.min(1, e.alpha + dt * 2);
    if (q.scan > 0) q.scan -= dt;
    if (q.pause > 0) { q.pause -= dt; e.moving = false; e.dir = q.face; return; }
    if (q.mode === 'hold') { e.moving = false; e.dir = q.face; q.scan = Math.max(q.scan, 0.5); return; }
    const sp = q.mode === 'go' ? 44 : 22;
    let ns = q.s + sp * dt;
    if (q.mode === 'go' && ns >= q.tgt) { ns = q.tgt; }
    const p = at(L, ns), seg = p.g;
    // 멈춤 지점(모서리 등)을 지나면 잠깐 서서 바깥을 비춘다
    if (q.mode === 'patrol' && seg.i !== q.last) {
      const v = QLOOP[seg.i];
      q.last = seg.i;
      if (v[2]) { const sv = at(L, seg.s0); e.x = sv.x; e.y = sv.y; q.s = seg.s0; this.outward(q, seg, sv); q.pause = 3.2; q.scan = 3.2; e.moving = false; e.dir = q.face; this.quadReport(e); return; }
    }
    q.s = ns; q.last = seg.i;
    const dx = p.x - e.x, dy = p.y - e.y;
    e.x = p.x; e.y = p.y; e.moving = true; e.anim += dt * sp / 34;
    if (Math.abs(dx) + Math.abs(dy) > 0.001) e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    if (q.mode === 'go' && q.s >= q.tgt - 0.01) {
      q.mode = 'hold'; this.outward(q, seg, p); e.dir = q.face; e.moving = false;
      const f = q.cb; q.cb = null; if (f) f(e);
    }
    if (q.mode === 'patrol' && Math.random() < dt * 0.2) this.setQuadLabel(sideOf(e.x, e.y));
  }
  outward(q, seg, p) {
    // 시계 방향 순찰이라 진행 방향의 왼쪽이 울타리 바깥
    let nx = seg.dy, ny = -seg.dx;
    const sd = sideOf(p.x, p.y);
    if (DETOUR.indexOf(seg.i) >= 0 || sd === '남측') { nx = 0; ny = 1; }
    if (seg.i === 0 || seg.i === 2) { /* 모서리: 진행 방향의 왼쪽 그대로 */ }
    q.nx = nx; q.ny = ny; q.face = Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? 'right' : 'left') : (ny > 0 ? 'down' : 'up');
  }
  quadReport(e) {
    const L = this.life, m = this.map;
    if (m.mode !== 'ambient' || L.quiet() || this.t < this.qrepT) return;
    this.qrepT = this.t + rnd(110, 170);
    const side = sideOf(e.x, e.y), R = L.routine;
    e.bubble = m.bub('경계 순찰 이상 없음', 'agent', 2);
    R.free(e.x, e.y - 12, 'gate', '경계로봇 RQ-01', () => R.send('gate', 'hq', '경계 순찰', () => R.log('gate', 'hq', '경계 순찰 로봇 RQ-01 · ' + side + ' 울타리 이상 없음')));
  }
  // 경계 시나리오용: 지금 진행 방향 앞쪽 울타리 지점 (정문 우회 구간은 피한다)
  eventSpot() {
    const q = this.quad.q, L = this.L;
    let s = q.s + rnd(150, 220), p = at(L, s);
    for (let k = 0; k < 6 && (DETOUR.indexOf(p.g.i) >= 0 || Math.abs(s - p.g.s0) < 30 || Math.abs(p.g.s0 + p.g.d - s) < 30); k++) { s += 120; p = at(L, s); }
    const tmp = {}; this.outward(tmp, p.g, p);
    const side = sideOf(p.x, p.y);
    const fx = tmp.nx ? (tmp.nx > 0 ? FENCE.x1 : FENCE.x0) : p.x, fy = tmp.ny ? (tmp.ny > 0 ? FENCE.y1 : FENCE.y0) : p.y;
    return { s: q.s < s ? s : s + L.len, x: p.x, y: p.y, fx, fy, nx: tmp.nx, ny: tmp.ny, side };
  }
  quadGoto(s, cb) { const q = this.quad.q; if (s < q.s) s += this.L.len; q.mode = 'go'; q.tgt = s; q.cb = cb; q.pause = 0; this.setQuadLabel(sideOf(this.quad.x, this.quad.y), '이상 신호 현장 확인'); }
  quadResume() { const q = this.quad.q; q.mode = 'patrol'; q.tgt = null; q.cb = null; q.s = ((q.s % this.L.len) + this.L.len) % this.L.len; q.last = at(this.L, q.s).g.i; this.setQuadLabel(sideOf(this.quad.x, this.quad.y)); }
  quadSay(text) { if (this.map.mode === 'ambient') this.quad.bubble = this.map.bub(text, 'agent', 2.4); }

  // ---------------- 숲 상공 드론 ----------------
  step(dt) {
    this.t += dt;
    const L = this.life, m = this.map;
    this.drones.forEach((d) => {
      d.sweep += dt;
      if (d.bubble) { d.bubble.life -= dt; if (d.bubble.life <= 0) d.bubble = null; }
      if (d.mode === 'loop') { d.s += d.sp * dt; const p = at(this.D, d.s); this.fly(d, p.x, p.y, dt, 200); d.side = sideOf(p.x, p.y); }
      else if (d.mode === 'go' || d.mode === 'back') {
        const tx = d.mode === 'go' ? d.tgt[0] : at(this.D, d.s).x, ty = d.mode === 'go' ? d.tgt[1] : at(this.D, d.s).y;
        if (this.fly(d, tx, ty, dt, 120)) { if (d.mode === 'go') { d.mode = 'hold'; const f = d.cb; d.cb = null; if (f) f(d); } else d.mode = 'loop'; }
      }
      // 가끔 보고 (시나리오 중·시연 중엔 쉼)
      if (d.mode === 'loop' && this.t > d.repT) {
        d.repT = this.t + rnd(95, 150);
        if (m.mode === 'ambient' && !L.quiet()) {
          const wild = Math.random() < 0.2, side = d.side || '외곽', R = L.routine;
          if (wild) { const f = L.fx.ring(d.x, d.y, '255,196,71', { r1: 26, life: 3 }); f.owner = null; }
          R.free(d.x, d.y - d.alt, 'gate', '드론 ' + d.id, () => R.send('gate', 'hq', '드론 순찰', () => R.log('gate', 'hq', wild ? '드론 ' + d.id + ' 순찰 · ' + side + ' 숲 야생동물 감지 · 오탐 제외' : '드론 ' + d.id + ' 순찰 · ' + side + ' 숲 이상 없음')));
        }
      }
    });
  }
  fly(d, tx, ty, dt, sp) {
    const dx = tx - d.x, dy = ty - d.y, dd = Math.hypot(dx, dy), s = sp * dt;
    if (dd <= s) { d.x = tx; d.y = ty; return true; }
    d.x += dx / dd * s; d.y += dy / dd * s; return false;
  }
  // 경계 시나리오: 가장 가까운 숲 드론이 현장으로 빠졌다가 순찰로로 돌아간다
  droneTo(x, y, cb) {
    let best = null, bd = 1e9;
    this.drones.forEach((d) => { if (d.mode !== 'loop') return; const k = Math.hypot(d.x - x, d.y - y); if (k < bd) { bd = k; best = d; } });
    if (!best) best = this.drones[0];
    best.mode = 'go'; best.tgt = [x, y]; best.cb = cb;
    return best;
  }
  droneBack(d) { if (d) { d.mode = 'back'; d.cb = null; } }
  dronesHome() { this.drones.forEach((d) => { if (d.mode !== 'loop') d.mode = 'back'; d.cb = null; }); }

  // ---------------- 그리기 ----------------
  drawEnt(c, e, t) {
    if (e !== this.quad || this.map.mode !== 'ambient') return;
    const q = e.q;
    if (q.scan <= 0 || e.hide) return;
    const map = this.map, z = map.z, a0 = Math.atan2(q.ny, q.nx) + Math.sin(t * 2.2) * 0.55, hx = e.x + q.nx * 6, hy = e.y - 9 + q.ny * 3;
    const p0 = map.w2s(hx, hy), L = 46 * z, w = 0.28, k = Math.min(1, q.scan);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.28 * k; c.fillStyle = 'rgba(255,236,170,1)';
    c.beginPath(); c.moveTo(p0[0], p0[1]);
    for (let i = -4; i <= 4; i++) { const a = a0 + w * i / 4; c.lineTo(p0[0] + Math.cos(a) * L, p0[1] + Math.sin(a) * L * 0.8); }
    c.closePath(); c.fill();
    c.globalAlpha = 0.9 * k; const G = 8 * z; c.drawImage(map.glow('255,236,170'), p0[0] - G / 2, p0[1] - G / 2, G, G);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }
  drawWorld(c, t) {
    const map = this.map, z = map.z, W = (x, y, w, h, col) => map.wrect(c, x, y, w, h, col);
    this.drones.forEach((d, i) => {
      const x = d.x, y = d.y - d.alt;
      // 땅 위 탐조등 + 아래로 내려가는 스캔 빔
      const gx = d.x + Math.sin(d.sweep * 1.3 + i) * 7, gy = d.y + Math.cos(d.sweep * 0.9 + i) * 4;
      const pg = map.w2s(gx, gy), pd = map.w2s(x, y + 3);
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.16; c.fillStyle = 'rgba(150,225,255,1)';
      c.beginPath(); c.moveTo(pd[0], pd[1]); c.lineTo(pg[0] - 9 * z, pg[1]); c.lineTo(pg[0] + 9 * z, pg[1]); c.closePath(); c.fill();
      c.globalAlpha = 0.22; c.beginPath(); c.ellipse(pg[0], pg[1], 10 * z, 6 * z, 0, 0, Math.PI * 2); c.fill();
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      W(d.x - 4, d.y + 3, 8, 2, 'rgba(0,0,0,0.25)');
      const p = map.w2s(x - 6, y - 6); c.drawImage(map.VS.drone, p[0], p[1], 12 * z, 12 * z);
      if (Math.floor(t * 14 + i) % 2) [[1.5, 1.5], [10, 1.5], [1.5, 10], [10, 10]].forEach((r) => W(x - 6 + r[0], y - 6 + r[1], 0.5, 0.5, '#FFFFFF'));
      W(x - 0.5, y - 0.5, 1, 1, Math.floor(t * 3 + i) % 2 ? '#FF4D4D' : '#45F08A');
      d.sp2 = map.w2s(x, y);
    });
  }
  drawScreen(c) {
    const map = this.map;
    this.drones.forEach((d) => { if (d.bubble && d.sp2) { const b = d.bubble; c.globalAlpha = Math.min(1, b.life / 0.25, (b.max - b.life) / 0.15 + 0.2); map.pill(c, b.text, d.sp2[0], d.sp2[1] - 6, b.style); c.globalAlpha = 1; } });
    if (map.my > 66 && !map.drag && map.mode === 'ambient') {
      const wx = map.cxs + map.mx / map.z, wy = map.cys + map.my / map.z;
      const d = this.drones.find((q) => Math.abs(wx - q.x) < 9 && Math.abs(wy - (q.y - q.alt)) < 9);
      if (d) { const p = map.w2s(d.x, d.y - d.alt - 8); map.pill(c, '외곽 정찰 드론 ' + d.id + ' · ' + (d.mode === 'loop' ? (d.side || '') + ' 숲 순찰' : '이상 신호 현장 확인'), p[0], p[1], 'name'); }
    }
  }
  droneSay(d, text) { if (d && this.map.mode === 'ambient') d.bubble = this.map.bub(text, 'agent', 2.6); }
}
