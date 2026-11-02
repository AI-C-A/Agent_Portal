// 시연용 소품 — 맵 굽기(정적 가구)와 매 프레임 그리는 움직이는 소품·효과 (모두 월드 좌표)
//   bakeProps(map, c)       : 체력단련실(1생활관 자리)·스마트 카페·정밀 점검 패드·보관함 생체 인식 패드를 맵 이미지에 굽는다
//   drawProps(map, c, t, S) : 바리스타 로봇·다족 보행 정찰로봇·정비 로봇(평소엔 대기 자세)과 시연 효과
// S는 demo.js의 재생 상태(없으면 평소 모드). S.fx[이름] = { t0, dur } 로 효과 시간을 받는다.
import { RM, RR, BLOCKS } from '../layout.js';

export const GYM = { x0: 1014, y0: 544, x1: 1330, y1: 643 };
const TREAD_X = [1024, 1048, 1072, 1096], TREAD_Y = 554;
const BIKE_X = [1130, 1150, 1170, 1190], BIKE_Y = 556;
const RACK = [1222, 552];
export const CAFE = { sh: [425, 285], home: [431, 281], cupAt: [436, 299], spout: [409, 302], pad: [434, 276] };
export const RIG = { quad: [1628, 172], mbot: [1660, 180] };
export const KIOSK = [848, 793]; // 정문 보행 출입구 안면 인식기 (새 좌표)

// ---------------------------------------------------------------- 맵 굽기
export function bakeProps(map, c) {
  let seed = 7319;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const speck = (x, y, w, h, cols, n) => { for (let k = 0; k < n; k++) R(x + (rnd() * w * 2 | 0) / 2, y + (rnd() * h * 2 | 0) / 2, 0.5, 0.5, cols[rnd() * cols.length | 0]); };
  const shade = (x, y, w, h) => { c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x + 2, y + h, w, 2); c.fillRect(x + w, y + 2, 2, h); };
  const disc = (cx, cy, r, ky, col) => { for (let dy = -r; dy <= r; dy += 0.5) { const w = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)) * 2) / 2; if (w > 0) R(cx - w, cy + dy * ky, w * 2, Math.max(0.5, ky * 0.5 + 0.01), col); } };
  const env = { R, speck, shade, disc };
  // 아래 굽기는 원래 좌표로 적혀 있어 블록 자리로 옮겨 굽는다 (layout.js)
  map.inBlock(c, 'bar', () => bakeGym(map, env)); gymData(map);
  map.inBlock(c, 'mess', () => bakeCafe(map, env));
  map.inBlock(c, 'fac', () => bakePad(map, env));
  bakeLockerPads(map, env); // map.rooms는 이미 새 좌표
}

