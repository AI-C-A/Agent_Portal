// 평소 모드 — 상시 시나리오 감독: 45~75초마다 하나씩, 전체 화면 그대로 그 자리에서 재생
import { RGB, HEX } from './fx.js';
import { RM, RP, BLOCKS } from '../layout.js';
// 좌표: 원래 배치 기준 숫자는 RM()으로 새 배치(layout.js)로 바꿔 쓴다. 캐릭터·노드·울타리 지점(sp)은 이미 새 좌표.
const PB = (x, y) => [x + BLOCKS.parade.d[0], y + BLOCKS.parade.d[1]]; // 연병장 블록 안 (사열대 훈련장 CCTV 등)
import { pick, rnd } from './text.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; } return b; };
const NAME = { hq: '관제', gate: '출입', med: '의무', trn: '훈련', per: '인사', fac: '정비', mess: '급양' };

// 시나리오·잔일(비네트) 공용 실행 단위: 타임라인, 패킷 콜백 보호, 맡은 캐릭터 반납, 효과 정리
export class Run {
  constructor(life, def, major) {
    this.life = life; this.def = def; this.id = def.id; this.major = !!major; this.t = 0; this.alive = true;
    this.tl = []; this.taken = []; this.places = def.places || []; this.dur = def.dur || 25; this.step = ''; this.pos = def.pos ? def.pos.slice() : null;
  }
  get A() { return this.life.agents; }
  get fx() { return this.life.fx; }
  get map() { return this.life.map; }
  at(t, fn) { this.tl.push({ t, fn, done: false }); return this; }
  later(dt, fn) { return this.at(this.t + dt, fn); }
  update(dt) {
    this.t += dt;
    for (const it of this.tl) {
      if (it.done || this.t < it.t || !this.alive) continue;
      it.done = true;
      try { it.fn(this); } catch (err) { const k = 'life.run.' + this.id; if (!this.map.modWarned[k]) { this.map.modWarned[k] = true; console.warn(k, err); } }
    }
    if (this.tl.length > 40) this.tl = this.tl.filter((it) => !it.done);
  }
  ok() { return this.alive && this.map.mode === 'ambient'; }
  set(s) { this.step = s; }
  send(from, to, chip, cb, small) { if (!this.ok()) return; this.map.send(from, to, chip, () => { if (this.ok() && cb) cb(); }, small); }
  free(x, y, to, chip, cb) { if (!this.ok()) return; this.map.sendFree(x, y, to, chip, () => { if (this.ok() && cb) cb(); }); }
  // 잔일(비네트) 로그는 시나리오가 도는 동안 쉰다
  log(from, to, msg) { if (this.ok() && (this.major || !this.life.quiet())) this.map.log(from, to, msg); }
  hq(s) { if (this.ok() && (this.major || !this.life.quiet())) this.map.hqLine(s); }
  say(e, text, style, life) { if (this.ok() && e && !e.hide) e.bubble = this.map.bub(text, style || 'say', life || 2.2); }
  own(o) { o.owner = this; return o; }
  take(e) {
    if (!e || !e.lf || e.actor || e.hide || (e.lf.scen && e.lf.scen !== this)) return false;
    if (e.lf.scen === this) return true;
    this.A.interrupt(e); e.lf.scen = this; this.taken.push(e); return true;
  }
  give(e, steps) { if (e && e.lf && e.lf.scen === this) { this.A.interrupt(e); e.lf.plan = steps.filter(Boolean); } }
  release(e) { if (!e || !e.lf || e.lf.scen !== this) return; e.lf.scen = null; this.A.interrupt(e); const k = this.taken.indexOf(e); if (k >= 0) this.taken.splice(k, 1); }
  end(aborted) {
    if (!this.alive) return;
    this.alive = false;
    this.taken.slice().forEach((e) => { if (e.lf && e.lf.scen === this) { e.lf.scen = null; this.A.interrupt(e); } });
    this.taken = [];
    this.fx.clear(this);
    if (this.def.cleanup) { try { this.def.cleanup(this, !!aborted); } catch (err) { console.warn('life.cleanup', err); } }
  }
}

// ---------------------------------------------------------------- 8개 시나리오
const byJob = (A, re) => A.list.find((e) => e.lf && re.test(e.lf.job || '') && !e.hide && !e.actor && !e.lf.scen);
const byRole = (A, role) => A.list.find((e) => e.lf && e.lf.role === role && !e.hide && !e.actor && !e.lf.scen);
const human = (e) => e && e.lf && !e.lf.robot;

