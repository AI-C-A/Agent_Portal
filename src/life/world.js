// 평소 모드 — 길찾기 그래프(문·복도·보도·도로)와 장소별 지점(좌석·작업 위치)
// 좌표는 모두 baseMap.js buildMap()의 건물·가구 좌표에서 손으로 뽑았다(원래 배치 기준).
// buildWorld()가 다 만든 뒤 remapWorld()가 한 번에 새 배치(layout.js)로 옮긴다. 블록 밖이라 따로 정한 자리는 FIX.
import { RM, RP, BLOCKS } from '../layout.js';

export const MIDS = [594, 699, 798, 896], TOPS = [544, 655, 754, 853], BOTS = [643, 742, 841, 938];
export const TABLES = [[112, 226], [262, 226], [112, 272], [262, 272]];

const NODES = [
  // 북측 보도 (y 400~416)
  ['nw0', 84, 408], ['nwX', 240, 408], ['nwM', 272, 408], ['nwP', 540, 408], ['nwE', 822, 408],
  ['stub', 868, 406], ['neW', 930, 408], ['neD', 1000, 408], ['neL', 1350, 408], ['neWa', 1540, 408], ['neA', 1664, 408], ['neE', 1734, 408],
  // 남측 보도 (y 480~496)
  ['sw0', 84, 488], ['swC', 224, 488], ['swP', 540, 488], ['swE', 822, 490],
  ['seW', 930, 490], ['seB', 1376, 488], ['seE', 1734, 488],
  // 정문 가는 세로 보도
  ['vw1', 822, 690], ['vw2', 822, 850], ['ve1', 920, 690], ['ve2', 920, 842],
  // 위병소 (아래쪽 문)
  ['gbE', 824, 948], ['gbD', 752, 948], ['gbI', 752, 925],
  // 보행 출입구 (안면인식 키오스크) — pdI↔pdO 구간이 문
  ['pdT', 960, 850], ['pdI', 960, 940], ['pdO', 960, 1004], ['off', 960, 1124], ['gpE', 919, 1010], ['gpW', 812, 1010], ['rbt', 1000, 1012],
  // 대대본부 통합관제상황실
  ['hqO', 864, 336], ['hqD', 864, 318], ['hqI', 864, 306],
  ['hbW', 657, 306], ['hbCW', 820, 306], ['hbCE', 900, 306], ['hbE', 1005, 306],
  ['htW', 657, 160], ['htD', 724, 160], ['htC', 848, 160], ['htE', 1040, 160], ['hrB', 1040, 268],
  ['hmW', 716, 270], ['hmCW', 820, 270], ['hmCE', 876, 270], ['hmE', 975, 270],
  // 병영식당 (L0 y212 · L1 y262 · L2 y306 통로, 주방 y166)
  ['msO', 272, 336], ['msD', 272, 318], ['msI', 272, 306],
  ['m2w', 108, 306], ['m2c', 252, 306],
  ['m1w', 108, 262], ['m1c', 252, 262], ['m1e', 402, 262],
  ['m0w', 108, 212], ['m0c', 252, 212], ['m0e', 402, 212],
  ['kg', 365, 204], ['ki', 365, 166], ['kw', 130, 166],
  // 의무실
  ['clO', 224, 516], ['clD', 224, 545], ['clI', 224, 575], ['clC', 262, 650], ['clB', 180, 672],
  // 연병장 (운동장 안은 트여 있어 직선 이동)
  ['pgN', 540, 552], ['pgC', 616, 690], ['pgE', 772, 690],
  ['drS', 1000, 394],
  // 수송부
  ['lotS', 1350, 392], ['lotM', 1350, 240], ['lotW', 1190, 240], ['lotE', 1470, 240],
  ['garO', 1568, 254], ['garD', 1568, 237], ['garI', 1568, 218], ['garC', 1612, 196],
  ['wash', 1540, 372], ['taO', 1664, 393], ['taI', 1664, 372],
  // 생활관 (위쪽 문 → 가운데 복도)
  ['bkO', 1376, 506], ['bkD', 1376, 530], ['bkI', 1372, 556]
];
const EDGES = [
  'nw0-nwX', 'nwX-nwM', 'nwM-nwP', 'nwP-nwE', 'nwE-stub', 'stub-neW', 'neW-neD', 'neD-neL', 'neL-neWa', 'neWa-neA', 'neA-neE',
  'sw0-swC', 'swC-swP', 'swP-swE', 'seW-seB', 'seB-seE', 'swE-seW', 'neW-seW',
  'swE-vw1', 'vw1-vw2', 'vw2-gbE', 'gbE-gbD', 'gbD-gbI',
  'seW-ve1', 've1-ve2', 've2-pdT', 'pdT-pdI', 'pdO-off', 'pdO-gpE', 'gpE-gpW', 'pdO-rbt',
  'stub-hqO', 'hqO-hqD', 'hqD-hqI', 'hqI-hbCW', 'hqI-hbCE', 'hbCW-hbW', 'hbCE-hbE', 'hbW-htW', 'htW-htD', 'htD-htC', 'htC-htE', 'htE-hrB', 'hrB-hbE',
  'hbCW-hmCW', 'hmCW-hmW', 'hmW-htD', 'hbCE-hmCE', 'hmCE-hmE', 'hmE-hbE',
  'nwM-msO', 'msO-msD', 'msD-msI', 'msI-m2c', 'm2c-m2w', 'm2w-m1w', 'm1w-m0w', 'm2c-m1c', 'm1c-m0c', 'm1e-m0e', 'm1w-m1c', 'm1c-m1e',
  'm0e-kg', 'kg-ki', 'ki-kw',
  'swC-clO', 'clO-clD', 'clD-clI', 'clI-clC', 'clI-clB', 'clC-clB',
  'swP-pgN', 'pgN-pgC', 'pgC-pgE', 'pgE-vw1', 'nwP-drS',
  'neL-lotS', 'lotS-lotM', 'lotM-lotW', 'lotM-lotE', 'lotE-garO', 'garO-garD', 'garD-garI', 'garI-garC', 'neWa-wash', 'neA-taO', 'taO-taI',
  'seB-bkO', 'bkO-bkD', 'bkD-bkI'
];
// 횡단보도가 없는 도로 횡단·대기줄 옆 통로는 비용을 높여 꼭 필요할 때만
const EDGES_K = [['nw0-sw0', 1.7], ['nwX-swC', 1.7], ['nwP-swP', 1.7], ['neE-seE', 1.7], ['neL-seB', 1.7], ['m0w-m0c', 1.4], ['m0c-m0e', 1.4]];

