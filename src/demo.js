// 1분 시연 — 웅비대대 시나리오 컷신 재생 (job A)
// 훅 목록은 baseMap.js의 use()/hook() 주석 참고. 대본은 demo/script.js, 화면 UI는 demo/ui.js, 소품·효과는 demo/props.js.
//   demo.play(map) / demo.stop(map) / demo.toggle(map), demo.playing, demo.onChange(on)
// 재생 중엔 map.mode = 'demo'. 시연 배우는 actor: true, demoActor: true 인 캐릭터로 넣고 끝나면 모두 지운다.
// 평소 모드의 통신 로그·상황실 문구·패킷 칩은 재생 중에만 잠시 막는다(인스턴스 메서드를 덮었다가 끝나면 되돌림).
import { SCRIPT as RAW, SPEAKERS, SECTIONS } from './demo/script.js';
import { bakeProps, drawProps, cup } from './demo/props.js';
import { drawUI, FOCUS_Y, progressHit, progressTime } from './demo/ui.js';
import { MAP_W, MAP_H } from './layout.js';
import { voice } from './demo/voice.js';

const SCRIPT = RAW.map((s, i) => ({ s, i })).sort((a, b) => a.s.at - b.s.at || a.i - b.i).map((q) => q.s);
const TOTAL = SCRIPT.reduce((m, s) => Math.max(m, s.at), 0);
const BEATS = SCRIPT.filter((s) => s.k === 'banner').map((s) => s.at);
const BEAT_NAMES = SCRIPT.filter((s) => s.k === 'banner').map((s) => s.time + ' ' + s.place);
// 진행 막대 조작 상태 (재생을 새로 만들어도 이어지게 밖에 둔다): 마우스 위치(화면 좌표), 마지막으로 움직인 때, 끌고 있는 목표 시각
const CTL = { x: -1, y: -1, moved: 0, scrub: null };
const VOICES = SCRIPT.filter((s) => s.voice).map((s) => s.voice); // 대사 음성(TTS) 파일 id
let QUIET = false; // 이동(빠르게 다시 돌리기) 중에는 음성을 내지 않는다
const CY0 = (64 + 900) / 2; // baseMap view()의 화면 중심 y
const OVERRIDES = ['log', 'hqLine', 'send', 'sendFree', 'clock', 'drawMinimap'];
const clamp01 = (u) => Math.max(0, Math.min(1, u));
const soft = (u) => u * u * u * (u * (u * 6 - 15) + 10); // 카메라 비행 가감속 (양끝 속도·가속도 0)
const smooth = (u) => { u = clamp01(u); return u * u * (3 - 2 * u); };
const LINGER = 0.7; // clear 뒤 화면 안의 시연 배우가 남아 있는 시간(초) — 화면 밖으로 나가면 바로 지운다

let M = null; // map
let S = null; // 재생 상태 (재생할 때마다 새로 만든다)
let TOK = 0;
let DIM = []; // 이번 프레임에만 흐리게 그리는 평소 캐릭터 [e, 원래 alpha] (그린 뒤 되돌린다)

