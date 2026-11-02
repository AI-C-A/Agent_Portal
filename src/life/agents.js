// 평소 모드 — 캐릭터 두뇌: 역할별 활동 선택(가중 무작위 + 장소 수요), 길찾기 이동, 앉기·일어나기, 인사, 소품
import { buildWorld, findPath, nearestNode, MIDS } from './world.js';
import { RANK, rankVal, SURN, L as T, pick, rnd } from './text.js';
import { RM, BLOCKS } from '../layout.js';
// 좌표는 새 배치(layout.js). 원래 배치로 적힌 상수는 RM()·블록 이동으로 바꿔 쓴다.
const blk = (id) => (x, y) => [x + BLOCKS[id].d[0], y + BLOCKS[id].d[1]], MESS = blk('mess'), PAR = blk('parade'); // 밀리테리아 · 연병장 블록 안 좌표

const DV = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wpick = (opts) => {
  let s = 0; opts.forEach((o) => { s += Math.max(0, o[1]); });
  if (s <= 0) return null;
  let r = Math.random() * s;
  for (const o of opts) { r -= Math.max(0, o[1]); if (r <= 0) return o[0]; }
  return opts[opts.length - 1][0];
};

export class Agents {
  constructor(life) {
    this.life = life; this.map = life.map; this.t = 0;
    this.list = []; this.encT = 0; this.encCD = 0; this.encOpen = []; this.errN = 0;
  }

  // ================= 준비 =================
  init() {
    const map = this.map;
    const W = this.W = buildWorld(map);
    this.queue = new Queue(this); this.parade = new Parade(this); this.gate = new Gate(this);
    this.names = SURN.slice().sort(() => Math.random() - 0.5); this.nameI = 0;
    this.addExtras();
    const ents = map.ents.filter((e) => e.kind === 'ch' && !e.actor);
    const near = (list, e, r) => { let b = null, bd = (r || 2.5) * (r || 2.5); list.forEach((s) => { const d = (s.x - e.x) * (s.x - e.x) + (s.y - e.y) * (s.y - e.y); if (d <= bd) { bd = d; b = s; } }); return b; };
    const adminSeats = [].concat(...W.adminRooms.map((A) => A.seats.concat([A.chief])));
    const roomSeats = [].concat(...W.rooms.map((R) => R.seats));
    const taSeats = ['taS0', 'taS1', 'taS2', 'taS3'].map((id) => W.spots[id]);
    const plans = [];
    ents.forEach((e) => {
      const lb = e.label || '', lf = this.mk(e, lb);
      const homeAt = (s, role, job) => {
        lf.role = role; lf.job = job || lf.job;
        if (!s) { lf.at = this.atNearest(e); return; }
        const far = Math.abs(e.x - s.x) > 5 || Math.abs(e.y - s.y) > 5;
        this.own(e, s, far);
        plans.push([e, far ? [this.go(s), this.stay(s, rnd(6, 60), this.workAct(e))] : [this.stay(s, rnd(6, 200), this.workAct(e))]]);
      };
      let s;
      if (e === map.robot) { lf.nm = '휴머노이드 아미 NO.7'; lf.robot = true; lf.role = 'no7'; this.own(e, W.spots.robotPost); plans.push([e, [this.stay(W.spots.robotPost, rnd(4, 12), '출입 관제')]]); }
      else if (lb.indexOf('위병소 상황') >= 0) { lf.job = '위병소 근무'; homeAt(W.spots.boothDesk, 'booth'); }
      else if (lb.indexOf('정문 경계') === 0) { lf.job = '정문 경계'; s = e.x < 756 ? W.spots.postW : W.spots.postE; lf.role = 'guard'; this.own(e, s); plans.push([e, [this.stay(s, rnd(8, 30), '경계 근무')]]); }
      else if (e === map.song) { lf.nm = '송 상사'; lf.job = '2중대 행정보급관'; lf.role = 'commuter'; lf.cs = 'off'; lf.offUntil = 9; this.offBase(e); }
      else if (lb.indexOf('군의관') === 0) { lf.job = '군의관'; homeAt(W.spots.mConsult, 'medic'); }
      else if (lb.indexOf('박 상병') === 0) { lf.nm = '박 상병'; lf.role = 'troop'; lf.room = W.rooms.find((R) => R.name === '2생활관') || pick(W.rooms) || null; this.inRoom(e, plans); lf.fixedName = true; }
      else if (lb.indexOf('훈련 용사') === 0) { lf.role = 'troop'; lf.group = 'combat'; lf.room = this.randRoom(); lf.at = { node: 'pgN', back: [], lane: null }; plans.push([e, [this.ctl(this.parade)]]); }
      else if (lb === '1중대 · 집합') { lf.role = 'troop'; lf.room = this.randRoom(); lf.at = { node: 'pgN', back: [], lane: null }; plans.push([e, [this.ctl(this.parade)]]); }
      else if (lb.indexOf('강 대위') === 0) { lf.nm = '강 대위'; lf.job = '1중대장'; homeAt(W.spots.stand, 'captain'); }
      else if (lb.indexOf('급양관리관') === 0) { lf.job = '급양관리관'; homeAt(W.spots.kGate, 'messmgr'); }
      else if (lb.indexOf('이 주무관') === 0) { lf.nm = '이 주무관'; lf.job = '정비담당관'; lf.civ = true; homeAt(W.spots.office, 'civ'); }
      else if (lb.indexOf('순찰') >= 0) { lf.role = 'patrol'; lf.job = '순찰'; lf.at = this.atNearest(e); }
      else if (lb.indexOf('(세차)') >= 0) { lf.job = '수송병'; homeAt(W.spots.washSp, 'motor'); }
      else if (lb.indexOf('(주유)') >= 0) { lf.job = '운전병'; homeAt(W.spots.fuelSp, 'motor'); }
      else if (lb.indexOf('리프트') >= 0) { lf.job = '정비병'; homeAt(W.spots.liftSp, 'motor'); }
      else if (lb.indexOf('수송 용사') >= 0) { lf.job = '수송 용사'; lf.role = 'motorWalk'; lf.at = { node: 'lotW', back: [], lane: null }; }
      else if (e.type === 'cook' && e.half && (s = near(W.servers, e))) { lf.job = '취사병'; homeAt(s, 'server'); }
      else if (e.type === 'cook') { lf.job = '조리병'; lf.role = 'cook'; s = near(W.kitchen, e, 8); if (s) { this.claimAt(e, s); plans.push([e, [this.stay(s, rnd(4, 16), '조리 중')]]); } else lf.at = { node: 'ki', back: [], lane: null }; }
      else if (lb.indexOf('배식 대기') >= 0) { lf.role = 'troop'; lf.room = this.randRoom(); lf.at = { node: 'm0w', back: [], lane: null }; plans.push([e, this.eatPlan(e).slice(2)]); }
      else if (e === map.cmdr) { lf.job = '대대장'; homeAt(near(W.hqSeats, e), 'cmdr'); }
      else if (e.half && (s = near(W.hqSeats, e))) { const p = lb.split(' · '); if (lb.indexOf('최 중사') === 0) { lf.nm = '최 중사'; lf.job = '작전관'; } else lf.job = p[0]; homeAt(s, 'seat'); s.job = lf.job; }
      else if (e.half && (s = near(adminSeats, e))) {
        const A = s.room;
        if (s === A.chief) { if (A.k === 0) { e.rank = 'o2'; lf.rk = 'o2'; lf.rv = rankVal('o2'); lf.job = '1중대 부중대장'; } else lf.job = '2중대 행정반장'; homeAt(s, 'chief'); }
        else { lf.job = A.name + (e.type === 'officer' ? ' 간부' : ' 행정병'); homeAt(s, 'admin'); }
      }
      else if (e.half && (s = near(roomSeats, e))) { lf.role = 'troop'; lf.room = s.room; this.claimAt(e, s); plans.push([e, [this.stay(s, rnd(5, 60), s.room.name + ' · 담소')]]); }
      else if (e.half && (s = near(taSeats, e))) { lf.job = lb.split(' · ')[0]; homeAt(s, 'tadmin'); }
      else if (e.half && (s = near([W.spots.duty], e))) { lf.job = '당직부사관'; homeAt(s, 'duty'); }
      else if (e.half && (s = near(W.messSeats, e))) { lf.role = 'troop'; lf.room = this.randRoom(); this.claimAt(e, s); plans.push([e, this.eatFromSeat(e, s, rnd(12, 110))]); }
      else if (/생활관$/.test(lb)) { lf.role = 'troop'; const nm = lb.split(' · ')[1]; lf.room = W.rooms.find((R) => R.name === nm) || this.randRoom(); this.inRoom(e, plans); }
      else if (lb.indexOf('기술지원팀') >= 0) { lf.nm = pick(['오', '민', '서']) + ' 기술원'; lf.job = '민간 기술지원팀'; lf.civ = true; lf.rk = ''; lf.rv = 15; homeAt(W.spots.techS, 'tech'); }
      else if (lb.indexOf('급양 운반') >= 0) { homeAt(W.spots.logiBot, 'logibot'); }
      else if (lb.indexOf('급수 지원') >= 0) { homeAt(W.spots.waterBot, 'waterbot'); }
      else if (lb.indexOf('정비 지원') >= 0) { homeAt(W.spots.maintBot, 'maintbot'); }
      else if (lb.indexOf('간호장교') >= 0) { lf.job = '간호장교'; homeAt(W.spots.mDesk, 'medic'); }
      else if (lb.indexOf('한 주무관') >= 0) { lf.nm = '한 주무관'; lf.job = '시설관리'; lf.civ = true; lf.role = 'commuter'; lf.cs = 'on'; lf.onUntil = rnd(200, 420); lf.at = { node: 'co1', back: [], lane: null }; }
      else if (lb.indexOf('트레이너') >= 0 && W.gym) { lf.nm = pick(['윤', '정', '하']) + ' 트레이너'; lf.job = '체력단련실'; lf.civ = true; lf.rk = ''; lf.rv = 15; homeAt(W.gym.coach, 'coach'); }
      else { lf.role = 'troop'; lf.room = this.randRoom(); lf.at = this.atNearest(e); }
      if (!lf.nm) lf.nm = this.nameFor(e);
      this.list.push(e);
    });
    // 순찰조: 앞사람을 뒤따라 걷는 2인 1조
    const pat = this.list.filter((e) => e.lf.role === 'patrol');
    if (pat.length >= 2) { pat[1].lf.role = 'patrolF'; pat[1].lf.leader = pat[0]; pat[0].lf.trail = []; }
    plans.forEach((q) => { q[0].lf.plan = q[1].filter(Boolean); });
    this.parade.setup();
    this.queue.setup();
    this.list.forEach((e) => { this.setAct(e, e.lf.act || ''); e.lf.path0 = e.path; e.path = null; e.brain = (en, dt) => this.safeBrain(en, dt); });
  }
  mk(e, lb) {
    let rk = e.rank || '';
    if (!rk) for (const k in RANK) if (lb.indexOf(RANK[k]) >= 0) { rk = k; break; }
    if (!rk && (e.type === 'pt' || e.type === 'soldier' || e.type === 'trainee')) rk = pick(['e1', 'e2', 'e2', 'e3', 'e3', 'e4']);
    e.lf = { nm: '', rk, rv: rankVal(rk), role: 'troop', job: '', act: '', plan: [], at: null, spot: null, res: [], home: null, room: null, group: null,
      prop: null, propT: 0, tray: null, salute: 0, ping: 0, alert: 0, beam: 0, greetCD: rnd(5, 40), speed: e.type === 'robot' ? 30 : (e.type === 'officer' ? rnd(30, 34) : rnd(31, 37)), scen: null, last: '', err: 0, fade: 1 };
    if (e.type === 'robot') e.lf.robot = true;
    return e.lf;
  }
  nameFor(e) {
    const lf = e.lf; if (lf.robot) return e.label ? e.label.split(' · ')[0] : '로봇';
    const s = this.names[this.nameI++ % this.names.length];
    if (lf.civ) return s + ' 주무관';
    return s + ' ' + (RANK[lf.rk] || '');
  }
  addExtras() {
    const map = this.map, W = this.W;
    const ch = (type, x, y, o) => { const e = Object.assign({ kind: 'ch', type, rank: '', x, y, dir: 'down', moving: false, speed: 34, path: null, i: 0, wait: 0, fadeW: 0, alpha: 1, bubble: null, label: '', alertT: 0, anim: Math.random() * 10 }, o || {}); map.ents.push(e); return e; };
    const sp = W.spots;
    ch('robot', sp.logiBot.x, sp.logiBot.y, { dir: 'left', label: '급양 운반 로봇 · 밀리테리아' });
    ch('robot', sp.waterBot.x, sp.waterBot.y, { dir: 'down', label: '급수 지원 로봇 · 연병장' });
    ch('robot', sp.maintBot.x, sp.maintBot.y, { dir: 'left', label: '정비 지원 로봇 · 차량 정비고' });
    ch('medic', sp.mDesk.x, sp.mDesk.y, { dir: 'up', rank: 'o2', label: '간호장교 · 중위' });
    ch('officer', ...RM(1372, 699), { label: '한 주무관 · 시설관리 (군무원)' });
    // 전문 트레이너·민간 기술지원팀: job A가 등록하는 전용 스프라이트(trainer·tech)가 있으면 첫 프레임에 바꿔 입힌다
    if (W.gym) ch('soldier', W.gym.coach.x, W.gym.coach.y, { label: '전문 트레이너 · 체력단련실', wantType: 'trainer' });
    ch('soldier', sp.techS.x, sp.techS.y, { dir: 'up', label: '민간 기술지원팀 · 정찰로봇 정비', wantType: 'tech' });
    // 납품 트럭 (출입 차량 확인 시나리오용, 평소엔 맵 밖에서 대기)
    this.deliv = Object.assign({ kind: 'veh', vk: 'truck', x: 776, y: 1000, heading: 0, moving: false, speed: 60, path: null, i: 0, wait: 0, fadeW: 0, alpha: 0, bubble: null, label: '식자재 납품 차량', anim: 0 }, {});
    map.ents.push(this.deliv);
  }
  randRoom() { const R = this.W.rooms; return R.length ? R[Math.floor(Math.random() * R.length)] : null; }
  inRoom(e, plans) {
    const R = e.lf.room;
    if (!R) { e.lf.at = this.atNearest(e); return; }
    e.lf.at = { node: R.node, back: [], lane: 'R:' + R.name };
    plans.push([e, [this.wander(R, rnd(6, 50), R.name + ' · 휴식')]]);
  }
  offBase(e) { e.x = 828; e.y = 1000; e.alpha = 0; e.lf.fade = 0; e.lf.at = { node: 'off', back: [], lane: null }; }