export function buildWorld(map) {
  const W = { map, nodes: {}, spots: {}, spotList: [], rooms: [], adminRooms: [], cache: new Map() };
  const N = (id, x, y, o) => { const n = Object.assign({ id, x, y, adj: [] }, o || {}); W.nodes[id] = n; return n; };
  const E = (a, b, k, flag) => {
    const A = W.nodes[a], B = W.nodes[b]; if (!A || !B) return;
    const w = Math.hypot(A.x - B.x, A.y - B.y) * (k || 1) + 0.01;
    A.adj.push({ to: b, w, k: k || 1, flag }); B.adj.push({ to: a, w, k: k || 1, flag });
  };
  // map이 주는 방·체력단련실·TIGER 자리는 새 좌표라 원래 배치로 되돌려 쓴다
  const DB = BLOCKS.bar.d, DT = BLOCKS.tiger.d, back = (p, d) => [p[0] - d[0], p[1] - d[1]];
  const rooms0 = (map.rooms || []).map((r) => Object.assign({}, r, { x0: r.x0 - DB[0], x1: r.x1 - DB[0], y0: r.y0 - DB[1], y1: r.y1 - DB[1], door: r.door - DB[0], mid: r.mid - DB[1] }));
  NODES.forEach((q) => N(q[0], q[1], q[2]));
  W.nodes.off.dead = true;
  EDGES.forEach((s) => { const p = s.split('-'); E(p[0], p[1]); });
  EDGES_K.forEach((q) => { const p = q[0].split('-'); E(p[0], p[1], q[1]); });
  E('pdI', 'pdO', 1, 'ped');
  // 생활관 복도와 방 문
  for (let k = 0; k < 4; k++) {
    const m = MIDS[k];
    N('co' + k, 1372, m); N('dL' + k, 1333, m); N('rL' + k, 1305, m); N('dR' + k, 1419, m); N('rR' + k, 1450, m);
    E(k ? 'co' + (k - 1) : 'bkI', 'co' + k); E('co' + k, 'dL' + k); E('dL' + k, 'rL' + k); E('co' + k, 'dR' + k); E('dR' + k, 'rR' + k);
  }

  const S = (id, x, y, dir, node, appr, o) => {
    const s = Object.assign({ id, x, y, dir: dir || 'down', node, appr: appr || [], half: false, occ: null, owner: null, lane: null, place: '' }, o || {});
    W.spots[id] = s; W.spotList.push(s); return s;
  };
  W.S = S;

  // ---- 병영식당 ----
  const laneNode = (ly, sx) => {
    const c = ly === 212 ? ['m0w', 'm0c', 'm0e'] : ly === 262 ? ['m1w', 'm1c', 'm1e'] : ['m2w', 'm2c', 'msI'];
    let best = c[0], bd = 1e9; c.forEach((id) => { const d = Math.abs(W.nodes[id].x - sx); if (d < bd) { bd = d; best = id; } }); return best;
  };
  W.messSeats = [];
  TABLES.forEach((tb, ti) => {
    for (let i = 0; i < 6; i++) {
      const sx = tb[0] + 11 + i * 22;
      [0, 1].forEach((side) => {
        const sy = tb[1] + (side ? 27 : 1), ly = tb[1] === 226 ? (side ? 262 : 212) : (side ? 306 : 262);
        W.messSeats.push(S('mess' + ti + '_' + i + '_' + side, sx, sy, side ? 'up' : 'down', laneNode(ly, sx), [[sx, ly]],
          { half: true, place: 'mess', lane: 'mL' + ly, tb: tb, side: side, sx: sx }));
      });
    }
  });
  W.queueX = [128, 150, 170, 198, 226, 254, 282, 306]; W.queueY = 204; W.serveSlots = { 2: 0, 4: 1, 6: 2 };
  S('qIn', 112, 214, 'up', 'm0w', [], { place: 'mess' });
  S('ret', 410, 199, 'up', 'm0e', [], { place: 'mess' });
  W.rets = [396, 412, 428].map((x, i) => S('ret' + i, x, 199, 'up', 'm0e', [], { place: 'mess' }));
  // 스마트 카페(job A가 식당 오른쪽 아래에 그림): 손님은 카운터 북쪽 픽업 패드 앞
  S('cafeC', 434, 269, 'down', 'm1e', [], { place: 'mess' });
  S('kGate', 365, 190, 'down', 'kg', [], { place: 'mess' });
  S('hallC', 252, 238, 'down', 'm1c', [], { place: 'mess' });
  S('hallE', 402, 238, 'left', 'm1e', [], { place: 'mess' });
  const kit = (id, x, y) => S(id, x, y, 'up', 'ki', [[x, 166]], { place: 'mess', lane: 'K' });
  W.kitchen = [kit('stove1', 126, 158), kit('stove2', 162, 158), kit('stove3', 198, 158), kit('burner', 234, 152), kit('prep', 290, 152), kit('sink', 353, 152), kit('sink2', 384, 150), kit('fridge', 419, 160)];
  W.servers = [170, 226, 282].map((x, i) => S('srv' + i, x, 176, 'down', 'ki', [[x, 166]], { half: true, place: 'mess', lane: 'K' }));
  S('logiBot', 430, 168, 'left', 'ki', [[400, 166]], { place: 'mess', lane: 'K' });

  // ---- 상황실 ----
  const hq = (x, y, dir, node, appr) => S('hq_' + x + '_' + y, x, y, dir, node, appr, { half: true, place: 'hq' });
  W.hqSeats = [
    hq(848, 267, 'up', 'hqI', [[848, 292]]),
    hq(752, 235, 'up', 'hmW', [[752, 270]]), hq(778, 247, 'up', 'hmW', [[778, 270]]), hq(804, 259, 'up', 'hmCW', [[804, 270]]),
    hq(892, 259, 'up', 'hmCE', [[892, 270]]), hq(918, 247, 'up', 'hmCE', [[918, 270]]), hq(944, 235, 'up', 'hmE', [[944, 270]]),
    hq(676, 190, 'right', 'htW', [[657, 190]]), hq(676, 222, 'right', 'htW', [[657, 222]]),
    hq(710, 190, 'left', 'htD', [[724, 190]]), hq(710, 222, 'left', 'htD', [[724, 222]]),
    hq(684, 267, 'down', 'hbW', [[657, 250], [684, 250]]), hq(663, 287, 'right', 'hbW', [[657, 287]]), hq(705, 287, 'left', 'hbW', [[705, 306]]),
    hq(990, 200, 'up', 'hmE', [[990, 240]]), hq(1008, 224, 'right', 'hmE', [[996, 240]])
  ];
  for (let i = 0; i < 5; i++) {
    const y = 182 + i * 28;
    W.hqSeats.push(hq(641, y, 'left', y <= 238 ? 'htW' : 'hbW', [[657, y]]));
    W.hqSeats.push(hq(1055, y, 'right', y <= 238 ? 'htE' : 'hrB', [[1040, y]]));
  }
  W.hqBreak = [
    S('wall0', 690, 158, 'up', 'htW', [], { place: 'hq', act: '멀티비전 확인' }), S('wall1', 770, 158, 'up', 'htD', [], { place: 'hq', act: '멀티비전 확인' }),
    S('wall2', 848, 158, 'up', 'htC', [], { place: 'hq', act: '멀티비전 확인' }), S('wall3', 930, 158, 'up', 'htC', [], { place: 'hq', act: '멀티비전 확인' }),
    S('wall4', 1000, 158, 'up', 'htE', [], { place: 'hq', act: '멀티비전 확인' }),
    S('board', 746, 272, 'down', 'hmW', [], { place: 'hq', act: '작전 상황판 검토' }),
    S('coffee', 969, 287, 'down', 'hmE', [], { place: 'hq', act: '커피 한 잔' }),
    S('printer', 1042, 286, 'down', 'hrB', [], { place: 'hq', act: '보고서 출력' }),
    S('water', 1066, 282, 'down', 'hrB', [[1052, 272]], { place: 'hq', act: '정수기' }),
    S('radio', 648, 152, 'up', 'htW', [], { place: 'hq', act: '무전 점검' })
  ];

  // ---- 생활관 ----
  rooms0.forEach((r) => {
    const k = MIDS.indexOf(r.mid); if (k < 0) return;
    const left = r.door === 1330, top = TOPS[k], bot = BOTS[k], mid = r.mid, node = (left ? 'rL' : 'rR') + k, lane = 'R:' + r.name;
    const R = { name: r.name, k, left, top, bot, mid, node, rect: { x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1 }, lockers: [], beds: [], seats: [], tv: null, gun: null, res: [] };
    const o = (extra) => Object.assign({ place: 'room', lane, room: R }, extra || {});
    for (let i = 0; i < 5; i++) {
      const ux = left ? 1239 - 31 * i : 1484 + 31 * i, bx = ux + 21.5;
      R.lockers.push(S(lane + ':lk' + i, ux + 6, top + 34, 'up', node, [[ux + 6, mid]], o()));
      R.lockers.push(S(lane + ':lb' + i, ux + 6, bot - 31, 'down', node, [[ux + 6, mid]], o()));
      R.beds.push(S(lane + ':bt' + i, bx, top + 22, 'down', node, [[bx, mid], [bx, top + 34]], o({ half: true, sit: 'free' })));
      R.beds.push(S(lane + ':bb' + i, bx, bot - 6, 'up', node, [[bx, mid], [bx, bot - 32]], o({ half: true, sit: 'free' })));
    }
    if (left) {
      R.seats.push(S(lane + ':ta', 1072, mid - 6, 'down', node, [[1112, mid], [1072, mid - 18]], o({ half: true })));
      R.seats.push(S(lane + ':tb', 1088, mid + 18, 'up', node, [[1112, mid], [1110, mid + 18]], o({ half: true })));
      R.tv = S(lane + ':tv', 1036, mid - 18, 'up', node, [[1112, mid], [1110, mid - 20], [1042, mid - 20]], o({ half: true }));
      R.gun = S(lane + ':gun', 1300, top + 34, 'up', node, [[1300, mid]], o());
      R.gunQ = [[1300, top + 36], [1284, top + 44], [1268, top + 46]];
    } else {
      R.seats.push(S(lane + ':ta', 1664, mid - 6, 'down', node, [[1642, mid], [1664, mid - 18]], o({ half: true })));
      R.seats.push(S(lane + ':tb', 1680, mid + 18, 'up', node, [[1642, mid], [1648, mid + 18]], o({ half: true })));
      R.tv = S(lane + ':tv', 1717, mid - 18, 'up', node, [[1642, mid], [1645, mid - 20], [1712, mid - 20]], o({ half: true }));
      R.gun = S(lane + ':gun', 1452, top + 34, 'up', node, [[1452, mid]], o());
      R.gunQ = [[1452, top + 36], [1468, top + 44], [1484, top + 46]];
    }
    W.rooms.push(R);
  });
  // 행정반 (오른쪽 날개 1·2층)
  [0, 1].forEach((k) => {
    const top = TOPS[k], bot = BOTS[k], node = 'rR' + k, lane = 'A:' + k;
    const A = { k, name: k ? '2중대 행정반' : '1중대 행정반', seats: [], chief: null, top, bot };
    const o = (extra) => Object.assign({ place: 'admin', lane, room: A }, extra || {});
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) {
      const sx = 1492 + 32 * i, ly = top + (r ? 78 : 38);
      A.seats.push(S(lane + ':c' + r + i, sx, top + (r ? 70 : 34), 'up', node, [[1450, ly], [sx, ly]], o({ half: true })));
    }
    A.chief = S(lane + ':chief', 1702, top + 21, 'down', node, [[1450, top + 38], [1671, top + 38], [1671, top + 10], [1702, top + 10]], o({ half: true }));
    A.visit = S(lane + ':visit', 1694, top + 48, 'up', node, [[1450, top + 38], [1690, top + 38]], o({ act: '보고' }));
    A.printer = S(lane + ':prn', 1724, bot - 21, 'down', node, [[1450, top + 78], [1700, top + 78]], o({ act: '서류 출력' }));
    A.files = S(lane + ':file', 1444, top + 30, 'up', node, [[1450, top + 36]], o({ act: '문서 정리' }));
    W.adminRooms.push(A);
  });
  S('duty', 1399, 563, 'down', 'bkI', [[1399, 552]], { half: true, place: 'barracks' });
  S('laundry', 1356, 562, 'left', 'bkI', [], { place: 'barracks', act: '세탁물 수거함' });
  S('bkWater', 1390, 924, 'right', 'co3', [[1372, 924]], { place: 'barracks', act: '정수기' });
  for (let k = 0; k < 4; k++) {
    S('peekL' + k, 1342, MIDS[k], 'left', 'dL' + k, [], { place: 'barracks', act: '생활관 순찰' });
    S('peekR' + k, 1410, MIDS[k], 'right', 'dR' + k, [], { place: 'barracks', act: '생활관 순찰' });
  }

  // ---- 체력단련실 (job A가 map.gym을 만들면) ----
  W.gym = null;
  const g1 = map.gym, g = g1 && Object.assign({}, g1, { x0: g1.x0 - DB[0], x1: g1.x1 - DB[0], y0: g1.y0 - DB[1], y1: g1.y1 - DB[1],
    spots: (g1.spots || []).map((p) => Object.assign({}, p, { x: p.x - DB[0], y: p.y - DB[1] })) });
  if (g && isFinite(g.x0) && isFinite(g.x1) && isFinite(g.y0) && isFinite(g.y1) && Array.isArray(g.spots) && g.spots.length) {
    const cx = (g.x0 + g.x1) / 2, cy = (g.y0 + g.y1) / 2;
    let k = 0, bd = 1e9; MIDS.forEach((m, i) => { const d = Math.abs(m - cy); if (d < bd) { bd = d; k = i; } });
    const left = cx < 1336, mid = MIDS[k];
    const ex = left ? Math.min(g.x1 - 12, 1305) : Math.max(g.x0 + 12, 1450), ey = Math.max(g.y0 + 8, Math.min(g.y1 - 8, mid));
    N('gymE', ex, ey); E('gymE', (left ? 'dL' : 'dR') + k);
    W.gym = { name: g.name || '체력단련실', x0: g.x0, x1: g.x1, y0: g.y0, y1: g.y1, spots: [] };
    // 기구 사이 통로(문 높이)를 따라 걷다가 기구 앞에서 꺾는다
    const ly = Math.max(g.y0 + 10, Math.min(g.y1 - 10, ey + 3));
    g.spots.forEach((p, i) => {
      if (!p || !isFinite(p.x) || !isFinite(p.y)) return;
      if (p.x < g.x0 - 4 || p.x > g.x1 + 4 || p.y < g.y0 - 4 || p.y > g.y1 + 4) return;
      const kind = String(p.kind || '');
      const half = /bike|row|bench|seat|cycle|press|mat/i.test(kind) && !/tread|run/i.test(kind);
      W.gym.spots.push(S('gym' + i, p.x, p.y, p.dir || 'up', 'gymE', [[p.x, ly]], { place: 'gym', lane: 'G', half, kind, run: /tread|run/i.test(kind) }));
    });
    W.gym.coach = S('gymCoach', ex + (left ? -14 : 14), ly, left ? 'left' : 'right', 'gymE', [], { place: 'gym', lane: 'G' });
    W.gym.ly = ly;
    if (!W.gym.spots.length) W.gym = null;
  }

  // ---- TIGER 합성훈련장 (tiger.js가 굽는다: 연병장 남쪽 보도 → 동쪽 문 → 부스 두 줄 사이 통로) ----
  // 스크린 바로 앞은 지나다니지 않는다(머리가 스크린을 가림): 앞줄 부스도 가운데 통로에서 올라선다
  const tg = map.tiger;
  if (tg) {
    N('vtg', 822, 824); E('vtg', 'vw1'); E('vtg', 'vw2');
    N('tgW', 616, 824); E('tgW', 'vtg'); E('tgW', 'pgC');
    N('tgO', 442, 824); E('tgO', 'tgW');
    N('tgD', 424, 824); E('tgO', 'tgD');
    N('tgI', 408, 840); E('tgD', 'tgI');
    N('tgB', 360, 878); E('tgI', 'tgB');
    W.tiger = {
      pods: tg.pods.map((q, i) => { const p = back(q, DT); return S('tgPod' + i, p[0], p[1], 'up', 'tgB', [[p[0], 878]], { place: 'tiger', sit: 'free' }); }),
      rack: tg.rackFront.map((q, i) => { const p = back(q, DT); return S('tgRack' + i, p[0], p[1], 'right', 'tgB', [[376, p[1]]], { place: 'tiger' }); })
    };
  }

  // ---- 의무실 ----
  S('mDesk', 322, 626, 'up', 'clC', [[322, 650]], { place: 'clinic', act: '진료 기록 작성' });
  S('mConsult', 338, 642, 'left', 'clC', [[330, 650]], { place: 'clinic', act: '진료' });
  S('patient', 300, 642, 'right', 'clC', [], { place: 'clinic' });
  S('mCab', 134, 596, 'up', 'clI', [[134, 600]], { place: 'clinic', act: '의약품 점검' });
  S('mXray', 355, 594, 'up', 'clC', [[355, 612]], { place: 'clinic', act: '영상 판독' });
  W.beds = [123, 161, 199, 237].map((x, i) => S('bed' + i, x, 708, 'down', 'clB', [[x, 680]], { half: true, place: 'clinic' }));
  W.bedSide = [123, 161, 199, 237].map((x, i) => S('bedS' + i, x + 13, 684, 'left', 'clB', [], { place: 'clinic', act: '병상 회진' }));

  // ---- 연병장 ----
  S('stand', 616, 519, 'down', 'pgN', [[616, 552], [616, 536]], { half: true, place: 'parade' });
  S('standLow', 640, 556, 'down', 'pgN', [], { place: 'parade' });
  S('waterBot', 700, 548, 'down', 'pgN', [[640, 552]], { place: 'parade' });

  // ---- 위병소·정문 ----
  S('boothDesk', 770, 906, 'up', 'gbI', [], { place: 'gate', act: 'CCTV 모니터링' });
  S('boothWin', 722, 902, 'left', 'gbI', [], { place: 'gate', act: '출입 차량 확인' });
  S('boothBox', 782, 926, 'right', 'gbI', [], { place: 'gate', act: '출입 기록 점검' });
  S('postW', 812, 1010, 'down', 'gpW', [], { place: 'gate' });
  S('postE', 919, 1010, 'down', 'gpE', [], { place: 'gate' });
  S('robotPost', 1000, 1012, 'left', 'rbt', [], { place: 'gate' });
  S('kiosk', 960, 1004, 'up', 'pdO', [], { place: 'gate' });
  S('offBase', 960, 1124, 'down', 'off', [], { place: 'off' });

  // ---- 수송부 ----
  S('washSp', 1534, 340, 'left', 'wash', [], { place: 'motor', act: '세차' });
  S('fuelSp', 1566, 344, 'up', 'wash', [[1566, 360]], { place: 'motor', act: '주유' });
  S('liftSp', 1520, 214, 'up', 'garI', [[1540, 218]], { place: 'motor', act: '리프트 정비' });
  S('office', 1600, 172, 'left', 'garC', [], { place: 'motor', act: '정비 일지 검토' });
  S('tools', 1620, 124, 'up', 'garC', [[1592, 196], [1592, 124]], { place: 'motor', act: '공구 정리' });
  // 정찰로봇 정밀 점검 패드(job A) 둘레 — 패드 위로는 걷지 않는다
  S('techS', 1616, 193, 'up', 'garC', [], { place: 'motor', act: '정찰로봇 관절 점검' });
  S('techN', 1640, 128, 'down', 'garC', [[1592, 196], [1592, 128]], { place: 'motor', act: '정찰로봇 센서 교정' });
  S('maintBot', 1640, 214, 'left', 'garC', [], { place: 'motor' });
  W.vehicles = [
    [1150, 130, 'k151', 'K-151 61호'], [1190, 130, 'k151', 'K-151 64호'], [1230, 130, 'k151', 'K-151 72호'], [1270, 130, 'k151', 'K-151 75호'], [1410, 130, 'k151', 'K-151 78호'],
    [1330, 140, 'truck', '5톤 트럭 12호'], [1370, 140, 'truck', '5톤 트럭 15호'], [1150, 328, 'k151', 'K-151 81호'], [1190, 328, 'k151', 'K-151 83호'], [1270, 322, 'truck', '5톤 트럭 21호']
  ].filter((q) => q[0] < 1250 || q[0] > 1390).map((q, i) => { // 1250~1390 줄은 주차장을 줄이며 뺐다
    const north = q[1] < 200, sy = north ? (q[2] === 'truck' ? 186 : 182) : (q[2] === 'truck' ? 286 : 300);
    const node = q[0] < 1270 ? 'lotW' : (q[0] < 1400 ? 'lotM' : 'lotE');
    return { x: q[0], y: q[1], kind: q[2], name: q[3], spot: S('veh' + i, q[0], sy, north ? 'up' : 'down', node, [[q[0], 240]], { place: 'motor', act: q[3] + ' 점검' }) };
  });
  S('taS0', 1692, 340, 'up', 'taI', [[1664, 350], [1692, 350]], { half: true, place: 'motor' });
  S('taS1', 1722, 340, 'up', 'taI', [[1664, 350], [1722, 350]], { half: true, place: 'motor' });
  S('taS2', 1626, 372, 'up', 'taI', [], { half: true, place: 'motor' });
  S('taS3', 1705, 361, 'down', 'taI', [[1664, 350], [1705, 350]], { half: true, place: 'motor' });
  remapWorld(W);
  return W;
}