function bakeGym(map, { R, speck, shade, disc }) {
  const { x0, y0, x1, y1 } = GYM, w = x1 - x0, h = y1 - y0;
  // 바닥: 고무 매트 타일
  R(x0, y0, w, h, '#3F4650');
  for (let j = y0; j < y1; j += 16) for (let i = x0; i < x1; i += 16) if ((((i - x0) / 16 | 0) + ((j - y0) / 16 | 0)) % 2) R(i, j, Math.min(16, x1 - i), Math.min(16, y1 - j), '#444C57');
  speck(x0, y0, w, h, ['#4B535E', '#383E47', '#47505B'], 2400);
  // 거울 벽 + 벽걸이 트레이닝 화면
  R(x0, y0, w, 3.5, '#9DBFD3'); R(x0, y0 + 3.5, w, 0.5, '#5E7686');
  for (let x = x0 + 8; x < x1 - 6; x += 26) { R(x, y0 + 0.5, 5, 1, '#E6F4FB'); R(x + 6, y0 + 1.5, 2, 0.5, '#E6F4FB'); }
  R(1022, 545, 96, 7, '#101418'); R(1023, 546, 94, 5, '#0E2A36');
  for (let k = 0; k < 4; k++) { R(1026 + k * 23, 547, 10, 0.5, '#7FE3FF'); R(1026 + k * 23, 548.5, 16, 0.5, '#2A8FB0'); R(1026 + k * 23, 549.5, 6 + k * 3, 0.5, '#45F08A'); }
  // 통로(문 쪽 화살표)와 유산소|근력 구역선
  R(x0 + 2, 590, w - 2, 14, '#4A525D');
  for (let x = x0 + 14; x < x1 - 10; x += 24) { R(x, 596.5, 8, 1, '#79828E'); R(x + 7, 595, 1, 4, '#79828E'); }
  for (let y = y0 + 6; y < 588; y += 6) R(1213, y, 1, 3, '#C9A93A');
  for (let y = 606; y < y1 - 2; y += 6) R(1213, y, 1, 3, '#C9A93A');
  // 러닝머신 (위쪽이 계기판)
  const treadmill = (x, y) => {
    shade(x, y, 18, 34);
    R(x, y + 6, 18, 28, '#2A2F36'); R(x + 2, y + 9, 14, 23, '#16191D');
    for (let j = y + 10; j < y + 32; j += 3) R(x + 2, j, 14, 0.5, '#23272D');
    R(x, y + 6, 2, 28, '#5B636D'); R(x + 16, y + 6, 2, 28, '#4A515A'); R(x + 0.5, y + 6, 0.5, 28, '#8A939E');
    R(x + 2, y + 32, 14, 2, '#3A414B');
    R(x - 1, y + 4.5, 20, 1.5, '#8A939E');
    R(x + 1, y, 16, 6, '#3A414B'); R(x + 1, y, 16, 1, '#59616B');
    R(x + 4, y + 1, 10, 3.5, '#0E2A36'); R(x + 5, y + 2, 4, 0.5, '#29E0FF'); R(x + 5, y + 3, 7, 0.5, '#1E7FA0');
  };
  // 실내 사이클
  const bike = (x, y) => {
    shade(x + 1, y + 2, 12, 26);
    R(x, y + 24, 14, 2, '#3A414B'); R(x, y + 2, 14, 2, '#3A414B');
    R(x + 6, y + 4, 2, 21, '#59616B');
    R(x + 3, y + 4, 8, 6, '#2A2F36'); R(x + 4, y + 5, 6, 4, '#4A525C'); R(x + 4, y + 5, 6, 0.5, '#7E8794');
    R(x + 2, y + 10, 10, 1.5, '#8A939E');
    R(x + 5, y + 7, 4, 3, '#0E2A36'); R(x + 5.5, y + 7.5, 3, 0.5, '#29E0FF');
    R(x + 3, y + 15, 2, 2, '#2A2F36'); R(x + 9, y + 15, 2, 2, '#2A2F36');
    R(x + 5, y + 19, 4, 3, '#16191D'); R(x + 5, y + 19, 4, 0.5, '#3A414B');
  };
  // 파워랙 (바벨은 매 프레임 그린다)
  const rack = (x, y) => {
    shade(x, y, 34, 34);
    R(x, y, 34, 34, '#363C44'); R(x + 2, y + 2, 30, 30, '#6B5240');
    for (let j = y + 6; j < y + 32; j += 6) R(x + 2, j, 30, 0.5, '#5A4430');
    R(x + 1, y + 1, 1, 32, '#59616B'); R(x + 32, y + 1, 1, 32, '#59616B'); R(x, y, 34, 1.5, '#4A525C'); R(x, y + 32.5, 34, 1.5, '#4A525C');
    [[x, y], [x + 31, y], [x, y + 31], [x + 31, y + 31]].forEach((q) => { R(q[0], q[1], 3, 3, '#1D2126'); R(q[0], q[1], 3, 0.5, '#7E8794'); });
    R(x + 1, y + 10, 2.5, 1.5, '#C9CED3'); R(x + 30.5, y + 10, 2.5, 1.5, '#C9CED3');
  };
  const bench = (x, y) => {
    shade(x, y, 12, 28);
    R(x + 1, y + 2, 10, 1.5, '#59616B'); R(x + 1, y + 24, 10, 1.5, '#59616B');
    R(x + 3, y, 6, 28, '#16191D'); R(x + 3, y, 6, 0.5, '#3A414B');
    R(x - 0.5, y - 3, 1.5, 6, '#59616B'); R(x + 11, y - 3, 1.5, 6, '#59616B');
    R(x - 6, y - 1, 24, 1, '#B9C0C8'); R(x - 8, y - 3.5, 2.5, 6, '#2A2A2A'); R(x + 17.5, y - 3.5, 2.5, 6, '#2A2A2A');
  };
  const dumbbells = (x, y, w) => {
    shade(x, y, w, 12); R(x, y, w, 12, '#59616B'); R(x, y, w, 1, '#7E8794'); R(x, y + 10.5, w, 1.5, '#3A414B');
    for (let i = 0; i < 9; i++) { const dx = x + 3 + i * 8; [2, 6.5].forEach((dy) => { R(dx, y + dy, 1.5, 3, '#1D2126'); R(dx + 4, y + dy, 1.5, 3, '#1D2126'); R(dx + 1.5, y + dy + 1, 2.5, 1, '#9AA3AE'); }); }
  };
  TREAD_X.forEach((x) => treadmill(x, TREAD_Y));
  BIKE_X.forEach((x) => bike(x, BIKE_Y));
  rack(RACK[0], RACK[1]);
  bench(1270, 556);
  for (let k = 0; k < 4; k++) { disc(1300 + k * 7, 566, 2.5, 0.8, '#2A2A2A'); R(1298.5 + k * 7, 561.5, 3, 1, '#2A2A2A'); R(1299 + k * 7, 565, 1, 0.5, '#59616B'); }
  dumbbells(1224, 626, 76);
  // 스트레칭 매트
  [1024, 1070].forEach((mx) => { shade(mx, 612, 42, 24); R(mx, 612, 42, 24, '#2F5D8A'); R(mx, 612, 42, 1, '#4C7FB0'); for (let k = 1; k < 4; k++) R(mx, 612 + k * 6, 42, 0.5, '#28507A'); });
  // 트레이너 데스크(체력 데이터 화면) · 체성분 측정기 · 정수기
  shade(1134, 616, 32, 12); R(1134, 616, 32, 12, '#59616B'); R(1134, 616, 32, 1, '#7E8794');
  R(1137, 606, 26, 11, '#101418'); R(1138, 607, 24, 9, '#0E2A36');
  [3, 6, 4, 8, 5, 7].forEach((v, k) => R(1140 + k * 3.5, 615 - v, 2, v, k % 2 ? '#45F08A' : '#29E0FF'));
  R(1139, 608, 10, 0.5, '#7FE3FF');
  shade(1180, 612, 10, 18); R(1180, 622, 10, 8, '#C9CED3'); R(1181, 623, 8, 6, '#E8ECEF'); R(1183, 612, 4, 11, '#8E959C'); R(1181, 610, 8, 4, '#101418'); R(1182, 611, 6, 2, '#29E0FF');
  shade(1314, 608, 10, 16); R(1314, 608, 10, 16, '#E8ECEF'); R(1315, 609, 8, 5, '#7FB8E0'); R(1316, 617, 2, 1.5, '#3C7BB8'); R(1320, 617, 2, 1.5, '#D33A3A');
  // 간판 · 복도 표찰
  map.signs.push({ t: '체력단련실', x: 1172, y: 520, k: 'big' });
  const plate = map.signs.find((q) => q.t === '1생활관');
  if (plate) { plate.t = '체력단련실'; plate.bg = '#2E4A6A'; plate.w = null; }
}
// 체력단련실 자리 정보 (새 좌표) — 평소 캐릭터 배치에서 빼고, 평소 모드가 운동 인원을 보낼 자리를 공개한다
function gymData(map) {
  const g = RR([GYM.x0, GYM.y0, GYM.x1, GYM.y1]), x0 = g[0], y0 = g[1], x1 = g[2], y1 = g[3], P = (x, y) => RM(x, y);
  // 평소 캐릭터가 이 방에 배치되지 않도록 방·좌석 기록에서 뺀다
  const inG = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  if (map.rooms) for (let i = map.rooms.length - 1; i >= 0; i--) { const r = map.rooms[i]; if (r.name === '1생활관' || inG((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)) map.rooms.splice(i, 1); }
  if (map.seatDefs) for (let i = map.seatDefs.length - 1; i >= 0; i--) if (inG(map.seatDefs[i].x, map.seatDefs[i].y)) map.seatDefs.splice(i, 1);
  // 평소 모드(job B)가 운동 인원을 보낼 수 있게 공개: 서 있을 자리(x, y=발 위치)와 방향
  //   cycle 자리는 앉은 자세(half: true)로 그리면 안장 위에 맞는다
  const spots = [];
  const at = (x, y, kind, dir) => { const p = P(x, y); spots.push({ x: p[0], y: p[1], kind, dir }); };
  TREAD_X.forEach((x) => at(x + 9, 582, 'treadmill', 'up'));
  BIKE_X.forEach((x) => at(x + 7, 577, 'cycle', 'up'));
  at(1239, 580, 'weights', 'down'); at(1252, 622, 'weights', 'down'); at(1284, 622, 'weights', 'down');
  const d = P(1330, 594);
  map.gym = { x0, y0, x1, y1, name: '체력단련실', door: { x: d[0], y: d[1] }, spots };
}

function bakeCafe(map, { R, speck, shade }) {
  // 밀리테리아 오른쪽 아래: 스마트 카페 (손님은 카운터 북쪽, 바리스타 로봇은 남쪽)
  R(394, 286, 48, 28, '#BDB8A6'); speck(394, 286, 48, 28, ['#C6C1B0', '#B3AE9C'], 340);
  [406, 422, 438].forEach((x) => R(x, 286, 0.5, 28, '#A7A290')); R(394, 304, 48, 0.5, '#A7A290');
  // 뒤쪽 벽: 에스프레소 머신 · 컵 타워 · 얼음·우유 디스펜서
  shade(400, 297, 18, 14); R(400, 297, 18, 14, '#2E3540'); R(400, 297, 18, 2, '#C9CED3'); R(401, 299.5, 16, 1, '#4A525C');
  R(403, 304, 3, 3, '#9AA3AE'); R(412, 304, 3, 3, '#9AA3AE'); R(402, 308.5, 14, 2, '#59616B'); R(408, 300.5, 2, 1, '#45F08A');
  for (let k = 0; k < 3; k++) R(402 + k * 3, 295.5, 2, 1.5, '#F4F4F0');
  shade(421, 298, 5, 11); for (let k = 0; k < 5; k++) { R(421.5, 298 + k * 2, 4, 2, '#DCEFF7'); R(421.5, 298 + k * 2, 4, 0.5, '#FFFFFF'); }
  shade(430, 296, 12, 15); R(430, 296, 12, 15, '#E8ECEF'); R(431, 297, 10, 5, '#7FB8E0'); R(432, 298, 3, 0.5, '#FFFFFF'); R(434, 305, 4, 3, '#3C7BB8'); R(431, 309, 10, 1, '#C9CED3');
  // 로봇 받침대
  R(421, 288.5, 8, 5, '#59616B'); R(422, 288.5, 6, 1, '#7E8794'); R(421, 293, 8, 0.5, '#3A414B');
  // 카운터 (상판 + 남쪽 앞면)
  shade(396, 272, 46, 15);
  R(396, 272, 46, 10, '#EEF1F3'); R(396, 272, 46, 1, '#FFFFFF'); R(396, 281.5, 46, 0.5, '#C9CED3');
  R(396, 282, 46, 5, '#6B5240'); R(396, 282, 46, 0.5, '#86664E'); R(396, 272, 1, 15, '#C9CED3');
  // 샌드위치 온장고
  R(398, 265.5, 17, 11.5, '#7D848C'); R(399, 266.5, 15, 9, '#FFE2B0'); R(399, 266.5, 15, 0.5, '#FF9A3C');
  for (let k = 0; k < 3; k++) { const sx = 400 + k * 4.5; R(sx, 269.5, 3.5, 3, '#E8C98A'); R(sx + 0.5, 270.5, 2.5, 0.5, '#5E9A3A'); R(sx + 0.5, 271, 2.5, 0.5, '#C2522C'); R(sx, 269.5, 3.5, 0.5, '#F4DCA8'); }
  R(399, 273.5, 15, 1.5, '#C9CED3'); R(399.5, 267, 3, 0.5, '#FFFFFF');
  // 픽업 패드
  R(428, 274, 12, 6, '#1D222A'); R(429, 275, 10, 4, '#123A4A'); R(429, 275, 10, 0.5, '#29BDFD'); R(429, 278.5, 10, 0.5, '#1E7FA0');
}

function bakePad(map, { R, speck }) {
  // 차량 정비고: 다족 보행 정찰로봇 정밀 점검 패드
  R(1604, 138, 48, 44, '#8E918C'); speck(1604, 138, 48, 44, ['#979A95', '#858883'], 420);
  for (let x = 1612; x < 1650; x += 8) R(x, 140, 0.5, 40, 'rgba(255,255,255,0.12)');
  for (let y = 146; y < 180; y += 8) R(1606, y, 44, 0.5, 'rgba(255,255,255,0.12)');
  for (let x = 1604; x < 1652; x += 4) { R(x, 138, 2, 1.5, '#E2BB3D'); R(x + 2, 138, 2, 1.5, '#1F1F1F'); R(x, 180.5, 2, 1.5, '#E2BB3D'); R(x + 2, 180.5, 2, 1.5, '#1F1F1F'); }
  for (let y = 138; y < 182; y += 4) { R(1604, y, 1.5, 2, '#E2BB3D'); R(1604, y + 2, 1.5, 2, '#1F1F1F'); R(1650.5, y, 1.5, 2, '#E2BB3D'); R(1650.5, y + 2, 1.5, 2, '#1F1F1F'); }
  R(1606, 124, 6, 14, '#3A4048'); R(1606, 124, 6, 1, '#565E68'); R(1607, 125.5, 4, 4, '#0E2A36'); R(1607.5, 126, 3, 0.5, '#29BDFD'); R(1608, 131, 2, 1, '#45F08A');
  map.signs.push({ t: '정밀 점검', x: 1630, y: 127, k: 'small' });
}

function bakeLockerPads(map, { R }) {
  // 생활관 개인 화기 보관함마다 생체 인식 패드 (보관함 오른쪽 틀)
  (map.rooms || []).forEach((r) => {
    if (r.door == null || r.y0 == null) return;
    const left = r.door > 1220, lx = left ? r.door + 8 : r.door - 52, top = r.y0 - 44 + 1;
    R(lx + 40.5, top + 9, 2.5, 4, '#1D222A'); R(lx + 41, top + 9.5, 1.5, 2, '#29BDFD'); R(lx + 41, top + 12, 1.5, 0.5, '#45F08A');
  });
}

// ---------------------------------------------------------------- 그리기 도우미
const vis = (map, x0, y0, x1, y1) => { const z = map.z, a = (x0 - map.cxs) * z, b = (y0 - map.cys) * z, r = (x1 - map.cxs) * z, d = (y1 - map.cys) * z; return r > 0 && a < 1600 && d > 0 && b < 900; };
const clamp01 = (u) => Math.max(0, Math.min(1, u));
const smooth = (u) => { u = clamp01(u); return u * u * (3 - 2 * u); };
const fxU = (S, n) => (S && S.fx[n] ? (S.T - S.fx[n].t0) * (S.fx[n].rate || 1) : -1); // 효과 안의 시간 (rate배)
const fxOn = (S, n) => { const u = fxU(S, n); return u >= 0 && u <= S.fx[n].dur; };
function seg(map, c, x0, y0, x1, y1, w, col) {
  const dx = x1 - x0, dy = y1 - y0, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 2));
  for (let i = 0; i <= n; i++) { const u = i / n; map.wrect(c, x0 + dx * u - w / 2, y0 + dy * u - w / 2, w, w, col); }
}
// 2관절 팔: 어깨(sx, sy)에서 목표로. pick 'up' = 팔꿈치를 위로, 'back' = 오른쪽(+x)으로
function ik(sx, sy, tx, ty, l1, l2, pick) {
  const dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy) || 0.001;
  const dc = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(l1 + l2 - 0.01, d));
  const a = Math.atan2(dy, dx), b = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc))));
  const e1 = [sx + Math.cos(a + b) * l1, sy + Math.sin(a + b) * l1], e2 = [sx + Math.cos(a - b) * l1, sy + Math.sin(a - b) * l1];
  const el = pick === 'back' ? (e1[0] > e2[0] ? e1 : e2) : (e1[1] < e2[1] ? e1 : e2);
  const hx = tx - el[0], hy = ty - el[1], hd = Math.hypot(hx, hy) || 0.001;
  return { el, hand: [el[0] + hx / hd * l2, el[1] + hy / hd * l2] };
}
// 키프레임 [[u, [x, y]], ...] 사이를 부드럽게
function kf(u, keys) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (u <= keys[i][0]) { const a = keys[i - 1], b = keys[i], k = smooth((u - a[0]) / Math.max(0.001, b[0] - a[0])); return [a[1][0] + (b[1][0] - a[1][0]) * k, a[1][1] + (b[1][1] - a[1][1]) * k]; }
  }
  return keys[keys.length - 1][1];
}
function glowAt(map, c, x, y, rgb, size, a) {
  const p = map.w2s(x, y), G = size * map.z;
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.max(0, Math.min(1, a));
  c.drawImage(map.glow(rgb), p[0] - G / 2, p[1] - G / 2, G, G);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
}
function pillAt(map, c, text, x, y, style, a) {
  const p = map.w2s(x, y); c.globalAlpha = Math.max(0, Math.min(1, a == null ? 1 : a)); map.pill(c, text, p[0], p[1], style); c.globalAlpha = 1;
}
// 아이스 카페라테 컵 (x = 가운데, y = 컵 윗면). 1.4배로 키워 그린다
export function cup(map, c, x, y, fill, ice) {
  const K = 1.4, W = (a, b, w, h, col) => map.wrect(c, x + (a - x) * K, y + (b - y) * K, w * K, h * K, col);
  W(x - 1.75, y - 0.25, 3.5, 5, '#4A5562'); W(x - 1.5, y, 3, 4.5, '#DCEFF7');
  if (fill > 0) { const lh = 4 * clamp01(fill); W(x - 1.25, y + 4.25 - lh, 2.5, lh, '#EDE3D2'); W(x - 1.25, y + 4.25 - lh, 2.5, Math.min(lh, 1.2), '#9A6A44'); }
  if (ice) { W(x - 1, y + 1, 1, 1, '#FFFFFF'); W(x + 0.25, y + 1.75, 1, 1, '#E8F7FF'); }
  W(x + 0.5, y - 2, 0.5, 2.5, '#2E7D4A');
}

