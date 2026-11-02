// 에이전트 분석 화면 — 평소 모드에서 맵의 에이전트(◆ 또는 이름표)를 누르면 연다
//   데이터 연결: 맵을 어둡게 하고 그 에이전트가 보는 데이터 소스만 밝혀 선으로 잇는다(패킷이 에이전트로 흘러 들어간다)
//   에이전트 콘솔: 하는 일 · 지금 하는 일 · 핵심 지표 3개 · 최근 7일 추이 · 연결된 데이터 · 사람의 결정
//   물어보기: 미리 쓴 질문 3개 — 답이 타자 효과로 나오고 근거 칩과 맵 위치가 빛난다(실시간 LLM 없음 · 문구는 모두 검수본)
// 닫기: × · Esc · 맵 빈 곳 클릭. 시연이 시작되면 닫힌다. 숫자는 평소 모드·1분 시연과 맞춘 목업이다.
const CPS = 30; // 답 타자 속도 (글자/초)

let M = null, el = null;
const S = { id: null, a: 0, side: 'right', ans: null, shown: -1, hover: -1, focus: -1, focusT: 0 };

// ---- 에이전트별 내용 (좌표는 1600×836 맵 좌표) ----
function content(map) {
  const cam = (i) => { const q = map.cams && map.cams[i - 1]; return q ? [q[0], q[1]] : null; };
  const cams = (skip) => (map.cams || []).map((q, i) => (skip && skip.includes(i + 1) ? null : [q[0], q[1]])).filter(Boolean);
  const node = (id) => [map.nodes[id].x, map.nodes[id].y];
  const drone = map.droneS ? [map.droneS[0], map.droneS[1]] : [430, 242];
  const amb = map.overlays && map.overlays.amb && map.overlays.amb[0] ? [map.overlays.amb[0][0] + 5, map.overlays.amb[0][1] + 10] : [333, 452];
  const gym = map.gym && map.gym.x1 ? [(map.gym.x0 + map.gym.x1) / 2, (map.gym.y0 + map.gym.y1) / 2] : [1016, 420];
  const tiger = map.tiger && map.tiger.x1 ? [(map.tiger.x0 + map.tiger.x1) / 2, (map.tiger.y0 + map.tiger.y1) / 2] : [188, 706];
  const BARRACKS = [1201, 541], PARADE = [540, 519], ADMIN = [1238, 469], GATE = [758, 812];
  return {
    hq: {
      role: '부대 전 구역 데이터를 모아 상황을 판단하고, 6개 에이전트에 일을 나눠 줍니다.',
      now: 'CCTV 14대 영상 분석 · 오후 일정 조율',
      kpi: [['연결 에이전트', '6/6', '전원 정상'], ['오늘 처리 보고', '128건', '어제 +7건'], ['경계 구역', '정상', 'CCTV 14대']],
      trend: ['최근 7일 처리 보고 (건)', [96, 104, 99, 118, 112, 121, 128]],
      src: [{ n: 'CCTV 14대', pts: cams() }, { n: '정찰 드론 D-2', pts: [drone] }, { n: '6개 에이전트', pts: ['gate', 'med', 'trn', 'per', 'fac', 'mess'].map(node) }, { n: '기상청 단기예보', pts: [] }],
      human: ['오후 일정 변경안', '대대장 결심 대기'],
      qa: [
        ['지금 부대 상황은?', '부대 전 구역 정상입니다. CCTV 14대 이상 없음, 오늘 출입 차량 확인 3대, 진료 예약 1건이 있습니다.', ['CCTV 14대', '출입관제', '의무지원'], 0],
        ['오후 일정에 바뀔 게 있나요?', '14시 소나기 확률이 60%입니다. 연병장 훈련을 TIGER 합성훈련장으로 옮기는 안을 대대장님께 올렸습니다.', ['기상청 단기예보', '훈련관리'], 2],
        ['최종 결정은 누가 하나요?', 'AI는 분석하고 권고합니다. 일정은 대대장님, 정비 승인은 정비담당관, 진료는 군의관이 결정합니다.', ['대대장', '정비담당관', '군의관'], -1]
      ]
    },
    gate: {
      role: '정문을 드나드는 사람과 차량을 확인하고, 울타리 CCTV 영상을 함께 분석합니다.',
      now: '번호판 인식 대기 · 방문 차량 사전 등록 확인',
      kpi: [['오늘 출입', '1,204', '07시 이후 (건)'], ['방문 차량', '2대', '사전 등록 완료'], ['확인 시간', '3초', '1건 평균']],
      trend: ['최근 7일 출입 (건)', [1120, 1180, 1090, 1240, 1210, 1160, 1204]],
      src: [{ n: '번호판 인식 카메라', pts: [cam(9)] }, { n: '안면 인식 출입구', pts: [cam(10)] }, { n: '정문 차단기', pts: [GATE] }, { n: '울타리 CCTV 12대', pts: cams([9, 10]) }],
      human: ['방문 차량 2대 출입', '위병소 근무자 최종 확인'],
      qa: [
        ['오늘 출입 현황은?', '07시 이후 출입 1,204건입니다. 미등록 차량은 없고, 방문 차량 2대는 사전 등록으로 확인했습니다.', ['번호판 인식 카메라', '출입 기록'], 0],
        ['울타리 쪽은 이상 없나요?', '울타리 CCTV 12대 모두 정상입니다. 새벽 남서쪽 움직임은 열화상 판별 결과 멧돼지였습니다.', ['CCTV 03 남서 울타리', '정찰 드론 D-2'], 3],
        ['미등록 차량이 오면요?', '차단기를 내린 채 위병소 근무자에게 알립니다. 출입 허가는 근무자가 직접 결정합니다.', ['정문 차단기', '위병소 근무자'], 2]
      ]
    },
    med: {
      role: '아미 워치의 체온·심박을 살펴 아픈 장병을 먼저 찾고, 진료 예약을 잡습니다.',
      now: '워치 412대 건강 데이터 확인 · 진료 예약 관리',
      kpi: [['연결 워치', '412대', '전 장병'], ['미열 감지', '1명', '박 상병 37.8℃'], ['진료 예약', '10:20', '군의관 진료']],
      trend: ['최근 7일 진료 (건)', [3, 2, 4, 2, 1, 2, 1]],
      src: [{ n: '아미 워치 · 생활관', pts: [BARRACKS] }, { n: '아미 워치 · 연병장', pts: [PARADE] }, { n: '의무실 진료 기록', pts: [[150, 470]] }, { n: '구급차', pts: [amb] }],
      human: ['박 상병 진료', '군의관 10:20 진료'],
      qa: [
        ['오늘 아픈 장병이 있나요?', '박 상병의 워치에서 새벽 체온 37.8℃가 감지돼 10:20 진료를 잡았습니다. 오전 체력단련은 열외 처리했습니다.', ['아미 워치', '진료 예약', '훈련관리'], 0],
        ['더운 날 훈련은요?', '기온이 31℃를 넘으면 야외 훈련 인원의 심박을 5분마다 확인하고, 위험 신호가 보이면 휴식을 권고합니다.', ['아미 워치', '기상', '훈련관리'], 1],
        ['진료는 누가 결정하나요?', 'AI는 이상 징후를 알리고 예약만 잡습니다. 진단과 처치는 군의관이 합니다.', ['군의관'], 2]
      ]
    },
    trn: {
      role: '훈련 기록과 TIGER 합성훈련 결과를 분석해 다음 훈련 계획을 제안합니다.',
      now: '1중대 체력단련 기록 · TIGER 보완 훈련 준비',
      kpi: [['TIGER 명중률', '87%', '1중대'], ['노출 시간', '-12초', '지난 훈련 대비'], ['이번 주 훈련', '14회', '3개 중대']],
      trend: ['최근 7회 TIGER 명중률 (%)', [71, 74, 76, 79, 82, 84, 87]],
      src: [{ n: '연병장 훈련 기록', pts: [PARADE] }, { n: 'TIGER 합성훈련장', pts: [tiger] }, { n: '드론 훈련 영상', pts: [drone] }, { n: '아미 워치 심박', pts: [BARRACKS] }],
      human: ['다음 주 훈련 계획 B안', '대대장 결심 대기'],
      qa: [
        ['이번 주 훈련 성과는?', '1중대는 TIGER 보완 훈련 뒤 명중률 87%, 노출 시간 12초 단축을 기록했습니다. 결과는 다음 분석에 반영합니다.', ['TIGER 합성훈련장', '훈련 기록'], 1],
        ['비가 오면 훈련은요?', '소나기 예보가 있으면 연병장 훈련을 TIGER 합성훈련장으로 옮기는 안을 만들어 통합관제 AI에 올립니다.', ['기상', 'TIGER 합성훈련장', '통합관제'], 0],
        ['훈련 계획은 누가 정하나요?', 'AI가 계획안 3가지를 비교해 올리고, 대대장님이 결심하면 각 중대에 하달됩니다.', ['대대장', '중대장'], -1]
      ]
    },
    per: {
      role: '인원 현황과 당직, 생활관 일정을 챙기고 장병 개인 기록을 정리합니다.',
      now: '생활관 인원 현황 집계 · 당직 근무표 갱신',
      kpi: [['부대 안 인원', '398명', '총원 412명'], ['외출 · 휴가', '3 · 5', '명'], ['오늘 생일자', '2명', '케이크 준비']],
      trend: ['최근 7일 부대 안 인원 (명)', [401, 396, 399, 395, 402, 397, 398]],
      src: [{ n: '출입 기록', pts: [GATE] }, { n: '행정반 인사 기록', pts: [ADMIN] }, { n: '생활관 스마트 보관함', pts: [BARRACKS] }, { n: '체력단련실 워치 기록', pts: [gym] }],
      human: ['이번 주 당직 근무표', '행정보급관 확인 대기'],
      qa: [
        ['지금 부대에 몇 명 있나요?', '총원 412명 중 398명이 부대 안에 있습니다. 외출 3명, 휴가 5명, 파견·교육 6명입니다.', ['출입 기록', '행정반 인사 기록'], 0],
        ['오늘 챙길 일은?', '생일자 2명에게 축하 케이크를 준비했고, 예방접종 대상 12명에게 일정을 알렸습니다.', ['급양관리', '의무지원'], 1],
        ['체력 기록은 어디에 쓰이나요?', '워치로 잰 운동량을 인사 기록에 자동으로 반영합니다. 체력 등급은 담당 간부가 확인합니다.', ['아미 워치', '체력단련실 워치 기록'], 3]
      ]
    },
    fac: {
      role: '차량과 로봇의 상태 데이터를 읽어 고장을 미리 알리고, 부품 발주와 배차를 맡습니다.',
      now: '전술차량 진동 분석 · 오후 배차 준비',
      kpi: [['차량 가동률', '94%', '정비 대기 2대'], ['고장 예측', '72시간', '고장 전에 감지'], ['오후 배차', '3대', 'K-151 · 15시']],
      trend: ['최근 7일 차량 가동률 (%)', [89, 90, 92, 91, 93, 95, 94]],
      src: [{ n: '차량 진동 센서', pts: [[1076, 215]] }, { n: '차량 정비고', pts: [[1320, 95]] }, { n: '로봇 정밀 점검 패드', pts: [[1366, 122]] }, { n: '유류 보급', pts: [[1302, 226]] }],
      human: ['RQ-03 운용 준비', '정비담당관 이 주무관 승인'],
      qa: [
        ['고장 위험이 있는 장비는?', 'K-151 72호의 엔진 진동이 평소의 2.4배입니다. 72시간 안에 점검하도록 정비 작업을 등록했습니다.', ['차량 진동 센서', '차량 정비고'], 0],
        ['오후 배차는요?', 'K-151 3대를 15시 기동에 배차했습니다. 정비를 마친 차량은 10:30 출문 예정으로 출입관제 AI에 알렸습니다.', ['배차 요청', '출입관제'], 3],
        ['정비 결과는 누가 승인하나요?', 'AI가 진단하고 민간 기술지원팀이 정비한 뒤, 정비담당관 이 주무관이 운용 준비 상태를 승인합니다.', ['민간 기술지원팀', '정비담당관'], 2]
      ]
    },
    mess: {
      role: '식수 인원을 예측하고 장병별 맞춤 식단을 짜며, 잔반과 재고를 관리합니다.',
      now: '중식 식수 예측 · 맞춤 식단 27명 준비',
      kpi: [['오늘 중식', '404명', '예측'], ['잔반률', '4%', '최근 7일 최저'], ['맞춤 식단', '27명', '워치 연동']],
      trend: ['최근 7일 잔반률 (%)', [8, 7, 7, 6, 5, 5, 4]],
      src: [{ n: '배식대 카메라', pts: [[154, 150]] }, { n: '퇴식구 잔반 카메라', pts: [[337, 130]] }, { n: '아미 워치 운동량', pts: [BARRACKS, PARADE] }, { n: '외출·휴가 기록', pts: [ADMIN] }],
      human: ['석식 메뉴 조정', '급양관리관 승인 대기'],
      qa: [
        ['오늘 몇 명이 먹나요?', '중식은 404명으로 예측합니다. 부대 안 398명에 오전 복귀 6명을 더했고, 훈련 일정에 맞춰 배식 시간을 나눴습니다.', ['인사생활', '외출·휴가 기록'], 3],
        ['맞춤 식단은 누가 받나요?', '운동량이 많은 27명은 단백질을 보강하고, 미열이 있는 박 상병은 죽과 수분 보충 식단을 권고했습니다.', ['아미 워치 운동량', '의무지원'], 2],
        ['잔반은 어떻게 줄이나요?', '퇴식구 카메라로 잔반을 재서 다음 메뉴에 반영합니다. 메뉴 변경은 급양관리관이 승인합니다.', ['퇴식구 잔반 카메라', '급양관리관'], 1]
      ]
    }
  };
}
let DATA = null;