export const demo = {
  name: 'demo',
  playing: false,
  onChange: null,
  duration: TOTAL,
  get time() { return S ? S.T : -1; }, // 재생 위치(초), 재생 중이 아니면 -1
  bake(map, c) { bakeProps(map, c); },
  init(map) { M = map; if (typeof map.useExtraSprites === 'function') map.useExtraSprites(); },
  play(map) {
    map = map || M; if (!map || !map.ents || !map.nodes) return;
    try {
      if (S) teardown(map, false);
      S = fresh(map);
      S.prev = { flow: map.flow, log: map.showLog };
      map.flow = true; map.showLog = true;
      map.mode = 'demo';
      override(map, S);
      if (map.logs) map.logs.length = 0;
      map.drag = null; map.camT = null; map.mx = -1; map.my = -1;
      if (map.drone) { S.prev.drone = true; map.drone.ph = 'charge'; map.drone.t = 1e9; map.drone.alt = 0; map.drone.bubble = null; }
      map.setState({ flow: true, log: true });
      voice.stop(); voice.preload(VOICES); // 앞 시연의 마지막 음성이 남아 있으면 끊고 시작
      this.playing = true;
      if (this.onChange) this.onChange(true);
    } catch (err) { console.warn('demo.play', err); safeStop(map); }
  },
  stop(map) { if (S) safeStop(map || M); else voice.stop(); }, // 끝난 뒤 남은 마무리 음성도 멈춘다
  toggle(map) { if (this.playing) this.stop(map); else this.play(map); },

  // 일시정지: 맵의 시간을 멈춘다(그리기는 계속 — 일시정지 표시·진행 막대가 보이게)
  get paused() { return !!(S && S.paused); },
  pause(map) { if (!S) return; if (!S.paused) S.pausedAt = performance.now(); S.paused = true; (map || M).freeze = true; voice.pause(); },
  resume(map) { if (!S) return; S.paused = false; (map || M).freeze = false; voice.resume(); },
  togglePause(map) { if (S && S.paused) this.resume(map); else this.pause(map); },
  // 이동: 시연은 패킷이 도착해야 다음 일이 일어나므로 중간으로 바로 뛸 수 없다. 처음부터 다시 재생해 그 시각까지 빠르게 돌린다(멈춰 있었으면 멈춘 채로).
  seek(map, t) {
    map = map || M; if (!map || !S) return;
    const keepPaused = S.paused;
    t = Math.max(0, Math.min(TOTAL - 0.2, t));
    this.play(map);
    const st = S; if (!st) return;
    const real = performance.now(); let now = real, n = 0;
    map.freeze = false; map.paused = true; map.maxDt = 0.1; QUIET = true;
    try { while (S === st && st.T < t && n < 2000) { now += 100; map.frame(now); n++; } }
    finally { map.maxDt = 0; map.t0 -= now - real; map.last = 0; map.paused = false; QUIET = false; }
    if (S === st && keepPaused) this.pause(map);
  },
  // 진행 막대: 마우스 위치(화면 좌표)와 끌기. 막대 모양·위치는 ui.js(progressHit)가 정한다.
  pointer(x, y) { CTL.x = x; CTL.y = y; CTL.moved = performance.now(); },
  hit(x, y) { return progressHit(S, x, y); }, // 'toggle' · 시각 · null
  scrubX(x) { if (S) this.scrubAt(progressTime(S, x)); },
  scrubAt(t) { CTL.scrub = t == null ? null : Math.max(0, Math.min(TOTAL, t)); },
  scrubEnd(map) { const t = CTL.scrub; CTL.scrub = null; if (t != null) this.seek(map, t); },
  get scrubbing() { return CTL.scrub != null; },

  step(map, dt) {
    if (!S) return;
    try { stepDemo(map, dt); } catch (err) { console.warn('demo.step', err); safeStop(map); } // 오류가 나면 시연을 끝내고 평소 화면으로
  },
  drawEnt(map, c, e) { drawActor(map, c, e); },
  drawWorld(map, c, t) { drawWorldLayer(map, c, t); },
  drawScreen(map, c) { drawScreenLayer(map, c); }
};