export const SCENARIOS = [
  {
    id: 'heat', title: '온열손상 예방', agents: ['trn', 'med'], places: ['parade'], pos: RM(616, 650), chip: RM(400, 1035), dur: 27,
    can: (L) => L.agents.parade.pt.length + L.agents.parade.cb.length >= 5,
    start(R) {
      const A = R.A, P = A.parade, fx = R.fx;
      const mem = shuffle(P.pt.concat(P.cb).filter((e) => !e.hide && !e.actor));
      const hot = mem.sort((a, b) => (b.type === 'pt') - (a.type === 'pt')).slice(0, 3);
      R.hot = hot;
      R.set('7월 야외 훈련 · 워치 체온·심박 상승 감지');
      R.own(fx.ring(...RM(616, 660), RGB.trn, { r1: 130, per: 1.8, life: 27 }));
      hot.forEach((e) => { e.alertT = 9; e.lf.alert = 9; R.own(fx.ping(e.x, e.y - 18, RGB.red, { life: 3 })); });
      R.at(0.4, () => { const e = hot[0]; R.say(e, '워치: 체온 38.2℃ · 심박 172', 'alert', 2.6); R.free(e.x, e.y - 12, 'trn', '체온 38.2℃'); });
      R.at(1.3, () => { const e = hot[1]; if (e) { R.say(e, '워치: 심박 165 · 수분 부족', 'alert', 2.4); R.free(e.x, e.y - 12, 'trn', '심박 165'); } });
      R.at(2.0, () => { const e = hot[2]; if (e) R.free(e.x, e.y - 12, 'trn', '체온 38.0℃'); });
      R.at(3.8, () => {
        R.log('trn', 'med', '연병장 훈련 인원 ' + hot.length + '명 체온·심박 상승 · 온열손상 위험');
        R.send('trn', 'med', '온열 위험 ' + hot.length + '명', () => { R.set('의무지원 AI: 즉시 휴식·수분 섭취 권고'); R.log('med', 'trn', '휴식·수분 섭취 권고 · 야외 훈련 30분 순연'); R.send('med', 'trn', '휴식 권고'); });
      });
      R.at(6.5, () => {
        P.override('rest', 'rest', 30);
        const cap = A.list.find((e) => e.lf.role === 'captain');
        R.say(cap, '훈련 중지! 그늘에서 휴식한다!', 'say', 2.4);
        R.set('훈련 중지 · 그늘 휴식');
      });
      R.at(8.6, () => {
        const bot = byRole(A, 'waterbot'); R.set('급수 지원 로봇 출동');
        R.log('trn', 'hq', '급수 지원 로봇 출동 · 연병장 그늘 휴식 구역'); R.send('trn', 'hq', '급수 로봇 출동');
        if (!bot || !R.take(bot)) return;
        const sitters = shuffle(P.pt.concat(P.cb)).slice(0, 4), steps = [A.call((en) => A.prop(en, 'water'))];
        sitters.forEach((m) => {
          steps.push(A.go(null, { pts0: [[m.x + 11, m.y + 2]], anchor: 'pgN', act: '급수 지원' }), A.wait(1.1, { dir: 'left' }),
            A.call((en) => { if (m.lf) { A.prop(m, 'bottle', 50); m.lf.ping = 1; } if (Math.random() < 0.5) R.say(en, '시원한 물입니다. 천천히 드세요.', 'agent', 1.8); }));
        });
        steps.push(A.call((en) => A.prop(en, null)), A.wait(1));
        R.give(bot, steps);
      });
      R.at(14.5, () => { R.set('훈련 30분 순연 → 상황실 공유'); R.log('trn', 'hq', '오전 체력단련 30분 순연 · 10:30 재개'); R.send('trn', 'hq', '훈련 30분 순연', () => R.hq('온열 위험 · 훈련 순연')); });
      R.at(20, () => {
        hot.forEach((e) => { e.alertT = 0; e.lf.alert = 0; e.lf.ping = 1.4; });
        R.say(hot[0], '워치: 체온 37.1℃ · 정상 회복', 'agent', 2.4);
        R.set('체온·심박 정상 회복 확인'); R.log('med', 'hq', '온열 위험 인원 ' + hot.length + '명 체온 정상 회복 확인'); R.send('med', 'hq', '정상 회복');
      });
    },
    cleanup(R, aborted) {
      (R.hot || []).forEach((e) => { if (e.lf) { e.alertT = 0; e.lf.alert = 0; } });
      if (aborted && R.A.parade.ov) R.A.parade.ov.until = R.A.t;
    }
  },
  {
    id: 'drill', title: '드론·CCTV 훈련 분석', agents: ['trn'], places: ['parade'], pos: RM(616, 660), chip: RM(400, 1035), dur: 27,
    can: (L) => L.agents.parade.pt.length >= 3,
    start(R) {
      const A = R.A, P = A.parade, fx = R.fx, map = R.map;
      P.override('run', P.curC(), 24);
      R.set('훈련 분석 드론 3기 편대 이륙');
      R.log('hq', 'trn', '훈련 분석 드론 3기 편대 이륙 · 연병장 상공 촬영');
      const DS = map.droneS; R.free(DS[0], DS[1] - 12, 'trn', '드론 영상');
      const OC = RM(616, 676); R.drones = [0, 1, 2].map((i) => R.own(fx.drone(DS[0] - 8 + i * 8, DS[1], RP([[900 - i * 20, 470 + i * 10], [640 + i * 30, 600 + i * 20]]), { sp: 150, life: 40, orbit: { cx: OC[0], cy: OC[1], r: 96 + i * 16, w: 0.45 }, oa: i * 2.1 })));
      R.at(3.6, () => {
        R.set('CCTV 영상 + 워치 위치 동기화');
        // 사열대 모서리 훈련장 CCTV(patrol.js에서 그림) → 연병장
        R.free(...PB(667, 497), 'trn', '훈련장 CCTV');
        R.own(fx.cone(PB(667, 497), ...RM(616, 690), 80, RGB.trn, { life: 8 }));
      });
      R.at(5, () => {
        const cols = ['#7FE3FF', '#FFAF00', '#EB56C5'], m = [0, 4, 8].map((s) => P.pt.find((e) => P.slotOf.get(e) === s) || P.pt[s % Math.max(1, P.pt.length)]);
        R.trails = m.filter(Boolean).map((e, i) => R.own(fx.trail(e, cols[i], { life: 22 })));
        if (m[0]) R.free(m[0].x, m[0].y - 12, 'trn', '워치 위치');
        (R.drones || []).forEach((d) => R.own(fx.cone(d, ...RM(616, 690), 60, RGB.trn, { life: 12 })));
      });
      R.at(11, () => {
        R.set('분대별 이동 경로·노출 시간 분석');
        R.log('trn', 'hq', '분대별 이동 경로·노출 시간 분석 완료 · 2분대 노출 48초');
        R.own(fx.label(...RM(616, 610), '2분대 노출 48초 · 엄폐 간격 넓음', 'alert', { life: 7 }));
      });
      R.at(14, () => {
        R.set('사열대 멀티비전에 개선점 3건 표시');
        R.own(fx.panel(674, 482, { w: 50, h: 30, life: 13, rows: [['#FF4F6E', 0.85], ['#FFAF00', 0.6], ['#45F08A', 0.4]] }));
        const cap = A.list.find((e) => e.lf.role === 'captain');
        R.later(2.2, () => R.say(cap, '2분대, 엄폐 이동 간격 줄인다!', 'say', 2.4));
      });
      R.at(18, () => {
        const cap = A.list.find((e) => e.lf.role === 'captain'), N = map.nodes.trn;
        R.set('1중대장 전투체계로 전송');
        if (cap) R.own(fx.pkt([N.x, N.y], cap, HEX.trn, '전투체계', () => { if (!R.ok()) return; R.say(cap, '전투체계 수신 · 개선점 확인', 'agent', 2.4); cap.lf.ping = 1.4; R.log('trn', 'hq', '개선점 3건 · 1중대장 전투체계 전송 완료'); R.hq('훈련 분석 전송'); }, { rgb: RGB.trn }));
      });
      R.at(22, () => { (R.trails || []).forEach((tr) => { tr.stop = true; }); (R.drones || []).forEach((d, i) => { d.orbit = null; d.path = [RM(700, 560), [map.droneS[0] - 8 + i * 8, map.droneS[1]]]; d.onEnd = (o) => { o.land = true; }; }); });
    },
    cleanup(R) { if (R.A.parade.ov && R.A.parade.ov.pt === 'run') R.A.parade.ov.until = R.A.t; }
  },
  {
    id: 'maint', title: '수송 예방정비', agents: ['fac'], places: ['motor'], pos: RM(1230, 150), chip: RM(1250, 30), dur: 27,
    start(R) {
      const A = R.A, W = A.W, fx = R.fx, ks = W.vehicles.filter((v) => v.kind === 'k151' && v.y < 155);
      const v = pick(ks), sub = pick(ks.filter((q) => q !== v)) || v;
      R.pos = [v.x, v.y + 20]; R.veh = v;
      R.set(v.name + ' 엔진 진동 이상 감지');
      R.own(fx.ring(v.x, v.y, RGB.red, { r1: 36, life: 27 }));
      R.own(fx.ping(v.x - 6, v.y - 2, RGB.red, { life: 7 })); R.own(fx.ping(v.x + 6, v.y + 4, RGB.red, { life: 7 }));
      R.free(v.x, v.y - 10, 'fac', '진동 센서');
      R.at(2.6, () => { R.log('fac', 'hq', v.name + ' 엔진 진동 이상 패턴 감지 · 평소 대비 2.4배'); R.send('fac', 'hq', '진동 이상'); });
      R.at(3, () => {
        const bot = byRole(A, 'maintbot');
        if (bot && R.take(bot)) R.give(bot, [A.go(v.spot, { act: v.name + ' 정밀 점검', sp: 46 }), A.stay(null, 30, v.name + ' 정밀 점검', { dir: 'up' })]);
        R.bot = bot;
        const mech = A.list.find((e) => e.lf.role === 'motor' && /정비병/.test(e.lf.job) && !e.lf.scen && !e.hide);
        const sideSpot = { x: v.x + 14, y: 144, node: v.spot.node, appr: [[v.x + 14, 155]], lane: null, dir: 'up' };
        if (mech && R.take(mech)) R.give(mech, [A.call((en) => A.prop(en, 'toolbox')), A.go(sideSpot, { act: v.name + ' 정비 지원', sp: 44 }), A.stay(null, 30, v.name + ' 정비 지원', { dir: 'up' })]);
      });
      R.at(6.2, () => { R.set('AI 예측: 3일 내 고장 가능성 87%'); R.log('fac', 'hq', '고장 예측 3일 이내 · 위험도 87%'); R.send('fac', 'hq', '고장 예측 3일'); });
      R.at(9.6, () => R.send('hq', 'fac', '배차 제외', () => {
        R.log('hq', 'fac', '내일 기동 배차에서 ' + v.name.replace('K-151 ', '') + ' 제외 · 대체 차량 ' + sub.name + ' 배정');
        R.own(fx.ring(sub.x, sub.y, RGB.green, { r1: 30, life: 12 })); R.own(fx.label(sub.x, sub.y - 18, '대체 차량 배정', 'agent', { life: 4 }));
        R.set('내일 배차 제외 · 대체 차량 배정');
        const dsp = A.list.find((e) => /배차병/.test(e.lf.job || '') && !e.hide); if (dsp) R.say(dsp, '배차표 수정 완료!', 'say', 2);
      }));
      R.at(14.5, () => { R.set('부품 자동 발주 · 정비 로봇 점검'); R.send('fac', 'hq', '부품 발주', () => { R.log('fac', 'hq', '엔진 마운트 부품 자동 발주 · 내일 09:00 입고'); R.hq('부품 자동 발주'); }); });
      R.at(19.5, () => { if (R.bot && R.bot.lf.scen === R) { R.bot.lf.beam = 7; R.say(R.bot, '진동 센서 점검 · 엔진 마운트 마모 확인', 'agent', 2.6); } });
      R.at(24, () => { R.set('점검 완료 · 정비 일정 등록'); R.log('fac', 'hq', v.name + ' 정비 로봇 점검 완료 · 정비 일정 등록'); });
    }
  },
  {
    id: 'fence', title: '경계 이상 판별', agents: ['hq', 'gate'], places: ['fence'], pos: RM(40, 500), dur: 26,
    start(R) {
      const fx = R.fx, P = R.life.patrol, map = R.map, sp = P.eventSpot();
      R.pos = [sp.fx, sp.fy];
      const off = sp.fx < 800 ? 330 : -330; // 멧돼지 판별 표시와 겹치지 않게 옆으로
      R.chip = sp.side === '북측' ? [sp.fx + off, -130] : sp.side === '남측' ? [sp.fx + off, 1135] : sp.side === '서측' ? [200, sp.fy < 352 ? 326 : 740] : [1400, sp.fy < 463 ? 326 : 860];
      const code = { 북측: 'N', 동측: 'E', 남측: 'S', 서측: 'W' }[sp.side] || 'X', along = sp.ny ? sp.fx : sp.fy, sector = code + '-' + (1 + Math.floor(along / 120));
      const tx = -sp.ny, ty = sp.nx, bx = sp.fx + sp.nx * 14, by = sp.fy + sp.ny * 14;
      R.set(sp.side + ' 울타리 ' + sector + ' 진동 센서 감지');
      R.own(fx.ring(sp.fx, sp.fy, RGB.red, { r1: 44, life: 26 }));
      R.own(fx.ping(sp.fx + tx * 26, sp.fy + ty * 26, RGB.red, { life: 5 })); R.own(fx.ping(sp.fx - tx * 26, sp.fy - ty * 26, RGB.red, { life: 5 }));
      R.boar = R.own(fx.boar(bx, by, { life: 30, fvx: sp.nx, fvy: sp.ny || 0 }));
      let ci = -1, cd = 1e9; (map.cams || []).forEach((c, i) => { const d = Math.hypot(c[0] - sp.fx, c[1] - sp.fy); if (d < cd) { cd = d; ci = i; } });
      if (ci >= 0 && map.camFlash) map.camFlash[ci] = 3;
      R.log('gate', 'hq', sp.side + ' 울타리 ' + sector + ' 구간 진동 센서 감지'); R.send('gate', 'hq', '울타리 센서 감지', () => R.hq('울타리 센서 감지'));
      P.quadGoto(sp.s, () => { if (R.ok()) P.quadSay('RQ-01 현장 도착 · 열화상 확인'); });
      R.at(1.6, () => {
        const d = P.droneTo(sp.fx + sp.nx * 22, sp.fy + sp.ny * 22, null); R.drone = d;
        R.set('숲 정찰 드론 ' + d.id + ' 자동 출동'); R.log('hq', 'gate', '숲 정찰 드론 ' + d.id + ' 자동 출동 · 현장 영상 확인'); R.free(d.x, d.y - d.alt, 'gate', '드론 ' + d.id);
      });
      R.at(9.5, () => { R.set('AI 영상 판별 중'); if (R.drone) R.own(fx.cone(R.drone, bx, by + 2, 26, RGB.gate, { life: 6 })); });
      R.at(12, () => { R.set('영상 판별: 멧돼지 1마리 · 위협 아님'); R.own(fx.label(bx - sp.nx * 30, by - sp.ny * 30, '멧돼지 1마리 · 위협 아님', 'agent', { life: 5 })); R.log('hq', 'gate', 'AI 영상 판별: 멧돼지 1마리 · 위협 아님'); R.send('hq', 'gate', '판별: 멧돼지'); });
      R.at(14, () => { if (R.boar) R.boar.flee = true; });
      R.at(16, () => { R.set('상황 종료 · 경계 태세 정상'); R.log('hq', 'gate', '상황 종료 · 경계 태세 정상 유지'); R.send('hq', 'gate', '상황 종료', () => R.hq('경계 상황 종료')); });
      R.at(18.5, () => { P.droneBack(R.drone); P.quadResume(); P.quadSay('RQ-01 순찰 복귀'); });
    },
    cleanup(R) { const P = R.life.patrol; P.quadResume(); P.dronesHome(); }
  },
  {
    id: 'truck', title: '출입 차량 확인', agents: ['gate', 'mess'], places: ['gate'], pos: [776, 838], chip: RM(1360, 1012), dur: 27,
    can: (L) => L.routine.truckIdle() && !L.agents.gate.busy(),
    start(R) {
      const A = R.A, L = R.life, map = R.map, fx = R.fx, T = L.routine.deliv;
      L.routine.truckArrive(R);
      R.set('미등록 납품 차량 정문 접근');
      R.own(fx.ring(776, 846, RGB.gate, { r1: 40, life: 16 }));
      R.at(3.4, () => {
        const rb = map.robot;
        if (rb && R.take(rb)) R.give(rb, [A.go(null, { pts0: [[802, 832]], anchor: 'rbt', act: '방문 차량 확인' }), A.wait(30, { dir: 'left', act: '방문 차량 확인' })]);
        R.say(rb, '방문 일정을 조회하겠습니다.', 'agent', 2.4);
        map.scan = { t: 0, target: T };
        R.free(T.x, T.y - 10, 'gate', '번호판 인식');
      });
      R.at(6.2, () => { R.set('아미 NO.7: 방문 일정 조회'); R.log('gate', 'hq', '미등록 차량 12가 3456 · 방문 일정 조회'); R.send('gate', 'hq', '방문 일정 조회'); });
      R.at(9.4, () => R.send('hq', 'mess', '납품 확인 요청', () => { R.log('hq', 'mess', '12가 3456 · 식자재 납품 일정 확인 요청'); R.set('급양팀에 납품 일정 확인'); }));
      R.at(12.6, () => {
        const mg = A.list.find((e) => e.lf.role === 'messmgr'); R.say(mg, '네, 오늘 식자재 납품 맞습니다.', 'say', 2.4);
        R.send('mess', 'hq', '납품 확인', () => { R.log('mess', 'hq', '급양팀 확인: 10:00 식자재 납품 예정 차량'); R.set('급양팀: 납품 일정 확인'); });
      });
      R.at(16.6, () => R.send('hq', 'gate', '임시 출입증', () => {
        R.log('hq', 'gate', '임시 출입증 발급 · 하역 로봇 배정'); R.hq('납품 차량 임시 출입'); R.set('임시 출입증 발급 · 하역 로봇 배정');
        R.say(map.robot, '임시 출입증 발급. 식당 하역장으로 이동하세요.', 'agent', 3);
        L.routine.truckEnter();
      }));
      R.at(24, () => R.release(map.robot));
    },
    cleanup(R, aborted) { if (aborted) R.life.routine.truckAbort(); }
  },
  {
    id: 'meal', title: '급식 수요 예측', agents: ['mess', 'per'], places: ['mess'], pos: RM(272, 236), chip: RM(272, 38), dur: 25,
    start(R) {
      const A = R.A, P = A.parade, fx = R.fx, map = R.map;
      R.set('외출·훈련 강도·워치 칼로리 데이터 수집');
      R.own(fx.ring(...RM(272, 246), RGB.mess, { r1: 110, per: 1.7, life: 25 }));
      const tm = P.pt.concat(P.cb).filter((e) => !e.hide).slice(0, 2);
      tm.forEach((e, i) => R.at(0.3 + i * 0.6, () => { e.lf.ping = 1.4; R.free(e.x, e.y - 12, 'trn', i ? '심박 데이터' : '칼로리 소모'); }));
      R.at(0.8, () => { const g = map.nodes.gate; R.free(g.x - 30, g.y - 20, 'per', '외출 3명'); });
      R.at(3, () => R.send('trn', 'per', '훈련 강도 상', () => R.log('trn', 'per', '워치 칼로리 소모 평균 2,850kcal · 훈련 강도 상')));
      R.at(6, () => R.send('per', 'mess', '인원 현황', () => R.log('per', 'mess', '금일 외출 3명 · 휴가 5명 · 훈련 인원 ' + (P.pt.length + P.cb.length) + '명 반영')));
      R.at(9.5, () => {
        R.set('AI 식수 인원·메뉴 조정');
        R.own(fx.label(...RM(272, 150), '중식 412 → 404명 · 단백질 메뉴 +1', 'agent', { life: 7 }));
        R.log('mess', 'hq', '중식 식수 412명 → 404명 · 단백질 메뉴 1종 추가'); R.send('mess', 'hq', '식수 404명');
        const mg = A.list.find((e) => e.lf.role === 'messmgr' && !e.hide && !e.actor);
        if (mg && R.take(mg)) { R.give(mg, [A.go(A.W.spots.kGate, { act: '메뉴 조정 지시' }), A.stay(null, 20, '메뉴 조정 지시', { dir: 'up' })]); R.mg = mg; }
        R.later(1.4, () => R.say(R.mg, '단백질 메뉴 추가, 배식량 조정합니다!', 'say', 2.4));
      });
      R.at(12.5, () => {
        const cooks = A.list.filter((e) => e.lf.role === 'cook' && !e.lf.scen && !e.hide && !e.actor).slice(0, 2);
        const st = [A.W.spots.fridge, A.W.spots.stove2];
        cooks.forEach((ck, i) => {
          if (!R.take(ck)) return;
          const s = st[i];
          R.give(ck, [A.wait(0.3 + i * 0.5), A.call((en) => R.say(en, '알겠습니다!', 'say', 1.6)), A.go({ x: s.x + (i ? 8 : -8), y: s.y, node: s.node, appr: s.appr, lane: s.lane, dir: 'up' }, { act: '단백질 메뉴 조리' }), A.call((en) => A.prop(en, i ? null : 'food')), A.stay(null, 20, '단백질 메뉴 조리', { dir: 'up' })]);
        });
        [126, 162, 198].forEach((x) => R.own(fx.ping(...RM(x, 132), RGB.mess, { life: 6 })));
      });
      R.at(18, () => { R.set('잔반 감축 리포트 → 상황실'); R.log('mess', 'hq', '잔반 예측 4.1% → 2.6% · 잔반 감축 리포트 전송'); R.send('mess', 'hq', '잔반 감축 리포트', () => R.hq('잔반 감축 리포트')); });
    }
  },
  {
    id: 'gear', title: '장비 반납 확인', agents: ['per'], places: ['barracks'], pos: RM(1300, 600), dur: 27,
    can: (L) => !!L.routine.gearRoom(),
    start(R) {
      const A = R.A, fx = R.fx, map = R.map, pick3 = R.life.routine.gearRoom();
      const Rm = pick3.room, ppl = pick3.ppl, g = Rm.gun, mid = Rm.mid, lane = 'R:' + Rm.name;
      R.pos = [g.x, g.y - 6]; R.chip = [Rm.left ? 1016 : 1424, Rm.k < 2 ? 326 : 840];
      const Q = Rm.gunQ.map((p) => ({ x: p[0], y: p[1], node: Rm.node, appr: [[p[0], mid]], lane, dir: 'up' }));
      const door = { x: Rm.left ? 1292 : 1462, y: mid, node: Rm.node, appr: [], lane, dir: Rm.left ? 'right' : 'left' };
      R.set(Rm.name + ' · 훈련 후 생체인증 장비 반납');
      R.own(fx.ring(g.x, g.y - 8, RGB.per, { r1: 34, life: 27 }));
      ppl.forEach((e, i) => { if (R.take(e)) R.give(e, [A.go(Q[i], { act: '장비 반납 대기' }), A.wait(40, { dir: 'up', act: '장비 반납 대기' })]); });
      const turn = (i, t0) => {
        const e = ppl[i]; if (!e) return;
        if (i > 0) R.at(t0 - 2, () => R.give(e, [A.go(Q[0], { act: '생체인증 장비 반납' }), A.wait(40, { dir: 'up', act: '생체인증 장비 반납' })]));
        R.at(t0, () => {
          R.say(e, i === 0 ? '생체인증 반납 완료.' : (i === 1 ? '반납 완료!' : '반납 완료.'), 'say', 1.6);
          R.own(fx.sparkle(g.x, g.y - 4, { life: 1.6 })); R.free(g.x, g.y - 16, 'per', '생체인증');
          const away = i === 0 ? door : (pick(Rm.lockers.filter((s) => A.free(s, e))) || door);
          if (away !== door) A.claim(e, away);
          R.give(e, [A.go(away, { act: Rm.name + ' · 개인 정비' }), A.stay(away !== door ? away : null, 40, Rm.name + ' · 개인 정비', { dir: away.dir })]);
        });
      };
      turn(0, 4); turn(1, 7.5); turn(2, 10.5);
      R.at(12, () => { R.set('반납 수량 자동 점검'); R.log('per', 'hq', Rm.name + ' 총기·장비 반납 ' + ppl.length + '명 · 생체인증 완료 · 수량 자동 점검'); R.send('per', 'hq', '반납 수량 점검'); });
      R.at(14, () => {
        const tg = ppl[0]; R.set('탄알집 1개 미반납 감지 → 워치 알림');
        R.own(fx.ring(g.x, g.y - 8, RGB.red, { r1: 26, life: 6 })); R.own(fx.label(g.x, g.y - 22, '탄알집 1개 미반납', 'alert', { life: 4 }));
        R.log('per', 'hq', '탄알집 1개 미반납 · 해당 장병 워치 알림 발송');
        const N = map.nodes.per;
        if (tg) R.own(fx.pkt([N.x, N.y], tg, HEX.per, '워치 알림', () => { if (!R.ok()) return; tg.alertT = 6; tg.lf.alert = 6; R.say(tg, '워치: 탄알집 미반납 알림', 'alert', 2.4); }, { rgb: RGB.per }));
      });
      R.at(17.5, () => { const tg = ppl[0]; if (!tg) return; R.say(tg, '아, 바로 반납하겠습니다!', 'say', 2); R.give(tg, [A.go(Q[0], { act: '탄알집 반납', sp: 40 }), A.wait(40, { dir: 'up', act: '탄알집 반납' })]); });
      R.at(21, () => { const tg = ppl[0]; if (!tg) return; tg.alertT = 0; tg.lf.alert = 0; R.say(tg, '탄알집 반납 완료!', 'say', 1.8); R.own(fx.sparkle(g.x, g.y - 4, { life: 1.6 })); R.free(g.x, g.y - 16, 'per', '반납 완료'); });
      R.at(23.5, () => { R.set('장비 반납 100% 확인 · 이상 없음'); R.log('per', 'hq', Rm.name + ' 장비 반납 100% 확인 · 이상 없음'); R.hq('장비 반납 100%'); });
      R.ppl = ppl;
    },
    cleanup(R) { (R.ppl || []).forEach((e) => { if (e.lf) { e.alertT = 0; e.lf.alert = 0; } }); }
  },
  {
    id: 'weather', title: '기상 연동 일정 전환', agents: ['hq', 'trn', 'fac'], places: ['hq'], pos: RM(848, 210), chip: RM(700, 445), dur: 26,
    start(R) {
      const A = R.A, fx = R.fx, map = R.map;
      R.set('기상 정보 연동 · 14:00 소나기 예보');
      R.own(fx.cloud(824, 22, { life: 24 })); R.own(fx.ring(...RM(848, 122), RGB.hq, { r1: 70, per: 1.6, life: 26 }));
      R.own(fx.label(824, 36, '14:00 소나기 예보 · 강수확률 70%', 'agent', { life: 6 }));
      R.log('hq', 'trn', '기상 연동: 14:00 소나기 예보 · 강수확률 70%'); R.send('hq', 'trn', '소나기 예보');
      const ops = byJob(A, /^작전과장$/);
      R.at(0.8, () => { if (ops && R.take(ops)) { const s = A.W.spots.wall2; R.give(ops, [A.go({ x: s.x, y: s.y, node: s.node, appr: [], lane: null, dir: 'up' }, { act: '오후 일정 전환 검토' }), A.wait(30, { dir: 'up', act: '오후 일정 전환 검토' })]); } });
      R.at(4, () => R.say(ops, '오후 일정 실내 전환 검토!', 'say', 2.2));
      R.at(5.8, () => {
        R.set('야외 훈련 → TIGER 합성훈련장');
        R.log('trn', 'hq', '14:00 야외 전술 훈련 → TIGER 합성훈련장 실내 전환'); R.send('trn', 'hq', '실내 훈련 전환');
        R.own(fx.label(...RM(616, 600), '전투 훈련 소대 → TIGER 합성훈련장 이동', 'agent', { life: 6 }));
        const cap = A.list.find((e) => e.lf.role === 'captain'); R.later(1.6, () => R.say(cap, '오후 실내 훈련 전환 확인!', 'say', 2.2));
        // 연병장 전투 훈련 소대가 실제로 훈련장으로 옮겨 가 비·바람이 든 합성 전장에서 훈련한다
        R.later(0.6, () => { const s = R.life.routine.tiger({ rain: true }); if (s) R.pos = RM(264, 850); });
      });
      R.at(10, () => R.send('hq', 'fac', '수송 일정 조정', () => { R.log('hq', 'fac', '15:00 K-151 3대 기동 → 16:30 실내 훈련 연계 조정'); R.set('수송 배차 일정 자동 조정'); }));
      R.at(13.6, () => {
        R.send('fac', 'hq', '배차 조정 완료', () => R.log('fac', 'hq', '배차 일정 조정 완료 · 운전병 3명 통보'));
        const dsp = A.list.find((e) => /배차병/.test(e.lf.job || '') && !e.hide); R.say(dsp, '배차 조정 완료!', 'say', 2);
      });
      R.at(16.5, () => {
        R.set('전 장병 워치로 일정 변경 알림');
        R.log('hq', 'all', '전 장병 워치로 오후 일정 변경 알림 발송'); R.hq('일정 변경 알림');
        let n = 0;
        R.own(fx.ripple(...RM(848, 200), { onHit: (e) => { if (n < 4 && human(e) && !e.half && Math.random() < 0.08 && R.ok()) { n++; R.say(e, '워치: 14:00 실내 훈련 변경', 'agent', 2.2); } } }));
      });
    }
  }
];

