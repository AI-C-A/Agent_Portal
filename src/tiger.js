// TIGER 합성훈련장 — 의무실 아래 실내 훈련장 (LVCG 헬멧·센서 + 실제 지형·기상을 반영한 합성 전장)
// 훅 목록은 baseMap.js의 use()/hook() 주석 참고. 건물은 bake로 굽고, 스크린·부스·AI 화면은 drawFloor로 매 프레임 그린다.
// 훈련 상태는 map.tiger.live 하나로 주고받는다. 평소 모드(life/routine.js)와 시연(demo/props.js)이 start/stop을 부른다.
//   map.tiger.start({ dur, route: 'B'|null, rain, who }) · map.tiger.stop() · map.tiger.take(i)/put(i) 헬멧 거치대 칸
// 부스 위 캐릭터에 e.tgPod(0~5)를 달면 훈련 중 이동·조준·엄폐 자세를 이 모듈이 돌린다. e.lvcg면 헬멧 바이저·센서가 빛난다.
// 모듈 순서는 life·demo 뒤(step이 마지막에 돌아 자세를 덮어쓴다, init에서 만든 통제관은 평소 모드 두뇌를 받지 않는다).
// 아래 상수(TIGER·PODS·CONSOLE …)는 원래 배치 좌표 — 건물은 map.inBlock/map.local로 'tiger' 블록 자리에 그리고,
// map.tiger(pods·console·rackFront·door …)와 캐릭터는 새 배치 좌표다 (layout.js).
import { RM, RR, BLOCKS } from './layout.js';

export const TIGER = { x0: 96, y0: 768, x1: 432, y1: 928 };
export const PODS = [[192, 856], [258, 856], [324, 856], [192, 900], [258, 900], [324, 900]];
export const CONSOLE = { x: 140, y: 878 };
const SCR = { x0: 170, y0: 803, x1: 370, y1: 827 };
const AIP = { x0: 106, y0: 804, x1: 150, y1: 827 };
const RACK = { x0: 398, y0: 846, x1: 420, y1: 904 };
const SLOTS = [[401, 850], [411, 850], [401, 868], [411, 868], [401, 886], [411, 886]];
const FANS = [[159, 812], [381, 812]];
// 분대 전술 기동로(스크린 안 좌표)와 목표 지점
const ROUTE = [[176, 825], [196, 824], [214, 820], [236, 818], [258, 816], [276, 812], [292, 809], [303, 807]];
const HILL = [306, 806];

const clamp01 = (u) => Math.max(0, Math.min(1, u));
const vis = (map, x0, y0, x1, y1) => { const z = map.z, a = (x0 - map.cxs) * z, b = (y0 - map.cys) * z, r = (x1 - map.cxs) * z, d = (y1 - map.cys) * z; return r > 0 && a < 1600 && d > 0 && b < 900; };
const along = (pts, u) => {
  const L = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
  let s = clamp01(u) * tot;
  for (let i = 0; i < L.length; i++) { if (s <= L[i]) { const k = L[i] ? s / L[i] : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]; } s -= L[i]; }
  return pts[pts.length - 1].slice();
};

export const tiger = {
  name: 'tiger',
  keepOut: [RR([TIGER.x0 - 8, TIGER.y0 - 12, TIGER.x1 + 10, TIGER.y1 + 8]), [356, 668, 716, 696]],
  bake(map, c) { map.inBlock(c, 'tiger', () => bakeHall(map, c)); bakeWalk(c); tigerData(map); },
  init(map) {
    const T = map.tiger; if (!T) return;
    // 통제석 훈련통제관 (평소 모드). 시연에서는 강 대위 배우가 이 자리에 선다
    const e = { kind: 'ch', type: 'officer', rank: 'n2', x: T.console.x, y: T.console.y, dir: 'right', moving: false, speed: 34, path: null, i: 0, wait: 0, fadeW: 0, alpha: 1, bubble: null, label: '훈련통제관 · 중사 (TIGER 통제석 · 일체형 개인 전투체계)', alertT: 0, anim: 0, tgCtl: true };
    map.ents.push(e); T.ctl = e;
  },
  step(map, dt) { if (map.tiger) stepHall(map, dt); },
  drawFloor(map, c, t) { const T = map.tiger; if (T && vis(map, T.x0, T.y0, T.x1, T.y1)) map.local('tiger', () => drawHall(map, c, t)); },
  drawEnt(map, c, e, t) { if (e.lvcg) drawVisor(map, c, e, t); }
};

