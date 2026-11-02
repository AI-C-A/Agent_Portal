// 평소 모드 — 부대 일상 잔일: 차량 출입(K-151·납품 트럭), 간부 출퇴근(안면인식), 미열 진료 예약,
// 급양관리관 집계·정비 승인·상황 브리핑, 정문 경계·상황실 근무 교대. (initEnts의 기존 장면을 여기로 옮겼다)
import { Run } from './scenarios.js';
import { pick, rnd } from './text.js';
import { RM } from '../layout.js';

// 정문 차로·큰길 차로 (새 배치): 들어오는 차는 x 776, 나가는 차는 x 736. 울타리 y 812, 맵 밖 대기 y 1000.
// 큰길은 동쪽 방향 y 340 · 서쪽 방향 y 316.
const IN = 776, OUT = 736, OFF = 1000, SCAN = 830, GATE = 753, EB = 340, WB = 316;

const PLATES = ['23호', '31호', '47호', '52호', '68호', '74호', '86호'];
const SLOTS = ['B-1', 'B-2', 'B-3', 'B-4', 'B-5', 'B-6'];

export class Routine {
  constructor(life) {
    this.life = life; this.map = life.map; this.A = life.agents; this.runs = []; this.chk = 0; this.vlock = null;
    this.countI = 0; this.facI = 0; this.feverN = 0; this.gapT = 0; this.birthdayT = -1e9;
  }
  init() {
    const map = this.map;
    this.car = map.car; this.deliv = this.A.deliv;
    // 큰길을 그냥 지나가던 5톤 트럭도 정문으로만 드나드는 보급 수송 차량으로 바꾼다
    this.truck5 = map.ents.find((e) => e.kind === 'veh' && e.vk === 'truck' && e !== this.deliv && e !== map.car);
    [this.car, this.deliv, this.truck5].forEach((v) => {
      if (!v) return;
      v.vs = { path: [], wait: 0, fade: 0, state: 'out', until: 0, g: false, path0: v.path };
      v.x = IN; v.y = OFF; v.alpha = 0; v.path = null; v.heading = 0;
      v.brain = (en, dt) => this.vsafe(en, dt);
    });
    if (this.deliv) this.deliv.vs.until = 0;
    // 정문 출입 차량: 번호판 인식 → 정문 열림 → 목적지 주차 → 같은 정문으로 출문
    this.fleet = [];
    if (this.car) this.fleet.push({ v: this.car, first: 6, plates: PLATES.map((p) => 'K-151 ' + p), slots: SLOTS, park: [1094, 224], len: 32, kind: '전술차량',
      inMsg: (p) => p + ' 전술차량 출입 승인 · 기록 전송', parkChip: (sl) => '주차 ' + sl, parkMsg: (p, sl) => p + ' 주차 구역 ' + sl + ' 배정 · 정비 이력 연동', outMsg: (p) => p + ' 출문 확인 · 외부 기동 훈련 출발', stay: [120, 240], off: [60, 150] });
    if (this.truck5) this.fleet.push({ v: this.truck5, first: 75, plates: ['5톤 트럭 12호', '5톤 트럭 15호', '5톤 트럭 21호', '5톤 트럭 33호'], slots: ['하역장 C-1', '하역장 C-2'], park: RM(1420, 330), len: 58, kind: '보급 수송 차량',
      inMsg: (p) => p + ' 보급품 수송 차량 출입 승인 · 기록 전송', parkChip: (sl) => sl, parkMsg: (p, sl) => p + ' ' + sl + ' 배정 · 보급품 하역 예정', outMsg: (p) => p + ' 출문 확인 · 보급 수송 복귀', stay: [150, 280], off: [90, 200] });
    this.fleet.forEach((f) => { f.v.vs.until = f.first; });
    this.next = { fever: 3.5, count: 30, approval: 46, brief: 72, gateShift: 170, hqShift: 105, tiger: 20 };
  }
  // ---------- 공용 ----------
  ok() { return this.map.mode === 'ambient'; }
  send(from, to, chip, cb, small) { if (!this.ok()) return; this.map.send(from, to, chip, () => { if (this.ok() && cb) cb(); }, small); }
  free(x, y, to, chip, cb) { if (!this.ok()) return; this.map.sendFree(x, y, to, chip, () => { if (this.ok() && cb) cb(); }); }
  log(from, to, msg) { if (this.ok() && !this.life.quiet()) this.map.log(from, to, msg); }
  hq(s) { if (this.ok() && !this.life.quiet()) this.map.hqLine(s); }
  say(e, text, style, life) { this.A.say(e, text, style, life); }
  busy(place) {
    if (place === 'gate' && (this.vlock || this.A.gate.busy() || this.A.gate.ped.size)) return true;
    return this.runs.some((r) => r.alive && r.places.indexOf(place) >= 0);
  }
  idle(e) { const st = e.lf.plan[0]; return !st || st.k === 'stay' || st.k === 'wander' || st.k === 'wait'; }
  freeTroop(e) { return e.lf && e.lf.role === 'troop' && !e.lf.group && !e.lf.scen && !e.hide && !e.actor && e.alpha > 0.9 && this.idle(e); }
  minor(id, places, dur) { const R = new Run(this.life, { id, places, dur }, false); this.runs.push(R); return R; }
  clockPlus(min) {
    const s = Math.floor(7 * 3600 + 40 * 60 + this.map.simT + min * 60), p = (v) => (v < 10 ? '0' : '') + v;
    const mm = Math.round((Math.floor(s / 60) % 60) / 10) * 10, hh = Math.floor(s / 3600) + (mm >= 60 ? 1 : 0);
    return p(hh % 24) + ':' + p(mm % 60);
  }