function stepDemo(map, dt) {
  const st = S;
  st.T += dt;
  const T = st.T;
  while (S === st && st.i < SCRIPT.length && SCRIPT[st.i].at <= T) run(map, st, SCRIPT[st.i++]);
  if (S !== st) return;
  if (st.pend.length) {
    const due = st.pend.filter((p) => p.at <= T);
    if (due.length) { st.pend = st.pend.filter((p) => p.at > T); due.forEach((p) => { if (S === st) run(map, st, p); }); }
    if (S !== st) return;
  }
  // 구역 숨김: 시연 장면 구역의 평소 캐릭터는 숨긴다(화면 안이면 짧게 흐려지며).
  // 구역을 벗어난 캐릭터는 화면 밖에 있을 때 되돌린다 — 화면 안에서 사람이 툭 나타나거나 시연 배우와 바뀌어 보이지 않게.
  const R = st.rects, box = viewBox(map);
  map.ents.forEach((e) => {
    if (e.demoActor) return;
    const inR = R.length > 0 && R.some((r) => e.x >= r[0] && e.x <= r[2] && e.y >= r[1] && e.y <= r[3]);
    if (inR || st.hid.has(e)) {
      if (!st.hid.has(e)) { if (e.hide) return; st.hid.add(e); st.vis.set(e, 1); } // 다른 모듈이 숨긴 캐릭터는 건드리지 않는다
      const on = seen(box, e); let v = st.vis.get(e);
      if (inR) v = on ? Math.max(0, v - dt * 4) : 0;
      else if (!on) v = 1;
      else if (v > 0 || st.reveal) v = Math.min(1, v + dt * 4);
      if (v >= 1 && !inR) { e.hide = false; st.hid.delete(e); st.vis.delete(e); }
      else { st.vis.set(e, v); e.hide = v <= 0; if (v > 0 && v < 1) { DIM.push([e, e.alpha]); e.alpha *= v; } }
    }
    if (e.bubble) e.bubble = null; // 평소 캐릭터의 말풍선·워치 경보는 시연 대본과 겹치지 않게 끈다
    if (e.alertT > 0) e.alertT = 0;
  });
  if (map.drone) map.drone.bubble = null;
  // 앞 장면 배우: 화면 밖으로 나가면 바로, 화면 안이면 잠시 뒤 흐려지며 퇴장
  Object.keys(st.actors).forEach((id) => { const e = st.actors[id]; if (e.leave == null || e.fade < 0) return; if (!seen(box, e)) e.dead = true; else if (T >= e.leave) e.fade = -1; });
  Object.keys(st.actors).forEach((id) => { const e = st.actors[id]; if (e.dead) { removeEnt(map, e); delete st.actors[id]; } });
  // 정문 보행자 출입문은 시연이 직접 연다
  st.pedV += (st.ped - st.pedV) * Math.min(1, dt * 3); map.pedO = st.pedV; map.pedT = st.ped;
  // 통합관제 → 중대장 패킷
  st.out.forEach((o) => { if (!o.done) { o.s += dt / o.dur; if (o.s >= 1) { o.done = true; o.hit = 0.9; if (o.from === 'hq') st.outDone++; const N = map.nodes[o.from]; if (N) N.hit = Math.max(N.hit, 0.6); } } else o.hit -= dt; });
  if (st.out.some((o) => o.done && o.hit <= 0)) st.out = st.out.filter((o) => !o.done || o.hit > 0);
  st.view = camNow(map, st, T);
  map.mx = -1; map.my = -1; map.scan = null; map.camT = null; // 마우스 표시·차량 스캔 빔·기존 카메라 이동은 끈다
  if (T > TOTAL + 5) teardown(map, true); // 안전장치: 대본 끝을 놓쳐도 평소 화면으로 돌아간다
}

function safeStop(map) { try { teardown(map, true); } catch (err) { console.warn('demo.stop', err); S = null; demo.playing = false; if (map) map.mode = 'ambient'; if (demo.onChange) demo.onChange(false); } }

function drawActor(map, c, e) {
  if (!e.demoActor || !S) return;
  if (e.self === 'treadmill') {
    const bx = e.px - 9, by = e.py - 28, off = (S.T * 14) % 3;
    for (let j = 0; j < 8; j++) { const yy = by + 10 + j * 3 + off; if (yy < by + 31.5) map.wrect(c, bx + 2, yy, 14, 0.5, '#2E343C'); }
    c.globalAlpha = e.va;
    map.wrect(c, e.x - 5, e.y - 2, 10, 2, 'rgba(0,0,0,0.26)');
    const fr = e.moving ? [1, 0, 2, 0][Math.floor(e.anim * 8) % 4] : 0, s = map.sprite(e.type, e.rank, e.dir, fr), p = map.w2s(e.x - 8, e.y - 24);
    c.drawImage(s, p[0], p[1], 16 * map.z, 24 * map.z);
    c.globalAlpha = 1;
  }
  if (e.carry === 'latte' && e.va > 0.05) {
    const hx = e.dir === 'down' ? e.x + 4.5 : (e.dir === 'up' ? e.x - 4.75 : (e.dir === 'left' ? e.x - 3 : e.x + 3));
    c.globalAlpha = e.va; cup(map, c, hx, e.y - 10, 1, true); c.globalAlpha = 1;
  }
}
function drawWorldLayer(map, c, t) {
  c.save();
  try {
    drawProps(map, c, t, S);
    const v = S ? tintNow(S) : 0;
    if (v > 0.01) { c.fillStyle = 'rgba(14,22,40,' + (0.14 * Math.min(1, v)).toFixed(3) + ')'; c.fillRect(0, 0, 1600, 900); } // 저녁: 옅은 푸른 어둠(최대 14%)
  } finally { c.restore(); }
}
let uiWarned = false;
function drawScreenLayer(map, c) {
  undim();
  const st = S; if (!st) return;
  c.save();
  try { drawUI(map, c, st, SPEAKERS); } catch (err) { if (!uiWarned) { uiWarned = true; console.warn('demo.drawUI', err); } } finally { c.restore(); }
  if (S === st) applyCam(map, st.view); // 다음 프레임 카메라 (맵·캐릭터·오버레이가 같은 배율로 그려지게 프레임 끝에서 바꾼다)
}