// ---------------------------------------------------------------- 매 프레임
export function drawProps(map, c, t, S) {
  drawGymDyn(map, c, t, S);
  map.local('mess', () => drawCafe(map, c, t, S)); // 원래 좌표로 적힌 소품은 블록 자리로 옮겨 그린다
  map.local('fac', () => drawRig(map, c, t, S));
  driveTiger(map, S);
  if (!S) return;
  drawPerim(map, c, t, S);
  drawFaceScan(map, c, t, S);
  drawWall(map, c, t, S);
  drawDecide(map, c, t, S);
  map.local('drone', () => drawDrones(map, c, t, S));
}

// 주둔지 경계작전(시연 6): 남서 울타리 밖 멧돼지 → CCTV 03 감지 → 숲 정찰 드론·경계로봇 RQ-01 출동 → 열화상 판별 → 상황 종료
//   cctv = 카메라 머리, boar = 멧돼지 발 위치(울타리 밖 숲), robot → stop = 울타리 안 순찰로, drone0 = 숲 정찰로 위 드론 출발점
export const PERIM = { cctv: [10, 785], boar: [224, 840], robot: [364, 800], stop: [236, 800], drone0: [564, 858] }; // 새 좌표 (울타리 y 812, 밖은 둘레 숲)
function drawPerim(map, c, t, S) {
  const u = fxU(S, 'perim');
  if (u < 0 || u > S.fx.perim.dur) return;
  const P = PERIM, z = map.z, W = (x, y, w, h, col) => map.wrect(c, x, y, w, h, col);
  // 멧돼지: 숲 가장자리를 서성이다 판별 뒤 숲 안쪽으로 달아난다
  const flee = smooth((u - 3.2) / 1.0), bx = P.boar[0] - 5 * Math.sin(u * 0.9) - flee * 70, by = P.boar[1] + flee * 34;
  if (flee < 0.98) { c.globalAlpha = 1 - flee * flee; boarArt(map, c, bx, by, u, flee > 0); c.globalAlpha = 1; }
  if (map.camFlash && u < 1.6) map.camFlash[2] = Math.max(map.camFlash[2] || 0, 0.25);
  // CCTV 감지: 카메라에서 멧돼지까지 빨간 점선 + 감지 상자
  if (u < 2.7) {
    const a = Math.min(1, u / 0.25, (2.7 - u) / 0.3), n = 26;
    c.globalAlpha = a;
    for (let k = 1; k < n; k += 2) { const q = k / n; W(P.cctv[0] + (bx - P.cctv[0]) * q - 0.6, P.cctv[1] + (by - 4 - P.cctv[1]) * q - 0.6, 1.2, 1.2, '#FF4D4D'); }
    const p0 = map.w2s(bx - 14, by - 12), p1 = map.w2s(bx + 10, by + 3);
    c.strokeStyle = Math.floor(t * 6) % 2 ? '#FF4D4D' : '#FF9A9A'; c.lineWidth = Math.max(1.5, z * 0.5); c.strokeRect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]);
    c.globalAlpha = 1;
    pillAt(map, c, 'CCTV 03 · 울타리 외곽 움직임 감지', bx, by - 14, 'alert', a);
  }
  // 숲 정찰 드론: 정찰로에서 빠져나와 멧돼지 위에 멈추고 열화상으로 판별한 뒤 돌아간다
  if (map.VS && map.VS.drone) {
    const go = smooth((u - 0.9) / 1.0), ret = smooth((u - 3.5) / 0.9), hx = P.boar[0] + 8, hy = P.boar[1] - 4;
    const x = P.drone0[0] + (hx - P.drone0[0]) * go + (P.drone0[0] - hx) * ret, y = P.drone0[1] + (hy - P.drone0[1]) * go + (P.drone0[1] - hy) * ret, alt = 22;
    if (u > 1.9 && u < 3.3) {
      const a = Math.min(1, (u - 1.9) / 0.3, (3.3 - u) / 0.3), d = map.w2s(x, y - alt), l = map.w2s(bx - 13, by), r = map.w2s(bx + 9, by);
      c.globalAlpha = a * 0.28; c.fillStyle = '#FF9A3C'; c.beginPath(); c.moveTo(d[0], d[1]); c.lineTo(l[0], l[1]); c.lineTo(r[0], r[1]); c.closePath(); c.fill();
      glowAt(map, c, bx - 2, by - 4, '255,150,60', 20, a * 0.8); c.globalAlpha = 1;
    }
    map.wrect(c, x - 5, y + 2, 10, 2.5, 'rgba(0,0,0,0.14)');
    const p = map.w2s(x - 6, y - alt - 6);
    c.drawImage(map.VS.drone, p[0], p[1], 12 * z, 12 * z);
    if (Math.floor(t * 16) % 2) [[1.5, 1.5], [10, 1.5], [1.5, 10], [10, 10]].forEach((q) => W(x - 6 + q[0], y - alt - 6 + q[1], 0.5, 0.5, '#FFFFFF'));
    W(x - 0.5, y - alt + 3, 1, 1, Math.floor(t * 4) % 2 ? '#FF4D4D' : '#45F08A');
    if (u > 1.0 && u < 1.9) pillAt(map, c, '숲 정찰 드론 D-2 자동 출동', x, y - alt - 8, 'agent', Math.min(1, (u - 1.0) / 0.2, (1.9 - u) / 0.2));
  }
  if (u > 2.6 && u < 4.2) pillAt(map, c, 'AI 열화상 판별 · 멧돼지 1마리 · 위협 아님', P.boar[0] - 10, P.boar[1] - 32, 'agent', Math.min(1, (u - 2.6) / 0.25, (4.2 - u) / 0.3));
  // 경계로봇 RQ-01: 울타리 안 순찰로를 따라 와서 멈춰 현장을 확인하고 다시 순찰
  const w1 = smooth((u - 0.8) / 1.6), w2 = smooth((u - 3.6) / 1.4);
  const qx = P.robot[0] + (P.stop[0] - P.robot[0]) * w1 - w2 * 60, qy = P.stop[1];
  const walking = (u > 0.8 && u < 2.4) || u > 3.6;
  quad(map, c, qx, qy, { amp: walking ? 1 : 0, ph: t * 7, sit: 0, knee: 'ok', glint: 0, lamp: Math.floor(t * 3) % 2 ? '#45F08A' : '#2A6E44' }, t);
  if (u > 2.4 && u < 3.6) {
    const a = Math.min(1, (u - 2.4) / 0.2, (3.6 - u) / 0.3), s = map.w2s(qx - 17, qy - 13), e0 = map.w2s(bx - 10, by - 6), e1 = map.w2s(bx + 6, by - 2);
    c.globalAlpha = a * 0.3; c.fillStyle = '#29BDFD'; c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(e0[0], e0[1]); c.lineTo(e1[0], e1[1]); c.closePath(); c.fill(); c.globalAlpha = 1;
    pillAt(map, c, 'RQ-01 현장 확인', qx, qy - 22, 'agent', a);
  }
}
function boarArt(map, c, x, y, t, run) {
  const W = (a, b, w, h, col) => map.wrect(c, a, b, w, h, col), lg = Math.sin(t * (run ? 24 : 6)) > 0 ? 1 : 0, A = c.globalAlpha;
  c.globalAlpha = A * 0.25; W(x - 8, y + 0.5, 16, 2, '#000000'); c.globalAlpha = A;
  W(x - 6, y - 8, 13, 6.5, '#3A2A1E'); W(x - 5, y - 9, 11, 1.5, '#4E3A2A'); W(x - 6, y - 2.5, 13, 1, '#2A1E16');
  W(x - 11, y - 7, 5.5, 4.5, '#4A3628'); W(x - 12.5, y - 5, 2, 2, '#6B4A36'); W(x - 11, y - 3, 1, 1.2, '#F2EEE6'); W(x - 9.5, y - 6.5, 1, 1, '#111111'); W(x - 8, y - 8.5, 1.5, 1.5, '#3A2A1E');
  [[-5, lg], [-2, -lg], [2.5, lg], [5, -lg]].forEach((q) => W(x + q[0] + q[1] * 0.5, y - 1.5, 1.5, 2, '#22180F'));
  W(x + 7, y - 7, 1.5, 1, '#3A2A1E');
}

