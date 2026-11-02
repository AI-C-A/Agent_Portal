// 평소 모드 — 캐릭터 자율 행동 + 상시 시나리오 (전체 화면 유지, 카메라는 건드리지 않는다)
// 훅 목록은 baseMap.js의 use()/hook() 주석 참고. 세부 구현은 src/life/ 아래:
//   world.js     길찾기 그래프(문·복도·보도)와 장소별 지점(좌석·작업 위치)
//   agents.js    캐릭터 두뇌 — 역할별 활동 선택, 이동, 앉기·일어나기, 인사(경례), 들고 있는 물건
//   routine.js   부대 일상 잔일 — 차량 출입, 출근 안면인식, 미열 진료 예약, 근무 교대
//   scenarios.js 상시 시나리오 8종과 감독(45~75초마다 하나)
//   patrol.js    외곽 경계 — 4족 보행 경계로봇 RQ-01, 숲 상공 정찰 드론, CCTV 바깥 감시, 큰길 끝 차단
//   fx.js        장소 효과 — 맥동 링, 센서 핑, 시나리오 드론, 멧돼지, 패킷
// 콘솔: agentPortal.map.life.play('heat') · .list() · .stats() · .stop() · .next(5)
import { Agents } from './life/agents.js';
import { FX } from './life/fx.js';
import { Director, SCENARIOS } from './life/scenarios.js';
import { Routine } from './life/routine.js';
import { Patrol } from './life/patrol.js';
import { TABLES } from './life/world.js';
import { pick, L as T } from './life/text.js';

const TRN = [['체력 기록', (n) => '1중대 체력단련 기록 ' + n + '명 실시간 동기화'], ['심박 이상 0', () => '훈련 인원 심박·체온 이상 없음 확인'], ['랩타임 갱신', () => '연병장 3km 구보 랩타임 갱신']];

class Life {
  constructor(map) { this.map = map; this.timers = []; this.speechN = 0; this.errs = {}; }
  init() {
    this.agents = new Agents(this);
    this.agents.init();
    this.fx = new FX(this);
    this.routine = new Routine(this);
    this.routine.init();
    this.patrol = new Patrol(this);
    this.patrol.init();
    this.director = new Director(this);
  }
  quiet() { return !!(this.director && this.director.quiet()); }
  later(sec, fn) { if (this.timers.length >= 200) this.timers.shift(); this.timers.push({ t: sec, fn }); }
  guard(name, fn) {
    try { fn(); } catch (err) { if (!this.errs[name]) { this.errs[name] = true; this.map.modWarned['life.' + name] = true; console.warn('life.' + name, err); } }
  }
  step(dt) {
    this.guard('agents', () => this.agents.step(dt));
    this.guard('fx', () => this.fx.step(dt));
    this.guard('routine', () => this.routine.step(dt));
    this.guard('patrol', () => this.patrol.step(dt));
    this.guard('director', () => this.director.step(dt));
    this.guard('timers', () => {
      if (!this.timers.length) return;
      this.timers.forEach((q) => { q.t -= dt; });
      const due = this.timers.filter((q) => q.t <= 0);
      if (due.length) { this.timers = this.timers.filter((q) => q.t > 0); due.forEach((q) => q.fn()); }
    });
  }
  // 체력단련 소대 집합 때 중대장 훈시 (예전 initEnts의 강 대위 장면)
  speech(n) {
    const A = this.agents, cap = A.list.find((e) => e.lf.role === 'captain');
    if (!cap || !A.atHome(cap) || this.map.mode !== 'ambient' || n < 3 || this.quiet()) return;
    A.say(cap, pick(T.speech), 'say', 2.4);
    this.later(2.6, () => A.say(cap, '체력 데이터 실시간 동기화 중', 'agent', 2.4));
    if (this.speechN++ % 2) return;
    const m = TRN[Math.floor(this.speechN / 2) % TRN.length], R = this.routine;
    R.free(cap.x + 8, cap.y - 14, 'trn', '태블릿 업로드', () => R.send('trn', 'hq', m[0] === '체력 기록' ? '체력 기록 ' + n + '명' : m[0], () => { R.log('trn', 'hq', m[1](n)); R.hq(m[0]); }));
  }
  // ---- 콘솔 도우미 ----
  play(id) { return this.director.play(id); }
  stop() { this.director.stop(); }
  next(sec) { this.director.nextT = sec == null ? 0 : sec; }
  list() { return SCENARIOS.map((d) => ({ id: d.id, title: d.title, played: this.director.played[d.id] })); }
  vignette(name) { const f = this.routine[name]; return typeof f === 'function' ? f.call(this.routine) : 'fever|count|approval|brief|gateShift|hqShift'; }
  stats() {
    const m = this.map, A = this.agents, run = this.director.run;
    const acts = {}; A.list.forEach((e) => { const k = (e.lf.plan[0] && e.lf.plan[0].k) || '-'; acts[k] = (acts[k] || 0) + 1; });
    return {
      mode: m.mode, scenario: run ? run.id + ' ' + run.t.toFixed(1) + 's' : null, nextIn: +this.director.nextT.toFixed(1), history: this.director.history.slice(),
      ents: m.ents.length, agents: A.list.length, packets: m.packets.length, mapTimers: m.timers.length, logs: m.logs.length,
      lifeTimers: this.timers.length, fx: this.fx.list.length, runs: this.routine.runs.length, pathCache: A.W.cache.size,
      queue: A.queue.count(), parade: A.parade.pt.length + '+' + A.parade.cb.length + ' ' + A.parade.curP(), diners: A.W.messSeats.filter((s) => s.occ).length,
      walking: A.list.filter((e) => e.moving).length, seated: A.list.filter((e) => e.half).length, steps: acts, brainErrors: A.errN, warned: Object.keys(m.modWarned)
    };
  }
}