// ---------------------------------------------------------------- 굽기
function bakeHall(map, c) {
  let seed = 4111;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const speck = (x, y, w, h, cols, n) => { for (let k = 0; k < n; k++) R(x + (rnd() * w * 2 | 0) / 2, y + (rnd() * h * 2 | 0) / 2, 0.5, 0.5, cols[rnd() * cols.length | 0]); };
  const disc = (cx, cy, r, ky, col) => { for (let dy = -r; dy <= r; dy += 0.5) { const w = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)) * 2) / 2; if (w > 0) R(cx - w, cy + dy * ky, w * 2, Math.max(0.5, ky * 0.5 + 0.01), col); } };
  const { x0, y0, x1, y1 } = TIGER, bw = x1 - x0, bh = y1 - y0;

  // 건물 껍데기 (baseMap building()과 같은 모양: 위쪽 외벽 32 + 옆·아래 벽 6)
  c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x0 + 4, y1, bw, 4); c.fillRect(x1, y0 + 6, 4, bh);
  R(x0 + 6, y0 + 32, bw - 12, bh - 38, '#232A36'); speck(x0 + 6, y0 + 32, bw - 12, bh - 38, ['#272F3C', '#1F2530'], 2600);
  for (let x = x0 + 6; x < x1 - 6; x += 16) R(x, y0 + 32, 0.5, bh - 38, '#2C3646');
  for (let y = y0 + 32; y < y1 - 6; y += 16) R(x0 + 6, y, bw - 12, 0.5, '#2C3646');
  // 바닥 유도등(통로)
  for (let x = 172; x < 392; x += 6) R(x, 879, 3, 0.5, '#1E5A72');
  R(x0, y0, bw, 32, '#E3DCCB'); speck(x0, y0 + 5, bw, 24, ['#E9E3D4', '#DBD3C1'], bw * 6);
  R(x0, y0, bw, 4, '#B4AB95'); R(x0, y0 + 4, bw, 1, '#CFC7B3'); R(x0, y0 + 29, bw, 3, '#A89E87'); R(x0, y0 + 28.5, bw, 0.5, '#C2B9A4');
  for (let x = x0 + 20; x + 18 <= x1 - 16; x += 52) {
    if (x + 18 > 214 && x < 316) continue; // 간판 자리
    R(x, y0 + 9, 18, 14, '#566B7C'); R(x + 1, y0 + 10, 16, 12, '#8CB3D2'); R(x + 1, y0 + 10, 7, 4, '#BBD7EC'); R(x + 1.5, y0 + 10.5, 2, 0.5, '#E4F1FA'); R(x + 9, y0 + 9, 1, 14, '#566B7C'); R(x, y0 + 16, 18, 1, '#566B7C'); R(x - 1, y0 + 23, 20, 1, '#B8AF99');
  }
  // 외벽 TIGER 표식
  R(226, y0 + 22, 76, 4, '#2E4A6A'); R(226, y0 + 22, 76, 0.5, '#5A7FA6'); for (let k = 0; k < 6; k++) R(230 + k * 12, y0 + 23.5, 6, 1, '#E2BB3D');
  const wallV = (x) => { R(x, y0 + 32, 6, bh - 32, '#D2CAB6'); R(x, y0 + 32, 1, bh - 32, '#9C937D'); R(x + 5, y0 + 32, 1, bh - 32, '#BBB29C'); };
  wallV(x0); wallV(x1 - 6);
  R(x0, y1 - 6, bw, 6, '#D2CAB6'); R(x0, y1 - 1, bw, 1, '#9C937D'); R(x0 + 6, y1 - 6, bw - 12, 1, '#BBB29C');
  // 동쪽 출입문 (보도와 이어짐)
  R(x1 - 6, 812, 6, 24, '#2A303A'); R(x1 - 6, 812, 6, 1, '#7C6A55'); R(x1 - 6, 835, 6, 1, '#7C6A55');
  R(x1 - 7, 810, 8, 2, '#7C6A55'); R(x1 - 7, 836, 8, 2, '#7C6A55'); R(x1 - 1, 814, 1, 20, '#29BDFD');

  // 곡면 LED 스크린 (내용은 drawFloor)
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(SCR.x0 - 1, SCR.y1 + 2, SCR.x1 - SCR.x0 + 4, 2);
  R(SCR.x0 - 3, SCR.y0 - 2, SCR.x1 - SCR.x0 + 6, SCR.y1 - SCR.y0 + 4, '#14181E'); R(SCR.x0 - 3, SCR.y0 - 2, SCR.x1 - SCR.x0 + 6, 0.5, '#3A4350');
  R(SCR.x0 - 4, SCR.y0 + 2, 1, SCR.y1 - SCR.y0 - 4, '#14181E'); R(SCR.x1 + 3, SCR.y0 + 2, 1, SCR.y1 - SCR.y0 - 4, '#14181E');
  R(SCR.x0, SCR.y0, SCR.x1 - SCR.x0, SCR.y1 - SCR.y0, '#0B1C2A');
  // 훈련관리 AI 화면
  R(AIP.x0 - 1.5, AIP.y0 - 1.5, AIP.x1 - AIP.x0 + 3, AIP.y1 - AIP.y0 + 3, '#14181E'); R(AIP.x0, AIP.y0, AIP.x1 - AIP.x0, AIP.y1 - AIP.y0, '#1D1B3A');
  // 4D 효과 장치 (송풍기·음향) 몸체
  FANS.forEach((f) => { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(f[0] - 5, f[1] + 6, 11, 2); disc(f[0], f[1], 5.5, 1, '#5A626E'); disc(f[0], f[1], 4.5, 1, '#2A3038'); R(f[0] - 1, f[1] + 5, 2, 3, '#5A626E'); });
  // 훈련 부스 6개 (전방향 트레드밀)
  PODS.forEach((p) => {
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(p[0] - 13, p[1] + 5, 28, 3);
    disc(p[0], p[1], 14, 0.55, '#4A525E'); disc(p[0], p[1], 12.5, 0.55, '#1A3242'); disc(p[0], p[1], 9, 0.55, '#16283A');
    for (let k = -8; k <= 8; k += 4) R(p[0] + k, p[1] - 0.25, 2, 0.5, '#24425A');
    R(p[0] - 14, p[1] - 0.5, 1, 1.5, '#29BDFD'); R(p[0] + 13, p[1] - 0.5, 1, 1.5, '#29BDFD');
  });
  // 통제석 책상 (서쪽 벽) + 모니터
  c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x0 + 8, 906, 18, 2);
  R(x0 + 6, 846, 16, 60, '#2E3540'); R(x0 + 6, 846, 16, 2, '#46505E'); R(x0 + 21, 846, 1, 60, '#1F242C');
  [852, 872].forEach((y) => { R(x0 + 10, y, 10, 14, '#1D222A'); R(x0 + 11, y + 1, 8, 12, '#3FC4F2'); map.overlays.monitors.push([x0 + 11, y + 1, 8, 12]); });
  R(x0 + 10, 892, 9, 6, '#3A4048'); R(x0 + 11, 893, 7, 1, '#6A7586');
  // 헬멧·센서 거치대 (동쪽 벽)
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(RACK.x0 - 2, RACK.y1, RACK.x1 - RACK.x0 + 2, 2);
  R(RACK.x0, RACK.y0, RACK.x1 - RACK.x0, RACK.y1 - RACK.y0, '#3A4048'); R(RACK.x0, RACK.y0, RACK.x1 - RACK.x0, 2, '#565E68'); R(RACK.x0, RACK.y0, 1, RACK.y1 - RACK.y0, '#565E68');
  [864, 882, 900].forEach((y) => R(RACK.x0 + 1, y, RACK.x1 - RACK.x0 - 2, 1, '#252A31'));
  SLOTS.forEach((s) => R(s[0], s[1] + 7, 8, 2, '#252A31'));

  map.signs.push({ t: 'TIGER 합성훈련장', x: 264, y: y0 + 4, k: 'big' });
}
// 연병장 남쪽 보도 (새 좌표) — 정문 가는 세로 도로에서 훈련장 동쪽 문까지
function bakeWalk(c) {
  const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  R(356, 674, 360, 16, '#BEBAAF');
  for (let x = 356; x < 716; x += 8) R(x, 674, 0.5, 16, '#A9A59A');
  for (let y = 674; y < 690; y += 8) R(356, y, 360, 0.5, '#A9A59A');
}
// 훈련장 상태 · 자리 (새 좌표)
function tigerData(map) {
  const D = BLOCKS.tiger.d, P = (p) => [p[0] + D[0], p[1] + D[1]], { x0, y0, x1, y1 } = TIGER;
  map.sitZones = (map.sitZones || []).concat([{ x0: x0 + 6 + D[0], y0: y0 + 32 + D[1], x1: x1 - 6 + D[0], y1: y1 - 6 + D[1], kind: 'free' }]);
  const live = { on: false, t: 0, dur: 30, route: null, rain: false, who: null, cover: 0, fan: 0, scan: 0, booms: [], out: [false, false, false, false, false, false], acc: 0, exp: 0, hr: 0, sync: 0 };
  map.tiger = {
    x0: x0 + D[0], y0: y0 + D[1], x1: x1 + D[0], y1: y1 + D[1], pods: PODS.map(P), console: { x: CONSOLE.x + D[0], y: CONSOLE.y + D[1] }, door: { x: x1 + D[0], y: 824 + D[1] },
    rackFront: [[390, 856], [390, 874], [390, 892]].map(P), live, ctl: null,
    start(o) { o = o || {}; Object.assign(live, { on: true, t: 0, dur: o.dur || 30, route: o.route || 'B', rain: !!o.rain, who: o.who || null, cover: 0, booms: [], sync: 0 }); },
    stop() { live.on = false; live.cover = 0; live.booms.length = 0; },
    take(i) { live.out[i % 6] = true; },
    put(i) { live.out[i % 6] = false; },
    reset() { this.stop(); live.out.fill(false); live.who = null; }
  };
}