// TIGER 합성훈련장(tiger.js): 효과 'tiger'가 켜진 동안 훈련장 스크린·부스를 보완 훈련으로 돌린다
//   이미 몇 초 진행된 장면으로 시작(헬멧은 모두 착용, 수치는 팝업과 같은 87% · 12초)
function driveTiger(map, S) {
  const T = map.tiger; if (!T) return;
  const on = !!S && fxOn(S, 'tiger'), mine = T.live.who === 'demo';
  if (on && !mine) { T.reset(); T.start({ dur: 9, route: 'B', who: 'demo' }); T.live.t = 4.2; [0, 1, 2, 3, 4, 5].forEach((i) => T.take(i)); }
  else if (!on && mine) T.reset();
  if (on) { const u = fxU(S, 'tiger'); T.live.cover = u > 1.2 && u < 2.6 ? 0.2 : 0; }
}

// 체력단련실: 인사참모 AI가 심박을 보며 러닝머신 속도를 자동 조정 (팝업과 같은 값)
export function gymVitals(u) { const k = smooth((u - 1.2) / 3.2); return { hr: Math.round(128 + 20 * k), spd: 8.0 + 1.2 * k }; }

function drawGymDyn(map, c, t, S) {
  const D = BLOCKS.bar.d, g = RR([GYM.x0, GYM.y0, GYM.x1, GYM.y1]); // 랙·러닝머신은 원래 좌표 + 블록 이동, 배우는 새 좌표
  if (!vis(map, g[0], g[1], g[2], g[3])) return;
  const W = (x, y, w, h, col) => map.wrect(c, x, y, w, h, col);
  // 바벨: 리프터가 있으면 어깨 위에서 오르내리고, 없으면 랙 걸이에
  const lifter = S && Object.values(S.actors).find((e) => e.lift === 'squat');
  const by = lifter ? lifter.y - 15 + (Math.sin(S.T * 3.2) > 0 ? -0.8 : 0.6) : RACK[1] + D[1] + 10.5;
  const bx = RACK[0] + D[0] + 17;
  W(bx - 21, by, 42, 1, '#B9C0C8'); W(bx - 21, by, 42, 0.5, '#E2E6EA');
  W(bx - 22, by - 3, 3, 7, '#2A2A2A'); W(bx + 19, by - 3, 3, 7, '#2A2A2A'); W(bx - 19, by - 2, 1.5, 5, '#4A4A4A'); W(bx + 17.5, by - 2, 1.5, 5, '#4A4A4A');
  // 계기판 깜빡임 (평소) / 워치 연동 (시연)
  const link = S && fxOn(S, 'gymAI') ? fxU(S, 'gymAI') : -1;
  TREAD_X.forEach((x, i) => { if (Math.sin(t * 2 + i * 1.7) > 0.2) W(x + D[0] + 12, TREAD_Y + D[1] + 1.5, 1.5, 1, '#45F08A'); });
  if (link < 0) return;
  Object.values(S.actors).forEach((e) => {
    if (!e.link || e.va < 0.5) return;
    const wx = e.half ? e.x - 4.75 : e.x - 4.75, wy = e.half ? e.y - 1.5 : e.y - 7.5, cx = e.link[0], cy = e.link[1];
    for (let k = 0; k < 3; k++) { const u = ((link * 1.4 + k / 3) % 1); W(wx + (cx - wx) * u - 0.5, wy + (cy - wy) * u - 0.5, 1, 1, '#7FE3FF'); }
    if (!e.half) glowAt(map, c, cx + 5, cy, '41,224,255', 9, 0.45 + 0.2 * Math.sin(t * 6));
  });
  const kim = S.actors.kimG, tr = S.actors.trainer;
  if (kim && ((link > 1.5 && link < 2.4) || (link > 4.1 && link < 5.3))) { const v = gymVitals(link), a0 = link < 3 ? 1.5 : 4.1, a1 = link < 3 ? 2.4 : 5.3; pillAt(map, c, 'AI 자동 조정 · 심박 ' + v.hr + ' · ' + v.spd.toFixed(1) + 'km/h', kim.x, kim.y - 30, 'agent', Math.min(1, (link - a0) / 0.2, (a1 - link) / 0.2)); }
  if (tr && link > 3.6 && link < 5.4) pillAt(map, c, 'AI 권고 수신 · 정 일병 사이클 전환', tr.x, tr.y - 30, 'agent', Math.min(1, (link - 3.6) / 0.2, (5.4 - link) / 0.3));
}