// 맵 굽기: 식탁 위 식판은 캐릭터가 직접 들고 다니도록 지우고, 세탁물 수거함·급수대·충전 도크를 그린다 (카페는 job A)
// 좌표는 원래 배치 기준 — 블록마다 map.inBlock으로 새 자리에 굽는다
function paint(map, c) {
  const rect = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  map.inBlock(c, 'mess', () => TABLES.forEach((tb) => rect(tb[0], tb[1] + 1, 130, 15, '#C8B48C')));
  // 생활관 세탁물 수거함
  map.inBlock(c, 'bar', () => {
    rect(1340, 562, 12, 2, 'rgba(0,0,0,0.16)');
    rect(1338, 548, 12, 14, '#2E6FA0'); rect(1338, 548, 12, 2, '#4C8FC4'); rect(1340, 552, 8, 1, '#E8ECEF'); rect(1339, 561, 2, 1.5, '#1C1F23'); rect(1347, 561, 2, 1.5, '#1C1F23');
  });
  // 연병장 급수대
  map.inBlock(c, 'parade', () => {
    rect(707, 542, 14, 2, 'rgba(0,0,0,0.18)');
    rect(706, 529, 12, 13, '#C3C9CF'); rect(706, 529, 12, 1.5, '#E2E6EA'); rect(708, 531, 8, 6, '#4C8FC4'); rect(709, 532, 3, 2, '#9FD3F2'); rect(711, 538, 2, 2, '#2E6FA0');
  });
  // 정비고 로봇 충전 도크
  map.inBlock(c, 'fac', () => { rect(1632, 216, 16, 6, '#3A4048'); rect(1632, 216, 16, 1, '#565E68'); rect(1636, 218, 2, 2, '#45F08A'); });
}

export const life = {
  name: 'life',
  bake(map, c) { paint(map, c); Patrol.prototype.bake.call({ map }, c); },
  init(map) {
    const L = new Life(map);
    try { L.init(); map.life = L; }
    catch (err) {
      // 실패하면 원래 장면(initEnts의 경로 이동)으로 돌아간다
      console.warn('life.init', err); map.modWarned['life.init'] = true;
      (map.ents || []).forEach((e) => {
        if (e.lf && !e.actor) { if (e.lf.path0) e.path = e.lf.path0; e.brain = null; e.lf = null; }
        if (e.vs && !e.actor) { if (e.vs.path0) e.path = e.vs.path0; e.brain = null; }
      });
      map.life = null;
    }
  },
  step(map, dt) { if (map.life) map.life.step(dt); },
  drawEnt(map, c, e, t) { const L = map.life; if (!L) return; if (e.lf) L.agents.drawEnt(c, e, t); else if (e === L.patrol.quad) L.patrol.drawEnt(c, e, t); },
  drawWorld(map, c, t) { if (map.life) { map.life.patrol.drawWorld(c, t); map.life.fx.drawWorld(c, t); } },
  drawScreen(map, c, t) { if (map.life) { map.life.fx.drawScreen(c, t); map.life.patrol.drawScreen(c, t); map.life.director.drawScreen(c, t); } }
};