  step(dt) {
    const A = this.A, m = this.map, t = A.t;
    if (m.mode !== 'ambient') this.runs.forEach((r) => { if (r.alive && r.id === 'tiger') r.end(true); }); // 시연이 시작되면 훈련장 세션은 접는다(시연이 훈련장을 직접 돌림)
    for (const r of this.runs) { if (r.alive) r.update(dt); if (r.alive && r.t > r.dur) r.end(false); }
    if (this.runs.some((r) => !r.alive)) this.runs = this.runs.filter((r) => r.alive);
    this.chk -= dt; if (this.chk > 0) return; this.chk = 0.5;
    if (m.mode !== 'ambient' || this.life.quiet()) return;
    // 차량 출입
    if (!this.vlock && !A.gate.busy() && !this.busy('gate')) {
      const f = this.fleet.find((q) => !q.v.actor && ((q.v.vs.state === 'out' || q.v.vs.state === 'parked') && t >= q.v.vs.until));
      if (f) { if (f.v.vs.state === 'out') this.vehIn(f); else this.vehOut(f); }
    }
    // 간부·군무원 출근
    if (!this.busy('gate')) {
      const cm = A.list.find((e) => e.lf.role === 'commuter' && e.lf.cs === 'off' && t >= (e.lf.offUntil || 0) && !e.lf.scen && !e.actor);
      if (cm && t >= this.gapT) { this.arrive(cm); this.gapT = t + 6; }
    }
    if (t < this.gapT) return;
    const N = this.next, go = (k, a, b, fn) => { if (t >= N[k]) { N[k] = t + rnd(a, b); if (fn.call(this) !== false) this.gapT = t + 7; return true; } return false; };
    if (!this.busy('clinic') && go('fever', 240, 360, this.fever)) return;
    if (go('count', 120, 200, this.count)) return;
    if (go('approval', 120, 200, this.approval)) return;
    if (go('brief', 150, 240, this.brief)) return;
    if (!this.busy('gate') && go('gateShift', 300, 480, this.gateShift)) return;
    if (!this.busy('hq') && go('hqShift', 200, 320, this.hqShift)) return;
    if (!this.busy('tiger') && go('tiger', 150, 230, this.tiger)) return;
  }