function fresh(map) {
  const c0 = map.center();
  return {
    T: 0, i: 0, tok: ++TOK, pend: [], actors: {}, hid: new Set(), vis: new Map(), reveal: false, rects: [], fx: {}, flags: {},
    cam: null, view: { x: c0[0], y: c0[1] - (CY0 - FOCUS_Y) / map.z, z: map.z },
    say: null, pop: null, banner: null, card: null, chapter: null, sec: null, sections: SECTIONS, lb: null, out: [], outDone: 0, tint: null,
    ped: 0, pedV: map.pedO || 0, own: 0, clock: { base: 6 * 3600 + 29 * 60 + 40, t0: 0 },
    total: TOTAL, beats: BEATS, beatNames: BEAT_NAMES, ctl: CTL, paused: false, saved: null, prev: null
  };
}

function own(st, fn) { st.own++; try { return fn(); } finally { st.own--; } }

function override(map, st) {
  const saved = {};
  OVERRIDES.forEach((k) => { saved[k] = { own: Object.prototype.hasOwnProperty.call(map, k), v: map[k] }; });
  const orig = (k) => saved[k].v;
  const mine = () => S === st && st.own > 0;
  map.log = function (from, to, msg) { if (mine()) return orig('log').call(this, from, to, msg); };
  map.hqLine = function (s) { if (mine()) return orig('hqLine').call(this, s); };
  map.send = function (from, to, chip, cb, small) { const m = mine(); return orig('send').call(this, from, to, m ? chip : '', cb, m ? small : true); };
  map.sendFree = function (x, y, to, chip, cb) { return orig('sendFree').call(this, x, y, to, mine() ? chip : '', cb); };
  map.clock = function () { return S === st ? storyClock(st) : orig('clock').call(this); };
  map.drawMinimap = function () { this.mmRect = null; };
  st.saved = saved;
}
function restore(map, st) {
  if (!st.saved) return;
  OVERRIDES.forEach((k) => { const s = st.saved[k]; if (s.own) map[k] = s.v; else delete map[k]; });
  st.saved = null;
}

// keepVoice: 대본이 끝까지 가서 닫힐 때만 — 마무리 문구 음성이 잘리지 않게 끝까지 재생한다
function teardown(map, fit, keepVoice) {
  const st = S; if (!st) return;
  S = null;
  map.freeze = false; CTL.scrub = null; if (!keepVoice) voice.stop();
  for (let i = map.ents.length - 1; i >= 0; i--) if (map.ents[i].demoActor) map.ents.splice(i, 1);
  undim();
  st.hid.forEach((e) => { e.hide = false; });
  st.hid.clear(); st.vis.clear();
  map.packets = map.packets.filter((p) => p.demo == null);
  restore(map, st);
  map.logs.length = 0; // 시연 시계(06:30~19:00)로 찍힌 로그는 평소 시계와 섞이지 않게 비운다
  map.flow = st.prev.flow; map.showLog = st.prev.log;
  if (st.prev.drone && map.drone && map.drone.ph === 'charge') map.drone.t = 2.5;
  map.pedT = 0; map.scan = null; map.mode = 'ambient';
  map.setState({ flow: map.flow, log: map.showLog, z: map.z });
  if (fit) map.fitAll();
  demo.playing = false;
  if (demo.onChange) demo.onChange(false);
}

function storyClock(st) {
  const s = Math.floor(st.clock.base + (st.T - st.clock.t0) * 12), p = (v) => (v < 10 ? '0' : '') + v;
  return p(Math.floor(s / 3600) % 24) + ':' + p(Math.floor(s / 60) % 60) + ':' + p(s % 60);
}
function tintNow(st) { const k = st.tint; if (!k) return 0; return k.a + (k.b - k.a) * smooth((st.T - k.t0) / k.dur); }

