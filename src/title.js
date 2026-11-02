// 시작 화면 — 포털을 게임 타이틀처럼 연다: 큰 AXIS 로고, 홀로그램 AI 에이전트 7, 경계로봇·드론, ARMY CENTER 엠블럼
// 1600×900 무대 안에서 그린다(main.js가 창 크기에 맞춰 무대를 키운다). 배경은 낮은 해상도 픽셀 버퍼(u배 확대), 빛·이름표·패킷은 고해상도로 덧그린다.
// 메뉴를 고르면 일곱 에이전트를 차례로 연결한 뒤 onGo(id)로 넘긴다: ambient(평소 모드) · demo(1분 시연) · sheet(캐릭터 시트).
import { SpriteKit } from './sprites.js';
import { emblem } from './emblem.js';

const W = 1600, H = 900;

export function createTitle(stage, opts = {}) {
  const $ = (q) => stage.querySelector(q);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let seed = 7;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

  // 포털과 같은 에이전트 이름·약칭·색 (baseMap.js initFlow)
  const AG = {
    hq: { name: '통합관제', code: '관제', hex: '#7FE3FF', rgb: '127,227,255' },
    gate: { name: '출입관제', code: '출입', hex: '#29BDFD', rgb: '41,189,253' },
    med: { name: '의무지원', code: '의무', hex: '#FF4F6E', rgb: '255,79,110' },
    trn: { name: '훈련관리', code: '훈련', hex: '#FFAF00', rgb: '255,175,0' },
    per: { name: '인사생활', code: '인사', hex: '#A98BFF', rgb: '169,139,255' },
    fac: { name: '정비수송', code: '정비', hex: '#9DCA1C', rgb: '157,202,28' },
    mess: { name: '급양관리', code: '급양', hex: '#EB56C5', rgb: '235,86,197' },
    bot: { name: 'RQ-01 경계로봇', code: 'RQ-01', hex: '#E7EBF0', rgb: '231,235,240', plain: true }
  };
  // 왼쪽 → 오른쪽 줄: AI 에이전트 부대원 7과 4족 보행 경계로봇. 자리가 모자라면 pri가 큰 것부터 뺀다 (통합관제가 늘 가운데)
  const CAST = [
    { kind: 'agent', ag: 'trn', pri: 6 },
    { kind: 'agent', ag: 'med', pri: 4 },
    { kind: 'agent', ag: 'mess', pri: 2 },
    { kind: 'agent', ag: 'hq', pri: 0 },
    { kind: 'agent', ag: 'per', pri: 1 },
    { kind: 'agent', ag: 'gate', pri: 3 },
    { kind: 'agent', ag: 'fac', pri: 5 },
    { kind: 'dog', ag: 'bot', pri: 7 }
  ];
  const ORDER = ['hq', 'gate', 'med', 'trn', 'per', 'fac', 'mess'];

  const kit = new SpriteKit();
  const grid = (w, h) => { const g = kit.gridNew(w, h); const set = (x, y, col) => { if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = col; }; return { g, set, F: (x, y, ww, hh, col) => { for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) set(x + i, y + j, col); } }; };
  const flip = (cvs) => { const o = document.createElement('canvas'); o.width = cvs.width; o.height = cvs.height; const k = o.getContext('2d'); k.scale(-1, 1); k.drawImage(cvs, -cvs.width, 0); return o; };

  // ---- AI 에이전트 = 홀로그램 소프트웨어 (로봇이 아니다) ----
  // 바닥 투영기에서 빛이 올라가 HUD 고리 안에 에이전트 아이콘이 빛 입자로 맺힌다 (AXIS 디자인 캔버스 07 홀로그램 HUD 플로우와 같은 언어).
  // 아이콘 모양은 24×24 선 그림 — 통합관제 코어·인사생활 사람·정비수송 트럭은 캔버스의 아이콘을 그대로 쓴다.
  const IPATH = {
    hq: ['M21.59 7.73 A10.5 3.6 -24 1 1 2.41 16.27 A10.5 3.6 -24 1 1 21.59 7.73', 'M16 12 A4 4 0 1 1 8 12 A4 4 0 1 1 16 12 Z'],
    gate: ['M12 3 L19 6 V11 C19 16 15.5 19.5 12 21 C8.5 19.5 5 16 5 11 V6 Z', 'M9 12 L11.2 14.2 L15.5 9.8'],
    med: ['M10 4 H14 V10 H20 V14 H14 V20 H10 V14 H4 V10 H10 Z'],
    trn: ['M20 12 A8 8 0 1 1 4 12 A8 8 0 1 1 20 12 Z', 'M15.5 12 A3.5 3.5 0 1 1 8.5 12 A3.5 3.5 0 1 1 15.5 12 Z', 'M12 1.5 V5 M12 19 V22.5 M1.5 12 H5 M19 12 H22.5'],
    per: ['M12.2 8 A3.2 3.2 0 1 1 5.8 8 A3.2 3.2 0 1 1 12.2 8 Z', 'M3.5 20 V18.8 A5.5 5.5 0 0 1 14.5 18.8 V20', 'M19.1 9 A2.6 2.6 0 1 1 13.9 9 A2.6 2.6 0 1 1 19.1 9 Z', 'M16.5 13.6 A4.4 4.4 0 0 1 20.9 18 V20'],
    fac: ['M2 6 H14 V16 H2 Z', 'M14 9 H18 L21.5 12.5 V16 H14', 'M8.5 18 A2 2 0 1 1 4.5 18 A2 2 0 1 1 8.5 18 Z', 'M19.5 18 A2 2 0 1 1 15.5 18 A2 2 0 1 1 19.5 18 Z'],
    mess: ['M3.5 12 H20.5 A8.5 7 0 0 1 3.5 12 Z', 'M8.5 9 C7.5 7.5 9.5 6.5 8.5 4.5', 'M12 9 C11 7.5 13 6.5 12 4.5', 'M15.5 9 C14.5 7.5 16.5 6.5 15.5 4.5']
  };
  function iconPts(id, S) {
    const cv2 = document.createElement('canvas'); cv2.width = S; cv2.height = S;
    const k = cv2.getContext('2d');
    k.setTransform(S / 24, 0, 0, S / 24, 0, 0); k.lineWidth = 1.8; k.lineCap = 'round'; k.lineJoin = 'round'; k.strokeStyle = '#FFFFFF';
    IPATH[id].forEach((d) => k.stroke(new Path2D(d)));
    const data = k.getImageData(0, 0, S, S).data, pts = [];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (data[(y * S + x) * 4 + 3] > 80) pts.push([x - (S - 1) / 2, y - (S - 1) / 2, 1 + rnd() * 2.5, rnd() * 6.28, rnd() < 0.12]);
    return pts;
  }
  const ICONS = {};
  Object.keys(IPATH).forEach((id) => { ICONS[id] = iconPts(id, id === 'hq' ? 21 : 17); });
  const holoR = (m) => (m.ag === 'hq' ? 17 : 13);
  const holoY = (m, t) => gA - (m.ag === 'hq' ? 34 : 30) + Math.round(still.matches ? 0 : Math.sin(t * 1.6 + m.ph));
  function holo(m, t) {
    const A = AG[m.ag], hl = A.hl || (A.hl = kit.light(A.hex, 0.45)), cx = Math.round(m.x / u), R = holoR(m), cy = holoY(m, t);
    const P = (x, y, col, a) => { b.globalAlpha = a; b.fillStyle = col; b.fillRect(x, y, 1, 1); };
    const arc = (r, a0, a1, col, a, step) => { const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r)); for (let i = 0; i <= n; i += step || 1) { const an = a0 + (a1 - a0) * i / n; P(Math.round(cx + Math.cos(an) * r), Math.round(cy + Math.sin(an) * r), col, a); } };
    // 바닥 투영기
    b.globalAlpha = 1; b.fillStyle = '#141B27'; b.fillRect(cx - 6, gA - 3, 12, 2); b.fillStyle = '#2A3446'; b.fillRect(cx - 5, gA - 4, 10, 1);
    for (let k = -4; k <= 4; k += 2) P(cx + k, gA - 3, A.hex, (Math.floor(t * 5) + k + 8) % 4 === 0 ? 1 : 0.35);
    // 빛기둥 (주사선)
    const top = cy + R - 3, bot = gA - 5;
    for (let y = top; y <= bot; y++) { const k = (bot - y) / Math.max(1, bot - top), w = Math.round(2 + k * (R - 4)); b.globalAlpha = (y % 2 ? 0.08 : 0.15) * (0.85 + 0.15 * Math.sin(t * 7 + y)); b.fillStyle = A.hex; b.fillRect(cx - w, y, w * 2, 1); }
    for (let k = 0; k < 3; k++) { const f = (t * 0.55 + k / 3 + m.ph) % 1, y = Math.round(bot - f * (bot - top)), x = cx + Math.round(Math.sin(k * 2.1 + m.ph) * (1 + f * (R - 6))); P(x, y, hl, 0.85 * (1 - f)); }
    // HUD 화면 (어두운 원판) · 고리 — 바탕 고리 · 도는 호 4개 · 눈금 12 · 작업 진행 호
    b.globalAlpha = 0.62; b.fillStyle = '#04101C';
    for (let dy = -(R - 3); dy <= R - 3; dy++) { const w = Math.round(Math.sqrt((R - 3) * (R - 3) - dy * dy)); b.fillRect(cx - w, cy + dy, w * 2 + 1, 1); }
    arc(R - 2, 0, Math.PI * 2, A.hex, 0.3);
    const rot = t * (m.ph > 3 ? 0.8 : -0.8);
    for (let q = 0; q < 4; q++) { const a0 = q * Math.PI / 2 + Math.PI / 4 + rot; arc(R, a0 - 0.3, a0 + 0.3, A.hex, 0.95); }
    for (let q = 0; q < 12; q++) { const an = q * Math.PI / 6; P(Math.round(cx + Math.cos(an) * (R + 2)), Math.round(cy + Math.sin(an) * (R + 2)), A.hex, 0.4); }
    if (m.act > 0) arc(R - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, m.act), '#FFFFFF', m.act > 1 ? Math.max(0, 1.4 - m.act) * 2.2 : 0.9);
    // 아이콘 빛 입자 (데이터를 보낼 때 잠깐 흩어졌다 다시 맺힌다)
    const s = m.burst > 0 ? Math.sin(m.burst * Math.PI) * 0.45 : 0;
    for (const p of ICONS[m.ag]) {
      const j = s ? Math.sin(p[3] * 7) * s * 2 : 0, x = Math.round(cx + p[0] * (1 + s) + j), y = Math.round(cy + p[1] * (1 + s) - j);
      const tw = still.matches ? 0 : Math.sin(t * p[2] + p[3]);
      P(x, y, hl, 0.82 + 0.18 * tw);
      if (p[4] && tw > 0.4) P(x, y, '#FFFFFF', tw);
    }
    b.globalAlpha = 1;
    return cy;
  }
  // ---- 4족 보행 경계로봇 (옆모습, 왼쪽을 본다 · 40×26) — 포털 RQ-01과 같은 올리브 도색 ----
  function paintDog(f, rest) {
    const { g, set, F } = grid(40, 26);
    const line = (x0, y0, x1, y1, col) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) F(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 2, 2, col); };
    const leg = (hx, hy, ph, far) => {
      const p = f * Math.PI / 2 + ph, fx = hx + (rest ? 0 : Math.round(3 * Math.sin(p))), fy = 23 - (rest ? 0 : Math.round(Math.max(0, Math.cos(p)) * 2));
      const d = Math.hypot(fx - hx, fy - hy) || 1, k = Math.sqrt(Math.max(0, 49 - d * d / 4));
      const kx = Math.round((hx + fx) / 2 + k * (fy - hy) / d), ky = Math.round((hy + fy) / 2 - k * (fx - hx) / d);
      line(hx, hy, kx, ky, far ? '#2A2E33' : '#3A3F45'); line(kx, ky, fx, fy, far ? '#23272B' : '#30353A');
      F(fx - 1, fy + 2, 4, 1, '#15181B'); if (!far) set(kx, ky, '#9AA3AE');
    };
    leg(13, 12, Math.PI, true); leg(32, 12, 0, true);
    F(9, 6, 28, 9, '#5B6548'); F(9, 6, 28, 1, '#7A8560'); F(9, 14, 28, 1, '#3E4530'); F(36, 6, 1, 9, '#3E4530');
    F(13, 9, 7, 2, '#4A5239'); F(23, 9, 9, 2, '#4A5239'); set(21, 10, '#C9A93A');
    F(1, 6, 8, 8, '#3A3F44'); F(1, 6, 8, 1, '#4E555C'); F(1, 8, 5, 3, '#29BDFD'); set(1, 8, '#BFF1FF'); set(2, 8, '#BFF1FF'); F(8, 8, 2, 4, '#2A2F36');
    F(26, 3, 2, 3, '#3A3F44'); F(23, 0, 8, 3, '#2A2F36'); F(24, 1, 6, 1, '#7FE3FF'); set(24 + (f % 3) * 2, 1, '#FFFFFF');
    F(37, 7, 2, 2, f % 2 ? '#45F08A' : '#2A6E44');
    leg(11, 13, 0, false); leg(30, 13, Math.PI, false);
    return kit.toCanvas(kit.outline(g));
  }
  // ---- 드론 (옆모습 · 18×9) ----
  function paintDrone(f) {
    const { g, set, F } = grid(18, 9);
    F(5, 3, 8, 3, '#2A2F36'); F(5, 3, 8, 1, '#4E5661'); F(8, 4, 2, 1, '#29BDFD');
    F(1, 3, 4, 1, '#4E5661'); F(13, 3, 4, 1, '#4E5661'); set(2, 2, '#3A3F44'); set(15, 2, '#3A3F44');
    if (f) { F(0, 1, 5, 1, '#9AA3AE'); F(13, 1, 5, 1, '#9AA3AE'); } else { F(1, 1, 3, 1, '#C6CDD5'); F(14, 1, 3, 1, '#C6CDD5'); }
    F(8, 6, 2, 2, '#15181B'); set(9, 7, '#29BDFD'); F(4, 6, 1, 2, '#3A3F44'); F(13, 6, 1, 2, '#3A3F44');
    return kit.toCanvas(kit.outline(g));
  }
  const DOG = { walk: [0, 1, 2, 3].map((f) => paintDog(f, false)), rest: [0, 1, 2, 3].map((f) => paintDog(f, true)) };
  DOG.walkR = DOG.walk.map(flip); DOG.restR = DOG.rest.map(flip);
  const DRONE = [paintDrone(0), paintDrone(1)];

  const cv = $('.t-scene'), c = cv.getContext('2d');
  const buf = document.createElement('canvas'), b = buf.getContext('2d');
  let dpr = 1, u = 4, bw = 0, bh = 0, gA = 0, hA = 0, narrow = false;
  let back = null, stars = [], leds = [], flag = null, towers = null, cast = [], hub = { x: 0, y: 0, l: 0, r: 0, b: 0 };
  const patrol = { x: 20, dir: 1, f: 0, ft: 0, wait: 0 }, fleet = { x: -60, t: 3 };
  const glow = { rgb: '79,209,255', k: 0 }, pk = [];

  // ---- 배치: 메뉴 아래 땅까지 캐릭터가 들어가면 한 줄로, 아니면 메뉴 양옆으로 ----
  function layout() {
    resize();
    const menu = rel($('.t-menu')), logo = rel($('.t-logo')), foot = rel($('.t-foot')), hint = $('.t-hint');
    const above = hint && hint.offsetParent ? rel(hint).bottom : menu.bottom;
    hub = { x: logo.left + logo.width / 2, y: logo.top + logo.height * 0.55, l: logo.left, r: logo.right, b: logo.bottom };
    const ground = foot.top - 6, uMax = clamp(Math.floor(Math.min(W / 260, H / 150)), 2, 8);
    const fit = Math.floor((ground - above - 52) / 48), row = fit >= 2;
    u = row ? Math.min(uMax, fit) : uMax;
    bw = Math.ceil(W / u); bh = Math.ceil(H / u); buf.width = bw; buf.height = bh;
    gA = Math.floor(ground / u); hA = gA - 20;
    const step = 34 * u, xs = [];
    narrow = step < 116;
    if (row) {
      const n = clamp(Math.floor((W - 32) / step), 0, CAST.length);
      for (let i = 0; i < n; i++) xs.push(W / 2 + (i - (n - 1) / 2) * step);
    } else {
      const gap = Math.max(menu.width, logo.width) + 48, per = clamp(Math.floor((W / 2 - gap / 2 - 16) / step), 0, 4);
      for (let i = per - 1; i >= 0; i--) xs.push(W / 2 - gap / 2 - step / 2 - i * step);
      for (let i = 0; i < per; i++) xs.push(W / 2 + gap / 2 + step / 2 + i * step);
    }
    const pick = CAST.slice().sort((p, q) => p.pri - q.pri).slice(0, xs.length).sort((p, q) => CAST.indexOf(p) - CAST.indexOf(q));
    const prev = new Map(cast.map((m) => [m.ag, m]));
    cast = pick.map((m, i) => Object.assign({ ph: rnd() * 6.28, pulse: 0, burst: 0, act: 0 }, prev.get(m.ag) || {}, m, { x: xs[i] }));
    pk.length = 0;
    patrol.x = clamp(patrol.x, 4, Math.max(4, bw - 44));
    bakeBack();
  }

  // ARMY CENTER 엠블럼(왼쪽 상징탑 위 간판)은 emblem.js — 시연의 ArmyGPT 버튼과 함께 쓴다

  // ---- 배경: 새벽 하늘·산등성이·부대 건물 실루엣·울타리·연병장 (한 번 구워 둔다) ----
  function bakeBack() {
    back = document.createElement('canvas'); back.width = bw; back.height = bh;
    const g = back.getContext('2d'), R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    seed = 2040;
    const sky = g.createLinearGradient(0, 0, 0, hA);
    sky.addColorStop(0, '#04070D'); sky.addColorStop(0.55, '#0A1424'); sky.addColorStop(0.86, '#12273D'); sky.addColorStop(1, '#1D3B55');
    g.fillStyle = sky; g.fillRect(0, 0, bw, hA);
    stars = [];
    const ns = Math.round(bw * hA / 70);
    for (let i = 0; i < ns; i++) {
      const x = rnd() * bw | 0, y = rnd() * (hA * 0.7) | 0;
      R(x, y, 1, 1, rnd() < 0.3 ? '#3A4E68' : '#1E2C40');
      if (rnd() < 0.35) stars.push({ x, y, sp: 0.6 + rnd() * 1.6, ph: rnd() * 6.28 });
    }
    // 먼 산등성이 두 겹
    const ridge = (base, amp, f, col) => { for (let x = 0; x < bw; x++) { const y = Math.round(base - amp * (0.6 * Math.sin(x * f + 1.3) + 0.4 * Math.sin(x * f * 2.7 + 4.1))); R(x, y, 1, hA - y, col); } };
    ridge(hA - 30, 8, 0.021, '#0B1626'); ridge(hA - 18, 5, 0.037, '#0A131F');
    // 부대 건물 실루엣 (가운데 대대본부 통합관제상황실, 양옆 생활관)
    const cx = Math.round(bw / 2), body = '#0E1A2A', roof = '#1A2C42';
    const block = (x, w, h, lit) => {
      R(x, hA - h, w, h, body); R(x, hA - h, w, 1, roof); R(x - 1, hA - h + 1, w + 2, 1, roof);
      for (let wy = hA - h + 4; wy < hA - 4; wy += 5) for (let wx = x + 3; wx < x + w - 3; wx += 5) R(wx, wy, 2, 2, rnd() < lit ? '#C99A3A' : '#152235');
    };
    [-1, 1].forEach((s) => { block(cx + s * 50 - (s < 0 ? 44 : 0), 44, 14, 0.32); block(cx + s * 100 - (s < 0 ? 40 : 0), 40, 12, 0.22); block(cx + s * 146 - (s < 0 ? 36 : 0), 36, 11, 0.18); });
    R(cx - 34, hA - 24, 68, 24, body); R(cx - 34, hA - 24, 68, 1, roof); R(cx - 35, hA - 23, 70, 1, roof);
    for (let wx = cx - 30; wx < cx + 30; wx += 3) R(wx, hA - 17, 2, 4, rnd() < 0.8 ? '#2E8FB8' : '#1A4A66'); // 통합관제상황실 멀티비전
    for (let wx = cx - 30; wx < cx + 30; wx += 6) R(wx, hA - 9, 3, 3, rnd() < 0.4 ? '#C99A3A' : '#152235');
    R(cx + 24, hA - 38, 1, 14, '#3A4A5E'); R(cx + 22, hA - 31, 5, 1, '#3A4A5E'); R(cx + 23, hA - 35, 3, 1, '#3A4A5E'); // 안테나
    leds = [{ x: cx + 24, y: hA - 39, c: '#FF4D4D', ph: 0 }];
    R(cx - 44, hA - 34, 1, 34, '#6A7584'); R(cx - 45, hA - 35, 3, 1, '#C9A93A'); // 국기 게양대
    flag = { x: cx - 43, y: hA - 34 };
    // 왼쪽 상징탑 (옥상 간판 = ARMY CENTER 엠블럼) · 오른쪽 드론 스테이션
    const tower = (x, w, h, lit) => {
      const x0 = Math.round(x - w / 2);
      R(x0, hA - h, w, h, '#101D2E'); R(x0, hA - h, w, 1, '#24384F'); R(x0 - 1, hA - h + 1, w + 2, 1, '#1A2C42'); R(x0 + w - 2, hA - h + 2, 2, h - 2, '#0B1522');
      for (let wy = hA - h + 5; wy < hA - 3; wy += 4) for (let wx = x0 + 3; wx < x0 + w - 4; wx += 4) R(wx, wy, 2, 2, rnd() < lit ? '#C99A3A' : '#16243A');
      return x0;
    };
    const lx = Math.round(bw * 0.2), rx = Math.round(bw * 0.8);
    tower(lx, 26, 36, 0.3);
    const lift = Math.max(38, Math.ceil(27 + 54 / u)), ey = hA - lift - 41; // 작은 화면에선 이름표 위로 더 올려 단다
    R(lx - 9, ey + 34, 1, hA - 36 - ey - 34, '#2E3A4E'); R(lx + 8, ey + 34, 1, hA - 36 - ey - 34, '#2E3A4E');
    const emb = emblem(g, lx - 19, ey);
    const r0 = tower(rx, 22, 30, 0.25);
    R(r0 - 2, hA - 31, 26, 1, '#5E6878'); R(r0 - 2, hA - 32, 2, 1, '#FFC247'); R(r0 + 22, hA - 32, 2, 1, '#FFC247'); R(r0 + 17, hA - 40, 1, 9, '#3A4A5E');
    leds.push({ x: r0 - 2, y: hA - 33, c: '#FFC247', ph: 0.3 }, { x: r0 + 23, y: hA - 33, c: '#FFC247', ph: 0.8 }, { x: r0 + 17, y: hA - 41, c: '#FF4D4D', ph: 1.1 });
    towers = { emb, pad: { x: rx, y: hA - 31 } };
    // 양끝 소나무 숲
    const pine = (x, h, col) => { for (let k = 0; k < h; k++) { const w = Math.max(1, Math.round((k / h) * 5)); R(x - w, hA - h + k, w * 2 + 1, 1, col); } R(x, hA - 2, 1, 2, '#0A1410'); };
    for (let x = 2; x < bw; x += 5 + (rnd() * 4 | 0)) { const d = Math.min(x, bw - x) / bw; if (d < 0.2) pine(x, 12 + (rnd() * 12 | 0) + Math.round((0.2 - d) * 40), d < 0.1 ? '#08130F' : '#0A1813'); }
    // 땅 (울타리 앞 잔디 → 연병장 흙)
    R(0, hA, bw, bh - hA, '#101C17');
    for (let y = hA; y < bh; y++) { const k = (y - hA) / Math.max(1, bh - hA); if (y > gA - 7) R(0, y, bw, 1, k > 0.9 ? '#16130F' : '#1F1A14'); }
    for (let i = 0; i < bw * 3; i++) { const x = rnd() * bw | 0, y = hA + (rnd() * (gA - 8 - hA) | 0); R(x, y, 1, 1, rnd() < 0.5 ? '#173022' : '#0C1712'); }
    for (let i = 0; i < bw * 2; i++) { const x = rnd() * bw | 0, y = gA - 6 + (rnd() * (bh - gA + 6) | 0); R(x, y, 1, 1, rnd() < 0.5 ? '#2A241C' : '#17130E'); }
    // 울타리 · 윤형 철조망 · CCTV
    for (let x = 0; x < bw; x++) { if (x % 2 === 0) R(x, hA - 12, 1, 1, '#3A4558'); R(x, hA - 8, 1, 1, '#222C3C'); R(x, hA - 4, 1, 1, '#222C3C'); }
    for (let x = (bw % 12) / 2; x < bw; x += 12) R(x, hA - 11, 1, 11, '#2E3A4E');
    [0.06, 0.3, 0.7, 0.94].forEach((f, i) => { const x = Math.round(bw * f); R(x, hA - 22, 1, 22, '#2E3A4E'); R(x - 2, hA - 23, 4, 2, '#4A5668'); leds.push({ x: x + (i % 2 ? -3 : 2), y: hA - 23, c: '#FF4D4D', ph: i * 0.7 }); });
  }

  // ---- 데이터 패킷: 에이전트 노드 → AXIS 로고(통합관제 허브) ----
  const topOf = (m) => (m.kind === 'dog' ? gA - 26 : (m.ag === 'hq' ? gA - 55 : gA - 47));
  const nodeAt = (m) => ({ x: m.x, y: topOf(m) * u - 34 });
  function pathOf(m) {
    const p = nodeAt(m), half = (hub.r - hub.l) * 0.42;
    const e = { x: hub.x + clamp(m.x - hub.x, -half, half), y: hub.b - (hub.b - hub.y) * 0.35 };
    return { p, k: { x: p.x, y: e.y }, e };
  }
  const bez = (q, s) => { const a = (1 - s) * (1 - s), m2 = 2 * (1 - s) * s, z = s * s; return [a * q.p.x + m2 * q.k.x + z * q.e.x, a * q.p.y + m2 * q.k.y + z * q.e.y]; };
  function launch(m, cb) {
    const q = pathOf(m), len = Math.hypot(q.e.x - q.p.x, q.e.y - q.p.y);
    pk.push({ m, q, s: 0, dur: 0.7 + len / 700, cb });
    m.pulse = 1; if (m.kind === 'agent') { m.burst = 0.001; m.act = 0.001; } // 데이터를 보낼 때 아이콘 입자가 흩어졌다 맺히고 진행 호가 한 바퀴 찬다
  }
  const logo = $('.t-logo');
  function hit(m) {
    const A = AG[m.ag]; glow.rgb = A.rgb; glow.k = 1;
    logo.style.setProperty('--hit', A.hex); logo.classList.remove('hit'); void logo.offsetWidth; logo.classList.add('hit');
    clearTimeout(hit.t); hit.t = setTimeout(() => logo.classList.remove('hit'), 260);
  }

  // 시작 화면엔 통신 로그를 띄우지 않는다 — 에이전트가 로고로 패킷만 보낸다
  let nextPk = 0.6, booting = false;

  // ---- 그리기 ----
  function diamond(x, y, r, col) { for (let dy = -r; dy <= r; dy++) { const w = (r - Math.abs(dy)) * 2 + 1; c.fillStyle = col; c.fillRect(Math.round(x - w), Math.round(y + dy * 2 - 1), w * 2, 2); } }
  function glowAt(x, y, rad, rgb, a) {
    if (a <= 0.01) return;
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(' + rgb + ',' + a.toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  function draw(t) {
    b.drawImage(back, 0, 0);
    for (const s of stars) { const v = Math.sin(t * s.sp + s.ph); if (v > 0.55) { b.fillStyle = v > 0.93 ? '#FFFFFF' : '#8FA6C2'; b.fillRect(s.x, s.y, 1, 1); } }
    for (const l of leds) if (Math.floor(t * 1.4 + l.ph) % 2 === 0) { b.fillStyle = l.c; b.fillRect(l.x, l.y, 1, 1); }
    if (flag) { // 태극기 (2프레임 펄럭임)
      const w = Math.floor(t * 2.5) % 2, fx = flag.x, fy = flag.y + 1;
      b.fillStyle = '#E8E8E4'; b.fillRect(fx, fy, 8, 5); b.fillRect(fx + 2, fy + 5 - w, 6, w);
      b.fillStyle = '#CD2E3A'; b.fillRect(fx + 3, fy + 1, 2, 2); b.fillStyle = '#0047A0'; b.fillRect(fx + 3, fy + 3, 2, 1); b.fillRect(fx + 5, fy + 2, 1, 1);
      b.fillStyle = '#222222'; b.fillRect(fx + 1, fy, 1, 1); b.fillRect(fx + 6, fy, 1, 1); b.fillRect(fx + 1, fy + 4, 1, 1); b.fillRect(fx + 6, fy + 4, 1, 1);
    }
    if (towers) { // 엠블럼 꼭대기 반짝임 · 드론 스테이션 위 드론 D-2
      const a = towers.emb.apex;
      if (Math.floor(t * 1.2) % 3 === 0) { b.fillStyle = '#FFFFFF'; b.fillRect(a[0], a[1] - 3, 1, 1); b.fillRect(a[0] - 2, a[1] - 1, 1, 1); b.fillRect(a[0] + 2, a[1] - 1, 1, 1); b.fillStyle = '#BFE0FF'; b.fillRect(a[0], a[1] - 2, 1, 1); }
      const p = towers.pad, y = Math.round(p.y - 13 - (still.matches ? 0 : (Math.sin(t * 0.9) + 1) * 4));
      b.drawImage(DRONE[Math.floor(t * 20) % 2], p.x - 9, y);
      b.fillStyle = Math.floor(t * 3) % 2 ? '#45F08A' : '#FF4D4D'; b.fillRect(p.x, y + 9, 1, 1);
    }
    if (fleet.x > -60 && fleet.x < bw + 60) { // 먼 하늘 정찰 드론 편대 (3기)
      [[0, 0], [-10, -4], [-10, 4]].forEach(([dx, dy], i) => {
        const x = Math.round(fleet.x + dx), y = Math.round(bh * 0.12 + dy + Math.sin(t * 1.6 + i) * 1.2);
        b.fillStyle = '#3A4558'; b.fillRect(x - 3, y, 6, 1); b.fillStyle = '#5E6A7E'; b.fillRect(x - 1, y, 2, 2);
        b.fillStyle = Math.floor(t * 8 + i) % 2 ? '#8FA6C2' : '#4A5568'; b.fillRect(x - 4, y - 1, 2, 1); b.fillRect(x + 2, y - 1, 2, 1);
        b.fillStyle = Math.floor(t * 2 + i) % 2 ? '#45F08A' : '#FF4D4D'; b.fillRect(x, y + 2, 1, 1);
      });
    }
    // 울타리 안쪽을 도는 경계로봇 (부대원 줄 뒤)
    const ps = patrol.wait > 0 ? (patrol.dir < 0 ? DOG.rest : DOG.restR) : (patrol.dir < 0 ? DOG.walk : DOG.walkR);
    b.fillStyle = 'rgba(0,0,0,0.35)'; b.fillRect(Math.round(patrol.x) + 6, hA + 5, 28, 1);
    b.drawImage(ps[patrol.f % 4], Math.round(patrol.x), hA + 5 - 25);
    for (const m of cast) {
      const A = AG[m.ag], dog = m.kind === 'dog', cx = Math.round(m.x / u), pw = dog ? 30 : 16, px = cx - pw / 2;
      b.globalAlpha = 0.45 + 0.5 * m.pulse; b.fillStyle = A.hex; // 발밑 투영 받침 (에이전트 색)
      b.fillRect(px, gA - 2, pw, 1); b.fillRect(px - 3, gA - 1, 2, 2); b.fillRect(px + pw + 1, gA - 1, 2, 2); b.fillRect(px, gA + 1, pw, 1);
      b.globalAlpha = 1;
      b.fillStyle = 'rgba(0,0,0,0.45)'; b.fillRect(px + 1, gA - 1, pw - 2, 2);
      if (dog) { b.drawImage(DOG.rest[Math.floor(t * 4) % 4], cx - 20, gA - 26); continue; }
      holo(m, t);
    }
    c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false;
    c.drawImage(buf, 0, 0, bw, bh, 0, 0, bw * u * dpr, bh * u * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 로고 뒤 허브 빛
    c.globalCompositeOperation = 'lighter';
    glowAt(hub.x, hub.y, (hub.r - hub.l) * 0.75, '79,209,255', 0.1);
    glowAt(hub.x, hub.y, (hub.r - hub.l) * 0.7, glow.rgb, 0.22 * glow.k);
    if (towers) glowAt(towers.emb.x * u, towers.emb.y * u, 34 * u, '64,140,255', 0.15 + 0.04 * Math.sin(t * 1.5)); // 엠블럼 간판 조명
    for (const m of cast) {
      const n = nodeAt(m); glowAt(n.x, n.y, 26 + 10 * m.pulse, AG[m.ag].rgb, 0.3 + 0.4 * m.pulse);
      if (m.kind === 'agent') { glowAt(m.x, (holoY(m, t) + 0.5) * u, holoR(m) * u * 1.6, AG[m.ag].rgb, 0.16 + 0.22 * m.pulse); glowAt(m.x, (gA - 3) * u, 9 * u, AG[m.ag].rgb, 0.22); } // 홀로그램 · 투영기 빛
    }
    c.globalCompositeOperation = 'source-over';
    // 노드 → 허브 점선
    for (const m of cast) {
      if (AG[m.ag].plain) continue;
      const q = pathOf(m), on = pk.some((p) => p.m === m);
      c.fillStyle = AG[m.ag].hex; c.globalAlpha = on ? 0.55 : 0.16;
      for (let s = 0.08; s < 0.97; s += 0.035) { const p = bez(q, s); c.fillRect(Math.round(p[0]) - 1, Math.round(p[1]) - 1, 2, 2); }
    }
    c.globalAlpha = 1;
    // 패킷
    for (const p of pk) {
      const A = AG[p.m.ag];
      for (let k = 4; k >= 0; k--) { const s = p.s - k * 0.025; if (s < 0) continue; const q = bez(p.q, s), r = k ? 2 : 3; c.globalAlpha = k ? 0.5 - k * 0.09 : 1; c.fillStyle = k ? A.hex : '#FFFFFF'; c.fillRect(Math.round(q[0]) - r, Math.round(q[1]) - r, r * 2, r * 2); }
    }
    c.globalAlpha = 1;
    // 노드 · 이름표
    c.font = '700 12px Galmuri11, ui-monospace, monospace'; c.textBaseline = 'middle'; c.textAlign = 'left';
    for (const m of cast) {
      const A = AG[m.ag], n = nodeAt(m), label = narrow ? A.code : (A.plain ? A.name : A.name + ' AI');
      const by = Math.round(n.y + Math.sin(t * 2 + m.ph) * (still.matches ? 0 : 1.5));
      diamond(n.x, by, 5, '#05070A'); diamond(n.x, by, 4, A.hex); diamond(n.x, by, 1, '#FFFFFF');
      const w = Math.ceil(c.measureText(label).width) + 14, x = Math.round(n.x - w / 2), y = by + 14;
      c.fillStyle = '#05070A'; c.fillRect(x - 2, y, w + 4, 18); c.fillRect(x, y - 2, w, 22);
      c.fillStyle = A.plain ? '#2A3140' : A.hex; c.fillRect(x, y, w, 18);
      c.fillStyle = A.plain ? '#E8EDF5' : '#05070A'; c.fillText(label, x + 7, y + 10);
    }
  }

  function step(dt, t) {
    for (const m of cast) {
      m.pulse = Math.max(0, m.pulse - dt * 1.6);
      if (m.burst > 0) { m.burst += dt / 0.7; if (m.burst > 1) m.burst = 0; }
      if (m.act > 0) { m.act += dt / 0.9; if (m.act > 1.4) m.act = 0; }
    }
    glow.k = Math.max(0, glow.k - dt * 1.8);
    for (let i = pk.length - 1; i >= 0; i--) { const p = pk[i]; p.s += dt / p.dur; if (p.s >= 1) { pk.splice(i, 1); hit(p.m); if (p.cb) p.cb(); } }
    fleet.t -= dt; if (fleet.t <= 0 && (fleet.x <= -60 || fleet.x >= bw + 60)) { fleet.x = -40; fleet.t = 22; }
    if (fleet.x > -60 && fleet.x < bw + 60) fleet.x += dt * bw / 14;
    if (patrol.wait > 0) patrol.wait -= dt;
    else {
      patrol.x += patrol.dir * dt * 12; patrol.ft += dt; if (patrol.ft > 0.14) { patrol.ft = 0; patrol.f++; }
      if (patrol.x < 4 || patrol.x > bw - 44) { patrol.x = clamp(patrol.x, 4, Math.max(4, bw - 44)); patrol.dir *= -1; patrol.wait = 1.6; }
    }
    if (booting) return;
    nextPk -= dt;
    if (nextPk <= 0 && cast.length) { const live = cast.filter((m) => !AG[m.ag].plain); if (live.length) launch(live[rnd() * live.length | 0]); nextPk = 0.9 + rnd() * 0.9; }
  }

  let last = 0, raf = 0;
  function loop(now) {
    if (!visible) return;
    raf = requestAnimationFrame(loop);
    const t = now / 1000, dt = last ? Math.min(0.05, t - last) : 0.016; last = t;
    step(dt, t); draw(t);
  }

  // ---- 메뉴 (↑ ↓ · Enter · 마우스) ----
  const items = Array.from(stage.querySelectorAll('.t-item'));
  let cur = 0;
  const select = (i) => { cur = (i + items.length) % items.length; items.forEach((el, k) => el.setAttribute('aria-current', k === cur ? 'true' : 'false')); };
  items.forEach((el, i) => { el.addEventListener('mouseenter', () => select(i)); el.addEventListener('focus', () => select(i)); el.addEventListener('click', () => boot(el.dataset.id)); });

  // ---- 시작: 일곱 에이전트를 차례로 연결한 뒤 고른 화면으로 넘어간다 ----
  const BOOT = {
    ambient: { lead: '평소 모드 · 부대 전체 보기 100%', done: '연결 완료 · 부대로 들어갑니다' },
    demo: { lead: '1분 시연 · 06:30 기상부터 68초', done: '연결 완료 · 웅비대대의 하루를 재생합니다' },
    sheet: { lead: '캐릭터 시트 · 캐릭터·차량·계급장', done: '연결 완료 · 캐릭터 시트를 엽니다' }
  };
  const bootEl = $('.t-boot'), list = $('.t-list'), bar = $('.t-bar i'), doneEl = $('.t-done');
  let bootT = [], visible = false;
  function boot(id) {
    const B = BOOT[id] || BOOT.ambient;
    bootT.forEach(clearTimeout); bootT = [];
    booting = true; bootEl.hidden = false;
    $('.t-lead').textContent = B.lead; doneEl.hidden = true; bar.style.width = '0';
    list.innerHTML = '';
    ORDER.forEach((k) => { const li = document.createElement('li'); li.style.setProperty('--c', AG[k].hex); li.innerHTML = '<i></i><span></span><b>대기</b>'; li.querySelector('span').textContent = AG[k].name + ' 에이전트'; list.appendChild(li); });
    const rows = Array.from(list.children), gap = still.matches ? 0 : 180, end = 200 + ORDER.length * gap;
    ORDER.forEach((k, i) => bootT.push(setTimeout(() => {
      rows[i].classList.add('ok'); rows[i].querySelector('b').textContent = '연결';
      bar.style.width = Math.round((i + 1) / ORDER.length * 100) + '%';
      const m = cast.find((q) => q.ag === k); if (m && !still.matches) launch(m);
    }, 200 + i * gap)));
    bootT.push(setTimeout(() => { doneEl.textContent = B.done; doneEl.hidden = false; }, end + 150));
    bootT.push(setTimeout(() => { closeBoot(); if (opts.onGo) opts.onGo(id); }, end + 750));
  }
  function closeBoot() { bootT.forEach(clearTimeout); bootT = []; bootEl.hidden = true; booting = false; }
  window.addEventListener('keydown', (e) => {
    if (!visible || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!bootEl.hidden) { if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); closeBoot(); items[cur].focus({ preventScroll: true }); } return; }
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); select(cur + 1); items[cur].focus({ preventScroll: true }); }
    else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); select(cur - 1); items[cur].focus({ preventScroll: true }); }
    else if ((e.key === 'Enter' || e.key === ' ') && !(e.target && e.target.closest && e.target.closest('button'))) { e.preventDefault(); boot(items[cur].dataset.id); }
  });

  // ---- 무대 크기 · 보이기/숨기기 (숨어 있는 동안은 그리지 않는다) ----
  // 무대는 CSS로 확대·축소되므로 DOM 위치는 무대 좌표(1600×900)로 바꿔 쓴다
  function rel(el) {
    const s = stage.getBoundingClientRect(), r = el.getBoundingClientRect(), k = s.width / W || 1;
    return { left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k, width: r.width / k, height: r.height / k };
  }
  function resize() {
    dpr = Math.max(1, Math.min(3, (window.devicePixelRatio || 1) * (api.viewScale || 1)));
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  }
  const api = {
    viewScale: 1,
    show() {
      visible = true; closeBoot(); layout();
      if (still.matches) draw(0); else { cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(loop); }
      items[cur].focus({ preventScroll: true });
    },
    hide() { visible = false; cancelAnimationFrame(raf); raf = 0; closeBoot(); },
    fit() { if (visible) { layout(); if (still.matches) draw(0); } }
  };
  still.addEventListener && still.addEventListener('change', () => { if (visible) api.show(); });
  // 픽셀 글꼴이 준비되면 글자 폭에 맞춰 다시 배치한다
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => api.fit());
  return api;
}