// ---------------------------------------------------------------- 감독
export class Director {
  constructor(life) {
    this.life = life; this.map = life.map; this.run = null; this.nextT = 24; this.last = null; this.deck = []; this.played = {}; this.history = [];
    this.defs = {}; SCENARIOS.forEach((d) => { this.defs[d.id] = d; this.played[d.id] = 0; });
  }
  quiet() { return !!(this.run && this.run.alive && this.run.major); }
  locked(place) { return !!(this.run && this.run.alive && this.run.places.indexOf(place) >= 0); }
  pickNext() {
    const L = this.life;
    for (let tries = 0; tries < 2; tries++) {
      if (!this.deck.length) { this.deck = shuffle(Object.keys(this.defs)); if (this.deck[0] === this.last && this.deck.length > 1) this.deck.push(this.deck.shift()); }
      for (let i = 0; i < this.deck.length; i++) {
        const id = this.deck[i], d = this.defs[id];
        if (id === this.last) continue;
        if (d.places.some((p) => L.routine.busy(p))) continue;
        let ok = true; try { ok = !d.can || d.can(L); } catch (err) { ok = false; }
        if (!ok) continue;
        this.deck.splice(i, 1); return d;
      }
      this.deck = [];
    }
    return null;
  }
  start(d) {
    const R = new Run(this.life, d, true);
    this.run = R; this.last = d.id; this.played[d.id]++; this.history.push(d.id); if (this.history.length > 16) this.history.shift();
    try { d.start(R); } catch (err) { console.warn('life.scenario.' + d.id, err); R.end(true); this.run = null; return false; }
    return true;
  }
  step(dt) {
    const m = this.map;
    if (m.mode !== 'ambient') { if (this.run) { this.run.end(true); this.run = null; } this.nextT = Math.max(this.nextT, 10); this.wasDemo = true; return; }
    if (this.wasDemo) { this.wasDemo = false; this.nextT = Math.min(this.nextT, rnd(14, 22)); } // 시연이 끝나면 조금 쉬었다가 다시 시작
    if (this.run) { this.run.update(dt); if (!this.run.alive || this.run.t >= this.run.dur) { this.run.end(false); this.run = null; } }
    this.nextT -= dt;
    if (!this.run && this.nextT <= 0) { const d = this.pickNext(); if (d && this.start(d)) this.nextT = rnd(45, 75); else this.nextT = 6; }
  }
  play(id) {
    const d = this.defs[id]; if (!d || this.map.mode !== 'ambient') return false;
    if (this.run) { this.run.end(true); this.run = null; }
    const ok = this.start(d); this.nextT = rnd(45, 75); return ok;
  }
  stop() { if (this.run) { this.run.end(true); this.run = null; } }
  // 시나리오 제목 칩: 장소 근처 빈 땅(도로·숲) 위에, 맵 영역 안(통신 로그 창 왼쪽, 헤더 아래). 점선으로 장소와 잇는다
  drawScreen(c) {
    const R = this.run, m = this.map;
    if (!R || !R.alive || !R.pos) return;
    let a = Math.min(1, R.t / 0.4);
    if (R.t > R.dur - 0.7) a = Math.max(0, (R.dur - R.t) / 0.7);
    if (a <= 0) return;
    const d = R.def, hex = HEX[d.agents[0]] || '#7FE3FF', anchor = R.chip || d.chip || R.pos;
    c.save(); c.globalAlpha = a; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.font = '12px Galmuri11, sans-serif';
    const tagW = Math.ceil(c.measureText('AI 에이전트').width), sw = Math.ceil(c.measureText(R.step || '').width);
    const chips = d.agents.map((id) => [id, Math.ceil(c.measureText(NAME[id]).width) + 10]);
    const chipsW = chips.reduce((s, q) => s + q[1] + 4, 0);
    c.font = '700 13px Galmuri11, sans-serif'; const tw = Math.ceil(c.measureText(d.title).width);
    const w = Math.max(22 + tagW + 8 + tw + 12 + chipsW, sw + 28) + 12, h = 46;
    const p = m.w2s(anchor[0], anchor[1]), q = m.w2s(R.pos[0], R.pos[1]), right = (m.viewR ? m.viewR() : 1204) - 8;
    const y = clamp(Math.round(p[1] - h / 2), 74, 900 - h - 56);
    let x = clamp(Math.round(p[0] - w / 2), 8, right - w);
    if (m.flow && m.showLog && x + w > 1214 && y < 234) x = Math.max(8, 1214 - w); // 오른쪽 위 통신 로그 토스트 자리(3칸)는 비켜 선다
    // 장소와 칩을 잇는 점선 + 장소 표시
    const ax = clamp(q[0], x + 8, x + w - 8), ay = q[1] > y + h ? y + h + 2 : (q[1] < y ? y - 2 : null);
    if (ay != null) {
      c.fillStyle = hex; const n = Math.max(2, Math.floor(Math.hypot(q[0] - ax, q[1] - ay) / 5));
      for (let i = 1; i < n; i += 2) { const u = i / n; c.fillRect(Math.round(ax + (q[0] - ax) * u) - 1, Math.round(ay + (q[1] - ay) * u) - 1, 2, 2); }
      c.fillStyle = '#05070A'; c.fillRect(q[0] - 4, q[1] - 4, 8, 8); c.fillStyle = hex; c.fillRect(q[0] - 3, q[1] - 3, 6, 6);
    }
    c.fillStyle = '#05070A'; c.fillRect(x - 2, y, w + 4, h); c.fillRect(x, y - 2, w, h + 4);
    c.fillStyle = 'rgba(12,16,24,0.95)'; c.fillRect(x, y, w, h);
    c.fillStyle = hex; c.fillRect(x, y, 3, h);
    c.fillRect(x + 12, y + 10, 8, 8); c.fillStyle = '#05070A'; c.fillRect(x + 14, y + 12, 4, 4);
    c.font = '12px Galmuri11, sans-serif'; c.fillStyle = hex; c.fillText('AI 에이전트', x + 24, y + 15);
    c.font = '700 13px Galmuri11, sans-serif'; c.fillStyle = '#FFFFFF'; c.fillText(d.title, x + 24 + tagW + 8, y + 15);
    c.font = '12px Galmuri11, sans-serif';
    let cx = x + w - 10 - chipsW + 4;
    chips.forEach((ch) => { const N = m.nodes[ch[0]]; c.fillStyle = N ? N.hex : '#E8EDF5'; c.fillRect(cx, y + 8, ch[1], 14); c.fillStyle = '#05070A'; c.fillText(NAME[ch[0]], cx + 5, y + 15.5); cx += ch[1] + 4; });
    c.fillStyle = '#C9D2DF'; c.fillText(R.step || '', x + 12, y + 33);
    c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(x + 3, y + h - 2, w - 3, 2); c.fillStyle = hex; c.fillRect(x + 3, y + h - 2, Math.round((w - 3) * Math.min(1, R.t / R.dur)), 2);
    c.restore();
  }
}
