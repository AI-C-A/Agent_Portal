// 1분 시연 대본 — 참모총장 지휘서신 「2040년 웅비대대의 하루」 (핵심 장면: 훈련 성과 분석 회의 → TIGER 보완 훈련)
import { TIGER, PODS, CONSOLE } from '../tiger.js';
import { PERIM } from './props.js';
import { RM, RP, RR } from '../layout.js';
// 시각(at, 초) 순으로 놓인 단계 목록이다. 숫자만 고치면 재배치된다(정렬은 demo.js가 한다).
// 좌표는 원래 배치 기준으로 적고, 아래 도우미가 새 배치(layout.js)로 바꾼다. 이미 새 좌표인 점(PERIM)은 nw([x, y])로 감싼다.
//   cam(at, x, y, 배율, 걸리는 시간)   x, y = 대사창 위 화면 가운데에 올 맵 좌표
//   fit(at, 시간)                      맵 전체 보기
//   lb(at, on)                         컷신 띠 들어오기/나가기
//   card(at, 시간, 큰 줄, 작은 줄)      타이틀 카드 / chapter(...) 핵심 장면 표지
//   banner(at, 'HH:MM', 장소, 설명, 시간, 강조)  왼쪽 위 장소 배너 (시연 시계도 맞춘다)
//   say(at, 화자, 대사, 시간)           대사창 (화자는 SPEAKERS 키)
//   pop(at, 팝업, 시간, 빠르기)          오른쪽 팝업 (ui.js POPS 키, 빠르기 = 팝업 안 시간 배속)
//   fx(at, 효과, 시간, 빠르기, 값)       월드 효과 (props.js가 S.fx[효과]로 읽는다)
//   spawn(at, id, 종류, 계급, x, y, 방향, 옵션) / move(at, id, [[x, y]...], 속도, 끝 방향) / pose(at, id, {...}) / bub(at, id, 말, 모양, 시간)
//   clear(at, 남는 시간)                 배우 퇴장 — 화면 밖으로 나가면 바로, 화면 안이면 남는 시간(기본 0.7초) 뒤 흐려진다
//   free(at, [x, y] 또는 id, 노드, 칩, 시간, {log, hq, then}) 맵 지점 → 에이전트 패킷
//   send(at, 보내는 노드, 받는 노드, 칩, 시간, {log, hq, then}) 연결선 따라 패킷 (then은 도착 후 단계)
//   out(at, x, y, 칩, 시간, 노드)        에이전트(기본 통합관제) → 맵 지점 패킷 (칩이 ''이면 작은 점)
//   log(at, from, to, 메시지) / hq(at, 상황실 문구)
//   hide(at, [[x0, y0, x1, y1]...], 화면 안 복귀)  그 구역의 평소 캐릭터를 잠시 숨긴다. 구역을 벗어난 캐릭터는 화면 밖에서
//                                       되돌리고, 세 번째 값이 true면 화면 안에서도 서서히 되돌린다(타이틀 카드 뒤 등)
//   tint(at, 0~1, 시간)                 저녁 어둠 (옅은 푸른빛, 최대 14%)
//   gate(at, 0|1)                       정문 보행자 출입문
//   end(at)
const nw = (p) => Object.assign(p.slice(), { nw: true });
const M = (p) => (p.nw ? [p[0], p[1]] : RM(p[0], p[1]));
const cam = (at, x, y, z, dur) => { const p = RM(x, y); return { at, k: 'cam', x: p[0], y: p[1], z, dur }; };
const fit = (at, dur) => ({ at, k: 'cam', fit: true, dur });
const lb = (at, on) => ({ at, k: 'lb', on });
const card = (at, dur, l1, l2) => ({ at, k: 'card', dur, l1, l2 });
const chapter = (at, dur, l1, l2) => ({ at, k: 'chapter', dur, l1, l2 });
const banner = (at, time, place, sub, dur, em) => ({ at, k: 'banner', time, place, sub, dur, em: !!em });
const say = (at, who, text, dur) => ({ at, k: 'say', who, text, dur });
const pop = (at, id, dur, rate) => ({ at, k: 'pop', id, dur, rate: rate || 1 });
const fx = (at, name, dur, rate, p) => ({ at, k: 'fx', name, dur, rate: rate || 1, p: p || null });
const spawn = (at, id, type, rank, x, y, dir, o) => {
  const p = RM(x, y); o = o || {}; if (o.link) o = Object.assign({}, o, { link: RM(o.link[0], o.link[1]) });
  return { at, k: 'spawn', id, type, rank, x: p[0], y: p[1], dir, o };
};
const move = (at, id, pts, speed, face) => ({ at, k: 'move', id, pts: RP(pts), speed, face });
const pose = (at, id, set) => ({ at, k: 'pose', id, set });
const bub = (at, id, text, style, dur) => ({ at, k: 'bub', id, text, style, dur });
const clear = (at, linger) => ({ at, k: 'clear', linger });
const free = (at, src, to, chip, dur, o) => Object.assign({ at, k: 'free', to, chip, dur }, typeof src === 'string' ? { from: src } : { x: M(src)[0], y: M(src)[1] }, o || {});
const send = (at, from, to, chip, dur, o) => Object.assign({ at, k: 'send', from, to, chip, dur }, o || {});
const out = (at, x, y, chip, dur, from) => { const p = Array.isArray(x) ? M(x) : RM(x, y); return { at, k: 'out', x: p[0], y: p[1], chip, dur, from: from || 'hq' }; };
const log = (at, from, to, msg) => ({ at, k: 'log', from, to, msg });
const hq = (at, line) => ({ at, k: 'hq', line });
const hide = (at, rects, reveal) => ({ at, k: 'hide', rects: (rects || []).map(RR), reveal: !!reveal });
const tint = (at, v, dur) => ({ at, k: 'tint', v, dur });
const gate = (at, v) => ({ at, k: 'gate', v });
const end = (at) => ({ at, k: 'end' });