function drawCafe(map, c, t, S) {
  if (!vis(map, 390, 255, 446, 318)) return;
  const W = (x, y, w, h, col) => map.wrect(c, x, y, w, h, col);
  // 온장고 김 · 픽업 패드 불빛
  for (let k = 0; k < 4; k++) { const ph = (t * 0.6 + k / 4) % 1; c.globalAlpha = (1 - ph) * 0.5; W(401 + k * 3.5 + Math.sin(t * 2 + k) * 0.8, 265 - ph * 9, 1.5 + ph, 1 + ph * 0.5, '#FFFFFF'); }
  c.globalAlpha = 1;
  glowAt(map, c, 434, 277, '41,189,253', 12, 0.25 + 0.15 * Math.sin(t * 3));
  // 바리스타 로봇 팔
  const u = fxU(S, 'barista');
  let tg, hold = false, fill = 0, ice = false;
  const H = CAFE.home, A = CAFE.cupAt, E = CAFE.spout, P = CAFE.pad;
  if (u >= 0 && u <= 3.7) {
    tg = kf(u, [[0, H], [0.6, A], [0.9, [A[0], A[1] - 2]], [1.4, E], [2.4, E], [2.75, [421, 279]], [3.0, P], [3.2, [P[0], P[1] - 3]], [3.7, H]]);
    hold = u >= 0.6 && u < 3.0; ice = u >= 0.8; fill = u < 1.4 ? 0 : (u - 1.4) / 1.0;
  } else tg = [H[0] + Math.sin(t * 0.7) * 1.5, H[1] + Math.cos(t * 0.9) * 1];
  const sh = CAFE.sh, r = ik(sh[0], sh[1], tg[0], tg[1], 13, 12, 'up'), el = r.el, hd = r.hand;
  if (u >= 1.4 && u < 2.4) { W(E[0] - 0.25, E[1] - 5, 0.5, 5, '#7A4A2A'); if (Math.floor(t * 10) % 2) W(E[0] - 0.25, E[1] - 1, 0.5, 0.5, '#B98A5E'); }
  seg(map, c, sh[0], sh[1], el[0], el[1], 3.4, '#4A5562'); seg(map, c, el[0], el[1], hd[0], hd[1], 2.8, '#4A5562');
  seg(map, c, sh[0], sh[1], el[0], el[1], 2.4, '#EEF1F4'); seg(map, c, el[0], el[1], hd[0], hd[1], 1.9, '#EEF1F4');
  W(sh[0] - 1.5, sh[1] - 1.5, 3, 3, '#29BDFD'); W(sh[0] - 0.75, sh[1] - 0.75, 1.5, 1.5, '#EEF1F4');
  W(el[0] - 1.2, el[1] - 1.2, 2.4, 2.4, '#29BDFD'); W(hd[0] - 1, hd[1] - 1, 2, 2, '#4A5562');
  W(hd[0] - 1.8, hd[1] + 0.5, 0.8, 2, '#8E959C'); W(hd[0] + 1, hd[1] + 0.5, 0.8, 2, '#8E959C');
  if (hold) cup(map, c, hd[0], hd[1] + 1, fill, ice);
  const onPad = u >= 3.0 && !(S.flags && S.flags.latte);
  if (onPad) cup(map, c, P[0], P[1] - 2, 1, true);
  if (u >= 3.0 && u <= 4.6) pillAt(map, c, '주문하신 아이스 카페라테 나왔습니다', 425, 291, 'agent', Math.min(1, (u - 3.0) / 0.2, (4.6 - u) / 0.3));
}

// 다족 보행 정찰로봇 (옆모습, 왼쪽을 본다) — 무릎 위치를 돌려준다
function quad(map, c, bx, by, o, t) {
  const W = (x, y, w, h, col) => map.wrect(c, x, y, w, h, col);
  const bob = o.amp * Math.abs(Math.sin(o.ph)) * 0.7, top = by - 17 + o.sit - bob;
  c.globalAlpha = 0.25; W(bx - 15, by - 1, 30, 2.5, '#000000'); c.globalAlpha = 1;
  const knees = {};
  const leg = (front, far) => {
    const hx = (front ? bx - 9 : bx + 9) + (far ? 1.5 : 0), hy = top + 7 - (far ? 1 : 0);
    const lp = o.ph + (front === far ? 0 : Math.PI);
    const fx = hx + o.amp * 2.6 * Math.sin(lp), fy = by - (far ? 1 : 0) - o.amp * Math.max(0, Math.cos(lp)) * 2.4;
    const r = ik(hx, hy, fx, fy, 6, 6.5, 'back'), k = r.el, f = r.hand;
    const th = far ? '#2A2E33' : '#3A3F45', sn = far ? '#23272B' : '#30353A';
    seg(map, c, hx, hy, k[0], k[1], 3, '#15181B'); seg(map, c, k[0], k[1], f[0], f[1], 2.4, '#15181B');
    seg(map, c, hx, hy, k[0], k[1], 2.2, th); seg(map, c, k[0], k[1], f[0], f[1], 1.6, sn);
    W(f[0] - 1.6, f[1] - 1, 3.2, 1.4, '#15181B');
    knees[(front ? 'F' : 'H') + (far ? 'R' : 'L')] = k;
    return k;
  };
  leg(true, true); leg(false, true);
  W(bx - 13.5, top - 0.5, 27, 9, '#15181B'); W(bx - 13, top, 26, 8, '#5B6548'); W(bx - 13, top, 26, 1.5, '#7A8560'); W(bx - 13, top + 6.5, 26, 1.5, '#3E4530');
  W(bx - 8, top + 2.5, 6, 2.5, '#4A5239'); W(bx + 1, top + 2.5, 8, 2.5, '#4A5239'); W(bx - 1.5, top + 3, 1.5, 1.5, '#C9A93A');
  const kL = leg(true, false), kH = leg(false, false);
  W(kL[0] - 1, kL[1] - 1, 2, 2, '#9AA3AE');
  const cap = o.knee === 'none' ? '#15181B' : (o.knee === 'new' ? (o.glint > 0.05 ? '#7CFFB2' : '#9AA3AE') : '#9AA3AE');
  W(kH[0] - 1.3, kH[1] - 1.3, 2.6, 2.6, cap);
  W(bx - 18, top + 0.5, 6, 6.5, '#15181B'); W(bx - 17.5, top + 1, 5, 5.5, '#3A3F44'); W(bx - 17.5, top + 2.5, 3, 2, o.visor || '#29BDFD'); W(bx - 17.5, top + 2.5, 1, 0.5, '#BFF1FF');
  W(bx + 2, top - 3, 1.5, 3, '#3A3F44'); W(bx + 0.5, top - 5, 4.5, 2.2, '#2A2F36'); W(bx + 1, top - 4.5, 3.5, 0.5, '#7FE3FF'); W(bx + 1 + ((t * 6) % 3), top - 4.5, 1, 0.5, '#FFFFFF');
  W(bx + 10, top - 1, 2, 1.2, o.lamp);
  if (o.glint > 0.05) glowAt(map, c, kH[0], kH[1], '124,255,178', 14, o.glint);
  return { knees, top };
}
// 정비 로봇 (바퀴 달린 받침 + 노란 팔, 왼쪽을 본다)
function mbot(map, c, bx, by, tg, o, t) {
  const W = (x, y, w, h, col) => map.wrect(c, x, y, w, h, col);
  c.globalAlpha = 0.25; W(bx - 9, by - 1, 18, 2.5, '#000000'); c.globalAlpha = 1;
  W(bx - 8, by - 3, 4, 3, '#15181B'); W(bx + 4, by - 3, 4, 3, '#15181B');
  W(bx - 8.5, by - 10.5, 17, 8, '#2A2410'); W(bx - 8, by - 10, 16, 7, '#E8B923'); W(bx - 8, by - 10, 16, 1.2, '#F6D25A');
  for (let k = 0; k < 4; k++) W(bx - 8 + k * 4, by - 5, 2, 1.5, '#1F1F1F');
  W(bx + 2.5, by - 12.5, 5.5, 2.5, '#59616B');
  if (o.tray) W(bx + 3, by - 14, 2.4, 2.4, o.tray === 'new' ? '#7CFFB2' : '#9A5A3A');
  if (o.trayOld) W(bx + 5.6, by - 14, 2.4, 2.4, '#9A5A3A');
  W(bx - 3.5, by - 14.5, 6, 4.5, '#3A3F44'); W(bx - 3.5, by - 14.5, 6, 1, '#59616B'); W(bx + 1, by - 13, 1, 1, Math.floor(t * 2) % 2 ? '#45F08A' : '#1E5A34');
  const sx = bx - 0.5, sy = by - 14.5, r = ik(sx, sy, tg[0], tg[1], 12, 11, 'up'), el = r.el, hd = r.hand;
  seg(map, c, sx, sy, el[0], el[1], 3.2, '#2A2410'); seg(map, c, el[0], el[1], hd[0], hd[1], 2.6, '#2A2410');
  seg(map, c, sx, sy, el[0], el[1], 2.3, '#E8B923'); seg(map, c, el[0], el[1], hd[0], hd[1], 1.8, '#E8B923');
  W(sx - 1.4, sy - 1.4, 2.8, 2.8, '#3A3F44'); W(el[0] - 1.2, el[1] - 1.2, 2.4, 2.4, '#3A3F44'); W(el[0] - 0.5, el[1] - 0.5, 1, 1, '#8E959C');
  W(hd[0] - 1.8, hd[1] - 0.5, 1, 2.6, '#59616B'); W(hd[0] + 0.8, hd[1] - 0.5, 1, 2.6, '#59616B');
  if (o.hold) W(hd[0] - 1.3, hd[1] + 0.6, 2.6, 2.6, o.hold === 'new' ? '#7CFFB2' : '#9A5A3A');
  return hd;
}