// ---- 콘솔 DOM ----
function build(stage) {
  el = document.createElement('aside');
  el.className = 'agent-panel'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '에이전트 분석');
  el.innerHTML = '<div class="ap-head"><i class="ap-dia"></i><h2 class="ap-name"></h2><button type="button" class="ap-x" aria-label="닫기 (Esc)">×</button></div>'
    + '<div class="ap-body"><p class="ap-place"></p><p class="ap-role"></p>'
    + '<div class="ap-now"><i></i><span class="ap-k">지금 하는 일</span><span class="ap-now-t"></span></div>'
    + '<div class="ap-kpis"></div>'
    + '<div class="ap-trend"><span class="ap-k ap-trend-t"></span><div class="ap-bars"></div></div>'
    + '<div class="ap-sec"><span class="ap-k">연결된 데이터</span><ul class="ap-src"></ul></div>'
    + '<div class="ap-human"><span class="ap-k">사람의 결정</span><p><b></b><span></span></p></div>'
    + '<div class="ap-sec"><span class="ap-k">물어보기</span><div class="ap-qs"></div>'
    + '<div class="ap-ans" hidden><p class="ap-a"></p><div class="ap-ev"></div></div></div></div>';
  stage.appendChild(el);
  el.querySelector('.ap-x').addEventListener('click', () => agentView.close());
  window.addEventListener('keydown', (e) => { if (S.id && (e.key === 'Escape' || e.key === 'Esc') && !stage.classList.contains('hidden')) { e.preventDefault(); agentView.close(); } });
}
const $ = (q) => el.querySelector(q);
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