  // ================= 두뇌 =================
  safeBrain(e, dt) {
    try { this.brain(e, dt); }
    catch (err) {
      const lf = e.lf; lf.err = (lf.err || 0) + 1; this.errN++;
      if (!this.map.modWarned['life.brain']) { this.map.modWarned['life.brain'] = true; console.warn('life.brain', err); }
      try { lf.plan = []; lf.at = null; lf.scen = null; } catch (e2) { /* 무시 */ }
      if (lf.err > 40) { e.brain = null; e.path = null; }
    }
  }
  brain(e, dt) {
    const lf = e.lf;
    if (e.actor) { lf.wasActor = true; this.map.stepEnt(e, dt); return; }
    if (e.bubble) { e.bubble.life -= dt; if (e.bubble.life <= 0) e.bubble = null; }
    if (e.alertT > 0) e.alertT -= dt;
    if (lf.salute > 0) lf.salute -= dt;
    if (lf.ping > 0) lf.ping -= dt;
    if (lf.alert > 0) lf.alert -= dt;
    if (lf.beam > 0) lf.beam -= dt;
    if (lf.propT > 0) { lf.propT -= dt; if (lf.propT <= 0) lf.prop = null; }
    if (lf.wasActor) { lf.wasActor = false; lf.plan = []; lf.scen = null; lf.at = this.atNearest(e); e.half = false; }
    const fa = lf.fade == null ? 1 : lf.fade;
    if (e.alpha !== fa) e.alpha = fa > e.alpha ? Math.min(fa, e.alpha + dt * 2) : Math.max(fa, e.alpha - dt * 2);
    if (lf.trail) { lf.trailT = (lf.trailT || 0) - dt; if (lf.trailT <= 0) { lf.trailT = 0.2; lf.trail.push([e.x, e.y, e.dir, e.moving]); if (lf.trail.length > 24) lf.trail.shift(); } }
    this.run(e, dt);
  }
  run(e, dt) {
    const lf = e.lf;
    for (let guard = 0; guard < 8; guard++) {
      if (!lf.plan.length) {
        if (lf.scen) { e.moving = false; return; }
        let p = null;
        try { p = this.next(e); } catch (err) { p = null; if (!this.map.modWarned['life.next']) { this.map.modWarned['life.next'] = true; console.warn('life.next', err); } }
        lf.plan = (p && p.length) ? p.filter(Boolean) : [{ k: 'wait', t: 1 + Math.random() * 2 }];
        if (!lf.plan.length) lf.plan = [{ k: 'wait', t: 2 }];
      }
      const st = lf.plan[0];
      if (!st.on) { st.on = true; if (this.enter(e, st) === 'skip') { if (lf.plan[0] === st) lf.plan.shift(); else { const k = lf.plan.indexOf(st); if (k >= 0) lf.plan.splice(k, 1); } continue; } }
      if (this.tick(e, st, dt)) { const k = lf.plan.indexOf(st); if (k >= 0) lf.plan.splice(k, 1); this.exit(e, st); dt = 0; continue; }
      return;
    }
  }
  enter(e, st) {
    const lf = e.lf;
    switch (st.k) {
      case 'go': {
        // 이미 그 자리에 있으면 나갔다 들어오지 않는다
        if (st.dest && st.dest.x != null && lf.spot === st.dest && Math.abs(e.x - st.dest.x) < 1 && Math.abs(e.y - st.dest.y) < 1) return 'skip';
        if (!st.pts) st.pts = this.route(e, st.dest, st);
        if (!st.pts || !st.pts.length) return 'skip';
        if (e.half) e.half = false;
        if (lf.spot) { if (lf.spot.occ === e) lf.spot.occ = null; lf.spot = null; }
        lf.tray = null; st.i = 0;
        if (st.act) this.setAct(e, st.act);
        return;
      }
      case 'stay': {
        const s = st.spot;
        if (s) { lf.spot = s; s.occ = e; const k = lf.res.indexOf(s); if (k >= 0) lf.res.splice(k, 1); if (Math.abs(e.x - s.x) < 4 && Math.abs(e.y - s.y) < 4) { e.x = s.x; e.y = s.y; } }
        e.half = st.half != null ? st.half : !!(s && s.half);
        e.dir = st.dir || (s && s.dir) || e.dir; e.moving = false;
        if (st.act) this.setAct(e, st.act);
        if (st.tray) lf.tray = { seat: s, p: 0 };
        st.T = st.t; st.ev = st.every || 0;
        if (st.fn0) st.fn0(e, st);
        return;
      }
      case 'wander': st.tt = rnd(0.5, 2); st.tgt = null; if (st.act) this.setAct(e, st.act); e.half = false; return;
      case 'call': try { st.fn(e); } catch (err) { if (!this.map.modWarned['life.call']) { this.map.modWarned['life.call'] = true; console.warn('life.call', err); } } return 'skip';
      case 'wait': e.moving = false; if (st.dir) e.dir = st.dir; if (st.act) this.setAct(e, st.act); return;
      case 'greet': e.moving = false; this.face(e, st.other); st.T = st.t; return;
      case 'ctl': st.ctl.join(e); return;
      case 'fade': lf.fade = st.to; return;
      default: return;
    }
  }
  tick(e, st, dt) {
    const lf = e.lf;
    switch (st.k) {
      case 'go': {
        const p = st.pts[st.i];
        if (!p) return true;
        if (p.gate && !st.gHeld) { if (!this.gate.reqPed(e)) { e.moving = false; return false; } st.gHeld = true; }
        if (this.mv(e, p.x, p.y, st.sp || lf.speed, dt)) {
          if (p.gate && st.gHeld) { this.gate.relPed(e); st.gHeld = false; }
          st.i++;
          if (st.i >= st.pts.length) return true;
        }
        return false;
      }
      case 'stay':
        st.T -= dt; e.moving = !!st.run; if (st.run) e.anim += dt * 1.3;
        if (st.tray && lf.tray) lf.tray.p = 1 - Math.max(0, st.T) / Math.max(0.1, st.t);
        if (st.every && st.fn) { st.ev -= dt; if (st.ev <= 0) { st.ev = st.every * rnd(0.7, 1.3); st.fn(e, st); } }
        return st.T <= 0;
      case 'wander':
        if (st.t != null) st.t -= dt;
        if (st.tgt) { if (this.mv(e, st.tgt[0], st.tgt[1], lf.speed * 0.7, dt)) { st.tgt = null; st.tt = rnd(1.2, 4); e.moving = false; } }
        else {
          st.tt -= dt; e.moving = false;
          if (st.tt <= 0) {
            if (st.t <= 0) return true;
            const r = st.rect; st.tgt = [r.x0 + Math.random() * (r.x1 - r.x0), r.y0 + Math.random() * (r.y1 - r.y0)];
          }
        }
        return false;
      case 'wait': st.t -= dt; e.moving = false; return st.t <= 0;
      case 'greet':
        st.T -= dt; e.moving = false;
        if (!st.said && st.t - st.T >= (st.delay || 0)) { st.said = true; if (st.say) this.say(e, st.say, 'say', 1.5); if (st.salute) lf.salute = 1.1; }
        return st.T <= 0;
      case 'ctl': return st.ctl.drive(e, dt) === 'done';
      case 'fade': e.moving = false; return Math.abs(e.alpha - st.to) < 0.03;
      case 'follow': return this.follow(e, st, dt);
      default: return true;
    }
  }
  exit(e, st) {
    const lf = e.lf;
    switch (st.k) {
      case 'go':
        e.moving = false;
        if (st.gHeld) { this.gate.relPed(e); st.gHeld = false; }
        if (st.dest && st.dest.x != null) lf.at = { node: st.dest.node, back: (st.dest.appr || []).slice().reverse(), lane: st.dest.lane || null };
        else if (st.pts0) lf.at = { node: st.anchor || this.atNearest(e).node, back: [], lane: st.lane || null };
        else {
          const nd = typeof st.dest === 'string' ? st.dest : (st.dest && st.dest.node);
          if (nd && this.W.nodes[nd]) lf.at = { node: nd, back: [], lane: null };
          else if (st.anchor) lf.at = { node: st.anchor, back: [], lane: st.lane || null };
        }
        if (st.onArrive) st.onArrive(e);
        return;
      case 'stay': e.moving = false; if (st.tray) lf.tray = null; if (st.done) st.done(e, st); return;
      case 'wander': e.moving = false; lf.at = { node: st.node, back: [], lane: st.lane || null }; return;
      case 'ctl': st.ctl.leave(e); return;
      case 'greet': { const nx = lf.plan[0]; if (nx && nx.on && nx.k === 'stay') e.dir = nx.dir || (nx.spot && nx.spot.dir) || e.dir; return; }
      default: return;
    }
  }
  // 이동 (방향 전환에 여유를 둬 대각선에서 깜빡이지 않게)
  mv(e, tx, ty, sp, dt) {
    const dx = tx - e.x, dy = ty - e.y, d = Math.sqrt(dx * dx + dy * dy), s = sp * dt;
    if (d <= s || d < 0.05) { e.x = tx; e.y = ty; return true; }
    e.x += dx / d * s; e.y += dy / d * s; e.moving = true; e.anim += dt * sp / 34;
    const ax = Math.abs(dx), ay = Math.abs(dy), hx = dx > 0 ? 'right' : 'left', hy = dy > 0 ? 'down' : 'up';
    if (ax > ay * 1.3) e.dir = hx; else if (ay > ax * 1.3) e.dir = hy; else if (e.dir !== hx && e.dir !== hy) e.dir = ax > ay ? hx : hy;
    return false;
  }
  face(e, o) { if (!o) return; const dx = o.x - e.x, dy = o.y - e.y; e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
  follow(e, st, dt) {
    const L = e.lf.leader;
    if (!L || !L.lf || L.lf.role !== 'patrol') return true;
    const tr = L.lf.trail || [], q = tr.length > 5 ? tr[tr.length - 5] : null;
    if (!q) { e.moving = false; return false; }
    const d = Math.hypot(q[0] - e.x, q[1] - e.y);
    if (d > 60) { e.x = q[0]; e.y = q[1]; }
    if (d < 1 || !L.moving) { if (d < 6 || !L.moving) { e.moving = false; if (d < 1) e.dir = q[2]; return false; } }
    this.mv(e, q[0], q[1], Math.min(L.lf.speed * 1.4, Math.max(L.lf.speed * 0.6, d * 3)), dt);
    return false;
  }

  // ================= 길찾기 =================
  atNearest(e) { const n = nearestNode(this.W, e.x, e.y, (n) => (e.y > 813 ? true : n.y < 818)); return { node: n ? n.id : 'pgC', back: [], lane: null }; }
  route(e, dest, st) {
    const lf = e.lf, W = this.W;
    let at = lf.at; if (!at || !W.nodes[at.node]) at = lf.at = this.atNearest(e);
    const pts = [];
    const push = (x, y, n) => { const q = pts[pts.length - 1]; if (q && Math.abs(q.x - x) < 0.01 && Math.abs(q.y - y) < 0.01) { if (n) q.n = n; return; } pts.push({ x, y, n: n || null }); };
    if (st.pts0) { st.pts0.forEach((p) => push(p[0], p[1])); return pts; }
    const spot = dest && dest.x != null ? dest : null, node = spot ? spot.node : (typeof dest === 'string' ? dest : dest && dest.node);
    if (!W.nodes[node]) return null;
    at.back.forEach((p) => push(p[0], p[1]));
    if (spot && at.node === node && at.lane && at.lane === spot.lane) st.anchor = node;
    else {
      const path = findPath(W, at.node, node);
      if (!path) return null;
      let prev = null;
      path.forEach((id) => { const n = W.nodes[id]; push(n.x, n.y, id); if ((prev === 'pdI' && id === 'pdO') || (prev === 'pdO' && id === 'pdI')) pts[pts.length - 1].gate = true; prev = id; });
    }
    if (spot) { spot.appr.forEach((p) => push(p[0], p[1])); push(spot.x, spot.y); }
    while (pts.length > 1 && !pts[0].gate && Math.abs(pts[0].x - e.x) < 0.5 && Math.abs(pts[0].y - e.y) < 0.5) pts.shift();
    return pts;
  }
  atFromGo(e, st) {
    const P = st.pts || [], i = Math.min(st.i || 0, P.length);
    for (let j = i; j < P.length; j++) if (P[j].n) return { node: P[j].n, back: P.slice(i, j).map((p) => [p.x, p.y]), lane: null };
    const back = [];
    for (let j = i - 1; j >= 0; j--) { if (P[j].n) return { node: P[j].n, back, lane: null }; back.push([P[j].x, P[j].y]); }
    const nd = st.anchor || (st.dest && st.dest.node);
    return nd && this.W.nodes[nd] ? { node: nd, back, lane: null } : this.atNearest(e);
  }
  // 하던 일을 멈추고 새 지시를 받을 수 있게 (시나리오·근무 교대)
  interrupt(e) {
    const lf = e.lf, st = lf.plan[0];
    if (st && st.on) {
      if (st.k === 'go') { lf.at = this.atFromGo(e, st); if (st.gHeld) { this.gate.relPed(e); st.gHeld = false; } }
      else if (st.k === 'ctl') { st.ctl.leave(e); lf.at = st.ctl.atFor(e); }
      else if (st.k === 'wander') lf.at = { node: st.node, back: [], lane: st.lane || null };
      else if (st.k === 'follow') lf.at = this.atNearest(e);
      if (st.tray) lf.tray = null;
    }
    lf.res.forEach((s) => { if (s.occ === e && s !== lf.spot) s.occ = null; }); lf.res.length = 0;
    lf.plan = []; e.moving = false;
    if (!lf.at) lf.at = this.atNearest(e);
  }

  // ================= 계획 조각 =================
  free(s, e) { return !!s && (!s.occ || s.occ === e) && (!s.owner || s.owner === e) && !s.lock; }
  claim(e, s) { if (!this.free(s, e)) return false; s.occ = e; if (e.lf.res.indexOf(s) < 0) e.lf.res.push(s); return true; }
  claimAt(e, s) { s.occ = e; e.lf.spot = s; e.lf.at = { node: s.node, back: s.appr.slice().reverse(), lane: s.lane }; if (Math.abs(e.x - s.x) < 6 && Math.abs(e.y - s.y) < 6) { e.x = s.x; e.y = s.y; } }
  own(e, s, far) {
    if (!s) return;
    if (s.owner && s.owner !== e && s.owner.lf && s.owner.lf.home === s) s.owner.lf.home = null;
    s.owner = e; e.lf.home = s;
    if (far) { s.occ = e; e.lf.at = this.atNearest(e); } else this.claimAt(e, s);
  }
  go(dest, o) { return Object.assign({ k: 'go', dest }, o || {}); }
  stay(spot, t, act, o) { return Object.assign({ k: 'stay', spot, t, act }, o || {}); }
  wait(t, o) { return Object.assign({ k: 'wait', t }, o || {}); }
  call(fn) { return { k: 'call', fn }; }
  ctl(c) { return { k: 'ctl', ctl: c }; }
  wander(R, t, act) { return { k: 'wander', rect: R.rect, t, act, node: R.node, lane: 'R:' + R.name }; }
  // 빈 지점이면 [가서, 머문다]
  visit(e, s, t, act, o) { if (!s || !this.claim(e, s)) return null; const a = act || s.act; return [this.go(s, { act: a ? a + ' 이동' : '' }), this.stay(s, t, a, o)]; }
  goHome(e, t, act) {
    const h = e.lf.home; if (!h) return [this.wait(2)];
    h.occ = e; const a = act || this.workAct(e);
    return [this.go(h, { act: this.atHome(e) ? a : '근무지 복귀' }), this.stay(h, t, a)];
  }
  atHome(e) { return e.lf.home && e.lf.spot === e.lf.home; }
  setAct(e, act) { const lf = e.lf; lf.act = act; e.label = [lf.nm, lf.job, act].filter(Boolean).join(' · '); }
  say(e, text, style, life) { if (this.map.mode !== 'ambient' || e.hide) return; e.bubble = this.map.bub(text, style || 'say', life || 2); }
  prop(e, p, t) { e.lf.prop = p; e.lf.propT = t || 0; }
  workAct(e) {
    const j = e.lf.job || '';
    if (/상황|관제|통합방위|정보|통신|드론/.test(j)) return '상황 모니터링';
    if (/작전|훈련부사관|과장|군수/.test(j)) return '작전 업무';
    if (j === '대대장') return '지휘 통제';
    if (/행정|부중대장|반장/.test(j)) return '행정 업무';
    if (/수송관|배차|수송부/.test(j)) return '배차 관리';
    return '근무 중';
  }

  // ================= 역할별 다음 할 일 =================
  next(e) {
    const f = this['r_' + e.lf.role];
    return f ? f.call(this, e) : [this.wait(3)];
  }
  // ---- 용사 ----
  r_troop(e) {
    const lf = e.lf, W = this.W;
    if (lf.group === 'combat') return [this.go('pgN', { act: '전투 훈련 복귀' }), this.ctl(this.parade)];
    const opts = [];
    const md = this.messDemand();
    if (md > 0 && this.queue.capacity() > 0) opts.push(['eat', 1.5 * md]);
    if (lf.room) opts.push(['rest', 1.0]);
    if (W.gym && W.gym.spots.some((s) => this.free(s, e))) opts.push(['gym', 0.75]);
    const open = this.parade.open();
    if (open > 0 && e.type !== 'trainee') opts.push(['train', 0.35 + 0.22 * Math.min(open, 5)]);
    opts.push(['water', 0.16]);
    if (lf.room) opts.push(['laundry', 0.08]);
    opts.push(['errand', 0.07]);
    opts.forEach((o) => { if (o[0] === lf.last) o[1] *= (o[0] === 'rest' ? 0.6 : 0.3); });
    const id = wpick(opts) || 'rest';
    lf.last = id;
    const p = this['a_' + id] ? this['a_' + id](e) : null;
    return p && p.length ? p : (lf.room ? this.a_rest(e) : [this.wait(3)]);
  }
  // 식당 수요: 앉은·줄 선 사람에 '식당 가는 중'인 사람까지 세어 한꺼번에 몰리지 않게
  messDemand() {
    if (this.mdT === this.t) return this.mdV;
    let n = this.queue.count(), bound = 0;
    this.W.messSeats.forEach((s) => { if (s.occ) n++; });
    for (const e of this.list) { const p = e.lf.plan; for (let i = 0; i < p.length; i++) if (p[i].ctl === this.queue && !p[i].on) { bound++; break; } }
    // 식당까지 걷는 길이 길어(30~40초) 가는 사람은 절반만 센다. 목표: 48석 중 30석 안팎
    this.mdT = this.t; this.mdV = bound > 14 ? 0 : clamp((36 - n - bound * 0.5) / 7, 0, 1.6);
    return this.mdV;
  }
  eatPlan(e) {
    return [this.call((en) => this.setAct(en, '식당 이동')), this.go(this.W.spots.qIn), this.ctl(this.queue), this.call((en) => this.afterQueue(en))];
  }
  a_eat(e) { return this.eatPlan(e); }
  afterQueue(e) {
    const free = this.W.messSeats.filter((s) => this.free(s, e));
    if (!free.length) { this.prop(e, null); return; }
    const s = pick(free); this.claim(e, s);
    e.lf.plan.splice(1, 0, this.go(s, { act: '식판 들고 이동' }), ...this.eatFromSeat(e, s, rnd(85, 140)));
  }
  eatFromSeat(e, s, dur) {
    const W = this.W;
    const out = [
      this.stay(s, dur, '식사 중', { tray: true, fn0: (en) => this.prop(en, null), every: 18, fn: (en) => { if (Math.random() < 0.12 && this.chatOK()) this.say(en, pick(T.diner), 'say', 1.8); } }),
      this.call((en) => {
        this.prop(en, 'trayE');
        const r = W.rets.filter((q) => this.free(q, en)), ret = r.length ? pick(r) : pick(W.rets);
        if (r.length) this.claim(en, ret);
        en.lf.plan.splice(1, 0, this.go(ret, { act: '식판 반납' }), this.stay(r.length ? ret : null, 1.3, '식판 반납', { dir: 'up' }));
      }),
      this.call((en) => this.prop(en, null))
    ];
    if (Math.random() < 0.25) out.push(this.call((en) => { const c = W.spots.cafeC; if (this.claim(en, c)) en.lf.plan.splice(1, 0, this.go(c), this.stay(c, 3.2, '카페 · 음료 주문', { fn0: (x) => this.cafeServe(x) }), this.call((x) => this.prop(x, 'cup', 50))); }));
    return out;
  }
  // 바리스타 로봇은 job A가 카페 소품으로 그린다 — 평소엔 그 자리 위에 한마디만 띄운다
  cafeServe(e) { if (this.chatOK()) this.life.later(1.2, () => { if (this.chatOK() && this.life.fx) this.life.fx.label(...MESS(425, 284), pick(T.barista), 'agent', { life: 2.2 }); }); }
  a_rest(e) {
    const R = e.lf.room; if (!R) return null;
    const out = [], n = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const opt = wpick([['seat', 1], ['bed', 1.2], ['locker', 0.8], ['tv', 0.6], ['wander', 0.7]]);
      let s = null, t = 10, act = R.name + ' · 휴식';
      if (opt === 'seat') { s = R.seats.find((q) => this.free(q, e)); t = rnd(30, 75); act = R.name + ' · 담소'; }
      else if (opt === 'bed') { s = pick(R.beds.filter((q) => this.free(q, e))); t = rnd(40, 95); act = R.name + ' · 침상 휴식'; }
      else if (opt === 'locker') { s = pick(R.lockers.filter((q) => this.free(q, e))); t = rnd(7, 14); act = R.name + ' · 관물대 정리'; }
      else if (opt === 'tv' && R.tv && this.free(R.tv, e)) { s = R.tv; t = rnd(30, 70); act = R.name + ' · TV 시청'; }
      if (s && this.claim(e, s)) {
        out.push(this.go(s), this.stay(s, t, act, { every: 22, fn: (en) => { if (Math.random() < 0.15 && this.chatOK()) this.say(en, pick(T.room), 'say', 1.8); } }));
      } else {
        const c = { x: Math.round((R.rect.x0 + R.rect.x1) / 2), y: R.mid, node: R.node, appr: [], lane: 'R:' + R.name, dir: 'down' };
        out.push(this.go(c, { act: R.name + ' · 휴식' }), this.wander(R, rnd(10, 24), R.name + ' · 휴식'));
      }
    }
    return out;
  }
  a_gym(e) {
    const G = this.W.gym; if (!G) return null;
    const s = pick(G.spots.filter((q) => this.free(q, e)));
    if (!s || !this.claim(e, s)) return null;
    const k = String(s.kind || ''), what = s.run ? '러닝머신' : /cycle|bike/i.test(k) ? '실내 자전거' : /row/i.test(k) ? '로잉머신' : /bench|press/i.test(k) ? '벤치프레스' : /mat|stretch/i.test(k) ? '스트레칭' : '웨이트 트레이닝';
    return [this.go(s, { act: G.name + ' 이동' }), this.stay(s, rnd(60, 120), G.name + ' · ' + what, { run: !!s.run, every: 20, fn: (en) => { en.lf.ping = 1.2; if (Math.random() < 0.2 && this.chatOK()) this.say(en, pick(T.gymUser), 'say', 1.6); } })];
  }
  a_train(e) { return [this.go('pgN', { act: '연병장 이동' }), this.ctl(this.parade)]; }
  a_water(e) {
    const s = this.W.spots.bkWater;
    if (!this.claim(e, s)) return null;
    return [this.go(s, { act: '정수기 이동' }), this.stay(s, 3, '물 보충', { done: (en) => this.prop(en, 'bottle', 60) })];
  }
  a_laundry(e) {
    const s = this.W.spots.laundry;
    if (!this.claim(e, s)) return null;
    return [this.call((en) => this.prop(en, 'laundry')), this.go(s, { act: '세탁물 운반' }), this.stay(s, 2, '세탁물 수거함', { done: (en) => this.prop(en, null) })];
  }
  a_errand(e) {
    const A = pick(this.W.adminRooms); if (!A) return null;
    const s = A.visit; if (!this.claim(e, s)) return null;
    return [this.call((en) => this.prop(en, 'doc')), this.go(s, { act: A.name + ' 방문' }), this.stay(s, 5, A.name + ' · 서류 제출', { fn0: (en) => this.report(en, A) }), this.call((en) => this.prop(en, null))];
  }
  report(e, A) {
    const chief = A.chief.owner;
    if (!this.chatOK()) return;
    this.say(e, pick(T.report), 'say', 1.6);
    if (chief && chief.lf.spot === A.chief) this.life.later(1.4, () => this.say(chief, pick(T.reportReply), 'say', 1.6));
  }
  chatOK() { return this.map.mode === 'ambient' && !this.life.quiet(); }