function drawRig(map, c, t, S) {
  if (!vis(map, 1590, 120, 1690, 200)) return;
  const q = RIG.quad, m = RIG.mbot;
  const qt = fxU(S, 'quadTest'), dg = fxU(S, 'diag'), sw = fxU(S, 'swap'), up = fxU(S, 'update'), ok = fxU(S, 'quadOk');
  const o = { amp: 0, ph: t * 9, sit: 0, lamp: Math.floor(t * 1.2) % 2 ? '#45F08A' : '#2A6A40', knee: 'norm', glint: 0 };
  const swDur = S && S.fx.swap ? S.fx.swap.dur : 0;
  if (qt >= 0) { const d = S.fx.quadTest.dur; if (qt <= d) o.amp = qt < d - 0.5 ? 1 : (d - qt) / 0.5; if (qt > d - 0.5) o.sit = Math.min(2, (qt - d + 0.5) * 4); }
  if (ok >= 0) { o.sit = Math.max(0, 2 - ok * 4); o.amp = ok <= S.fx.quadOk.dur ? Math.min(1, ok * 2) : 0; o.lamp = '#45F08A'; }
  const flag = dg >= 1.0 && !(sw >= 0.9);
  if (sw >= 0.9) o.knee = sw >= 2.3 ? 'new' : 'none';
  if (sw >= 2.3) o.glint = Math.max(0, 1 - (sw - 2.3) / 1.4);
  if (flag) o.lamp = Math.floor(t * 4) % 2 ? '#FF4D4D' : '#5A1E1E';
  else if (sw >= 0 && sw <= swDur) o.lamp = '#FFB020';
  else if (up >= 0 && up <= S.fx.update.dur) { o.lamp = '#29E0FF'; o.visor = Math.floor(t * 8) % 2 ? '#7FE3FF' : '#29BDFD'; }
  const rq = quad(map, c, q[0], q[1], o, t), kH = rq.knees.HL;
  // 정비 로봇 팔
  let tg = [1650 + Math.sin(t * 0.6) * 1.2, 154 + Math.cos(t * 0.8) * 0.8], hold = null, tray = null, trayOld = null;
  if (sw >= 0 && sw <= swDur + 0.1) {
    const K = [kH[0], kH[1]], A = [kH[0] + 3, kH[1] - 4], T = [m[0] + 4.5, m[1] - 16];
    tg = kf(sw, [[0, [1650, 154]], [0.6, A], [0.9, K], [1.1, A], [1.5, T], [1.7, [T[0] - 1.5, T[1]]], [2.0, A], [2.3, K], [2.5, A], [3.2, [1650, 154]]]);
    hold = sw >= 0.9 && sw < 1.5 ? 'old' : (sw >= 1.7 && sw < 2.3 ? 'new' : null);
    tray = sw < 1.7 ? 'new' : null; trayOld = sw >= 1.5 ? 'old' : null;
    if (sw > 2.25 && sw < 2.6 && Math.floor(t * 20) % 2) { map.wrect(c, K[0] + 1.5, K[1] - 2, 1, 1, '#FFF2A0'); map.wrect(c, K[0] - 2, K[1] + 1, 1, 1, '#FFFFFF'); }
  } else if (sw > swDur) trayOld = 'old';
  mbot(map, c, m[0], m[1], tg, { hold, tray, trayOld }, t);
  // 진단 오버레이
  if (dg >= 0 && dg <= S.fx.diag.dur) {
    const a = Math.min(1, dg / 0.3, (S.fx.diag.dur - dg) / 0.3), x0 = q[0] - 21, y0 = q[1] - 25, x1 = q[0] + 17, y1 = q[1] + 3, col = 'rgba(127,227,255,' + a.toFixed(2) + ')';
    [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach((b) => { map.wrect(c, b[0] - (b[2] < 0 ? 0.6 : 0), b[1] - (b[3] < 0 ? 0.6 : 0), 4, 0.6, col); map.wrect(c, b[0] - (b[2] < 0 ? 0.6 : 0), b[1] - (b[3] < 0 ? 4 : 0), 0.6, 4, col); });
    const sx = x0 + ((dg * 0.8) % 1) * (x1 - x0);
    c.globalAlpha = 0.5 * a; map.wrect(c, sx, y0, 0.6, y1 - y0, '#7FE3FF'); c.globalAlpha = 1;
    Object.keys(rq.knees).forEach((k) => { if (k === 'HL' && dg >= 1.0) return; const p = rq.knees[k]; map.wrect(c, p[0] - 1.6, p[1] - 1.6, 3.2, 0.5, '#45F08A'); map.wrect(c, p[0] - 1.6, p[1] + 1.1, 3.2, 0.5, '#45F08A'); });
  }
  if (flag) {
    const k = (t * 1.6) % 1, p = map.w2s(kH[0], kH[1]), z = map.z, r = (2 + 4 * k) * z;
    c.globalAlpha = 1 - k; c.strokeStyle = '#FF4D4D'; c.lineWidth = Math.max(1, z * 0.5); c.strokeRect(p[0] - r, p[1] - r, r * 2, r * 2); c.globalAlpha = 1;
    glowAt(map, c, kH[0], kH[1], '255,77,77', 12, 0.5 + 0.3 * Math.sin(t * 10));
    if (dg >= 1.0 && dg <= 3.0) pillAt(map, c, '좌후방 무릎 진동 +38%', kH[0], kH[1] - 3, 'alert', Math.min(1, (dg - 1.0) / 0.2, (3.0 - dg) / 0.3));
  }
  // 알고리즘 업데이트: 정비수송 노드에서 로봇으로 데이터 흐름
  if (up >= 0 && up <= S.fx.update.dur) {
    const N = map.nodes && map.nodes.fac, F = BLOCKS.fac.d, sx = N ? N.x - F[0] : 1560, sy = N ? N.y - F[1] : 262, tx = q[0] - 14, ty = rq.top + 3;
    for (let k = 0; k < 8; k++) { const u = (up * 1.2 + k / 8) % 1; map.wrect(c, sx + (tx - sx) * u - 0.75, sy + (ty - sy) * u - 0.75, 1.5, 1.5, k % 2 ? '#7FE3FF' : '#FFFFFF'); }
    glowAt(map, c, q[0] - 2, q[1] - 10, '41,224,255', 40, 0.25 + 0.15 * Math.sin(t * 8));
    pillAt(map, c, up < S.fx.update.dur * 0.65 ? '보행 제어 알고리즘 v4.2 설치 중' : '업데이트 완료', q[0], rq.top - 6, 'agent', Math.min(1, up / 0.2, (S.fx.update.dur - up) / 0.3));
  }
  if (ok >= 0 && ok <= S.fx.quadOk.dur) pillAt(map, c, '보행 시험 정상 · 운용 준비 완료', q[0], rq.top - 6, 'agent', Math.min(1, ok / 0.2, (S.fx.quadOk.dur - ok) / 0.3));
}

function drawFaceScan(map, c, t, S) {
  const u = fxU(S, 'faceScan'), e = S.actors.song;
  if (u < 0 || !e || u > S.fx.faceScan.dur + 0.6) return;
  const dur = S.fx.faceScan.dur, x0 = e.x - 6, y0 = e.y - 24, x1 = e.x + 6, y1 = e.y - 12, done = u >= dur;
  const a = done ? Math.max(0, 1 - (u - dur) / 0.6) : Math.min(1, u / 0.2);
  // 단말기 빛줄기
  if (!done) {
    const k = KIOSK, p0 = map.w2s(k[0], k[1]), pa = map.w2s(x1, y0), pb = map.w2s(x1, y1);
    c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(41,189,253,' + (0.22 * a).toFixed(3) + ')';
    c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(pa[0], pa[1]); c.lineTo(pb[0], pb[1]); c.closePath(); c.fill();
    c.globalCompositeOperation = 'source-over';
    glowAt(map, c, k[0], k[1], '41,189,253', 10, 0.8);
  }
  const col = done || u > dur - 0.3 ? '#45F08A' : '#7FE3FF';
  c.globalAlpha = a;
  [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach((b) => { map.wrect(c, b[0] - (b[2] < 0 ? 3 : 0), b[1] - (b[3] < 0 ? 0.5 : 0), 3, 0.5, col); map.wrect(c, b[0] - (b[2] < 0 ? 0.5 : 0), b[1] - (b[3] < 0 ? 3 : 0), 0.5, 3, col); });
  if (!done && u < 1.3) map.wrect(c, x0 + 0.5, y0 + ((u * 1.5) % 1) * (y1 - y0), x1 - x0 - 1, 0.5, '#BFF1FF');
  if (!done && u >= 1.3) { const k = (t * 3) % 1, ex = e.x + 2.25, ey = e.y - 16.5, r = 0.8 + k * 1.6; c.globalAlpha = a * (1 - k); map.wrect(c, ex - r, ey - r, r * 2, 0.4, '#7FE3FF'); map.wrect(c, ex - r, ey + r, r * 2, 0.4, '#7FE3FF'); map.wrect(c, ex - r, ey - r, 0.4, r * 2, '#7FE3FF'); map.wrect(c, ex + r, ey - r, 0.4, r * 2, '#7FE3FF'); }
  c.globalAlpha = 1;
  const label = done || u > dur - 0.3 ? '출입 승인' : (u < 1.3 ? '안면 인식 중' : '홍채 스캔 중');
  pillAt(map, c, label + (done ? '' : ' · ' + Math.max(1, Math.ceil(dur - u)) + '초'), e.x, y0 - 2, 'agent', a);
}

// 전투통제실 멀티비전 (훈련 성과 분석 회의 · 핵심 장면)
//   1단계: 지난주 TIGER 결과 · 드론 훈련 영상 · AI 계획 도출 · 체력·건강 데이터
//   2단계: 다음 주 훈련 계획 A·B·C 카드 (B안 AI 추천)
//   3단계: 디지털 트윈 다음 주 일정표 · 가상 일정 100회 · B안 카드
//   4단계: B안 카드에 '지휘관 결심'
// 다음 주 훈련 계획 3안 (이름, 예상 성과 향상 %, 한 줄 평)
const COA = { A: ['야외 전술훈련 집중', 62, '기상 영향 큼 · 부상 위험'], B: ['TIGER 반복 + 야외 병행', 91, '취약 과목 집중 보완'], C: ['야간 훈련 확대', 74, '피로도 증가 · 일정 부담'] };
function drawWall(map, c, t, S) {
  const u = fxU(S, 'wall');
  if (u < 0 || !map.wall || map.wall.length < 4) return;
  const f = S.fx.wall, P = f.p || {}, p2 = P.p2 || 4.4, p3 = P.p3 || 7.2, p4 = P.p4 || 9.8;
  if (u > f.dur + 10) return;
  const z = map.z, big = z >= 2.4;
  const kinds = [['tiger', 'recon', 'derive', 'health'], ['summary', 'coaA', 'coaB', 'coaC'], ['summary', 'twin', 'sim', 'coaB']];
  const starts = [0, p2, p3], phase = u < p2 ? 0 : (u < p3 ? 1 : 2);
  map.wall.forEach((s, i) => {
    const x = s[0], y = s[1], w = s[2], h = s[3];
    if (!vis(map, x, y, x + w, y + h)) return;
    const on = u - starts[phase] - i * 0.25;
    const p = map.w2s(x, y), pw = Math.round(w * z), ph = Math.round(h * z);
    const wipe = on < 0 ? 0 : Math.min(1, on / 0.35);
    if (wipe < 1) { if (phase > 0) wallScreen(map, c, kinds[phase - 1][i], p, pw, ph, z, big, u - starts[phase - 1] - i * 0.25, t, u >= p4, 1); else if (on >= 0) { c.fillStyle = '#061424'; c.fillRect(p[0], p[1], pw, ph); } } // 새 화면이 위에서 덮을 때까지 이전 화면을 둔다
    if (on >= 0) wallScreen(map, c, kinds[phase][i], p, pw, ph, z, big, on, t, u >= p4, wipe);
    if (on >= 0 && on < 0.5) { c.globalAlpha = (1 - on / 0.5) * 0.6; c.fillStyle = '#BFF3FF'; c.fillRect(p[0], p[1] + ph * Math.min(1, on / 0.35) - 2, pw, 3); c.globalAlpha = 1; }
  });
}
function wallScreen(map, c, kind, p, pw, ph, z, big, on, t, decided, wipe) {
  const F = '12px Galmuri11, sans-serif', B = '700 12px Galmuri11, sans-serif', B24 = '700 24px Galmuri11, sans-serif';
  const T = (s, x, y, font, col, al) => { c.font = font; c.fillStyle = col; c.textAlign = al || 'left'; c.textBaseline = 'middle'; c.fillText(s, Math.round(x), Math.round(y)); };
  const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const isB = kind === 'coaB', gold = '#C9A93A';
  const heads = {
    tiger: ['지난주 TIGER 합성훈련', '#2E6FA0'], recon: ['드론 훈련 영상 분석', '#2E7A5E'], derive: ['AI 참모 · 훈련 계획 도출', '#5A4A9A'], health: ['체력·건강 데이터', '#7A3A62'],
    summary: ['AI 참모 · 다음 주 훈련 계획 3안', '#5A4A9A'], coaA: ['A안', '#3A4356'], coaB: [decided ? 'B안 · 지휘관 결심' : 'B안 · AI 추천', gold], coaC: ['C안', '#3A4356'],
    twin: ['디지털 트윈 · 다음 주 일정', '#2E7A5E'], sim: ['일정 시뮬레이션', '#2E6FA0']
  };
  const hd = heads[kind], hh = Math.round(6 * z);
  c.save(); c.beginPath(); c.rect(p[0], p[1], pw, ph * wipe); c.clip();
  R(p[0], p[1], pw, ph, '#061424'); R(p[0], p[1], pw, hh, hd[1]);
  if (isB) { R(p[0], p[1] + ph - 2, pw, 2, gold); R(p[0], p[1], 2, ph, gold); R(p[0] + pw - 2, p[1], 2, ph, gold); }
  if (!big) {
    const bars = { tiger: [0.78, 0.88, 0.9], health: [0.76, 0.18, 0.05], summary: [0.62, 0.91, 0.74], coaA: [0.62], coaB: [0.91], coaC: [0.74], sim: [Math.min(1, on / 2)], derive: [Math.min(1, on / 3)] }[kind] || [0.6, 0.4];
    bars.forEach((v, k) => R(p[0] + 4, p[1] + hh + 6 + k * 8, (pw - 8) * v, 4, isB ? gold : '#3FC4F2'));
    c.restore(); return;
  }
  T(hd[0], p[0] + 8, p[1] + hh / 2 + 1, B, isB ? '#2A1C00' : '#FFFFFF');
  const x0 = p[0] + 8, top = p[1] + hh + 4, iw = pw - 16, ih = ph - hh - 8;
  const terrain = (tx, ty, tw, th) => {
    R(tx, ty, tw, th, '#16301F');
    for (let k = 0; k < 4; k++) { R(tx + tw * (0.08 + k * 0.05), ty + th * (0.18 + k * 0.08), tw * (0.3 - k * 0.05), 1, '#2F5A3A'); R(tx + tw * (0.55 + k * 0.04), ty + th * (0.1 + k * 0.1), tw * (0.26 - k * 0.05), 1, '#2F5A3A'); }
    R(tx, ty + th * 0.62, tw, 3, '#24507A');
    R(tx + tw * 0.8 - 1, ty + th * 0.12, 2, 10, '#E8E8E8'); R(tx + tw * 0.8 + 1, ty + th * 0.12, 8, 5, Math.floor(t * 3) % 2 ? '#FFC247' : '#C9A93A'); // 훈련 목표 지점
  };
  if (kind === 'tiger') {
    [['1중대', 78], ['2중대', 88], ['3중대', 90]].forEach((r, k) => {
      const ry = top + 10 + k * 20, low = r[1] < 80;
      T(r[0], x0, ry, F, '#E8F4FF'); R(x0 + 48, ry - 5, iw - 100, 10, '#123050');
      R(x0 + 48, ry - 5, (iw - 100) * r[1] / 100 * Math.min(1, Math.max(0, (on - 0.2 - k * 0.15) / 0.6)), 10, low ? '#FFC247' : '#3FC4F2'); T(r[1] + '점', x0 + iw, ry, F, low ? '#FFE08A' : '#FFFFFF', 'right');
    });
    T('보완 1중대 · 엄폐 간격 · 노출 시간', x0, top + 76, F, '#FFE08A');
  } else if (kind === 'recon') {
    terrain(x0, top + 2, iw * 0.56, ih - 6);
    R(x0 + iw * 0.56 * ((on * 0.35) % 1), top + 2, 2, ih - 6, 'rgba(127,227,255,0.8)');
    [[0.3, 0.55], [0.42, 0.62]].forEach((q) => { const bx = x0 + iw * 0.56 * q[0], by = top + 2 + (ih - 6) * q[1]; R(bx - 3, by - 3, 6, 6, '#FFC247'); });
    T('분대 기동 영상 12건', x0 + iw * 0.6, top + 12, B, '#FFFFFF'); T('2분대 노출 48초', x0 + iw * 0.6, top + 32, F, '#FFE08A'); T('엄폐 간격 넓음', x0 + iw * 0.6, top + 50, F, '#FFE08A'); T('AI 영상 분석', x0 + iw * 0.6, top + 72, F, '#7FE3FF');
  } else if (kind === 'derive') {
    T('훈련 데이터 1,284건 분석', x0, top + 12, F, '#C9D6E2');
    const k = Math.min(1, Math.max(0, (on - 0.2) / 2.6));
    R(x0, top + 26, iw, 10, '#1E1840'); R(x0, top + 26, iw * k, 10, k < 1 ? '#B9A6FF' : '#45F08A');
    if (k >= 1) T('훈련 계획 3안 도출', x0, top + 58, B24, '#45F08A'); else T('분석 중 ' + Math.round(k * 100) + '%', x0, top + 56, B, '#D6CCFF');
  } else if (kind === 'health') {
    [['체력 1단계', '312명', '#45F08A'], ['피로도 높음', '18명', '#FFC247'], ['미열 · 훈련 열외', '1명', '#FF8FA3']].forEach((r, k) => {
      const ry = top + 12 + k * 22; R(x0, ry - 4, 8, 8, r[2]); T(r[0], x0 + 14, ry, F, '#E8F4FF'); T(r[1], x0 + iw, ry, B, '#FFFFFF', 'right');
    });
    T('워치 412명 연동 · 인사생활 AI', x0, top + 78, F, '#9AB8D8');
  } else if (kind === 'summary') {
    ['A', 'B', 'C'].forEach((k, j) => {
      const ry = top + 12 + j * 22, b = k === 'B';
      if (b) R(x0 - 4, ry - 10, iw + 8, 20, 'rgba(201,169,58,0.25)');
      T(k + '안 ' + COA[k][0], x0, ry, b ? B : F, b ? '#FFE08A' : '#E8F4FF'); T(COA[k][1] + '%', x0 + iw, ry, B, b ? '#7CFFB2' : '#C9D6E2', 'right');
    });
  } else if (kind === 'coaA' || kind === 'coaB' || kind === 'coaC') {
    const k = kind.slice(3), d = COA[k], fill = Math.min(1, Math.max(0, (on - 0.1) / 0.8));
    T(k + '안', x0, top + 18, B24, isB ? '#FFE08A' : '#E8F4FF');
    T(d[0], x0 + 56, top + 18, B, '#FFFFFF');
    T(Math.round(d[1] * fill) + '%', x0 + iw, top + 18, B24, isB ? '#7CFFB2' : '#C9D6E2', 'right');
    R(x0, top + 40, iw, 8, '#1A2030'); R(x0, top + 40, iw * d[1] / 100 * fill, 8, isB ? '#45F08A' : '#7F8B9E');
    T(d[2], x0, top + 64, F, isB ? '#C9F5D8' : '#9AA6B8');
    if (isB && !decided) { R(x0 + iw - 64, top + 54, 64, 20, gold); T('AI 추천', x0 + iw - 32, top + 65, B, '#2A1C00', 'center'); }
    if (isB && decided) { R(x0 + iw - 100, top + 52, 100, 24, '#FFC247'); R(x0 + iw - 98, top + 54, 96, 20, '#2A1C00'); T('지휘관 결심', x0 + iw - 50, top + 65, B, '#FFC247', 'center'); }
  } else if (kind === 'twin') {
    // 다음 주 일정표: 요일 × 오전·오후 칸이 B안으로 채워진다(수요일 비 예보 → TIGER 실내 훈련, 요일 글자를 하늘색으로)
    const days = ['월', '화', '수', '목', '금'], cw = iw / 5, rh = (ih - 18) / 2;
    const plan = [['야외', 'TIGER'], ['체력', 'TIGER'], ['TIGER', 'TIGER'], ['야외', '체력'], ['TIGER', '평가']];
    const col = { 야외: '#2E7A4A', TIGER: '#1E6A9A', 체력: '#5A4A9A', 평가: '#8A6A1A' };
    days.forEach((d, i) => {
      const cx = x0 + i * cw; T(d, cx + cw / 2, top + 7, F, i === 2 ? '#9FD3F2' : '#C9D6E2', 'center');
      plan[i].forEach((p, j) => {
        const k = Math.min(1, Math.max(0, (on - 0.15 - (i * 2 + j) * 0.12) / 0.3)), y = top + 16 + j * rh;
        R(cx + 2, y, cw - 4, rh - 3, '#0E1A2A');
        if (k > 0) { c.globalAlpha = k; R(cx + 2, y, cw - 4, rh - 3, col[p]); T(p, cx + cw / 2, y + rh / 2 - 1, F, '#FFFFFF', 'center'); c.globalAlpha = 1; }
      });
    });
  } else if (kind === 'sim') {
    const k = Math.min(1, Math.max(0, (on - 0.2) / 2.0)), n = Math.floor(k * 100);
    T('가상 일정 ' + n + '/100회', x0, top + 14, B, '#FFFFFF');
    R(x0, top + 28, iw, 8, '#123050'); R(x0, top + 28, iw * k, 8, k < 1 ? '#3FC4F2' : '#45F08A');
    if (k >= 1) { T('성과 향상 91%', x0, top + 58, B24, '#45F08A'); T('일정 충돌 0건', x0 + iw, top + 60, F, '#C9F5D8', 'right'); } else T('검증 중', x0, top + 56, F, '#9AB8D8');
  }
  c.restore();
}
// 대대장 결심 순간: 금빛 테두리와 표시
function drawDecide(map, c, t, S) {
  const u = fxU(S, 'decide'), e = S.actors.cmdr;
  if (u < 0 || !e || u > S.fx.decide.dur) return;
  const a = Math.max(0, Math.min(1, u / 0.2, (S.fx.decide.dur - u) / 0.4));
  glowAt(map, c, e.x, e.y - 8, '255,194,71', 44, 0.45 * a);
  const k = (u * 1.2) % 1, p = map.w2s(e.x, e.y - 8), r = (8 + 14 * k) * map.z;
  c.globalAlpha = a * (1 - k); c.strokeStyle = '#FFC247'; c.lineWidth = Math.max(2, map.z * 0.6); c.strokeRect(p[0] - r, p[1] - r * 0.6, r * 2, r * 1.2); c.globalAlpha = 1;
  const q = map.w2s(e.x, e.y - 31), s = '지휘관 결심 · B안';
  c.font = '700 12px Galmuri11, sans-serif';
  const w = Math.ceil(c.measureText(s).width) + 24, x = Math.round(q[0] - w / 2), y = Math.round(q[1] - 30);
  c.globalAlpha = a; c.fillStyle = '#05070A'; c.fillRect(x - 2, y - 2, w + 4, 26); c.fillStyle = '#FFC247'; c.fillRect(x, y, w, 22);
  c.fillStyle = '#2A1C00'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, x + w / 2, y + 12); c.textAlign = 'left'; c.globalAlpha = 1;
}

function drawDrones(map, c, t, S) {
  const u = fxU(S, 'drones');
  if (u < 0 || u > S.fx.drones.dur || !map.VS || !map.VS.drone) return;
  const pads = [[980, 352], [1020, 352], [980, 377], [1020, 377]], offs = [[0, 0], [-12, 9], [12, 9], [0, 18]];
  const path = [[1000, 330], [930, 240], [850, 120], [760, -140]];
  const lead = (v) => { v = clamp01(v); const f = v * (path.length - 1), i = Math.min(path.length - 2, Math.floor(f)), k = f - i; return [path[i][0] + (path[i + 1][0] - path[i][0]) * k, path[i][1] + (path[i + 1][1] - path[i][1]) * k]; };
  const vf = clamp01((u - 1.8) / 3.2), L = lead(vf * vf * (3 - 2 * vf) * 0.35 + vf * 0.65), z = map.z;
  pads.forEach((pd, k) => {
    const lift = smooth((u - 0.8 - k * 0.2) / 0.6), alt = lift * 22;
    let x = pd[0], y = pd[1];
    if (u > 1.8) { const s = smooth((u - 1.8) / 0.7); x = pd[0] + (L[0] + offs[k][0] - pd[0]) * s; y = pd[1] + (L[1] + offs[k][1] - pd[1]) * s; }
    const sh = 1 - alt / 40;
    map.wrect(c, x - 5 * sh, y + 2, 10 * sh, 2.5, 'rgba(0,0,0,' + (0.12 + 0.15 * sh).toFixed(2) + ')');
    const p = map.w2s(x - 6, y - alt - 6);
    c.drawImage(map.VS.drone, p[0], p[1], 12 * z, 12 * z);
    if (u > 0.4 && Math.floor(t * 16 + k) % 2) [[1.5, 1.5], [10, 1.5], [1.5, 10], [10, 10]].forEach((r) => map.wrect(c, x - 6 + r[0], y - alt - 6 + r[1], 0.5, 0.5, '#FFFFFF'));
    map.wrect(c, x - 0.5, y - alt + 3, 1, 1, Math.floor(t * 4 + k) % 2 ? '#FF4D4D' : '#45F08A');
    if (k === 0 && u > 2.2 && u < 4.6) pillAt(map, c, '훈련 지형 정찰 비행', x, y - alt - 8, 'agent', Math.min(1, (u - 2.2) / 0.2, (4.6 - u) / 0.3));
  });
}