function fill(id) {
  const N = M.nodes[id], D = DATA[id];
  el.style.setProperty('--ag', N.hex);
  $('.ap-name').textContent = N.name + (N.hub ? ' AI 허브' : ' AI');
  $('.ap-place').textContent = N.place;
  $('.ap-role').textContent = D.role;
  $('.ap-now-t').textContent = D.now;
  $('.ap-kpis').innerHTML = D.kpi.map((k) => '<div class="ap-kpi"><span class="ap-k">' + esc(k[0]) + '</span><b>' + esc(k[1]) + '</b><span class="ap-sub">' + esc(k[2]) + '</span></div>').join('');
  const v = D.trend[1], lo = Math.min(...v), hi = Math.max(...v), base = lo - (hi - lo) * 0.35 - 1e-6;
  $('.ap-trend-t').textContent = D.trend[0];
  $('.ap-bars').innerHTML = v.map((x, i) => '<i class="' + (i === v.length - 1 ? 'last' : '') + '" style="height:' + Math.round(6 + 26 * (x - base) / (hi - base || 1)) + 'px" title="' + esc(x) + '"></i>').join('') + '<span class="ap-last">' + esc(v[v.length - 1].toLocaleString('ko-KR')) + '</span>';
  $('.ap-src').innerHTML = D.src.map((s, i) => '<li data-i="' + i + '"' + (s.pts.length ? '' : ' class="ext"') + '><i></i>' + esc(s.n) + (s.pts.length ? '' : ' <em>외부</em>') + '</li>').join('');
  el.querySelectorAll('.ap-src li').forEach((li) => {
    li.addEventListener('mouseenter', () => { S.hover = +li.dataset.i; });
    li.addEventListener('mouseleave', () => { S.hover = -1; });
  });
  $('.ap-human b').textContent = D.human[0];
  $('.ap-human span').textContent = D.human[1];
  $('.ap-qs').innerHTML = D.qa.map((q, i) => '<button type="button" class="ap-q" data-i="' + i + '">' + esc(q[0]) + '</button>').join('');
  el.querySelectorAll('.ap-q').forEach((b) => b.addEventListener('click', () => ask(+b.dataset.i)));
  $('.ap-ans').hidden = true; S.ans = null; S.shown = -1;
}
function ask(i) {
  const q = DATA[S.id].qa[i];
  S.ans = { i, t: 0, text: q[1] }; S.shown = -1;
  S.focus = q[3]; S.focusT = q[3] >= 0 ? 6 : 0;
  el.querySelectorAll('.ap-q').forEach((b) => b.classList.toggle('on', +b.dataset.i === i));
  $('.ap-ans').hidden = false; $('.ap-a').textContent = ''; $('.ap-ev').innerHTML = ''; $('.ap-ev').classList.remove('on');
}