  // ---------- 차량 ----------
  vsafe(v, dt) {
    try { this.veh(v, dt); }
    catch (err) { if (!this.map.modWarned['life.veh']) { this.map.modWarned['life.veh'] = true; console.warn('life.veh', err); } if (v.vs) v.vs.path = []; }
  }
  veh(v, dt) {
    const s = v.vs;
    if (v.actor) { this.map.stepEnt(v, dt); return; }
    if (v.bubble) { v.bubble.life -= dt; if (v.bubble.life <= 0) v.bubble = null; }
    if (v.alpha !== s.fade) v.alpha = s.fade > v.alpha ? Math.min(s.fade, v.alpha + dt * 1.6) : Math.max(s.fade, v.alpha - dt * 1.6);
    if (s.wait > 0) { s.wait -= dt; v.moving = false; return; }
    const p = s.path[0];
    if (!p) { v.moving = false; return; }
    if (p.gate && !s.g) { if (!this.A.gate.reqVeh(v)) { v.moving = false; return; } s.g = true; }
    const dx = p.x - v.x, dy = p.y - v.y, d = Math.sqrt(dx * dx + dy * dy), sp = (p.sp || v.speed) * dt;
    if (d <= sp) {
      v.x = p.x; v.y = p.y; v.moving = false; s.path.shift();
      if (p.rel && s.g) { this.A.gate.relVeh(v); s.g = false; }
      if (p.fade != null) s.fade = p.fade;
      if (p.w) s.wait = p.w;
      if (p.at) p.at(v);
    } else {
      v.x += dx / d * sp; v.y += dy / d * sp; v.moving = true;
      if (!p.rev) v.heading = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 90 : 270) : (dy > 0 ? 180 : 0);
    }
  }
  vehIn(f) {
    const v = f.v, s = v.vs, A = this.A, plate = pick(f.plates), slot = pick(f.slots), P = f.park;
    this.vlock = v; s.state = 'in'; s.plate = plate; v.x = IN; v.y = OFF; v.heading = 0; s.fade = 1;
    v.label = plate + ' ' + f.kind + ' · 출입 중';
    s.path = [
      { x: IN, y: SCAN, w: 2.6, at: () => this.scanCar(f, v, plate, slot) },
      { x: IN, y: GATE, gate: true }, { x: IN, y: GATE + 7 - f.len, rel: true, at: () => { this.vlock = null; } },
      { x: IN, y: EB }, { x: P[0], y: EB },
      { x: P[0], y: P[1], at: () => { s.state = 'parked'; s.until = A.t + rnd(f.stay[0], f.stay[1]); v.label = plate + ' ' + f.kind + ' · ' + f.parkChip(slot); } }
    ];
  }
  scanCar(f, v, plate, slot) {
    const m = this.map;
    m.scan = { t: 0, target: v };
    if (m.robot) m.robot.dir = 'left';
    this.life.later(0.4, () => this.say(m.robot, '차량 번호 확인 · 출입 승인', 'agent', 2.2));
    this.free(v.x, v.y - 10, 'gate', '번호판 인식', () => this.send('gate', 'hq', plate + ' 출입', () => {
      this.log('gate', 'hq', f.inMsg(plate)); this.hq(plate + ' 출입 승인'); m.stats.cars++;
      this.life.later(0.4, () => this.send('hq', 'fac', f.parkChip(slot), () => this.log('hq', 'fac', f.parkMsg(plate, slot))));
    }));
  }
  vehOut(f) {
    const v = f.v, s = v.vs, A = this.A, plate = s.plate || f.plates[0], P = f.park;
    this.vlock = v; s.state = 'leaving'; v.label = plate + ' ' + f.kind + ' · 출문 중';
    s.path = [
      { x: P[0], y: P[1] + 36, rev: true, sp: 24 }, { x: P[0], y: WB }, { x: OUT, y: WB }, { x: OUT, y: GATE },
      { x: OUT, y: 813 + f.len, gate: true, rel: true, at: () => { this.vlock = null; if (!this.life.quiet()) this.log('gate', 'hq', f.outMsg(plate)); } },
      { x: OUT, y: OFF, fade: 0, at: () => { s.state = 'out'; s.until = A.t + rnd(f.off[0], f.off[1]); } }
    ];
  }
  truckIdle() { const v = this.deliv; return !!(v && v.vs && v.vs.state === 'out' && !v.actor && !this.vlock); }
  truckArrive() {
    const v = this.deliv, s = v.vs;
    this.vlock = v; s.state = 'arrive'; v.x = IN; v.y = OFF; v.heading = 0; s.fade = 1; s.wait = 0;
    v.label = '식자재 납품 차량 · 12가 3456 (미등록)';
    s.path = [{ x: IN, y: SCAN + 16 }];
  }
  truckEnter() {
    const v = this.deliv, s = v.vs; if (!v || s.state !== 'arrive') return;
    s.state = 'enter'; v.label = '식자재 납품 차량 · 12가 3456 (임시 출입)';
    s.path = [{ x: IN, y: GATE, gate: true }, { x: IN, y: GATE - 37, rel: true, at: () => { this.vlock = null; } }, { x: IN, y: WB }, { x: 224, y: WB, at: () => this.unload() }];
  }
  truckAbort() {
    const v = this.deliv, s = v && v.vs; if (!s) return;
    if (s.state === 'arrive' || (s.state === 'enter' && v.y > 758)) {
      s.path = []; s.fade = 0; if (s.g) { this.A.gate.relVeh(v); s.g = false; }
      this.vlock = null;
      this.life.later(0.9, () => { v.x = IN; v.y = OFF; s.state = 'out'; });
    }
  }
  unload() {
    const v = this.deliv, s = v.vs, A = this.A;
    s.state = 'park'; v.label = '식자재 납품 차량 · 하역 중';
    const bot = A.list.find((e) => e.lf.role === 'logibot' && !e.hide && !e.actor && !e.lf.scen);
    const R = this.minor('unload', [], 150);
    if (!bot || !R.take(bot)) { s.wait = 8; this.life.later(8, () => this.truckLeave()); R.end(); return; }
    const p = RM(300, 405), spot = { x: p[0], y: p[1], node: 'nwM', appr: [], lane: null, dir: 'down' };
    R.give(bot, [A.go(spot, { act: '식자재 하역 이동', sp: 42 }), A.call(() => R.say(bot, '식자재 하역을 시작합니다.', 'agent', 2)),
      A.wait(4, { dir: 'down', act: '식자재 하역' }), A.call(() => { A.prop(bot, 'boxes'); this.truckLeave(); }),
      A.go(A.W.spots.fridge, { act: '식자재 운반', sp: 38 }), A.wait(2.4, { dir: 'up', act: '냉장 보관' }),
      A.call(() => { A.prop(bot, null); if (!this.life.quiet()) this.log('mess', 'hq', '납품 식자재 하역 완료 · 냉장 보관 입고'); R.end(); })]);
  }
  truckLeave() {
    const v = this.deliv, s = v.vs; if (s.state !== 'park') return;
    s.state = 'leave'; v.label = '식자재 납품 차량 · 하역 완료';
    s.path = [{ x: 30, y: WB }, { x: 30, y: EB }, { x: OUT, y: EB }, { x: OUT, y: GATE }, { x: OUT, y: SCAN + 4, gate: true, rel: true }, { x: OUT, y: OFF, fade: 0, at: () => { s.state = 'out'; } }];
  }

  // ---------- 출근 (보행 출입구 안면인식) ----------
  arrive(e) {
    const A = this.A, m = this.map, lf = e.lf, R = this.minor('arrive', ['gate'], 40);
    if (!R.take(e)) { R.end(); return; }
    lf.cs = 'arriving'; e.x = 828; e.y = OFF; lf.fade = 1; lf.at = { node: 'off', back: [], lane: null };
    const nm = lf.nm, song = nm === '송 상사', bday = song && A.t - this.birthdayT > 1800;
    R.give(e, [A.go(A.W.spots.kiosk, { act: '출근 · 안면인식 출입' }),
      A.stay(null, 2.8, '안면인식 출입', { dir: 'up', fn0: () => {
        R.say(e, song ? '안녕 아미!' : pick(['아미, 출입 확인 부탁해.', '좋은 아침, 아미!']), 'say', 1.4);
        m.kioskFlash = 2.6;
        R.free(e.x, e.y - 18, 'gate', '안면 인식', () => R.send('gate', 'hq', nm + ' 출입', () => {
          R.log('gate', 'hq', nm + ' 안면인식 출입 확인 · 기록 전송'); R.hq(nm + ' 출입'); m.stats.present = Math.min(398, m.stats.present + 1);
          R.later(0.3, () => R.send('hq', 'per', '출근 처리', () => R.log('hq', 'per', nm + ' 출근 처리' + (bday ? ' · 오늘 생일자 알림' : '') + ' · 중식 +1 반영')));
        }));
        R.later(1.3, () => {
          const rb = m.robot; if (!rb) return;
          rb.dir = 'left';
          if (bday) this.birthdayT = A.t;
          R.say(rb, bday ? '송 상사님, 오늘 생일이시네요! 최고의 하루 되세요' : nm + '님, 출입 확인되었습니다. 좋은 하루 되십시오.', 'agent', 2.8);
        });
      } }),
      A.call(() => { lf.cs = 'on'; lf.onUntil = A.t + rnd(480, 900); R.end(); })]);
  }

  // ---------- 미열 감지 → 진료 예약 (박 상병 장면) ----------
  fever() {
    const A = this.A, W = A.W, m = this.map;
    let tg = null;
    if (!this.feverN) tg = A.list.find((e) => e.lf.nm === '박 상병' && this.freeTroop(e));
    if (!tg) tg = pick(A.list.filter((e) => e.type === 'pt' && this.freeTroop(e) && e.lf.room && e.lf.at && e.lf.at.node === e.lf.room.node));
    if (!tg) return false;
    const first = !this.feverN; this.feverN++;
    const R = this.minor('fever', ['clinic'], 200);
    R.def.cleanup = () => { if (R.sick) m.stats.sick = Math.max(0, m.stats.sick - 1); tg.alertT = 0; tg.lf.alert = 0; };
    R.take(tg);
    const nm = tg.lf.nm, temp = first ? '37.8' : pick(['37.6', '37.7', '37.9']), tm = first ? '10:20' : this.clockPlus(25);
    R.give(tg, [A.wait(4.8, { act: '워치 미열 감지' })]);
    tg.alertT = 4.4; tg.lf.alert = 4.4;
    R.say(tg, '워치: 미열 ' + temp + '℃ 감지', 'alert', 2);
    R.free(tg.x + 4, tg.y - 10, 'per', '체온 ' + temp + '℃', () => R.send('per', 'med', '미열 감지', () => {
      R.log('per', 'med', nm + ' 워치 체온 ' + temp + '℃ · 미열 감지');
      R.say(tg, '의무실 진료 예약 완료 · ' + tm, 'agent', 2.4);
      R.send('med', 'hq', '진료 예약', () => {
        R.log('med', 'hq', nm + ' 의무실 진료 ' + tm + ' 예약 확정'); R.hq(nm + ' 진료 예약');
        if (!R.sick) { R.sick = true; m.stats.sick = Math.min(3, m.stats.sick + 1); }
        R.later(0.4, () => R.send('hq', 'trn', '훈련 열외', () => R.log('hq', 'trn', nm + ' 오전 체력단련 열외 처리')));
      });
    }));
    R.at(5, () => {
      const pat = W.spots.patient, bed = W.beds.find((b) => A.free(b, tg));
      const steps = [A.go(pat, { act: '의무실 이동' }), A.stay(A.free(pat, tg) ? pat : null, 9, '진료 중', { dir: 'right', fn0: () => this.consult(R, tg) })];
      if (bed) steps.push(A.go(bed, { act: '의무실 이동' }), A.stay(bed, rnd(30, 50), '의무실 안정 중'));
      steps.push(A.call(() => R.end()));
      R.give(tg, steps);
      if (A.free(pat, tg)) A.claim(tg, pat);
      if (bed) A.claim(tg, bed);
    });
  }
  consult(R, tg) {
    const A = this.A, md = A.list.find((e) => e.lf.job === '군의관' && !e.hide && !e.actor && !e.lf.scen);
    if (!md || !R.take(md)) return;
    const h = md.lf.home;
    R.give(md, [A.go(h, { act: '진료' }), A.stay(h, 12, '진료', { dir: 'left' })]);
    const sur = tg.lf.nm;
    R.later(1.2, () => R.say(md, sur + ', 체온 한 번 더 잴게요', 'say', 2.4));
    R.later(5.6, () => R.say(md, '미열이네요. 오늘은 안정 취하세요.', 'say', 2.4));
    R.later(12, () => R.release(md));
  }
  // ---------- TIGER 합성훈련 (tiger.js 훈련장) ----------
  // 전투 훈련 소대(방탄헬멧·K2 용사)가 연병장 구보 대신 실내 합성훈련: 거치대에서 LVCG 헬멧 → 부스 → 훈련 → 반납
  // o.rain: 기상 연동 시나리오(소나기)로 옮겨 온 훈련 — 스크린에 비·바람을 띄운다
  tiger(o) {
    o = o || {};
    const A = this.A, m = this.map, TG = m.tiger, TW = A.W.tiger, fx = this.life.fx;
    if (!TG || !TW || this.busy('tiger') || TG.live.on || m.mode !== 'ambient') return false;
    const ok = (e) => e && e.lf && !e.lf.scen && !e.actor && !e.hide && e.alpha > 0.9;
    let crew = A.parade.cb.filter(ok);
    if (crew.length < 6) crew = crew.concat(A.list.filter((e) => this.freeTroop(e) && e.type !== 'robot' && crew.indexOf(e) < 0));
    crew = crew.slice(0, 6);
    if (crew.length < 3) return false;
    const R = this.minor('tiger', ['tiger'], 95), ctl = TG.ctl, n = crew.length;
    const say = (e, s, st, l) => { if (R.ok() && e && !e.hide) e.bubble = m.bub(s, st || 'say', l || 2.2); };
    R.def.cleanup = () => {
      TG.reset();
      crew.forEach((e) => { if (e.tgPose) e.half = false; e.lvcg = false; e.tgPod = null; e.tgPose = null; if (e.tgSave) { e.type = e.tgSave; e.tgSave = null; } });
    };
    crew.forEach((e, i) => {
      if (!R.take(e)) return;
      const rk = TW.rack[i % 3];
      R.give(e, [
        A.wait(0.2 + i * 0.7),
        A.go(rk, { act: 'TIGER 합성훈련장 이동', sp: 48 }),
        A.call(() => { TG.take(i); e.lvcg = true; if (e.type !== 'trainee') { e.tgSave = e.type; e.type = 'trainee'; } A.setAct(e, 'LVCG 헬멧·센서 착용'); }),
        A.wait(0.8, { dir: 'right' }),
        A.go(TW.pods[i], { act: 'TIGER 부스 이동' }),
        A.call(() => { e.tgPod = i; }),
        A.stay(TW.pods[i], 200, 'TIGER 합성훈련 · LVCG', { dir: 'up' })
      ]);
    });
    if (!R.taken.length) { R.end(true); return false; }
    say(ctl, o.rain ? '소나기 예보, 실내 합성훈련으로 전환한다!' : 'TIGER 합성훈련 준비! 헬멧·센서 착용.', 'say', 2.4);
    R.free(ctl.x + 6, ctl.y - 16, 'trn', 'TIGER 훈련 준비', () => R.log('trn', 'hq', '전투 훈련 소대 ' + n + '명 TIGER 합성훈련장 입실' + (o.rain ? ' · 소나기 예보로 실내 전환' : '')));
    // 부스에 다 모이면(또는 30초가 지나면) 훈련 시작
    const onPods = () => R.taken.filter((e) => e.tgPod != null && e.lf.spot && e.lf.spot.place === 'tiger').length;
    const ready = () => {
      if (!R.alive) return;
      if (onPods() < R.taken.length && R.t < 45) { R.later(0.5, ready); return; }
      const t0 = R.t;
      TG.start({ dur: 30, route: 'B', rain: !!o.rain, who: 'ambient' });
      say(ctl, 'LVCG 동기화 완료. 훈련 개시!', 'say', 2.2);
      R.own(fx.label(...RM(264, 768), '실제 지형·기상 반영 합성훈련 · 분대 전술 기동', 'agent', { life: 4 }));
      R.at(t0 + 6.5, () => { say(ctl, '2분대 좌측 엄폐 이동!', 'say', 2); TG.live.cover = 2.4; say(R.taken[1], '엄폐!', 'say', 1.4); });
      R.at(t0 + 11, () => say(ctl, '개인 전투체계로 전원 위치 확인', 'agent', 2.4));
      R.at(t0 + 17, () => {
        const L = TG.live;
        R.own(fx.label(...RM(200, 768), '훈련관리 AI · 명중률 ' + L.acc + '% · 노출 ' + L.exp + '초', 'agent', { life: 4.5 }));
        R.free(...RM(128, 815), 'trn', '명중률 ' + L.acc + '%', () => R.send('trn', 'hq', 'TIGER 결과', () => { R.log('trn', 'hq', 'TIGER 합성훈련 결과 · 명중률 ' + L.acc + '% · 노출 시간 ' + (24 - L.exp) + '초 단축'); R.hq('TIGER 훈련 결과'); }));
      });
      R.at(t0 + 28, () => {
        TG.stop();
        say(ctl, '훈련 종료. 장비 반납!', 'say', 2);
        R.taken.slice().forEach((e, i) => {
          const k = e.tgPod != null ? e.tgPod : i, rk = TW.rack[k % 3];
          R.give(e, [A.wait(i * 0.6), A.call(() => { e.tgPod = null; e.half = false; }), A.go(rk, { act: '장비 반납' }),
            A.call(() => { TG.put(k); e.lvcg = false; if (e.tgSave) { e.type = e.tgSave; e.tgSave = null; } }), A.wait(0.6, { dir: 'right' }),
            A.call(() => { R.release(e); if (!R.taken.length) R.end(); })]);
        });
      });
    };
    R.later(1, ready);
    return R;
  }
  // ---------- 짧은 보고 (말풍선 + 로그 한 줄) ----------
  count() {
    const A = this.A, mg = A.list.find((e) => e.lf.role === 'messmgr' && !e.hide && !e.actor);
    if (!mg) return false;
    const diners = A.W.messSeats.filter((s) => s.occ && s.occ.lf && s.occ.lf.spot === s).length;
    const L = [['배식 진행 68%', '조식 배식 진행률 68% · 잔반 예측 4%'], ['식수 집계', '식수 인원 자동 집계 · 현재 ' + diners + '명 식사 중'], ['위생 점검', '조리 위생 점검 완료 · 온도 기록 자동 저장'], ['배식 라인 정상', '배식 대기 ' + A.queue.count() + '명 · 배식 라인 정상']];
    const q = L[this.countI++ % L.length];
    this.say(mg, pick(['식수 인원 자동 집계 확인', '배식 현황 확인 완료', '조리 온도 기록 확인']), 'agent', 2.2);
    this.free(mg.x + 8, mg.y - 14, 'mess', '배식 현황', () => this.send('mess', 'hq', q[0], () => { this.log('mess', 'hq', q[1]); this.hq(q[0]); }));
  }
  approval() {
    const A = this.A, e = A.list.find((x) => x.lf.nm === '이 주무관' && !x.hide && !x.actor && !x.lf.scen);
    if (!e) return false;
    const L = [['정비 승인', '5톤 트럭 정비 점검 결과 승인'], ['부품 발주', '타이어 4본 자동 발주 요청'], ['점검 완료', 'K-151 2대 일일 점검 완료'], ['세차·주유 완료', 'K-151 세차·주유 완료 · 배차 대기']];
    const q = L[this.facI++ % L.length];
    this.say(e, q[0] === '정비 승인' ? '정비 점검 결과 승인' : q[0] + ' 확인', 'agent', 2.4);
    this.free(e.x - 8, e.y - 14, 'fac', '점검 결과', () => this.send('fac', 'hq', q[0], () => { this.log('fac', 'hq', q[1]); this.hq(q[0]); }));
  }
  brief() {
    const A = this.A, e = A.list.find((x) => x.lf.nm === '최 중사' && A.atHome(x) && !x.hide && !x.actor && !x.lf.scen);
    if (!e) return false;
    this.say(e, '통합관제: 부대 전 구역 정상', 'agent', 2.8);
    ['gate', 'med', 'trn', 'per', 'fac', 'mess'].forEach((id) => this.send('hq', id, '', null, true));
    this.log('hq', 'all', '부대 현황 브리핑 · 전 에이전트 배포');
  }
  // ---------- 근무 교대 ----------
  gateShift() {
    const A = this.A;
    const old = A.list.filter((e) => e.lf.role === 'guard' && A.atHome(e) && !e.lf.scen && !e.hide && !e.actor);
    const rel = A.parade.cb.filter((e) => !e.hide && !e.actor && !e.lf.scen).slice(0, old.length);
    if (!old.length || rel.length < old.length) return false;
    const R = this.minor('gateShift', ['gate'], 120);
    let done = 0;
    rel.forEach((nw, i) => {
      const o = old[i], post = o.lf.home, near = { x: post.x + (post.x < 756 ? 13 : -13), y: post.y + 3, node: post.node, appr: [], lane: null, dir: 'down' };
      if (!R.take(nw)) return;
      R.give(nw, [A.go(near, { act: '정문 근무 교대 이동' }), A.call(() => {
        if (!R.take(o)) { R.release(nw); return; }
        R.say(nw, '근무 교대하겠습니다!', 'say', 1.8); R.later(1.1, () => R.say(o, '인수인계 완료, 이상 무!', 'say', 1.8));
        post.owner = null; post.occ = null; o.lf.home = null;
        A.own(nw, post, true);
        nw.lf.role = 'guard'; nw.lf.group = null; nw.lf.job = '정문 경계';
        o.lf.role = 'troop'; o.lf.group = 'combat'; o.lf.job = '';
        R.give(o, [A.wait(2.3, { dir: 'right', act: '근무 인수인계' })]);
        R.give(nw, [A.wait(2.5, { dir: 'left', act: '근무 인수인계' }), A.go(post), A.stay(post, 8, '경계 근무')]);
        R.later(2.4, () => R.release(o)); R.later(10, () => R.release(nw));
        if (++done === rel.length) { this.log('gate', 'per', '정문 경계 근무 교대 완료 · ' + done + '명 인수인계'); R.later(11, () => R.end()); }
      })]);
    });
  }
  hqShift() {
    const A = this.A;
    const seats = A.W.hqSeats.filter((s) => s.owner && s.owner.type === 'soldier' && /병/.test(s.job || '') && s.owner.lf.spot === s && !s.owner.lf.scen && !s.owner.hide && !s.owner.actor);
    const seat = pick(seats), nw = pick(A.list.filter((e) => e.type === 'soldier' && this.freeTroop(e)));
    if (!seat || !nw) return false;
    const R = this.minor('hqShift', ['hq'], 150);
    R.take(nw);
    R.give(nw, [A.go({ node: seat.node }, { act: '상황실 근무 교대 이동' }), A.call(() => {
      const o = seat.owner;
      if (!o || o.lf.scen || o.hide || o.actor || !R.take(o)) { R.end(); return; }
      seat.owner = nw; seat.occ = nw; nw.lf.home = seat; o.lf.home = null;
      nw.lf.role = 'seat'; nw.lf.job = seat.job; o.lf.role = 'troop'; o.lf.job = ''; o.lf.room = o.lf.room || A.randRoom();
      R.say(nw, '근무 교대하겠습니다!', 'say', 1.8); R.later(1.2, () => R.say(o, '인수인계 완료, 수고해!', 'say', 1.8));
      R.give(o, [A.wait(2.4, { act: '근무 인수인계' })]);
      R.give(nw, [A.wait(2.6, { act: '근무 인수인계' }), A.go(seat), A.stay(seat, 20, A.workAct(nw))]);
      R.later(2.5, () => R.release(o));
      R.later(14, () => R.end());
      this.log('per', 'hq', '상황실 근무 교대 · ' + o.lf.nm + ' → ' + nw.lf.nm + ' 인수인계 완료');
    })]);
  }
  // 장비 반납 시나리오용: 생활관 안에 쉬는 용사가 둘 이상인 방
  gearRoom() {
    const A = this.A; let best = null;
    A.W.rooms.forEach((Rm) => {
      if (!Rm.gun) return;
      const inside = A.list.filter((e) => this.freeTroop(e) && e.lf.at && e.lf.at.node === Rm.node && !e.half);
      const sitting = A.list.filter((e) => this.freeTroop(e) && e.lf.at && e.lf.at.node === Rm.node && e.half);
      const ppl = inside.concat(sitting).slice(0, 3);
      if (ppl.length >= 2 && (!best || ppl.length > best.ppl.length)) best = { room: Rm, ppl };
    });
    return best;
  }
}