// ---- 카메라 비행 ----
// 시점 v = { x, y: 대사창 위 화면 가운데에 올 맵 좌표, z: 배율 }.
// 줌·이동 곡선은 van Wijk & Nuij(2003)의 경로를 따른다(멀리 갈수록 자연스럽게 멀어졌다 다가가며, 화면에서 느끼는 속도가 고르다).
// 맵 가장자리에서 카메라가 멈칫하지 않도록, 가장자리에 걸리는 축은 '그 배율에서 카메라가 갈 수 있는 범위 안의 비율'로 옮긴다.
function reach(map, v) { // 카메라가 실제로 보여 줄 수 있는 시점 (배율 한계·맵 가장자리 반영)
  const z = Math.max(map.zFit(), Math.min(6, v.z)), hx = map.viewR() / 2 / z, hy = FOCUS_Y / z;
  const p = map.clampXY(v.x - hx, v.y - hy, z);
  return { x: p[0] + hx, y: p[1] + hy, z };
}
function span(map, z) { const a = map.clampXY(-1e9, -1e9, z), b = map.clampXY(1e9, 1e9, z); return [a[0], a[1], b[0] - a[0], b[1] - a[1]]; } // 카메라 왼쪽 위가 갈 수 있는 범위 [x, y, 폭, 높이]
function frac(map, v) {
  const r = span(map, v.z), x = v.x - map.viewR() / 2 / v.z - r[0], y = v.y - FOCUS_Y / v.z - r[1];
  return [r[2] > 1e-6 ? x / r[2] : 0.5, r[3] > 1e-6 ? y / r[3] : 0.5];
}
function zoomPath(a, b, wa, wb, rho) { // s(0~1) → [a→b 진행률, 보이는 폭]
  const d = Math.hypot(b.x - a.x, b.y - a.y), r2 = rho * rho;
  if (d < 1e-3) { const L = Math.log(wb / wa); return { at: (s) => [s, wa * Math.exp(L * s)], w: Math.max(wa, wb) }; }
  const r0 = -Math.asinh((wb * wb - wa * wa + r2 * r2 * d * d) / (2 * wa * r2 * d)), r1 = -Math.asinh((wb * wb - wa * wa - r2 * r2 * d * d) / (2 * wb * r2 * d));
  const ch = Math.cosh(r0), sh = Math.sinh(r0);
  return { at: (s) => { const r = r0 + (r1 - r0) * s; return [wa / (r2 * d) * (ch * Math.tanh(r) - sh), wa * ch / Math.cosh(r)]; }, w: r0 < 0 && r1 > 0 ? wa * ch : Math.max(wa, wb) };
}
function flight(map, a, b, t0, dur) {
  a = reach(map, a); b = reach(map, b);
  const W = map.viewR(), wMax = W / map.zFit() * 0.97;
  let rho = Math.SQRT2, path = zoomPath(a, b, W / a.z, W / b.z, rho);
  for (let i = 0; i < 16 && path.w > wMax; i++) path = zoomPath(a, b, W / a.z, W / b.z, (rho *= 0.85)); // 맵 전체보다 더 멀어지지 않게
  // 축마다: 경로가 맵 가장자리에 걸리지 않으면 맵 좌표 그대로, 걸리면 범위 안 비율로 옮긴다
  let edgeX = false, edgeY = false;
  for (let i = 1; i < 32; i++) {
    const q = path.at(i / 32), z = W / q[1], v = { x: a.x + (b.x - a.x) * q[0], y: a.y + (b.y - a.y) * q[0], z }, p = reach(map, v);
    if (Math.abs(p.x - v.x) > 0.25) edgeX = true;
    if (Math.abs(p.y - v.y) > 0.25) edgeY = true;
  }
  return { a, b, t0, dur, path, fa: frac(map, a), fb: frac(map, b), edgeX, edgeY };
}
function camNow(map, st, T) {
  const k = st.cam; if (!k) return st.view;
  const u = clamp01((T - k.t0) / k.dur);
  if (u >= 1) { st.cam = null; return k.b; }
  const q = k.path.at(soft(u)), z = Math.max(map.zFit(), Math.min(6, map.viewR() / q[1]));
  const v = { x: k.a.x + (k.b.x - k.a.x) * q[0], y: k.a.y + (k.b.y - k.a.y) * q[0], z };
  if (k.edgeX || k.edgeY) {
    const r = span(map, z);
    if (k.edgeX) v.x = r[0] + (k.fa[0] + (k.fb[0] - k.fa[0]) * q[0]) * r[2] + map.viewR() / 2 / z;
    if (k.edgeY) v.y = r[1] + (k.fa[1] + (k.fb[1] - k.fa[1]) * q[0]) * r[3] + FOCUS_Y / z;
  }
  return v;
}
// 지금 카메라가 보여 주는 맵 영역(가장자리 여유 포함)과 그 안에 캐릭터가 보이는지
function viewBox(map) { const z = map.z; return [map.camX - 12, map.camY - 4, map.camX + 1600 / z + 12, map.camY + 900 / z + 28]; }
function seen(b, e) { return e.x > b[0] && e.x < b[2] && e.y > b[1] && e.y < b[3]; }
function undim() { for (let i = 0; i < DIM.length; i++) DIM[i][0].alpha = DIM[i][1]; DIM = []; }
function applyCam(map, v) {
  if (!v) return;
  const z = Math.max(map.zFit(), Math.min(6, v.z));
  map.z = z;
  map.camX = v.x - map.viewR() / 2 / z;
  map.camY = v.y + (CY0 - FOCUS_Y) / z - CY0 / z;
  map.clampCam(); map.camT = null; map.atFit = false;
}