// 맵 위 데이터 소스가 콘솔에 덜 가려지는 쪽에 콘솔을 띄운다
function pickSide(id) {
  let l = 0, r = 0;
  DATA[id].src.forEach((s) => s.pts.forEach((p) => { const q = M.w2s(p[0], p[1]); if (q[0] > 1200) r++; else if (q[0] < 400) l++; }));
  const n = M.w2s(M.nodes[id].x, M.nodes[id].y);
  if (n[0] > 1200) r += 3; else if (n[0] < 400) l += 3;
  return r > l ? 'left' : 'right';
}

export const agentView = {
  name: 'agentView',
  init(map) { M = map; DATA = content(map); if (!el) build(map.cv.closest('.stage') || document.body); },
  get open() { return S.id; },
  show(id) {
    if (!M || !DATA || !DATA[id]) return;
    S.id = id; S.hover = -1; S.focus = -1; S.focusT = 0;
    M.agentFocus = id;
    fill(id);
    S.side = pickSide(id);
    el.classList.toggle('left', S.side === 'left');
    el.hidden = false; void el.offsetWidth; el.classList.add('on');
    const N = M.nodes[id]; N.hit = 1;
  },
  close() {
    if (!S.id) return false;
    S.id = null; S.ans = null; if (M) M.agentFocus = null;
    el.classList.remove('on');
    setTimeout(() => { if (!S.id) el.hidden = true; }, 260);
    return true;
  },
  // baseMap이 드래그가 아닌 클릭을 알려 준다 (화면 좌표)
  click(map, sx, sy) {
    if (map.mode !== 'ambient') return;
    const id = map.nodeAtScreen(sx, sy);
    if (id) { if (S.id === id) this.close(); else this.show(id); }
    else if (S.id) this.close();
  },
  step(map, dt) {
    S.a += ((S.id ? 1 : 0) - S.a) * Math.min(1, dt * 8);
    if (S.id && map.mode !== 'ambient') { this.close(); return; }
    if (S.focusT > 0) S.focusT -= dt;
    if (S.ans) {
      S.ans.t += dt;
      const n = Math.min(S.ans.text.length, Math.floor(S.ans.t * CPS));
      if (n !== S.shown) {
        S.shown = n; $('.ap-a').textContent = S.ans.text.slice(0, n);
        if (n >= S.ans.text.length) {
          const q = DATA[S.id].qa[S.ans.i];
          $('.ap-ev').innerHTML = '<span class="ap-k">근거</span>' + q[2].map((e) => '<span class="ap-chip">' + esc(e) + '</span>').join('');
          $('.ap-ev').classList.add('on');
        }
      }
    }
  },
  // 데이터 연결 강조: 어두운 막 위에 데이터 소스 → 에이전트 선과 흘러가는 패킷
  drawScreen(map, c, t) {
    const id = S.id || this._last; if (S.a < 0.02 || !id) { if (!S.id) this._last = null; return; }
    if (S.id) this._last = S.id;
    const N = map.nodes[id], D = DATA[id], hex = N.hex, a = S.a, np = map.w2s(N.x, N.y);
    c.save();
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; // 앞 모듈이 남긴 투명도에 막이 묻히지 않게
    c.fillStyle = 'rgba(4,7,12,' + (0.62 * a).toFixed(3) + ')'; c.fillRect(0, 64, 1600, 836);
    const hl = S.hover >= 0 ? S.hover : (S.focusT > 0 ? S.focus : -1);
    D.src.forEach((s, i) => {
      // 이름표는 에이전트에 가장 가까운 지점에 단다 (여러 지점인 소스: CCTV 14대 · 워치 등)
      let lab = 0, best = Infinity;
      s.pts.forEach((p, j) => { const d = Math.hypot(p[0] - N.x, p[1] - N.y); if (d < best) { best = d; lab = j; } });
      s.lab = lab;
    });
    D.src.forEach((s, i) => s.pts.forEach((p, j) => {
      const q = map.w2s(p[0], p[1]), dx = np[0] - q[0], dy = np[1] - q[1], L = Math.hypot(dx, dy) || 1, on = i === hl;
      c.globalAlpha = a * (on ? 0.8 : 0.4); c.fillStyle = hex;
      for (let d = 14; d < L - 10; d += 9) c.fillRect(Math.round(q[0] + dx * d / L) - 1, Math.round(q[1] + dy * d / L) - 1, 2, 2);
      for (let k = 0; k < (on ? 3 : 1); k++) { // 데이터 → 에이전트로 흐르는 패킷
        const u = (t * (on ? 0.7 : 0.45) + i * 0.21 + j * 0.37 + k / 3) % 1, x = q[0] + dx * u, y = q[1] + dy * u;
        c.globalAlpha = a; c.fillStyle = hex; c.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6); c.fillStyle = '#FFFFFF'; c.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      }
      // 소스 표시: 모서리 괄호 + 가운데 점
      const r = Math.round((on ? 14 : 9) + 2 * Math.sin(t * 4 + i)), x0 = Math.round(q[0]), y0 = Math.round(q[1]);
      c.globalAlpha = a; c.globalCompositeOperation = 'lighter'; c.drawImage(map.glow(N.rgb), x0 - r * 2, y0 - r * 2, r * 4, r * 4); c.globalCompositeOperation = 'source-over';
      c.fillStyle = hex;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([ux, uy]) => { const cx = x0 + ux * r, cy = y0 + uy * r; c.fillRect(ux < 0 ? cx - 1 : cx - 5, cy - 1, 6, 2); c.fillRect(cx - 1, uy < 0 ? cy - 1 : cy - 5, 2, 6); });
      c.fillRect(x0 - 3, y0 - 3, 6, 6); c.fillStyle = '#FFFFFF'; c.fillRect(x0 - 1, y0 - 1, 2, 2);
      if (j === s.lab) map.dataChip(c, s.n, q[0], q[1] - r - 6, hex, on);
    }));
    // 에이전트 자신
    c.globalAlpha = a; c.globalCompositeOperation = 'lighter';
    const G = 120 + 16 * Math.sin(t * 3); c.drawImage(map.glow(N.rgb), np[0] - G / 2, np[1] - G / 2, G, G);
    c.globalCompositeOperation = 'source-over';
    const dia = (R, col) => { c.fillStyle = col; for (let dy = -R; dy <= R; dy++) { const w = (R - Math.abs(dy)) * 2 + 1; c.fillRect(Math.round(np[0] - w), Math.round(np[1] + dy * 2 - 1), w * 2, 2); } };
    dia(7, '#05070A'); dia(6, hex); dia(3, map.light(hex, 0.55)); c.fillStyle = '#FFFFFF'; c.fillRect(Math.round(np[0]) - 1, Math.round(np[1]) - 1, 2, 2);
    map.dataChip(c, N.name + (N.hub ? ' AI 허브' : ' AI'), np[0], np[1] - 20, hex, true);
    c.restore();
  }
};