export const SPEAKERS = {
  kim: { name: '김 일병', sub: '2생활관 · 용사', type: 'pt', rank: 'e2' },
  park: { name: '박 상병', sub: '2생활관 · 용사', type: 'pt', rank: 'e3' },
  medAI: { name: '의무지원 AI', sub: '의무실 · 군의관 연결', agent: 'med' },
  perAI: { name: '인사참모 AI', sub: '인사생활 에이전트 · 체력단련', agent: 'per', code: '인사참모 AI' },
  trainer: { name: '전문 트레이너', sub: '생활관 체력단련실', type: 'trainer', rank: '' },
  lead: { name: '급양팀장', sub: '밀리테리아 · 중사', type: 'officer', rank: 'n2' },
  song: { name: '송 상사', sub: '간부 · 출근', type: 'officer', rank: 'n3' },
  no7: { name: '아미 NO.7', sub: '휴머노이드 · 정문 출입 통제', type: 'robot', rank: '' },
  facAI: { name: '정비수송 AI', sub: '대대 정비센터 · 예지 정비', agent: 'fac' },
  tech: { name: '윤 책임', sub: '민간 기술지원팀', type: 'tech', rank: '' },
  lee: { name: '이 주무관', sub: '정비담당관 · 군무원', type: 'tech', rank: '' }, // 군무원 — 군복 대신 윤 책임과 같은 정비 작업복
  trnAI: { name: '훈련관리 AI', sub: '드론 편대 운용', agent: 'trn' },
  tigAI: { name: '훈련관리 AI', sub: 'TIGER 합성훈련 분석', agent: 'trn' },
  messAI: { name: '급양관리 AI', sub: '밀리테리아 · 맞춤 식단', agent: 'mess' },
  secAI: { name: '통합관제 AI', sub: 'CCTV·드론·로봇 경계작전', agent: 'hq' },
  staffAI: { name: 'AI 참모', sub: '통합관제 에이전트 · 훈련 성과 분석', agent: 'hq', code: 'AI 참모' },
  ops: { name: '작전과장', sub: '소령 · 참모단', type: 'officer', rank: 'f1' },
  cmdr: { name: '대대장', sub: '중령 · 지휘관 결심', type: 'officer', rank: 'f2' },
  gang: { name: '강 대위', sub: '1중대장 · 일체형 개인 전투체계', type: 'officer', rank: 'o3' },
  choi: { name: '최 중사', sub: '작전관 · 대대 작전과', type: 'officer', rank: 'n2' }
};