function removeEnt(map, e) { const i = map.ents.indexOf(e); if (i >= 0) map.ents.splice(i, 1); }
function actorBrain(e, dt) {
  if (e.bubble) { e.bubble.life -= dt; if (e.bubble.life <= 0) e.bubble = null; }
  if (e.alertT > 0) e.alertT -= dt;
  e.va = clamp01(e.va + e.fade * dt * 3.5);
  e.alpha = e.self ? Math.min(0.03, e.va) : e.va;
  if (e.fade < 0 && e.va <= 0) e.dead = true;
  e.clk += dt;
  if (e.path && e.path.length) {
    const wp = e.path[0], dx = wp[0] - e.px, dy = wp[1] - e.py, d = Math.hypot(dx, dy), sp = e.speed * dt;
    if (d <= sp) { e.px = wp[0]; e.py = wp[1]; e.path.shift(); if (!e.path.length) { e.moving = false; if (e.face) e.dir = e.face; } }
    else { e.px += dx / d * sp; e.py += dy / d * sp; e.moving = true; e.anim += dt * e.speed / 34; e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
  } else if (e.run) { e.moving = true; e.anim += dt * 1.6; } else e.moving = false;
  e.x = e.px; e.y = e.py + (e.bob && Math.sin(e.clk * e.bob) > 0 ? 0.5 : 0);
}

function run(map, st, s) {
  const A = st.actors, T = st.T;
  switch (s.k) {
    case 'cam': {
      const zf = map.zFit(), b = s.fit ? { x: MAP_W / 2, y: MAP_H / 2 - (CY0 - FOCUS_Y) / zf, z: zf } : { x: s.x, y: s.y, z: s.z };
      st.cam = flight(map, st.view, b, T, s.dur || 1.5);
      break;
    }
    case 'lb': st.lb = { on: s.on, t0: T }; break;
    case 'card': st.card = { t0: T, dur: s.dur, l1: s.l1, l2: s.l2 }; break;
    case 'chapter': st.chapter = { t0: T, dur: s.dur, l1: s.l1, l2: s.l2, n: s.n || 0 }; break;
    case 'sec': st.sec = s.n ? { n: s.n, t0: T } : null; break; // 위쪽 띠의 장 표시 (0이면 끔)
    case 'banner': {
      st.banner = { t0: T, dur: s.dur, time: s.time, place: s.place, sub: s.sub, em: !!s.em };
      const hm = String(s.time).split(':'); st.clock = { base: (+hm[0] || 0) * 3600 + (+hm[1] || 0) * 60, t0: T };
      break;
    }
    case 'say':
      st.say = { t0: T, dur: s.dur, who: s.who, text: s.text, fresh: !st.say || T - (st.say.t0 + st.say.dur) > 0.35, lines: null };
      if (s.voice && !QUIET) voice.say(s.voice);
      break;
    case 'pop': st.pop = { id: s.id, t0: T, dur: s.dur, rate: s.rate || 1, fresh: !st.pop || st.pop.id !== s.id || T - (st.pop.t0 + st.pop.dur) > 0.3 }; break;
    case 'fx': { const r = s.rate || 1; st.fx[s.name] = { t0: T, dur: s.dur * r, rate: r, p: s.p || null }; break; } // dur·u는 효과 안의 시간(rate배 빠르게)
    case 'spawn': {
      const o = s.o || {};
      if (A[s.id]) removeEnt(map, A[s.id]);
      const e = {
        kind: 'ch', type: s.type, rank: s.rank || '', x: s.x, y: s.y, px: s.x, py: s.y, dir: s.dir || 'down', moving: false, speed: 34,
        path: null, i: 0, wait: 0, fadeW: 0, alpha: 0, va: 0, fade: 1, bubble: null, label: o.label || '', alertT: 0, anim: 0, clk: 0,
        half: !!o.half, actor: true, demoActor: true, aid: s.id, run: !!o.run, self: o.self || null, bob: o.bob || 0, lift: o.lift || null,
        link: o.link || null, carry: null, face: null, brain: actorBrain, tgPod: o.tgPod != null ? o.tgPod : null, lvcg: !!o.lvcg
      };
      A[s.id] = e; map.ents.push(e);
      break;
    }
    case 'move': { const e = A[s.id]; if (!e) break; e.path = s.pts.map((p) => [p[0], p[1]]); e.speed = s.speed || 34; e.face = s.face || null; e.run = false; break; }
    case 'pose': { const e = A[s.id]; if (!e) break; Object.assign(e, s.set); if (s.set.carry) st.flags.latte = true; break; }
    case 'bub': { const e = A[s.id]; if (e) e.bubble = map.bub(s.text, s.style || 'say', s.dur || 2); break; }
    case 'clear': Object.keys(A).forEach((id) => { const e = A[id]; e.path = null; e.bubble = null; e.alertT = 0; e.leave = T + (s.linger != null ? s.linger : LINGER); }); break;
    case 'free': {
      let x = s.x, y = s.y;
      if (s.from) { const e = A[s.from]; if (!e) break; x = e.x; y = e.y - 14; }
      if (!map.nodes[s.to]) break;
      const cb = after(map, st, s);
      own(st, () => map.sendFree(x, y, s.to, s.chip || '', cb)); tag(map, st, cb, s.dur);
      break;
    }
    case 'send': {
      if (!map.nodes[s.from] || !map.nodes[s.to]) break;
      const cb = after(map, st, s);
      own(st, () => map.send(s.from, s.to, s.chip || '', cb, false)); tag(map, st, cb, s.dur);
      break;
    }
    case 'out': { const N = map.nodes[s.from || 'hq']; if (N) st.out.push({ arc: map.arcPts(N.x, N.y, s.x, s.y, 0.22), s: 0, dur: s.dur || 1, chip: s.chip, hex: N.hex, rgb: N.rgb, from: s.from || 'hq', x: s.x, y: s.y, done: false, hit: 0 }); break; }
    case 'log': own(st, () => map.log(s.from, s.to, s.msg)); break;
    case 'hq': own(st, () => map.hqLine(s.line)); break;
    case 'hide': st.rects = s.rects || []; st.reveal = !!s.reveal; break;
    case 'tint': st.tint = { a: tintNow(st), b: s.v, t0: T, dur: s.dur || 1 }; break;
    case 'gate': st.ped = s.v ? 1 : 0; break;
    case 'vo': if (!QUIET) voice.say(s.voice); break; // 자막 없이 음성만 (마지막 타이틀 카드 문구)
    case 'end': teardown(map, true, true); break;
    default: break;
  }
}
// 패킷 도착 때 할 일 (재생이 바뀌었으면 무시)
function after(map, st, s) {
  return () => {
    if (S !== st) return;
    own(st, () => { if (s.log) map.log(s.log[0], s.log[1], s.log[2]); if (s.hq) map.hqLine(s.hq); });
    if (s.then) s.then.forEach((n) => st.pend.push(Object.assign({}, n, { at: st.T + (n.at || 0) })));
  };
}
// 방금 넣은 패킷에 표시를 달고, 대본 시간에 맞게 속도를 정한다
function tag(map, st, cb, dur) {
  const pk = map.packets[map.packets.length - 1];
  if (pk && pk.cb === cb) { pk.demo = st.tok; if (dur) pk.speed = Math.max(40, pk.arc.len) / dur; }
}