  // ---- 자리 근무 (상황실·행정반·수송부 행정반) ----
  r_seat(e) {
    const lf = e.lf, W = this.W;
    if (!this.atHome(e)) return this.goHome(e, rnd(90, 300));
    const sp = W.spots, c = [];
    const j = lf.job || '';
    c.push([pick(W.hqBreak.slice(0, 5)), 0.35], [sp.board, 0.25], [sp.coffee, 0.22], [sp.water, 0.14], [sp.printer, 0.14]);
    if (/통신/.test(j)) c.push([sp.radio, 0.5]);
    const s = wpick(c.filter((q) => this.free(q[0], e)));
    if (!s) return this.goHome(e, rnd(60, 160));
    return [].concat(this.visit(e, s, rnd(6, 14), s.act) || [], this.goHome(e, rnd(100, 320)));
  }
  r_cmdr(e) {
    if (!this.atHome(e)) return this.goHome(e, rnd(160, 380));
    const s = wpick([[this.W.spots.wall2, 1], [this.W.spots.board, 1]].filter((q) => this.free(q[0], e)));
    return [].concat((s && this.visit(e, s, rnd(8, 14), s === this.W.spots.board ? '작전 상황판 검토' : '통합관제 현황 확인')) || [], this.goHome(e, rnd(200, 420), '지휘 통제'));
  }
  r_admin(e) {
    if (!this.atHome(e)) return this.goHome(e, rnd(80, 260));
    const A = e.lf.home.room, sp = this.W.spots;
    const opts = [[A.printer, 0.4], [A.files, 0.3], [A.visit, 0.3], [sp.bkWater, 0.15], [sp.board, 0.05]].filter((q) => this.free(q[0], e));
    const s = wpick(opts); if (!s) return this.goHome(e, rnd(60, 160));
    const pre = s === sp.board ? [this.call((en) => this.prop(en, 'doc'))] : [];
    const st = this.visit(e, s, s === sp.board ? rnd(8, 12) : rnd(4, 9), s === sp.board ? '상황실 보고' : (s === A.visit ? '결재 보고' : s.act), { fn0: (en) => { if (s === A.visit) this.report(en, A); } });
    return [].concat(pre, st || [], [this.call((en) => this.prop(en, null))], this.goHome(e, rnd(100, 300)));
  }
  r_chief(e) {
    if (!this.atHome(e)) return this.goHome(e, rnd(150, 360));
    const A = e.lf.home.room;
    const s = pick(A.seats.filter((q) => q.occ && q.owner && q.owner.lf.spot === q));
    if (!s) return this.goHome(e, rnd(120, 300));
    const lp = s.appr[1], behind = { x: lp[0] + 11, y: lp[1], node: s.node, appr: [s.appr[0]], lane: s.lane, dir: 'up' };
    return [this.go(behind, { act: '업무 점검' }), this.wait(5, { dir: 'up', act: '업무 점검' }),
      this.call((en) => { if (this.chatOK() && Math.random() < 0.5) this.say(en, '수고 많다.', 'say', 1.5); })].concat(this.goHome(e, rnd(160, 360)));
  }
  r_tadmin(e) {
    if (!this.atHome(e)) return this.goHome(e, rnd(90, 260));
    const j = e.lf.job || '';
    if (/수송관|배차/.test(j) && Math.random() < 0.6) {
      const v = pick(this.W.vehicles.filter((q) => this.free(q.spot, e)));
      if (v) return [].concat(this.visit(e, v.spot, rnd(6, 10), v.name + ' 배차 확인', { fn0: (en) => this.prop(en, null) }) || [], this.goHome(e, rnd(120, 280)));
    }
    return [this.stay(e.lf.home, rnd(60, 160), this.workAct(e))];
  }
  r_duty(e) {
    if (!this.atHome(e)) return this.goHome(e, rnd(90, 200));
    const sp = this.W.spots, out = [];
    const ks = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, 2);
    ks.forEach((k) => { const s = Math.random() < 0.5 ? sp['peekL' + k] : sp['peekR' + k]; const v = this.visit(e, s, 3, '생활관 순찰'); if (v) out.push(...v); });
    out.push(this.call((en) => { if (this.chatOK() && Math.random() < 0.4) this.say(en, pick(T.duty), 'say', 1.6); }));
    return out.concat(this.goHome(e, rnd(120, 260), '당직 근무'));
  }
  // ---- 급양 ----
  r_cook(e) {
    const W = this.W;
    if (Math.random() < 0.18) {
      const sv = pick(W.servers), behind = { x: sv.x + 9, y: MESS(0, 166)[1], node: 'ki', appr: [], lane: 'K', dir: 'down' };
      return [].concat(this.cookTo(e, W.kitchen[Math.floor(Math.random() * 3)], rnd(3, 5), '음식 담기'),
        [this.call((en) => this.prop(en, 'food')), this.go(behind, { act: '배식대 보충' }), this.wait(1.6, { dir: 'down', act: '배식대 보충' }),
          this.call((en) => { this.prop(en, null); if (this.chatOK() && Math.random() < 0.4) this.say(en, pick(T.cook), 'say', 1.6); })]);
    }
    const s = pick(W.kitchen.filter((q) => this.free(q, e)));
    return this.cookTo(e, s, rnd(8, 24), s && (/stove|burner/.test(s.id) ? '조리 중' : s.id === 'fridge' ? '식자재 꺼내기' : /sink/.test(s.id) ? '세척 중' : '재료 손질'));
  }
  cookTo(e, s, t, act) {
    if (!s || !this.claim(e, s)) return [this.wait(2)];
    return [this.go(s), this.stay(s, t, act, { every: 16, fn: (en) => { if (Math.random() < 0.1 && this.chatOK()) this.say(en, pick(T.cook), 'say', 1.8); } })];
  }
  r_server(e) {
    if (!this.atHome(e)) return this.goHome(e, rnd(50, 140), '배식');
    const s = pick(this.W.kitchen.filter((q) => this.free(q, e)));
    if (!s || Math.random() < 0.35) return [this.stay(e.lf.home, rnd(40, 100), '배식')];
    return [].concat(this.cookTo(e, s, rnd(4, 8), '반찬 보충 준비'), [this.call((en) => this.prop(en, 'food'))], this.goHome(e, rnd(50, 140), '배식'), [this.call((en) => this.prop(en, null))]);
  }
  r_messmgr(e) {
    const sp = this.W.spots;
    const s = wpick([[sp.kGate, 1], [sp.hallC, 0.6], [sp.hallE, 0.5], [pick(this.W.kitchen), 0.5]].filter((q) => this.free(q[0], e)));
    if (!s) return [this.wait(3)];
    const act = s === sp.kGate ? '배식 현황 확인' : (s.lane === 'K' ? '조리 위생 점검' : '식당 순회');
    return [].concat(this.visit(e, s, rnd(10, 24), act) || [this.wait(2)]);
  }
  r_tech(e) {
    const sp = this.W.spots, s = wpick([[sp.techS, 1], [sp.techN, 0.7], [sp.tools, 0.35]].filter((q) => this.free(q[0], e)));
    if (!s) return [this.wait(4)];
    return this.visit(e, s, s === sp.tools ? rnd(6, 10) : rnd(14, 30), s.act) || [this.wait(4)];
  }
  r_logibot(e) {
    const W = this.W;
    if (!this.atHome(e)) return [this.call((en) => this.prop(en, null))].concat(this.goHome(e, rnd(15, 30), '대기'));
    if (Math.random() < 0.5) return [this.stay(e.lf.home, rnd(15, 30), '대기')];
    const f = W.spots.fridge, s = pick(W.kitchen.slice(0, 5).filter((q) => this.free(q, e)));
    if (!s || !this.free(f, e)) return [this.stay(e.lf.home, 12, '대기')];
    return [].concat(this.visit(e, f, 3, '식자재 운반') || [], [this.call((en) => this.prop(en, 'box'))], this.visit(e, s, 2.5, '식자재 운반') || [], [this.call((en) => this.prop(en, null))], this.goHome(e, rnd(15, 30), '대기'));
  }
  // ---- 의무 ----
  r_medic(e) {
    const sp = this.W.spots, W = this.W;
    const sick = W.beds.filter((b) => b.occ && b.occ.lf && b.occ.lf.spot === b);
    const opts = [[sp.mDesk, 1], [sp.mConsult, 0.8], [sp.mCab, 0.35], [sp.mXray, 0.35]];
    sick.forEach((b) => opts.push([W.bedSide[W.beds.indexOf(b)], 0.9]));
    const s = wpick(opts.filter((q) => this.free(q[0], e)));
    if (!s) return [this.wait(3)];
    return this.visit(e, s, s.place === 'clinic' && s.act === '병상 회진' ? rnd(6, 10) : rnd(12, 30), s.act || '진료', { fn0: (en) => { if (s.act === '병상 회진' && this.chatOK() && Math.random() < 0.5) this.say(en, pick(T.medic), 'say', 1.8); } }) || [this.wait(3)];
  }
  // ---- 위병소·정문 ----
  r_booth(e) {
    const sp = this.W.spots;
    if (!this.atHome(e)) return this.goHome(e, rnd(40, 90));
    const s = Math.random() < 0.6 ? sp.boothWin : sp.boothBox;
    return [].concat(this.visit(e, s, rnd(6, 12), s.act, { fn0: (en) => { if (this.chatOK() && Math.random() < 0.3) this.say(en, pick(T.booth), 'say', 1.6); } }) || [], this.goHome(e, rnd(40, 100)));
  }
  r_guard(e) {
    if (!this.atHome(e)) return this.goHome(e, rnd(10, 25), '경계 근무');
    const h = e.lf.home;
    return [this.wait(1.4, { dir: Math.random() < 0.5 ? 'left' : 'right' }), this.stay(h, rnd(10, 24), '경계 근무')];
  }
  r_no7(e) {
    if (!this.atHome(e)) return this.goHome(e, rnd(6, 12), '출입 관제');
    return [this.wait(1.2, { dir: pick(['down', 'left', 'left']) }), this.stay(e.lf.home, rnd(6, 14), '출입 관제')];
  }
  // ---- 연병장 ----
  r_captain(e) {
    if (!this.atHome(e)) return this.goHome(e, rnd(40, 80), '훈련 지휘');
    const ph = this.parade.phase;
    if ((ph === 'run' || ph === 'drill') && Math.random() < 0.3 && this.free(this.W.spots.standLow, e)) return [].concat(this.visit(e, this.W.spots.standLow, rnd(10, 16), '훈련 감독') || [], this.goHome(e, rnd(30, 60), '훈련 지휘'));
    return [this.stay(e.lf.home, rnd(15, 30), '훈련 지휘')];
  }
  r_waterbot(e) {
    const P = this.parade, sit = P.sitters().filter((x) => !x.lf.prop);
    if (sit.length && !this.life.quiet() && (this.t - (e.lf.lastVisit || -99)) > 30) {
      e.lf.lastVisit = this.t;
      const out = [this.call((en) => this.prop(en, 'water'))];
      sit.slice(0, 3).forEach((m) => {
        out.push(this.go(null, { pts0: [[m.x + 11, m.y + 2]], anchor: 'pgN', act: '급수 지원' }), this.wait(1.2, { dir: 'left' }), this.call((en) => { if (m.lf && m.half) { this.prop(m, 'bottle', 40); if (this.chatOK() && Math.random() < 0.4) this.say(en, pick(T.water), 'agent', 1.8); } }));
      });
      return out.concat([this.call((en) => this.prop(en, null))], this.goHome(e, rnd(10, 20), '급수 대기'));
    }
    return this.atHome(e) ? [this.stay(e.lf.home, rnd(6, 12), '급수 대기')] : this.goHome(e, 10, '급수 대기');
  }
  // ---- 수송부 ----
  r_motor(e) {
    if (!this.atHome(e)) return this.goHome(e, rnd(30, 80));
    const h = e.lf.home;
    if (Math.random() < 0.55) return [this.stay(h, rnd(30, 70), h.act, { every: 20, fn: (en) => { if (this.chatOK() && Math.random() < 0.12) this.say(en, pick(T.motor), 'say', 1.6); } })];
    const v = pick(this.W.vehicles.filter((q) => this.free(q.spot, e)));
    if (!v) return [this.stay(h, 30, h.act)];
    return [this.call((en) => this.prop(en, 'toolbox'))].concat(this.visit(e, v.spot, rnd(8, 14), v.name + ' 점검') || [], [this.call((en) => this.prop(en, null))], this.goHome(e, rnd(40, 90)));
  }
  r_motorWalk(e) {
    const v = pick(this.W.vehicles.filter((q) => this.free(q.spot, e)));
    if (!v) return [this.wait(4)];
    return [this.call((en) => this.prop(en, 'toolbox'))].concat(this.visit(e, v.spot, rnd(8, 16), v.name + ' 일일 점검') || [this.wait(3)]);
  }
  r_maintbot(e) {
    if (!this.atHome(e)) return [this.call((en) => this.prop(en, null))].concat(this.goHome(e, rnd(20, 40), '충전 대기'));
    if (Math.random() < 0.5) return [this.stay(e.lf.home, rnd(20, 40), '충전 대기')];
    const v = pick(this.W.vehicles.filter((q) => this.free(q.spot, e)));
    if (!v) return [this.stay(e.lf.home, 20, '충전 대기')];
    return [].concat(this.visit(e, v.spot, rnd(6, 10), v.name + ' 센서 점검', { fn0: (en) => { en.lf.beam = 6; } }) || [], this.goHome(e, rnd(20, 40), '충전 대기'));
  }
  r_civ(e) {
    const sp = this.W.spots;
    const opts = [[sp.office, 1], [sp.tools, 0.5]];
    const v = pick(this.W.vehicles); if (v) opts.push([v.spot, 0.6]);
    const s = wpick(opts.filter((q) => this.free(q[0], e)));
    if (!s) return [this.wait(3)];
    return this.visit(e, s, rnd(10, 26), s.act) || [this.wait(3)];
  }
  // ---- 순찰 ----
  r_patrol(e) {
    const loop = ['nw0', 'nwP', 'nwE', 'neW', 'neL', 'neE', 'seE', 'seB', 'seW', 'swE', 'swP', 'swC', 'sw0'];
    const out = []; let k = Math.floor(Math.random() * 2);
    loop.forEach((id, i) => {
      out.push(this.go(id, { act: '부대 순찰' }));
      if (i % 4 === k) out.push(this.wait(2, { act: '부대 순찰' }), this.call((en) => { if (this.chatOK() && Math.random() < 0.3) this.say(en, pick(T.patrol), 'say', 1.6); }));
    });
    return out;
  }
  r_patrolF(e) { e.lf.noGreet = true; this.setAct(e, '부대 순찰'); return [{ k: 'follow' }]; }
  // ---- 출퇴근 간부·군무원 ----
  r_commuter(e) {
    const lf = e.lf, sp = this.W.spots;
    if (lf.cs === 'off') return [this.wait(2)];
    if (lf.cs === 'on' && this.t > (lf.onUntil || 0) && this.map.mode === 'ambient') {
      lf.cs = 'leaving';
      return [this.go(sp.offBase, { act: '외부 업무 출발' }), this.call((en) => { en.lf.fade = 0; }), { k: 'fade', to: 0 }, this.call((en) => { en.lf.cs = 'off'; en.lf.offUntil = this.t + rnd(90, 200); this.map.stats.present = Math.max(380, this.map.stats.present - 1); })];
    }
    const A = this.W.adminRooms[1], c = lf.civ
      ? [[sp.hallE, 0.6], [sp.laundry, 0.4], [sp.bkWater, 0.4], [sp.tools, 0.5], [sp.printer, 0.3]]
      : [[sp.board, 0.8], [A ? A.visit : sp.board, 0.6], [sp.wall3, 0.4], [sp.peekL1, 0.3], [sp.coffee, 0.3]];
    const s = wpick(c.filter((q) => q[0] && this.free(q[0], e)));
    if (!s) return [this.wait(4)];
    const act = lf.civ ? '시설 점검' : (s === sp.board ? '일일 상황 회의' : s === (A && A.visit) ? '행정반 업무 협의' : '부대 업무');
    return this.visit(e, s, rnd(14, 34), act) || [this.wait(4)];
  }
  r_coach(e) {
    const G = this.W.gym; if (!G) return [this.wait(5)];
    const busy = G.spots.filter((s) => s.occ && s.occ.lf && s.occ.lf.spot === s);
    if (busy.length && Math.random() < 0.7) {
      const s = pick(busy), side = s.x < (G.x0 + G.x1) / 2 ? 12 : -12, cx = clamp(s.x + side, G.x0 + 6, G.x1 - 6), ly = G.ly || s.y;
      return [this.go(null, { pts0: [[e.x, ly], [cx, ly], [cx, clamp(s.y + 4, G.y0 + 6, G.y1 - 2)]], anchor: 'gymE', lane: 'G', act: '체력단련 코칭' }), this.wait(5, { act: '체력단련 코칭' }), this.call((en) => { this.face(en, s); if (this.chatOK() && Math.random() < 0.6) this.say(en, pick(T.gymCoach), 'say', 2); if (s.occ) s.occ.lf.ping = 1.2; }),
        this.wait(2.5, { act: '체력단련 코칭' }), this.go(null, { pts0: [[cx, ly]], anchor: 'gymE', lane: 'G', act: '체력단련 코칭' })];
    }
    return this.goHome(e, rnd(6, 12), '체력단련 코칭');
  }

  // ================= 인사(경례) =================
  greetStep(dt) {
    this.encT -= dt;
    this.encOpen = this.encOpen.filter((q) => q > this.t);
    if (this.encT > 0) return;
    this.encT = 0.3;
    if (this.map.mode !== 'ambient' || this.t < this.encCD || this.encOpen.length >= 2) return;
    const C = [];
    for (const e of this.list) {
      const lf = e.lf;
      if (lf.robot || lf.scen || lf.noGreet || e.hide || e.actor || e.half || e.alpha < 0.95 || this.t < lf.greetCD) continue;
      const st = lf.plan[0];
      if (!st || !st.on || (st.k !== 'go' && st.k !== 'stay' && st.k !== 'wait')) continue;
      C.push(e);
    }
    for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
      const a = C[i], b = C[j], dx = b.x - a.x, dy = b.y - a.y;
      if (dx > 18 || dx < -18 || dy > 12 || dy < -12) continue;
      if (!a.moving && !b.moving) continue;
      const va = DV[a.dir], vb = DV[b.dir];
      const ok = (a.moving && va[0] * dx + va[1] * dy > 4 && (!b.moving || vb[0] * dx + vb[1] * dy < -4)) || (b.moving && vb[0] * dx + vb[1] * dy < -4 && !a.moving);
      if (!ok) continue;
      if (this.meet(a, b)) return;
    }
  }
  meet(a, b) {
    // 먼저 인사하는 쪽(jr)과 받는 쪽(sr): 하급자가 상급자에게 경례, 군무원과는 인사말
    let jr = a.lf.rv <= b.lf.rv ? a : b, sr = jr === a ? b : a;
    let l1, l2, sal = false;
    if (jr.lf.civ || sr.lf.civ) {
      if (jr.lf.civ && sr.lf.civ) { l1 = pick(T.civ); l2 = pick(T.civReply); }
      else { const civ = jr.lf.civ ? jr : sr; jr = civ === jr ? sr : jr; sr = civ; l1 = jr.lf.rv >= 11 ? pick(T.offPeer) : pick(T.toCiv); l2 = pick(T.civReply); }
    } else {
      const J = jr.lf, S = sr.lf;
      if (S.rv >= 11 && J.rv < S.rv) { l1 = pick(T.salute); l2 = S.rv >= 21 ? pick(T.replyOff) : pick(T.replyNco); sal = true; }
      else if (S.rv >= 11) { l1 = pick(T.offPeer); l2 = pick(T.offPeerReply); }
      else if (J.rv < S.rv) { l1 = pick(T.toSenior); l2 = pick(T.replySenior); }
      else { if (Math.random() < 0.5) return false; l1 = pick(T.peer); l2 = pick(T.peerReply); }
    }
    const cd = () => this.t + rnd(50, 100);
    a.lf.greetCD = cd(); b.lf.greetCD = cd(); this.encCD = this.t + 2.2; this.encOpen.push(this.t + 1.8);
    jr.lf.plan.unshift({ k: 'greet', t: 1.5, other: sr, say: l1, delay: 0, salute: sal });
    sr.lf.plan.unshift({ k: 'greet', t: 1.5, other: jr, say: l2, delay: 0.55 });
    return true;
  }

  // ================= 매 프레임 =================
  step(dt) {
    this.t += dt;
    if (!this.typed) { this.typed = true; const TY = this.map.TYPES || {}; this.list.forEach((e) => { if (e.wantType && TY[e.wantType]) e.type = e.wantType; }); }
    this.gate.step(dt); this.queue.step(dt); this.parade.step(dt);
    this.greetStep(dt);
  }

  // ================= 소품·표시 =================
  drawEnt(c, e, t) {
    const lf = e.lf; if (!lf || e.kind !== 'ch') return;
    const map = this.map, W = (x, y, w, h, col) => map.wrect(c, x, y, w, h, col);
    c.globalAlpha = Math.max(0, Math.min(1, e.alpha));
    if (lf.tray && lf.tray.seat && e.half) {
      const s = lf.tray.seat, tx = s.sx - 5, ty = s.tb[1] + (s.side ? 8.5 : 1.5);
      this.trayArt(c, tx, ty, lf.tray.p);
      if (s.side) this.redraw(c, e);
    }
    if (lf.prop) this.drawProp(c, e, lf.prop);
    if (map.mode !== 'ambient') { c.globalAlpha = 1; return; } // 시연 중엔 경보·핑 같은 평소 효과를 얹지 않는다
    if (lf.salute > 0 && !e.half) { const hx = e.dir === 'left' ? e.x - 5 : e.x + 3.5; W(hx, e.y - 20, 2, 1.5, '#F3CBA5'); }
    if (lf.ping > 0) {
      const g = map.w2s(e.x + (e.dir === 'left' ? -4 : 4), e.y - (e.half ? 8 : 10)), S = 10 * map.z * (1.4 - lf.ping * 0.3);
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, lf.ping) * 0.8 * e.alpha; c.drawImage(map.glow('41,224,255'), g[0] - S / 2, g[1] - S / 2, S, S); c.globalCompositeOperation = 'source-over';
    }
    if (lf.alert > 0 && e.type !== 'pt') {
      const k = (t * 1.6) % 1, q = map.w2s(e.x, e.y - (e.half ? 10 : 12)), z = map.z;
      c.globalAlpha = (1 - k) * e.alpha; c.strokeStyle = '#FF4D4D'; c.lineWidth = Math.max(1, z / 2);
      c.strokeRect(q[0] - (5 + 9 * k) * z, q[1] - (5 + 9 * k) * z, (10 + 18 * k) * z, (10 + 18 * k) * z);
    }
    if (lf.beam > 0 && e.type === 'robot') {
      const v = this.W.vehicles.find((q) => q.spot === lf.spot);
      if (v) {
        const a = Math.min(1, lf.beam) * (0.5 + 0.3 * Math.sin(t * 8)), p0 = map.w2s(e.x, e.y - 17), pa = map.w2s(v.x - 10, v.y + (v.y < 155 ? 10 : -10)), pb = map.w2s(v.x + 10, v.y + (v.y < 155 ? 10 : -10));
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = a * 0.35; c.fillStyle = '#29BDFD';
        c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(pa[0], pa[1]); c.lineTo(pb[0], pb[1]); c.closePath(); c.fill();
        c.globalCompositeOperation = 'source-over';
      }
    }
    c.globalAlpha = 1;
  }
  redraw(c, e) {
    const map = this.map, z = map.z, fr = e.moving ? [1, 0, 2, 0][Math.floor(e.anim * 8) % 4] : 0, s = map.sprite(e.type, e.rank, e.dir, fr);
    if (e.half) map.drawSeated(c, e);
    else { const p = map.w2s(e.x - 8, e.y - 24); c.drawImage(s, p[0], p[1], 16 * z, 24 * z); }
  }
  trayArt(c, x, y, p) {
    const W = (a, b, w, h, col) => this.map.wrect(c, a, b, w, h, col);
    W(x, y, 10, 6.5, '#9DA4AB'); W(x + 0.5, y + 0.5, 9, 5.5, '#C9CED3');
    if (p < 0.85) W(x + 1, y + 1, 3.5, 2.5, '#F6F4EC');
    if (p < 0.6) W(x + 5.5, y + 1, 3.5, 2.5, '#C2522C');
    if (p < 0.4) W(x + 1, y + 4, 2.5, 1.5, '#5E9A3A');
    if (p < 0.7) W(x + 4, y + 4, 2, 1.5, '#E0A23A');
    if (p < 0.3) W(x + 6.5, y + 4, 2.5, 1.5, '#B83A2A');
    W(x + 10.5, y + 1, 1.5, 2, '#E8ECEF');
  }
  drawProp(c, e, p) {
    const W = (a, b, w, h, col) => this.map.wrect(c, a, b, w, h, col), x = e.x, y = e.y, d = e.dir;
    const hand = d === 'left' ? x - 6.5 : (d === 'right' ? x + 4.5 : (d === 'up' ? x - 6 : x + 4));
    if (p === 'tray' || p === 'trayE') {
      if (d === 'up') { W(x - 6.5, y - 12, 13, 4, '#9DA4AB'); this.redraw(c, e); return; }
      const tx = d === 'left' ? x - 10 : (d === 'right' ? x + 1 : x - 5), tw = d === 'down' ? 10 : 9;
      W(tx, y - 11, tw, 4.5, '#9DA4AB'); W(tx + 0.5, y - 10.5, tw - 1, 3.5, '#C9CED3');
      if (p === 'tray') { W(tx + 1, y - 10, 2.5, 1.5, '#F6F4EC'); W(tx + 4, y - 10, 2.5, 1.5, '#C2522C'); W(tx + tw - 3, y - 9, 2, 1.5, '#5E9A3A'); }
    } else if (p === 'bottle') { if (d !== 'up') { W(hand, y - 12, 1.8, 4.5, '#BFE6FF'); W(hand, y - 12.5, 1.8, 1, '#2E6FA0'); } }
    else if (p === 'cup') { if (d !== 'up') { W(hand, y - 11, 2.2, 2.8, '#F2EEE6'); W(hand, y - 11, 2.2, 0.8, '#6B4A2A'); } }
    else if (p === 'doc') { if (d !== 'up') { W(hand - 0.5, y - 12, 3.5, 4.5, '#F4F4F0'); W(hand, y - 11, 2.5, 0.5, '#7D9AB8'); W(hand, y - 10, 2, 0.5, '#7D9AB8'); } }
    else if (p === 'toolbox') { W(hand - 1, y - 7.5, 5.5, 3.5, '#C62A30'); W(hand - 1, y - 7.5, 5.5, 0.8, '#E86A6E'); W(hand + 0.8, y - 8.5, 2, 1, '#2A2A2A'); }
    else if (p === 'laundry') { const bx = d === 'up' ? x - 4 : (d === 'left' ? x + 1 : x - 7); W(bx, y - 21, 7, 9, '#E4E0D2'); W(bx, y - 21, 7, 1, '#F6F3EA'); W(bx + 2.5, y - 22, 2, 1.5, '#6A6E74'); }
    else if (p === 'food') { const fx = d === 'left' ? x - 10 : (d === 'right' ? x + 1 : x - 5); if (d === 'up') { W(x - 6, y - 13, 12, 4, '#B8BEC5'); this.redraw(c, e); return; } W(fx, y - 12, 9, 4, '#B8BEC5'); W(fx, y - 12, 9, 1, '#E2E6EA'); W(fx + 1, y - 11, 7, 1.5, '#C2522C'); }
    else if (p === 'box') { if (d === 'up') { W(x - 5.5, y - 16, 11, 7, '#B8834F'); this.redraw(c, e); return; } W(x - 5, y - 16, 10, 7, '#B8834F'); W(x - 5, y - 16, 10, 1, '#D6A574'); W(x - 0.5, y - 16, 1, 7, '#E3C48A'); }
    else if (p === 'boxes') { W(x - 5, y - 21, 10, 12, '#B8834F'); W(x - 5, y - 15.5, 10, 0.8, '#8A5E36'); W(x - 0.5, y - 21, 1, 12, '#E3C48A'); }
    else if (p === 'water') { W(x - 5, y - 15, 10, 6, '#2E6FA0'); for (let k = 0; k < 4; k++) W(x - 4.5 + k * 2.4, y - 18, 1.6, 4, '#BFE6FF'); }
  }
}