// 블록 밖이라 따로 정한 자리 (새 좌표): 줄인 주차장 통로·옮긴 드론 스테이션·수송부 행정반 앞·정문 초소
const FIX = {
  lotS: [1114, 284], lotM: [1114, 155], lotW: [1054, 155], lotE: [1194, 155],
  drS: [430, 280], neA: [1508, 296], gpE: [804, 830], gpW: [708, 830], rbt: [854, 828]
};
function remapWorld(W) {
  const DB = BLOCKS.bar.d, DM = BLOCKS.mess.d;
  for (const id in W.nodes) { const n = W.nodes[id], p = FIX[id] || RM(n.x, n.y); n.x = p[0]; n.y = p[1]; }
  for (const id in W.nodes) { const A = W.nodes[id]; A.adj.forEach((ed) => { const B = W.nodes[ed.to]; ed.w = Math.hypot(A.x - B.x, A.y - B.y) * ed.k + 0.01; }); }
  W.spotList.forEach((s) => {
    const p = RM(s.x, s.y); s.x = p[0]; s.y = p[1]; if (s.appr) s.appr = RP(s.appr);
    if (s.place === 'mess' && s.tb) { s.sx += DM[0]; s.tb = [s.tb[0] + DM[0], s.tb[1] + DM[1]]; }
  });
  W.rooms.forEach((R) => { R.top += DB[1]; R.bot += DB[1]; R.mid += DB[1]; const r = R.rect; r.x0 += DB[0]; r.x1 += DB[0]; r.y0 += DB[1]; r.y1 += DB[1]; if (R.gunQ) R.gunQ = RP(R.gunQ); });
  W.adminRooms.forEach((A) => { A.top += DB[1]; A.bot += DB[1]; });
  W.queueX = W.queueX.map((x) => x + DM[0]); W.queueY += DM[1];
  if (W.gym) { W.gym.x0 += DB[0]; W.gym.x1 += DB[0]; W.gym.y0 += DB[1]; W.gym.y1 += DB[1]; W.gym.ly += DB[1]; }
  W.vehicles.forEach((v) => { const p = RM(v.x, v.y); v.x = p[0]; v.y = p[1]; v.spot.appr = [[v.spot.x, 155]]; });
}