// ---------------------------------------------------------------- 갱신
function stepHall(map, dt) {
  const L = map.tiger.live;
  L.fan += dt * (L.on ? 14 : 1.2); L.scan = (L.scan + dt * 0.35) % 1;
  if (L.on) {
    L.t += dt;
    const k = clamp01(L.t / 4);
    L.acc = Math.round(70 + 17 * k); L.exp = Math.round(24 - 12 * k); L.hr = Math.round(118 + 18 * Math.min(1, L.t / 6));
    L.sync = Math.min(6, Math.floor(L.t * 2) + 1);
    if (L.cover > 0) L.cover -= dt;
    if (Math.random() < dt * 0.55 && L.booms.length < 3) L.booms.push({ x: HILL[0] - 18 + Math.random() * 30, y: 806 + Math.random() * 10, t: 0 });
  }
  L.booms.forEach((b) => { b.t += dt; }); if (L.booms.length) L.booms = L.booms.filter((b) => b.t < 0.7);
  // 부스 위 훈련 자세: 이동(제자리 걸음) → 조준 → 엄폐(무릎 쏴) → 조준, 부스마다 박자를 어긋나게
  for (const e of map.ents) {
    if (e.tgPod == null) continue;
    const p = map.tiger.pods[e.tgPod % 6];
    const at = L.on && Math.abs(e.x - p[0]) < 1.5 && Math.abs(e.y - p[1]) < 1.5;
    if (!at) { if (e.tgPose) { e.tgPose = null; e.half = false; } continue; }
    const u = (L.t + e.tgPod * 1.1) % 7;
    let pose = u < 3.2 ? 'move' : (u < 4.6 || u >= 6 ? 'aim' : 'kneel');
    if (L.cover > 0) pose = 'kneel';
    e.dir = 'up'; e.tgPose = pose;
    if (pose === 'move') { e.moving = true; e.anim += dt * 1.4; e.half = false; } else { e.moving = false; e.half = pose === 'kneel'; }
    if (pose === 'aim' && Math.random() < dt * 1.8) e.tgFlash = 0.12;
    if (e.tgFlash > 0) e.tgFlash -= dt;
  }
}