// ---- 배식 대기줄: 한 칸씩 앞으로, 배식 칸에선 잠깐 머문다 ----
class Queue {
  constructor(A) { this.A = A; this.slots = new Array(A.W.queueX.length).fill(null); this.hold = []; this.srvCD = [0, 0, 0]; }
  // 처음부터 줄 서 있던 사람은 가장 가까운 칸에 그대로
  setup() {
    const X = this.A.W.queueX;
    this.A.list.forEach((e) => {
      const st = e.lf.plan[0]; if (!st || st.k !== 'ctl' || st.ctl !== this) return;
      let bi = -1, bd = 1e9; X.forEach((x, i) => { if (!this.slots[i] && Math.abs(x - e.x) < bd) { bd = Math.abs(x - e.x); bi = i; } });
      if (bi < 0) return;
      st.on = true; this.slots[bi] = e; e.lf.q = { slot: bi, t: rnd(0.5, 2) }; this.A.setAct(e, '배식 대기'); this.A.prop(e, 'trayE');
    });
  }
  count() { return this.hold.length + this.slots.filter(Boolean).length; }
  capacity() { return 11 - this.count(); }
  join(e) { if (this.hold.indexOf(e) < 0 && this.slots.indexOf(e) < 0) this.hold.push(e); e.lf.q = { slot: -1, t: 0 }; this.A.setAct(e, '배식 대기'); }
  leave(e) { const k = this.hold.indexOf(e); if (k >= 0) this.hold.splice(k, 1); const s = this.slots.indexOf(e); if (s >= 0) this.slots[s] = null; e.lf.q = null; }
  atFor(e) { return e.x > MESS(200, 0)[0] ? { node: 'm0e', back: [[e.x + 20, MESS(0, 212)[1]]], lane: null } : { node: 'm0w', back: [], lane: null }; }
  step(dt) {
    for (let i = 0; i < this.srvCD.length; i++) this.srvCD[i] -= dt;
    // 사라진(시나리오·시연) 사람 정리
    this.hold = this.hold.filter((e) => e.lf && e.lf.q && !e.actor);
    for (let i = 0; i < this.slots.length; i++) { const e = this.slots[i]; if (e && (!e.lf || !e.lf.q || e.actor)) this.slots[i] = null; }
  }
  drive(e, dt) {
    const A = this.A, W = A.W, q = e.lf.q; if (!q) return 'done';
    if (q.slot < 0) {
      const k = this.hold.indexOf(e);
      if (k === 0 && !this.slots[0]) { this.hold.shift(); this.slots[0] = e; q.slot = 0; q.t = 0.5; }
      else { const h0 = MESS(110, 214), hx = h0[0], hy = h0[1] + Math.max(0, k) * 12; if (A.mv(e, hx, hy, e.lf.speed, dt)) { e.moving = false; e.dir = k === 0 ? 'right' : 'up'; } return; }
    }
    const sx = W.queueX[q.slot], sy = W.queueY;
    if (!A.mv(e, sx, sy, e.lf.speed * 0.8, dt)) return;
    e.moving = false; e.dir = 'up';
    if (q.t > 0) {
      q.t -= dt;
      const si = W.serveSlots[q.slot];
      if (si != null && !q.served) { q.served = q.slot; const sv = W.servers[si].owner; if (sv && sv.lf.spot === W.servers[si] && this.srvCD[si] <= 0 && Math.random() < 0.25 && A.chatOK()) { this.srvCD[si] = rnd(8, 14); A.say(sv, pick(T.server), 'say', 1.6); } }
      return;
    }
    if (q.slot === this.slots.length - 1) { this.slots[q.slot] = null; e.lf.q = null; A.prop(e, 'tray'); A.setAct(e, '배식 완료'); e.lf.at = { node: 'm0e', back: [MESS(330, 212)], lane: null }; return 'done'; }
    if (!this.slots[q.slot + 1]) { this.slots[q.slot] = null; q.slot++; this.slots[q.slot] = e; q.served = false; q.t = W.serveSlots[q.slot] != null ? rnd(1.0, 1.8) : 0.3; if (W.serveSlots[q.slot] != null) A.prop(e, 'trayE'); }
  }
}