// 평소 캐릭터를 잠시 숨길 구역
const R_B2 = [1010, 648, 1340, 748], R_GYM = [1010, 540, 1340, 648], R_CAFE = [384, 220, 446, 318];
const R_GATE = [900, 940, 1060, 1100], R_FAC = [1560, 112, 1694, 236], R_MEET = [740, 225, 956, 276];
const R_TIG = [TIGER.x0, TIGER.y0, TIGER.x1, TIGER.y1], R_MESS = [120, 150, 330, 240], R_PERIM = [60, 932, 560, 1088];
const HALF = (label) => ({ half: true, label });


export const SCRIPT = [
  // ── 0 · 오프닝 ─────────────────────────────────────────────
  lb(0, true),
  card(0.1, 2.5, '2040년 7월 · 강원 철원 웅비대대', 'AI 에이전트와 함께 시작하는 장병의 하루'),
  hide(0.9, [R_B2]),
  spawn(0.9, 'kim', 'pt', 'e2', 1176, 706, 'down', { label: '김 일병 · 2생활관' }),
  spawn(0.9, 'park', 'pt', 'e3', 1238, 706, 'down', { label: '박 상병 · 2생활관' }),
  cam(1.1, 1232, 690, 3.4, 1.6),

  // ── 1 · 기상 · AI 아미 워치 (인사생활 → 의무지원) 1.1–8.6 ──────
  banner(2.0, '06:30', '2생활관', '기상 · AI 아미 워치가 밤사이 컨디션을 알려 줍니다', 6.6),
  pop(2.4, 'watchKim', 2.2),
  say(2.5, 'kim', '수면 7시간 12분, 심박·체온 모두 정상. 좋은 아침이다!', 2.1),
  pose(4.3, 'park', { alertT: 4.4 }),
  bub(4.3, 'park', '워치: 미열 37.8℃ 감지', 'alert', 1.6),
  free(4.4, 'park', 'per', '체온 37.8℃', 0.6, { then: [send(0, 'per', 'med', '미열 감지', 0.8, { log: ['per', 'med', '박 상병 워치 체온 37.8℃ · 미열 감지 · 진료 권장'] })] }),
  pop(4.7, 'watchPark', 3.9),
  say(4.8, 'park', '미열이 있다고? 진료 예약 버튼만 누르면 되겠네.', 1.8),
  send(5.9, 'med', 'hq', '진료 예약', 0.9, { log: ['med', 'hq', '박 상병 의무실 진료 10:20 예약 · 군의관 연결'], hq: '박 상병 진료 예약' }),
  say(6.7, 'medAI', '군의관 연결 완료. 오늘 10:20 의무실 진료가 예약되었습니다.', 2.0),

  // ── 2 · 체력단련실 — 인사참모 AI가 설계하고 트레이너가 지도 8.6–16.6 ──
  clear(8.6), hide(8.6, [R_GYM, R_B2]),
  cam(8.6, 1196, 600, 3.0, 1.3),
  spawn(8.7, 'kimG', 'pt', 'e2', 1057, 582, 'up', { run: true, self: 'treadmill', link: [1057, 556.5], label: '김 일병 · 러닝머신' }),
  spawn(8.7, 'jung', 'pt', 'e2', 1081, 582, 'up', { run: true, self: 'treadmill', link: [1081, 556.5], label: '정 일병 · 러닝머신' }),
  spawn(8.7, 'lee2', 'pt', 'e3', 1137, 577, 'up', { half: true, bob: 9, link: [1137, 564.5], label: '이 상병 · 실내 사이클' }),
  spawn(8.7, 'g4', 'pt', 'e1', 1239, 580, 'down', { lift: 'squat', bob: 3.2, label: '이병 · 스쿼트' }),
  spawn(8.7, 'trainer', 'trainer', '', 1122, 618, 'left', { label: '전문 트레이너' }),
  banner(9.0, '07:10', '체력단련실', '인사참모 AI가 워치 데이터로 개인별 운동을 설계합니다', 7.4),
  fx(9.1, 'gymAI', 7.4),
  free(9.2, 'kimG', 'per', '워치 데이터', 0.7), free(9.25, 'jung', 'per', '', 0.7), free(9.3, 'lee2', 'per', '', 0.7),
  out(9.9, 1057, 556, '맞춤 프로그램', 0.7, 'per'), out(9.95, 1081, 556, '', 0.7, 'per'), out(10.0, 1137, 564, '', 0.7, 'per'),
  pop(9.4, 'gymAI', 2.8),
  say(9.5, 'perAI', '밤사이 워치 데이터를 분석해 개인별 운동 프로그램을 자동 설정했습니다.', 2.5),
  bub(11.6, 'jung', '무릎 부하 높음', 'alert', 1.5),
  free(11.6, 'jung', 'per', '무릎 부하 감지', 0.5),
  out(12.1, 1122, 600, 'AI 권고', 0.6, 'per'),
  pop(12.2, 'insight', 2.6),
  say(12.3, 'trainer', 'AI 권고 확인했습니다. 정 일병, 무릎 보호를 위해 사이클로 바꿉시다!', 2.5),
  pose(12.9, 'jung', { self: null, run: false, link: null }),
  move(12.9, 'jung', [[1081, 594], [1157, 594], [1157, 577]], 64, 'up'),
  pose(13.5, 'trainer', { dir: 'right' }),
  pose(14.4, 'kimG', { run: false }),
  pose(14.6, 'jung', { half: true, bob: 8, link: [1157, 564.5] }),
  bub(14.5, 'kimG', '체력 등급 1단계 달성!', 'agent', 2.0),
  send(14.5, 'per', 'hq', '체력 1단계', 0.8, { log: ['per', 'hq', '김 일병 체력 등급 1단계 · 인사 기록 반영'], hq: '김 일병 체력 1단계' }),
  pop(14.6, 'fitApp', 2.2),
  say(14.8, 'perAI', '김 일병 체력 등급 1단계 달성. 인사 기록에 자동 반영했습니다.', 2.0),

  // ── 3 · 밀리테리아 — 급양관리 AI 맞춤 식단 (인사생활·의무지원 → 급양관리) 16.6–21.4 ──
  //   워치·체력단련·진료 데이터가 급양관리 AI로 모여 장병별 식단과 식수(조리량)를 정하고, 급양팀장이 배식한다
  clear(16.6), hide(16.6, [R_MESS]),
  cam(16.6, 254, 194, 4.2, 1.4),
  spawn(16.6, 'lead', 'officer', 'n2', 282, 176, 'down', HALF('급양팀장 · 중사')),
  spawn(16.6, 'cookM', 'cook', '', 226, 176, 'down', HALF('취사병 · 병장')),
  spawn(16.6, 'kimM', 'pt', 'e2', 282, 236, 'up', { label: '김 일병' }),
  move(16.7, 'kimM', [[282, 210]], 34, 'up'),
  banner(16.9, '07:50', '밀리테리아', '급양관리 AI · 개인 맞춤 식단 · 식수 예측', 4.4),
  send(17.1, 'per', 'mess', '체력·건강 데이터', 0.7, { log: ['per', 'mess', '김 일병 체력단련 기록 · 워치 컨디션 → 급양관리 AI'] }),
  send(17.3, 'med', 'mess', '미열 1명', 0.7, { log: ['med', 'mess', '박 상병 미열 37.8℃ · 죽·수분 보충 식단 요청'] }),
  say(17.4, 'messAI', '워치와 체력단련 기록을 반영해 장병별 맞춤 식단을 준비했습니다.', 2.2),
  pop(17.5, 'meal', 3.8),
  bub(18.3, 'kimM', '워치: 맞춤 식단 · 단백질 +20g', 'agent', 1.8),
  say(19.7, 'lead', 'AI 추천 식단입니다. 김 일병은 단백질 보강, 든든하게 드십시오!', 1.6),
  send(20.3, 'mess', 'hq', '식수 412명', 0.7, { log: ['mess', 'hq', '조식 식수 412명 예측 · 조리량 자동 조정 · 잔반 예측 4%'], hq: '조식 412명 · 맞춤 식단' }),

  // ── 4 · 위병소 정문 (출입관제 → 통합관제) 21.4–27.6 ─────────
  clear(21.4), hide(21.4, [R_GATE]),
  cam(21.4, 966, 990, 3.4, 1.4),
  spawn(21.4, 'no7', 'robot', '', 1000, 1012, 'left', { label: '휴머노이드 아미 NO.7' }),
  spawn(21.4, 'song', 'officer', 'n3', 960, 1040, 'up', { label: '송 상사' }),
  spawn(21.4, 'off2', 'officer', 'o2', 960, 1068, 'up', { label: '중위 · 출근' }),
  move(21.5, 'song', [[960, 1004]], 32, 'right'),
  move(21.5, 'off2', [[960, 1034]], 32, 'up'),
  banner(21.8, '08:20', '위병소 정문', '간부 출근 · 무인 출입 시스템', 5.8),
  say(22.7, 'song', '안녕, 아미!', 1.3),
  fx(22.7, 'faceScan', 3.0),
  pop(22.7, 'access', 4.6),
  free(22.9, [988, 961], 'gate', '안면·홍채 인증', 0.7),
  say(24.1, 'no7', '송 상사님, 오늘 생일이시네요! 최고의 하루가 될 것입니다.', 2.7),
  free(24.2, 'no7', 'gate', '출입 통제 현황', 0.6),
  gate(25.7, 1),
  send(25.7, 'gate', 'hq', '출입 현황', 0.9, { log: ['gate', 'hq', '송 상사 무인 출입 승인 · 출입 현황 통합관제 전송'], hq: '송 상사 출입' }),
  move(26.2, 'song', [[960, 944], [960, 900]], 32),
  move(27, 'off2', [[960, 1004]], 32, 'right'),
  gate(27.4, 0),

  // ── 5 · 대대 정비센터 — AI 예지 정비 27.6–37.2 ───────────────
  clear(27.6), hide(27.6, [R_FAC]),
  cam(27.6, 1624, 188, 4.0, 1.5),
  fx(27.6, 'quadTest', 2.4),
  spawn(27.6, 'lee', 'tech', '', 1588, 192, 'right', { label: '이 주무관 · 정비담당관(군무원)' }),
  spawn(27.6, 'tech', 'tech', '', 1641, 204, 'up', { label: '윤 책임 · 민간 기술지원팀' }),
  banner(28.1, '10:00', '대대 정비센터', 'AI 예지 정비 · 피지컬 AI 다족 보행 정찰로봇', 9.0),
  fx(28.6, 'diag', 2.6),
  pop(28.6, 'diag', 2.4),
  say(29.1, 'facAI', '좌후방 무릎 관절 이상 감지. 72시간 내 고장 예측, 부품을 자동 발주합니다.', 2.8),
  free(29.2, [1640, 158], 'fac', '관절 진동 이상', 0.6),
  pop(31, 'predict', 1.9, 1.2),
  send(31.1, 'fac', 'hq', '부품 자동 발주', 0.7, { log: ['fac', 'hq', 'RQ-03 무릎 감속기 자동 발주 · 기술지원팀 배정'], hq: '부품 자동 발주' }),
  send(31.7, 'hq', 'fac', '출고 승인', 0.6, { log: ['hq', 'fac', '부품 출고 승인 · 정비 작업 즉시 착수'] }),
  fx(31.6, 'swap', 2.4, 1.33),
  pose(31.6, 'tech', { dir: 'left' }), pose(32.3, 'tech', { dir: 'up' }), pose(33, 'tech', { dir: 'left' }),
  say(32.9, 'tech', '모듈 교체 완료. 보행 제어 알고리즘 v4.2를 업데이트합니다.', 2.2),
  pop(33, 'update', 1.8, 1.4),
  fx(33.4, 'update', 1.5),
  send(34.3, 'fac', 'hq', '알고리즘 v4.2', 0.6, { log: ['fac', 'hq', '보행 제어 알고리즘 v4.2 업데이트 · 보행 시험 정상'] }),
  pose(34.7, 'lee', { dir: 'down' }),
  pop(34.8, 'approve', 2.4, 1.3),
  say(35.1, 'lee', '점검 결과 확인했습니다. 운용 준비 상태, 최종 승인합니다.', 2.2),
  send(36, 'fac', 'hq', '운용 준비 승인', 0.7, { log: ['fac', 'hq', 'RQ-03 운용 준비 완료 · 이 주무관 최종 승인'], hq: '정찰로봇 운용 승인' }),
  fx(36, 'quadOk', 1.4),
  pose(36.4, 'lee', { dir: 'right' }),

  // ── 6 · 주둔지 경계작전 — CCTV·드론·로봇개를 통합관제 AI가 묶는다 37.2–41.6 ──
  //   울타리 밖 움직임(CCTV 감지) → 통합관제 AI가 숲 정찰 드론·경계로봇 출동 → 열화상 판별(멧돼지·위협 아님) → 상황 종료
  clear(37.2), hide(37.2, [R_PERIM]),
  cam(37.2, 300, 984, 3.6, 1.4),
  fx(37.2, 'perim', 4.4),
  banner(37.4, '13:30', '남서 울타리', '과학화 경계 · CCTV·드론·로봇개 연동 경계작전', 4.0),
  free(37.5, nw(PERIM.cctv), 'gate', 'CCTV 움직임 감지', 0.6, { then: [send(0, 'gate', 'hq', '경계 이상', 0.6, { log: ['gate', 'hq', 'CCTV 03 남서 울타리 외곽 움직임 감지'] })] }),
  say(37.7, 'secAI', '남서 울타리 외곽 움직임 감지. 드론과 로봇개를 바로 보냅니다.', 1.9),
  pop(37.8, 'perim', 3.7),
  out(38.4, nw([PERIM.boar[0], PERIM.boar[1] - 26]), 0, '드론 출동', 0.7), out(38.6, nw([PERIM.robot[0], PERIM.robot[1] - 12]), 0, '로봇개 출동', 0.7),
  free(39.6, nw([PERIM.boar[0], PERIM.boar[1] - 30]), 'hq', '열화상 영상', 0.6, { log: ['hq', 'gate', 'AI 열화상 판별 · 멧돼지 1마리 · 위협 아님'] }),
  say(39.8, 'secAI', '열화상 판별 결과 멧돼지 1마리, 위협 아닙니다. 경계 태세 정상 유지.', 1.8),
  send(40.9, 'hq', 'gate', '상황 종료', 0.6, { log: ['hq', 'gate', '상황 종료 · 경계로봇 RQ-01 순찰 복귀'], hq: '경계 상황 종료' }),

  // ── 7 · 훈련 성과 분석 회의 — AI 참모 × 지휘관 (핵심 장면) 41.6–57.0 ───
  //   지난 훈련 결과·드론 훈련 영상·체력 데이터 → AI 참모가 다음 주 훈련 계획 3안 → 디지털 트윈 일정 검증 → 대대장 결심 → 각 중대 하달
  clear(41.6), hide(41.6, [R_MEET]),
  cam(41.6, 848, 196, 2.9, 2.1),
  spawn(41.6, 'cmdr', 'officer', 'f2', 848, 267, 'up', HALF('대대장 · 중령')),
  spawn(41.6, 'opsC', 'officer', 'f1', 804, 259, 'up', HALF('작전과장 · 소령')),
  spawn(41.6, 'intC', 'officer', 'o3', 944, 235, 'up', HALF('정보과장 · 대위')),
  spawn(41.6, 'logC', 'officer', 'o2', 918, 247, 'up', HALF('군수과장 · 중위')),
  spawn(41.6, 'perC', 'officer', 'o3', 778, 247, 'up', HALF('인사과장 · 대위')),
  spawn(41.6, 'choi', 'officer', 'n2', 752, 235, 'up', HALF('최 중사 · 작전관')),
  spawn(41.6, 'sigC', 'officer', 'o1', 892, 259, 'up', HALF('통신관 · 소위')),
  chapter(41.8, 2.0, '훈련 성과 분석 회의', 'AI 참모 × 지휘관 · 교육훈련 피드백'),
  free(41.9, [892, 186], 'hq', '드론 훈련 영상', 0.8, { log: ['trn', 'hq', '드론 훈련 영상 · 분대별 기동·엄폐 분석 자료 전송'] }),
  free(42.2, [868, 150], 'hq', '', 0.6),
  send(42.3, 'trn', 'hq', 'TIGER 훈련 결과', 0.9, { log: ['trn', 'hq', '지난주 TIGER 합성훈련 결과 · AI 참모 분석 요청'], hq: '훈련 성과 분석' }),
  banner(42.6, '15:00', '훈련 성과 분석 회의', 'AI 참모 × 지휘관 · 교육훈련 피드백 · 디지털 트윈', 14.2, true),
  fx(43, 'wall', 14, 1, { p2: 4.4, p3: 7.2, p4: 9.8 }),
  cam(43.8, 848, 200, 3.1, 5.4),
  say(44, 'staffAI', '지난주 TIGER 합성훈련·드론 영상·체력 데이터를 분석했습니다. 1중대는 엄폐 간격과 노출 시간 보완이 필요합니다.', 3.4),
  pop(44, 'brief', 3.4),
  say(47.4, 'staffAI', '다음 주 훈련 계획 중 B안, TIGER 반복과 야외 훈련 병행이 성과 향상 91%로 가장 효과적입니다.', 2.8),
  pop(47.4, 'coa', 2.8),
  say(50.2, 'ops', '디지털 트윈 일정 검증 결과, 기상·장비 일정 충돌 없이 성과 향상 91%입니다.', 2.4),
  pop(50.2, 'twin', 2.6),
  cam(52.4, 848, 254, 5.0, 1.3),
  pose(52.6, 'cmdr', { dir: 'down' }),
  fx(52.8, 'decide', 2.4),
  say(52.9, 'cmdr', 'B안으로 결심한다. 다음 주 훈련 계획으로 하달하라.', 2.2),
  pop(52.9, 'decide', 2.1),
  // 작전관 PC 화면이 커지며 ArmyGPT(인공지능센터)가 결심한 B안을 훈련 계획 문서로 작성 → 대대장 결재 54.9–63.1
  //   PC 화면은 ArmyGPT 로컬 v1 FE의 실제 캡처 6장(55.95–59.85), 결과 문서는 같은 v1로 실제 생성한 PDF 첫 쪽(59.85–62.85에 멈춰 보여 준다).
  cam(54.9, 752, 232, 6, 1.0),
  say(55.0, 'choi', 'ArmyGPT로 1중대 보완훈련 계획 문서를 바로 작성하겠습니다.', 2.0),
  fx(55.5, 'gptPc', 7.75),
  say(60.6, 'cmdr', '문서 확인했다. 결재한다, 이대로 각 중대에 하달하라.', 2.0),
  cam(63.1, 1180, 500, 1.0, 1.3),
  send(63.3, 'hq', 'trn', '훈련 계획', 0.9, { log: ['hq', 'trn', '1중대 보완훈련 계획 하달 · ArmyGPT 작성 · 대대장 결재'], hq: '훈련 계획 하달' }),
  out(63.3, 616, 519, '1중대장', 1.0), out(63.4, 1702, 566, '2중대장', 1.0), out(63.5, 1702, 676, '3중대장', 1.0),
  pop(63.3, 'cmd', 2.2),
  say(64.3, 'gang', '1중대, 훈련 계획 수신. 오늘 오후 TIGER 보완 훈련 실시!', 1.6),

  // ── 8 · TIGER 합성훈련장 — 결심한 계획대로 취약 과목을 LVCG 합성훈련으로 보완 65.2–69.6 ──
  //   훈련관리 AI가 결과를 재서 다음 회의로 되돌린다(분석 → 결심 → 훈련 → 측정의 순환)
  clear(65.2), hide(65.2, [R_TIG]),
  cam(65.2, 266, 858, 3.3, 1.2),
  spawn(65.2, 'gangT', 'officer', 'o3', CONSOLE.x, CONSOLE.y, 'right', { label: '강 대위 · 1중대장 (일체형 개인 전투체계)' }),
  ...PODS.map((p, i) => spawn(65.2, 'tg' + i, 'trainee', ['e2', 'e3', 'e1', 'e4', 'e2', 'e3'][i], p[0], p[1], 'up', { tgPod: i, lvcg: true, label: '1중대 용사 · LVCG 헬멧·센서' })),
  fx(65.2, 'tiger', 4.6),
  banner(65.4, '16:00', 'TIGER 합성훈련장', 'LVCG 합성훈련 · 실제 지형·기상 반영 · 취약 과목 보완', 4.0),
  say(66.0, 'gang', '2분대 엄폐 간격 유지! 노출 시간 줄여라. 전원 위치 확인했다.', 1.7),
  pop(66.0, 'tiger', 3.4),
  free(66.4, [270, 815], 'trn', '훈련 데이터', 0.6),
  say(67.8, 'tigAI', '보완 훈련 결과 노출 시간 12초 단축, 명중률 87%. 다음 분석에 반영합니다.', 1.8),
  send(68.1, 'trn', 'hq', 'TIGER 결과', 0.8, { log: ['trn', 'hq', 'TIGER 보완 훈련 · 노출 시간 12초 단축 · 명중률 87% · 다음 분석 반영'], hq: 'TIGER 보완 훈련' }),

  // ── 9 · 피날레 — 모든 데이터가 통합관제로 69.5–73.1 ──────────
  clear(69.5), hide(69.5, []), fit(69.5, 1.6),
  banner(69.7, '19:00', '통합관제상황실', '부대 일일 현황 통합 · 전 에이전트', 2.6),
  ...[[1172, 590], [426, 280], [988, 961], [1628, 160], [1000, 362], [1300, 669], [300, 640], [616, 670], [1300, 250], [760, 880], [1560, 820], [180, 200], [264, 815]]
    .map((p, i) => free(69.6 + i * 0.05, p, 'hq', '', 1.1)),
  ...[['gate', '출입 기록', '오늘 출입 1,204건 · 경계 구역 이상 없음'], ['med', '진료 결과', '진료 3건 · 박 상병 해열 · 경과 양호'], ['trn', '훈련 결과', 'TIGER 보완 훈련 · 노출 시간 12초 단축 · 다음 주 계획 반영'],
    ['per', '인원 현황', '저녁 점호 412명 · 인원 이상 없음'], ['fac', '정비 현황', '정찰로봇 RQ-03 운용 대기 · 차량 가동률 96%'], ['mess', '급식 결산', '석식 410명 · 잔반 3%']]
    .map((m, i) => send(69.7 + i * 0.08, m[0], 'hq', m[1], 1.0, { log: [m[0], 'hq', m[2]] })),
  log(70.8, 'hq', 'all', '웅비대대 일일 현황 통합 완료 · 전 에이전트 정상'), hq(70.8, '일일 현황 통합 완료'),
  card(70.9, 2.2, 'AI 에이전트와 함께 강해지는 웅비대대', 'AXIS · 웅비대대 에이전트 포털'),
  clear(71.5, 0), hide(71.5, [], true), // 타이틀 카드가 화면을 덮는 동안 마지막 배우를 평소 캐릭터로 되돌린다
  lb(72.6, false),
  end(73.1)
];