// 가장 짧은 길 (노드 100여 개라 단순 다익스트라로 충분, 결과는 캐시)
export function findPath(W, a, b) {
  if (a === b) return [a];
  const key = a + '>' + b, hit = W.cache.get(key);
  if (hit) return hit;
  const dist = {}, prev = {}, done = {}, open = [a];
  dist[a] = 0;
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (dist[open[i]] < dist[open[bi]]) bi = i;
    const u = open[bi]; open.splice(bi, 1);
    if (u === b) break;
    if (done[u]) continue; done[u] = true;
    const nu = W.nodes[u];
    for (const ed of nu.adj) {
      if (done[ed.to]) continue;
      if (W.nodes[ed.to].dead && ed.to !== b) continue;
      const nd = dist[u] + ed.w;
      if (dist[ed.to] === undefined || nd < dist[ed.to]) { if (dist[ed.to] === undefined) open.push(ed.to); dist[ed.to] = nd; prev[ed.to] = u; }
    }
  }
  if (dist[b] === undefined) return null;
  const out = [b]; let c = b, guard = 0;
  while (c !== a && guard++ < 500) { c = prev[c]; out.push(c); }
  out.reverse();
  if (W.cache.size > 3000) W.cache.clear();
  W.cache.set(key, out);
  return out;
}

export function nearestNode(W, x, y, test) {
  let best = null, bd = 1e18;
  for (const id in W.nodes) {
    const n = W.nodes[id]; if (n.dead || (test && !test(n))) continue;
    const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