// ---- 연병장: 체력단련 소대(집합→훈시→체조→구보→휴식)와 전투 훈련조(트랙 구보) ----
const F_SLOT = (i) => PAR(580 + (i % 5) * 18, 604 + Math.floor(i / 5) * 22);
const D_SLOT = (i) => PAR(556 + (i % 5) * 30, 600 + Math.floor(i / 5) * 34);
const B_SLOT = (i) => PAR(468 + (i % 5) * 17, 540 + Math.floor(i / 5) * 14);
const C_REST = (i) => PAR(463, 606 + i * 22);
const LOOP_P = [[512, 590], [720, 590], [720, 762], [512, 762]].map((p) => PAR(p[0], p[1]));
const LOOP_C = [[478, 560], [754, 560], [754, 786], [478, 786]].map((p) => PAR(p[0], p[1]));
function loopLen(L) { let s = 0; for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length]; s += Math.hypot(b[0] - a[0], b[1] - a[1]); } return s; }
function onLoop(L, s) {
  const tot = loopLen(L); s = ((s % tot) + tot) % tot;
  for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (s <= d) return [a[0] + (b[0] - a[0]) * s / d, a[1] + (b[1] - a[1]) * s / d]; s -= d; }
  return L[0].slice();
}
function loopParam(L, x, y) {
  let best = 0, bd = 1e9, acc = 0;
  for (let i = 0; i < L.length; i++) {
    const a = L[i], b = L[(i + 1) % L.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u = clamp(((x - a[0]) * (b[0] - a[0]) + (y - a[1]) * (b[1] - a[1])) / (d * d), 0, 1), px = a[0] + (b[0] - a[0]) * u, py = a[1] + (b[1] - a[1]) * u, dd = Math.hypot(px - x, py - y);
    if (dd < bd) { bd = dd; best = acc + u * d; }
    acc += d;
  }
  return best;
}
class Parade {
  constructor(A) { this.A = A; this.pt = []; this.cb = []; this.phase = 'assemble'; this.t = 0; this.minT = 7; this.sP = 0; this.sC = 0; this.cPhase = 'run'; this.cT = rnd(120, 200); this.ov = null; this.cycle = 0; this.slotOf = new Map(); this.drillT = 0; this.lenP = loopLen(LOOP_P); this.lenC = loopLen(LOOP_C); }
  setup() {
    const A = this.A;
    // 처음 상태: 집합 대형·트랙 구보 위치 그대로 이어받는다
    A.list.forEach((e) => { const st = e.lf.plan[0]; if (st && st.k === 'ctl' && st.ctl === this) { st.on = true; this.join(e); } });
    this.slotOf.clear();
    const used = new Set();
    this.pt.forEach((e) => {
      let bi = -1, bd = 1e9;
      for (let i = 0; i < 10; i++) { if (used.has(i)) continue; const p = F_SLOT(i), d = Math.hypot(p[0] - e.x, p[1] - e.y); if (d < bd) { bd = d; bi = i; } }
      if (bi >= 0) { used.add(bi); this.slotOf.set(e, bi); }
    });
    const ps = this.cb.map((e) => [e, loopParam(LOOP_C, e.x, e.y)]).sort((a, b) => b[1] - a[1]);
    this.cb = ps.map((q) => q[0]); if (ps.length) this.sC = ps[0][1];
  }
  open() { return 10 - this.pt.length; }
  sitters() { return this.pt.concat(this.cb).filter((e) => e.half && e.lf.pState === 'sit'); }
  join(e) {
    const g = e.lf.group === 'combat' || e.type === 'trainee' ? this.cb : this.pt;
    if (g.indexOf(e) < 0) g.push(e);
    if (g === this.pt && !this.slotOf.has(e)) { const used = new Set(this.slotOf.values()); for (let i = 0; i < 10; i++) if (!used.has(i)) { this.slotOf.set(e, i); break; } }
    e.lf.pN = e.lf.pN || 0; e.lf.pState = '';
    this.A.setAct(e, g === this.cb ? '전투 훈련 · 구보' : '1중대 체력단련 · ' + this.phaseName());
  }
  leave(e) {
    let k = this.pt.indexOf(e); if (k >= 0) this.pt.splice(k, 1);
    k = this.cb.indexOf(e); if (k >= 0) this.cb.splice(k, 1);
    this.slotOf.delete(e); e.lf.pLeave = false; e.lf.pState = '';
  }
  atFor() { return { node: 'pgN', back: [], lane: null }; }
  phaseName(ph) { return { assemble: '집합', brief: '훈시', drill: '체조', run: '구보', rest: '휴식', break: '휴식' }[ph || this.curP()] || '훈련'; }
  curP() { return this.ov ? this.ov.pt : this.phase; }
  curC() { return this.ov ? this.ov.cb : this.cPhase; }
  override(pt, cb, dur) { this.ov = { pt, cb, until: this.A.t + dur }; this.label(); }
  label() { this.pt.forEach((e) => this.A.setAct(e, '1중대 체력단련 · ' + this.phaseName())); this.cb.forEach((e) => this.A.setAct(e, '전투 훈련 · ' + (this.curC() === 'run' ? '구보' : '휴식'))); }
  step(dt) {
    const A = this.A;
    this.pt = this.pt.filter((e) => !e.actor && e.lf && e.lf.plan[0] && e.lf.plan[0].ctl === this);
    this.cb = this.cb.filter((e) => !e.actor && e.lf && e.lf.plan[0] && e.lf.plan[0].ctl === this);
    if (this.ov && A.t > this.ov.until) { const was = this.ov.pt; this.ov = null; if (was === 'rest') { this.phase = 'assemble'; this.t = 0; this.minT = 6; } this.cPhase = 'run'; this.cT = rnd(120, 200); this.label(); }
    if (this.curP() === 'run') this.sP += dt * 40;
    if (this.curC() === 'run') this.sC += dt * 46;
    if (!this.ov) {
      this.t += dt; this.cT -= dt;
      if (this.cT <= 0) { this.cPhase = this.cPhase === 'run' ? 'rest' : 'run'; this.cT = this.cPhase === 'run' ? rnd(120, 200) : 22; this.label(); }
      const ph = this.phase;
      let nx = null;
      if (ph === 'assemble') { const all = this.pt.every((e) => { const p = F_SLOT(this.slotOf.get(e) || 0); return Math.abs(e.x - p[0]) < 3 && Math.abs(e.y - p[1]) < 3; }); if ((this.t > this.minT && all) || this.t > 22) nx = 'brief'; }
      else if (ph === 'brief' && this.t > 11) nx = 'drill';
      else if (ph === 'drill' && this.t > 24) nx = 'run';
      else if (ph === 'run' && this.t > 40) nx = 'break';
      else if (ph === 'break' && this.t > 18) nx = 'assemble';
      if (nx) this.enterPhase(nx);
      if (this.phase === 'drill') { this.drillT -= dt; if (this.drillT <= 0) { this.drillT = rnd(7, 10); const ld = this.leader(); if (ld && A.chatOK() && Math.random() < 0.6) A.say(ld, pick(T.drill), 'say', 1.6); } }
    }
  }
  leader() { let b = null; this.pt.forEach((e) => { if (!b || e.lf.rv > b.lf.rv) b = e; }); return b; }
  enterPhase(nx) {
    const A = this.A;
    this.phase = nx; this.t = 0;
    if (nx === 'run') this.sP = 0;
    if (nx === 'brief') A.life.speech(this.pt.length);
    if (nx === 'break') { this.cycle++; this.pt.forEach((e) => { e.lf.pN++; if (e.lf.pN >= 2 && Math.random() < 0.45) e.lf.pLeave = true; }); }
    if (nx === 'assemble') this.minT = 4;
    this.label();
  }
  drive(e, dt) {
    const A = this.A, lf = e.lf;
    const isC = this.cb.indexOf(e) >= 0;
    if (!isC && this.pt.indexOf(e) < 0) return 'done';
    const ph = isC ? this.curC() : this.curP();
    if (!isC && lf.pLeave && ph === 'assemble' && !this.ov) { e.half = false; return 'done'; }
    let tgt, sp = 40, sit = false, face = 'up', run = false;
    if (isC) {
      const i = this.cb.indexOf(e);
      if (ph === 'run') { tgt = onLoop(LOOP_C, this.sC - i * 30); sp = 46; run = true; }
      else { tgt = C_REST(i); sit = true; face = 'right'; }
    } else {
      const i = this.slotOf.get(e) || 0;
      if (ph === 'assemble' || ph === 'brief') tgt = F_SLOT(i);
      else if (ph === 'drill') tgt = D_SLOT(i);
      else if (ph === 'run') { tgt = onLoop(LOOP_P, this.sP - i * 16); sp = 40; run = true; }
      else { tgt = B_SLOT(i); sit = true; face = 'down'; }
    }
    const d = Math.hypot(tgt[0] - e.x, tgt[1] - e.y);
    if (d > 0.6) {
      if (e.half) e.half = false;
      lf.pState = '';
      A.mv(e, tgt[0], tgt[1], run ? (d > 6 ? sp * 1.45 : sp) : Math.max(36, Math.min(56, d * 2)), dt);
      return;
    }
    e.x = tgt[0]; e.y = tgt[1];
    if (run) { e.moving = true; e.anim += dt * sp / 34; return; }
    e.moving = false;
    if (sit) { e.half = true; e.dir = face; lf.pState = 'sit'; return; }
    lf.pState = 'stand';
    if (ph === 'drill') { const k = Math.floor(A.t * 1.1 + (this.slotOf.get(e) || 0) * 0.5) % 4; e.dir = ['up', 'left', 'up', 'right'][k]; } else e.dir = face;
  }
}

// ---- 정문: 차량 문·보행 문 열고 닫기 (지나는 동안 붙잡아 둔다) ----
class Gate {
  constructor(A) { this.A = A; this.ped = new Set(); this.veh = new Set(); this.pedC = 0; this.vehC = 0; this.lock = null; }
  reqPed(e) { const m = this.A.map; if (!this.ped.has(e)) { if (m.mode !== 'ambient') return false; this.ped.add(e); } m.pedHold = true; m.pedT = 1; this.pedC = 0; return m.pedO > 0.8; }
  relPed(e) { this.ped.delete(e); if (!this.ped.size) this.pedC = 0.6; }
  reqVeh(v) { const m = this.A.map; if (!this.veh.has(v)) { if (m.mode !== 'ambient') return false; this.veh.add(v); } m.gateHold = true; m.gateT = 1; this.vehC = 0; return m.gateO > 0.85; }
  relVeh(v) { this.veh.delete(v); if (!this.veh.size) this.vehC = 0.3; }
  busy() { return !!this.lock || this.veh.size > 0; }
  step(dt) {
    const m = this.A.map;
    this.ped.forEach((e) => { if (e.actor || !e.lf) this.ped.delete(e); });
    if (!this.ped.size && this.pedC > 0) { this.pedC -= dt; if (this.pedC <= 0) { m.pedHold = false; m.pedT = 0; } }
    if (!this.veh.size && this.vehC > 0) { this.vehC -= dt; if (this.vehC <= 0) { m.gateHold = false; m.gateT = 0; } }
    if (m.mode !== 'ambient') { if (!this.ped.size) m.pedHold = false; if (!this.veh.size) m.gateHold = false; }
  }
}