// ---------------------------------------------------------------- 그리기
function drawHall(map, c, t) {
  const T = map.tiger, L = T.live, z = map.z, W = (x, y, w, h, col) => map.wrect(c, x, y, w, h, col);
  const P = (x, y) => map.w2s(x, y);
  // ── 스크린 ──
  const a = P(SCR.x0, SCR.y0), b = P(SCR.x1, SCR.y1);
  c.save(); c.beginPath(); c.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]); c.clip();
  const dim = L.on ? 1 : 0.55;
  W(SCR.x0, SCR.y0, 200, 24, L.rain ? '#0A1B29' : '#0E2436');
  W(SCR.x0, SCR.y0, 200, 7, L.rain ? '#13283A' : '#17375A');
  const poly = (pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach((q, i) => { const s = P(q[0], q[1]); if (i) c.lineTo(s[0], s[1]); else c.moveTo(s[0], s[1]); }); c.closePath(); c.fill(); };
  c.globalAlpha = dim;
  poly([[170, 827], [170, 818], [190, 814], [214, 816], [238, 811], [262, 813], [284, 808], [HILL[0], HILL[1] - 1], [322, 808], [346, 812], [370, 810], [370, 827]], '#284D36');
  poly([[170, 827], [170, 822], [200, 820], [232, 822], [262, 819], [292, 821], [330, 818], [370, 821], [370, 827]], '#335F3C');
  for (let k = 0; k < 4; k++) W(180 + k * 48, 823 - (k % 2), 22, 0.5, '#3E7046');
  W(HILL[0] - 6, HILL[1] - 0.5, 12, 0.5, '#4E8A58');
  c.globalAlpha = 1;
  if (L.rain || !L.on) {
    for (let k = 0; k < (L.rain ? 26 : 0); k++) {
      const x = SCR.x0 + ((k * 37 + t * 70) % 200), y = SCR.y0 + ((k * 13 + t * 110) % 24);
      W(x, y, 0.5, 2, 'rgba(159,211,242,0.55)');
    }
  }
  if (L.on) {
    // 기동로·분대·적
    if (L.route) for (let u = 0; u < 1; u += 0.035) { const q = along(ROUTE, u); W(q[0] - 0.5, q[1] - 0.5, 1.2, 1, '#FAC775'); }
    const prog = clamp01(L.t / Math.max(8, L.dur * 0.85));
    for (let k = 0; k < 6; k++) { const q = along(ROUTE, Math.max(0, prog * 0.92 - k * 0.025)); W(q[0] - 0.75, q[1] - 0.75 + (k % 2) * 0.8, 1.5, 1.5, '#5DE0FF'); }
    if (Math.sin(t * 6) > -0.2) W(HILL[0] - 1, HILL[1] - 1.5, 2.5, 2.5, '#FFC247');
    c.globalCompositeOperation = 'lighter';
    L.booms.forEach((bm) => {
      const k = bm.t / 0.7, r = 1 + 5 * Math.sin(Math.min(1, k * 1.4) * Math.PI / 2), q = P(bm.x, bm.y), S = r * 2.4 * z;
      c.globalAlpha = (1 - k) * 0.9; c.drawImage(map.glow(k < 0.3 ? '255,240,200' : '255,150,60'), q[0] - S / 2, q[1] - S / 2, S, S);
      if (k < 0.15) { c.globalAlpha = 0.12; W(SCR.x0, SCR.y0, 200, 24, '#FFE9C8'); }
    });
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  } else {
    const sx = SCR.x0 + L.scan * 200; W(sx, SCR.y0, 1, 24, 'rgba(93,224,255,0.35)');
  }
  if (z >= 2.4) {
    c.font = Math.round(3.4 * z) + 'px Galmuri11, sans-serif'; c.textBaseline = 'top'; c.textAlign = 'left';
    c.fillStyle = 'rgba(232,240,248,0.85)';
    const tl = P(SCR.x0 + 3, SCR.y0 + 1.5); c.fillText(L.on ? 'TIGER 합성훈련 · 분대 전술 기동' + (L.route ? ' · 엄폐 보완 과제' : '') : 'TIGER · LVCG 합성훈련 대기', tl[0], tl[1]);
    if (L.on) { const hl = P(HILL[0] + 3, HILL[1] - 1); c.fillStyle = '#FFE08A'; c.fillText('목표 지점', hl[0], hl[1]); }
    if (L.rain) { const rl = P(SCR.x1 - 40, SCR.y0 + 1.5); c.fillStyle = '#9FD3F2'; c.fillText('강수 · 풍속 6m/s', rl[0], rl[1]); }
  }
  c.restore();

  // ── 훈련관리 AI 화면 ──
  W(AIP.x0, AIP.y0, 44, 2, '#534AB7');
  const bars = [[L.on ? L.acc / 100 : 0.18, '#7F77DD'], [L.on ? 1 - L.exp / 30 : 0.12, '#5DCAA5'], [L.on ? L.hr / 180 : 0.1, '#ED93B1']];
  const big = z >= 3, bx = big ? AIP.x0 + 22 : AIP.x0 + 3, bw = big ? 19 : 38;
  bars.forEach((q, i) => { const y = AIP.y0 + 8 + i * 6; W(bx, y, bw, 2.5, '#2A2752'); W(bx, y, bw * q[0], 2.5, q[1]); });
  if (big) {
    c.font = Math.round(2.6 * z) + 'px Galmuri11, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillStyle = '#E8E6FF';
    const tl = P(AIP.x0 + 2, AIP.y0 + 4.2); c.fillText('훈련관리 AI', tl[0], tl[1]);
    c.fillStyle = '#CECBF6';
    [[L.on ? '명중률 ' + L.acc + '%' : '명중률', 0], [L.on ? '노출 ' + L.exp + '초' : '노출 시간', 1], [L.on ? '심박 ' + L.hr : '심박', 2]].forEach((q) => { const p = P(AIP.x0 + 2.5, AIP.y0 + 9.4 + q[1] * 6); c.fillText(q[0], p[0], p[1]); });
  }
  // ── 송풍기 날개 · 바람 ──
  FANS.forEach((f, i) => {
    for (let k = 0; k < 3; k++) { const ang = L.fan * (i ? -1 : 1) + k * 2.094; W(f[0] + Math.cos(ang) * 2.5 - 0.75, f[1] + Math.sin(ang) * 2.5 - 0.75, 1.5, 1.5, '#B4B2A9'); }
    W(f[0] - 0.75, f[1] - 0.75, 1.5, 1.5, '#7D848C');
    if (L.on) for (let k = 0; k < 4; k++) {
      const u = (t * 0.9 + k / 4 + i * 0.13) % 1, dir = i ? -1 : 1, x = f[0] + dir * (6 + u * 50), y = f[1] + 8 + u * 30 + k * 3;
      c.globalAlpha = (1 - u) * 0.45; W(x, y, 4, 0.5, '#E8F4FF'); c.globalAlpha = 1;
    }
  });
  // ── 부스 링 ──
  PODS.forEach((p, i) => {
    const q = T.pods[i], used = map.ents.some((e) => e.tgPod === i && !e.hide && Math.abs(e.x - q[0]) < 2 && Math.abs(e.y - q[1]) < 2); // 캐릭터는 새 좌표
    const s = P(p[0], p[1]), rx = 12.5 * z, ry = 12.5 * 0.55 * z;
    c.strokeStyle = used && L.on ? 'rgba(93,224,255,' + (0.55 + 0.35 * Math.sin(t * 5 + i)) + ')' : 'rgba(41,189,253,0.28)';
    c.lineWidth = Math.max(1, z * 0.6); c.beginPath(); c.ellipse(s[0], s[1], rx, ry, 0, 0, Math.PI * 2); c.stroke();
  });
  // ── 거치대 헬멧 ──
  SLOTS.forEach((s, i) => {
    if (!L.out[i]) {
      W(s[0] + 1, s[1] + 2, 6, 5, '#4E5536'); W(s[0] + 2, s[1] + 1, 4, 1, '#5E6644'); W(s[0] + 1, s[1] + 5, 6, 1, '#2A2E22'); W(s[0] + 2, s[1] + 4, 4, 0.75, '#5DE0FF');
      if (Math.sin(t * 2 + i) > -0.4) W(s[0] + 7, s[1] + 8, 1, 1, '#45F08A');
    } else W(s[0] + 7, s[1] + 8, 1, 1, '#E2BB3D');
  });
}

function drawVisor(map, c, e, t) {
  if (e.hide || e.alpha < 0.05) return;
  const z = map.z, top = e.half ? e.y - 17 : e.y - 24, W = (x, y, w, h, col) => map.wrect(c, x, y, w, h, col);
  c.globalAlpha = Math.max(0, Math.min(1, e.alpha));
  if (e.dir === 'down') W(e.x - 4, top + 6.5, 8, 1.2, 'rgba(93,224,255,0.85)');
  else if (e.dir === 'up') W(e.x - 5, top + 4.2, 10, 0.8, '#5DE0FF');
  else W(e.dir === 'left' ? e.x - 6 : e.x + 1, top + 5, 5, 1, '#5DE0FF');
  const on = Math.sin(t * 6 + (e.tgPod || 0)) > 0;
  W(e.x - 5.5, top + 12.5, 1, 1, on ? '#45F08A' : '#5DE0FF'); W(e.x + 4.5, top + 12.5, 1, 1, on ? '#5DE0FF' : '#45F08A');
  const q = map.w2s(e.x, top + 4.6), S = 9 * z;
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.28 + 0.12 * Math.sin(t * 3);
  c.drawImage(map.glow('41,224,255'), q[0] - S / 2, q[1] - S / 2, S, S);
  if (e.tgFlash > 0) { const f = map.w2s(e.x + 3.5, top + 6), F = 7 * z; c.globalAlpha = 0.9; c.drawImage(map.glow('255,220,120'), f[0] - F / 2, f[1] - F / 2, F, F); }
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
}
