// 웅비대대 픽셀 부대 맵 — 에이전트 데이터 흐름 시각화
// 원본: AXIS 디자인 캔버스 14번 보드(PixelBase)를 독립 실행형으로 옮긴 코드
import { SpriteKit } from './sprites.js';
import { MAP_W, MAP_H, PAD, PAD_R, BLOCKS, blockRect, RM, RP } from './layout.js';

// 카메라: 1600×900 화면 중 헤더(64px) 아래가 맵 영역. 시연 중엔 오른쪽 팝업 자리를 비워 그 왼쪽(x 1204까지)에 맞춘다.
// 통신 로그는 맵 위에 토스트로 떠서 맵 영역을 줄이지 않는다.
// 최소 배율 zFit() = 맵 전체가 그 영역에 들어오는 배율(평소 모드 100%). Z_MAX = 6 — 맵·스프라이트가 2배 해상도로 그려져 있어
// 6배면 원본 1픽셀이 화면 3픽셀(명찰·계급장이 또렷), 그 이상은 화면에 방 하나도 다 안 들어와 의미가 없다.
// 맵 좌표는 layout.js의 새 배치(1600×836). 건물 내부를 그리는 굽기 코드는 원래 좌표 그대로 두고 블록마다 옮겨 그린다(inBlock).
const TOP = 64;
export const Z_MAX = 6;
const Z_STEPS = [1, 1.5, 2, 3, 4, 6];
// 통신 로그 토스트 (화면 오른쪽 위, 시연 팝업과 같은 열 x 1220~1580)
const LOG_X = 1220, LOG_Y = 80, LOG_W = 360, LOG_H = 44, LOG_STEP = 50, LOG_MAX = 3, LOG_LIFE = 3.5, LOG_GAP = 0.45;

export class BaseMap extends SpriteKit {
  constructor(canvas, opts = {}) {
    super();
    this.cv = canvas; this.ctx = null; this.state = {};
    this.onChange = opts.onChange || null;
    this.viewScale = 1; this.paused = false;
    this.mods = []; this.modWarned = {};
  }
  // ---- 확장 모듈 (life.js: 평소 자율 행동, demo.js: 1분 시연) ----
  // 모듈은 아래 이름의 메서드를 골라 가진 객체. 첫 인자는 항상 map.
  //   bake(map, c)            맵 이미지 굽기 마지막 (c: 월드 좌표, 2배 해상도)
  //   init(map)               캐릭터·데이터 흐름 준비 직후
  //   step(map, dt, t)        매 프레임 갱신
  //   drawFloor(map, c, t)    맵 이미지 위, 캐릭터 아래 (바닥·벽 화면처럼 사람이 앞을 지나가는 것)
  //   drawEnt(map, c, e, t)   캐릭터 하나를 그린 직후 (들고 있는 물건 등)
  //   drawWorld(map, c, t)    캐릭터·지붕 위, 데이터 흐름 아래
  //   drawScreen(map, c, t)   맨 위, 화면 좌표 (컷신 띠·대사창 등)
  // 모듈의 keepOut([[x0, y0, x1, y1]...])에는 나무를 심지 않는다(모듈이 굽는 건물 자리).
  // 한 모듈이 오류를 내도 화면이 멈추지 않게 각각 감싼다.
  use(m) { this.mods.push(m); return this; }
  hook(name, ...args) {
    for (const m of this.mods) {
      if (typeof m[name] !== 'function') continue;
      try { m[name](this, ...args); } catch (err) { const k = (m.name || '?') + '.' + name; if (!this.modWarned[k]) { this.modWarned[k] = true; console.warn(k, err); } }
    }
  }
  start() {
    this.initPal();
    // 통신 로그는 오른쪽 위 토스트로 떴다가 사라진다 — 맵을 줄이지 않아 전체 보기는 늘 100% (L 키·헤더 버튼으로 끄고 켠다)
    this.flow = true; this.showLog = true; this.simT = 0; this.mode = 'ambient'; // 'ambient' | 'demo'
    this.state = Object.assign({}, this.state, { flow: true, log: true });
    this.z = this.zFit(); this.atFit = true;
    this.camX = 0; this.camY = 0; this.camT = null;
    this.timers = []; this.scan = null; this.kioskFlash = 0;
    this.gateO = 0; this.gateT = 0; this.pedO = 0; this.pedT = 0;
    this.mx = -1; this.my = -1; this.drag = null;
    this.SC = {}; this.GL = {};
    this.VS = {};
    ['k151', 'truck', 'amb', 'drone'].forEach((k) => { this.VS[k] = this.toCanvas(this.paintVehicle(k)); });
    this.buildMap();
    this.initFlow();
    this.initEnts();
    this.hook('init');
    this.drone = { ph: 'charge', t: 3, x: this.droneS[0], y: this.droneS[1], alt: 0, wp: 0, bat: 62, bubble: null };
    this.t0 = performance.now(); this.last = 0;
    try { if (document.fonts && document.fonts.load) { document.fonts.load('12px Galmuri11'); document.fonts.load('700 12px Galmuri11'); } } catch (err) {}
    const loop = (now) => {
      this.raf = requestAnimationFrame(loop);
      try { if (!this.paused) this.frame(now); } catch (err) { if (!this.warned) { this.warned = true; console.warn(err); } }
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { cancelAnimationFrame(this.raf); }

  buildMap() {
    // 이미지 = 맵(MAP_W×MAP_H) + 둘레 숲 띠(PAD, 오른쪽은 PAD_R). 월드 (0, 0)이 이미지의 (PAD, PAD)에 온다.
    const T = 16, ROWS = 68, IW0 = MAP_W + PAD * 2, IW = MAP_W + PAD + PAD_R, IH = MAP_H + PAD * 2, BOT = MAP_H + PAD;
    const cv = this.mk(IW * 2, IH * 2), c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.setTransform(2, 0, 0, 2, PAD * 2, PAD * 2);
    let seed = 9137, seed2 = 4721;
    const R = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const R2 = () => { seed2 = (Math.imul(seed2, 1664525) + 1013904223) >>> 0; return seed2 / 4294967296; }; // 오른쪽 넓은 숲 띠 전용 — 안쪽 배치(R 순서)가 바뀌지 않게
    const rect = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    const occ = new Uint8Array(112 * ROWS);
    const mark = (tx, ty, tw, th) => { for (let j = ty; j < ty + th; j++) for (let i = tx; i < tx + tw; i++) if (i >= 0 && i < 112 && j >= 0 && j < ROWS) occ[j * 112 + i] = 1; };
    const speck = (x, y, w, h, cols, n) => { for (let k = 0; k < n; k++) rect(x + (R() * w * 2 | 0) / 2, y + (R() * h * 2 | 0) / 2, 0.5, 0.5, cols[R() * cols.length | 0]); };
    const shade = (x, y, w, h) => { c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(x + 2, y + h, w, 2); c.fillRect(x + w, y + 2, 2, h); };
    this.overlays = { monitors: [], leds: [], amb: [], steam: [], wash: null };
    this.signs = []; this.seatDefs = []; this.wall = [];
    const board = (t, x, y, k, o) => this.signs.push(Object.assign({ t: t, x: x, y: y, k: k || 'big' }, o || {}));
    const seat = (type, rank, x, y, dir, label) => this.seatDefs.push({ type: type, rank: rank, x: x, y: y, dir: dir, label: label });

    rect(-PAD, -PAD, IW, IH, '#5E8E3D');
    speck(-PAD, -PAD, IW0, IH, ['#699A45', '#547F37', '#6FA34B', '#5A8A3A'], 320000);
    for (let k = 0; k < 9600; k++) { const x = (R() * IW0 * 2 | 0) / 2 - PAD, y = (R() * IH * 2 | 0) / 2 - PAD; rect(x, y, 0.5, 1.5, R() < 0.5 ? '#4D7A33' : '#7DB257'); }
    for (let k = 0; k < 420; k++) rect((R() * IW0 * 2 | 0) / 2 - PAD, (R() * IH * 2 | 0) / 2 - PAD, 1, 1, ['#F3E07A', '#F6F6F0', '#E79AB2'][R() * 3 | 0]);
    const EX = MAP_W + PAD, EW = PAD_R - PAD, EK = EW / IW0; // 오른쪽 넓은 숲 띠의 잔디 결
    for (let k = 0; k < 320000 * EK; k++) rect(EX + (R2() * EW * 2 | 0) / 2, (R2() * IH * 2 | 0) / 2 - PAD, 0.5, 0.5, ['#699A45', '#547F37', '#6FA34B', '#5A8A3A'][R2() * 4 | 0]);
    for (let k = 0; k < 9600 * EK; k++) rect(EX + (R2() * EW * 2 | 0) / 2, (R2() * IH * 2 | 0) / 2 - PAD, 0.5, 1.5, R2() < 0.5 ? '#4D7A33' : '#7DB257');

    const lot = (tx, ty, tw, th) => { rect(tx * T, ty * T, tw * T, th * T, '#9FA19C'); speck(tx * T, ty * T, tw * T, th * T, ['#A8AAA5', '#95978F', '#8F918A'], tw * th * 60); mark(tx, ty, tw, th); };
    const walk = (tx, ty, tw, th) => {
      const x = tx * T, y = ty * T, w = tw * T, h = th * T;
      rect(x, y, w, h, '#BEBAAF'); speck(x, y, w, h, ['#C6C2B8', '#B3AFA4'], tw * th * 40);
      for (let i = x; i < x + w; i += 8) rect(i, y, 0.5, h, '#A9A59A');
      for (let j = y; j < y + h; j += 8) rect(x, j, w, 0.5, '#A9A59A');
      mark(tx, ty, tw, th);
    };

    // ---- 새 배치의 바닥 (layout.js 좌표로 직접): 큰길 y 304~352, 세로 도로 x 716~796(본부 앞 → 정문 → 맵 밖) ----
    const occN = new Set(); // 새 배치 타일 점유 (나무 심을 자리 계산용)
    const own = (x, y, w, h) => { for (let j = Math.floor(y / T); j < Math.ceil((y + h) / T); j++) for (let i = Math.floor(x / T); i < Math.ceil((x + w) / T); i++) occN.add(i + ',' + j); };
    const roadN = (x, y, w, h) => { rect(x, y, w, h, '#4B4E54'); speck(x, y, w, h, ['#55585E', '#43464B', '#5B5E63'], (w * h / 3.2) | 0); own(x, y, w, h); };
    const walkN = (x, y, w, h) => {
      rect(x, y, w, h, '#BEBAAF'); speck(x, y, w, h, ['#C6C2B8', '#B3AFA4'], (w * h / 6.4) | 0);
      for (let i = x; i < x + w; i += 8) rect(i, y, 0.5, h, '#A9A59A');
      for (let j = y; j < y + h; j += 8) rect(x, j, w, 0.5, '#A9A59A');
      own(x, y, w, h);
    };
    rect(704, 813, 148, 40, '#A9AAA4'); speck(704, 813, 148, 40, ['#B2B3AD', '#9D9E98', '#A3A49E'], 1900); own(704, 813, 148, 40); // 정문 밖 포장
    for (let x = 704; x < 852; x += 26) rect(x, 813, 0.5, 40, '#94958F');
    roadN(12, 304, 1576, 48); roadN(716, 352, 80, BOT - 352); roadN(716, 280, 80, 24);
    rect(12, 304, 1576, 1, '#8D9196'); rect(12, 351, 704, 1, '#8D9196'); rect(796, 351, 792, 1, '#8D9196');
    rect(716, 352, 1, BOT - 352, '#8D9196'); rect(795, 352, 1, BOT - 352, '#8D9196');
    for (let x = 18; x < 1588; x += 24) { if (x > 704 && x < 800) continue; rect(x, 327, 12, 2, '#E2BB3D'); rect(x, 327, 12, 0.5, '#F0CF5E'); }
    for (let y = 382; y < BOT; y += 24) { if (y > 764 && y < 852) continue; rect(755, y, 2, 12, '#E2BB3D'); }
    for (let x = 720; x < 794; x += 8) rect(x, 356, 4, 18, '#E9E9E4'); // 본부 앞 횡단보도
    for (let y = 306; y < 350; y += 8) rect(798, y, 32, 4, '#E9E9E4'); // 큰길 횡단보도
    rect(758, 841, 36, 2, '#F2F2EE'); rect(758, 841, 36, 0.5, '#FFFFFF'); // 정문 밖 정지선

    walkN(12, 288, 704, 16); walkN(796, 288, 792, 16); walkN(12, 352, 704, 16); walkN(796, 352, 792, 16);
    walkN(796, 368, 16, BOT - 368); walkN(812, 692, 32, BOT - 692); // 세로 도로 동쪽 보도 · 정문 보행로
    walkN(132, 368, 32, 8); walkN(1204, 368, 32, 8); walkN(180, 280, 32, 8); // 의무실 · 생활관 · 밀리테리아 앞
    rect(612, 812, 184, 1, '#596068'); rect(612, 812, 184, 0.5, '#8C939A'); // 정문 미닫이 레일
    own(612, 764, 104, 48); // 문이 열리면 밀려나는 자리 — 나무를 심지 않는다
    const sign = (cx, yb) => {
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(cx - 20, yb + 1, 44, 2);
      for (let y = yb - 20; y < yb; y += 3) { const col = ((y - yb) / 3) % 2 ? '#E8B923' : '#1F1F1F'; rect(cx - 18, y, 2, 3, col); rect(cx + 16, y, 2, 3, col); }
      rect(cx - 18, yb - 21, 36, 2.5, '#E8B923'); rect(cx - 18, yb - 5, 36, 2, '#E8B923');
      for (let x = cx - 18; x < cx + 18; x += 6) { rect(x, yb - 21, 3, 2.5, '#1F1F1F'); rect(x + 3, yb - 5, 3, 2, '#1F1F1F'); }
      rect(cx - 14, yb - 17, 28, 10, '#C62A30'); rect(cx - 14, yb - 17, 28, 0.5, '#F06A6E'); rect(cx - 14, yb - 7.5, 28, 0.5, '#8E1C22');
      for (let k = 0; k < 4; k++) { rect(cx - 11 + k * 6, yb - 15, 4, 0.5, '#FFFFFF'); rect(cx - 10 + k * 6, yb - 13.5, 2, 2, '#FFFFFF'); rect(cx - 11 + k * 6, yb - 11, 4, 0.5, '#FFFFFF'); }
      rect(cx - 20, yb - 1, 6, 2, '#2A2A2A'); rect(cx + 14, yb - 1, 6, 2, '#2A2A2A');
    };
    sign(738, 837);
    this.signRect = [724, 820, 28, 10];

    // 블록 굽기 (블록 안은 원래 좌표 그대로) — inBlock()이 새 자리로 옮기고 블록 밖으로 번지지 않게 자른다
    const sect = (id, fn, grow) => { this.inBlock(c, id, fn, grow); const q = blockRect(id); own(q[0], q[1], q[2] - q[0], q[3] - q[1]); };
    const bake = (kind, cx, cy, ang) => { const s = this.VS[kind], w = s.width / 2, h = s.height / 2; c.save(); c.translate(cx, cy); c.rotate(ang * Math.PI / 180); c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(-w / 2 + 2, -h / 2 + 2, w, h); c.drawImage(s, -w / 2, -h / 2, w, h); c.restore(); };

    const floorPaint = (kind, x, y, w, h) => {
      if (kind === 'wood') { rect(x, y, w, h, '#B8834F'); speck(x, y, w, h, ['#C08B57', '#AD7A48'], (w * h / 3) | 0); for (let j = y; j < y + h; j += 6) { rect(x, j, w, 0.5, '#9A6A3B'); for (let i = x + (((j - y) / 6) % 2 ? 0 : 14); i < x + w; i += 28) rect(i, j, 0.5, 6, '#9A6A3B'); } }
      else if (kind === 'tile') { rect(x, y, w, h, '#DCE3E8'); speck(x, y, w, h, ['#E4EAEE', '#D3DAE0'], (w * h / 4) | 0); for (let i = x; i < x + w; i += 16) rect(i, y, 0.5, h, '#BFC8D0'); for (let j = y; j < y + h; j += 16) rect(x, j, w, 0.5, '#BFC8D0'); }
      else if (kind === 'dark') { rect(x, y, w, h, '#2E3543'); speck(x, y, w, h, ['#343B4A', '#29303C'], (w * h / 4) | 0); for (let i = x; i < x + w; i += 16) rect(i, y, 0.5, h, '#242A35'); for (let j = y; j < y + h; j += 16) rect(x, j, w, 0.5, '#242A35'); }
      else if (kind === 'check') { for (let j = y; j < y + h; j += 16) for (let i = x; i < x + w; i += 16) rect(i, j, Math.min(16, x + w - i), Math.min(16, y + h - j), ((((i - x) / 16) + ((j - y) / 16)) % 2) ? '#D7CCB4' : '#E9E2D1'); speck(x, y, w, h, ['#F0EADB', '#CEC2A8'], (w * h / 5) | 0); }
      else if (kind === 'conc') { rect(x, y, w, h, '#A2A39D'); speck(x, y, w, h, ['#979892', '#ADAEA8'], (w * h / 3) | 0); }
      else if (kind === 'booth') { rect(x, y, w, h, '#CBD0D6'); for (let i = x; i < x + w; i += 8) rect(i, y, 0.5, h, '#B5BBC3'); for (let j = y; j < y + h; j += 8) rect(x, j, w, 0.5, '#B5BBC3'); }
      else if (kind === 'mess') { rect(x, y, w, h, '#BDB8A6'); speck(x, y, w, h, ['#C6C1B0', '#B3AE9C'], (w * h / 4) | 0); for (let i = x; i < x + w; i += 16) rect(i, y, 0.5, h, '#A7A290'); for (let j = y; j < y + h; j += 16) rect(x, j, w, 0.5, '#A7A290'); }
      else if (kind === 'corr') { rect(x, y, w, h, '#C9CFC2'); speck(x, y, w, h, ['#D1D7CA', '#C0C6B8'], (w * h / 5) | 0); for (let j = y; j < y + h; j += 12) rect(x, j, w, 0.5, '#B6BDAF'); }
      else if (kind === 'room') { rect(x, y, w, h, '#D5D2C8'); speck(x, y, w, h, ['#DDDAD0', '#CCC9BE'], (w * h / 5) | 0); for (let i = x; i < x + w; i += 20) rect(i, y, 0.5, h, '#C4C1B6'); for (let j = y; j < y + h; j += 20) rect(x, j, w, 0.5, '#C4C1B6'); }
      else if (kind === 'admin') { rect(x, y, w, h, '#8F979B'); speck(x, y, w, h, ['#99A1A5', '#868E92', '#949C9F'], (w * h / 3) | 0); for (let i = x; i < x + w; i += 16) rect(i, y, 0.5, h, '#7F878B'); for (let j = y; j < y + h; j += 16) rect(x, j, w, 0.5, '#7F878B'); }
    };
    const floorCol = { wood: '#B8834F', tile: '#DCE3E8', dark: '#2E3543', check: '#E9E2D1', conc: '#A2A39D', booth: '#CBD0D6', mess: '#BDB8A6', corr: '#C9CFC2', room: '#D5D2C8', admin: '#8F979B' };
    const building = (tx, ty, tw, th, kind, topDoors, botDoors) => {
      const bx = tx * T, by = ty * T, bw = tw * T, bh = th * T;
      mark(tx, ty, tw, th);
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(bx + 4, by + bh, bw, 4); c.fillRect(bx + bw, by + 6, 4, bh);
      floorPaint(kind, bx + 6, by + 32, bw - 12, bh - 38);
      rect(bx, by, bw, 32, '#E3DCCB'); speck(bx, by + 5, bw, 24, ['#E9E3D4', '#DBD3C1'], (bw * 6) | 0);
      rect(bx, by, bw, 4, '#B4AB95'); rect(bx, by + 4, bw, 1, '#CFC7B3'); rect(bx, by + 29, bw, 3, '#A89E87'); rect(bx, by + 28.5, bw, 0.5, '#C2B9A4');
      for (let x = bx + 20; x + 18 <= bx + bw - 16; x += 52) {
        if ((topDoors || []).some((d) => x + 22 > d * T && x < d * T + 36)) continue;
        rect(x, by + 9, 18, 14, '#566B7C'); rect(x + 1, by + 10, 16, 12, '#8CB3D2'); rect(x + 1, by + 10, 7, 4, '#BBD7EC'); rect(x + 1.5, by + 10.5, 2, 0.5, '#E4F1FA'); rect(x + 9, by + 9, 1, 14, '#566B7C'); rect(x, by + 16, 18, 1, '#566B7C'); rect(x - 1, by + 23, 20, 1, '#B8AF99');
      }
      rect(bx, by + 32, 6, bh - 32, '#D2CAB6'); rect(bx, by + 32, 1, bh - 32, '#9C937D'); rect(bx + 5, by + 32, 1, bh - 32, '#BBB29C');
      rect(bx + bw - 6, by + 32, 6, bh - 32, '#D2CAB6'); rect(bx + bw - 1, by + 32, 1, bh - 32, '#9C937D'); rect(bx + bw - 6, by + 32, 1, bh - 32, '#BBB29C');
      rect(bx, by + bh - 6, bw, 6, '#D2CAB6'); rect(bx, by + bh - 1, bw, 1, '#9C937D'); rect(bx + 6, by + bh - 6, bw - 12, 1, '#BBB29C');
      (topDoors || []).forEach((d) => { const x = d * T; rect(x, by, 32, 32, '#7C6A55'); rect(x + 2, by + 2, 28, 30, '#3B342D'); rect(x + 4, by + 4, 24, 4, '#4B4339'); rect(x + 2, by + 28, 28, 4, floorCol[kind]); rect(x + 26, by + 16, 1.5, 3, '#C9B48A'); });
      (botDoors || []).forEach((d) => { const x = d * T; rect(x, by + bh - 6, 32, 6, floorCol[kind]); rect(x + 4, by + bh - 3, 24, 4, '#6B5B4A'); });
    };
    const bunk = (x, y) => { shade(x, y, 22, 34); rect(x, y, 22, 34, '#5E5A4F'); rect(x + 2, y + 2, 18, 30, '#3F5C3B'); rect(x + 2, y + 2, 18, 1, '#567A50'); rect(x + 4, y + 3, 14, 7, '#ECE8DE'); rect(x + 4, y + 9, 14, 1, '#CFC9BB'); rect(x + 2, y + 18, 18, 2, '#4E6E48'); rect(x + 2, y + 30, 18, 2, '#33492F'); speck(x + 2, y + 11, 18, 18, ['#486A44', '#365233'], 40); };
    const locker = (x, y, n) => { shade(x, y, n * 10, 22); rect(x, y, n * 10, 22, '#7D8893'); rect(x, y, n * 10, 2, '#98A3AE'); for (let k = 0; k < n; k++) { rect(x + k * 10, y, 1, 22, '#5F6A75'); rect(x + k * 10 + 7, y + 9, 1, 4, '#D0D5DA'); rect(x + k * 10 + 2, y + 4, 5, 0.5, '#5F6A75'); rect(x + k * 10 + 2, y + 5, 5, 0.5, '#5F6A75'); } };
    const gearBox = (x, y) => { shade(x, y, 18, 22); rect(x, y, 18, 22, '#3B424A'); rect(x, y, 18, 2, '#525A63'); rect(x + 3, y + 4, 12, 8, '#2C3238'); rect(x + 4, y + 5, 10, 0.5, '#4A525C'); rect(x + 13, y + 15, 3, 3, '#1C2126'); this.overlays.leds.push([x + 14, y + 16]); };
    const clinicBed = (x, y) => { shade(x, y, 22, 40); rect(x, y, 22, 40, '#C9D0D6'); rect(x + 1, y + 1, 20, 38, '#F2F4F5'); rect(x + 3, y + 3, 16, 8, '#FFFFFF'); rect(x + 3, y + 11, 16, 1, '#D9DEE2'); rect(x + 2, y + 16, 18, 22, '#7FB1DA'); rect(x + 2, y + 16, 18, 2, '#9CC6E8'); for (let j = y + 20; j < y + 38; j += 4) rect(x + 2, j, 18, 0.5, '#6FA3CF'); };
    const curtain = (x, y, h) => { for (let j = 0; j < h; j += 4) rect(x, y + j, 2, 2, '#9CC4E4'); };
    const desk = (x, y, w, mons) => { shade(x, y, w, 14); rect(x, y, w, 14, '#7A5B3D'); rect(x, y, w, 3, '#94714E'); rect(x, y + 3, w, 0.5, '#A8835E'); (mons || []).forEach((mx) => { rect(mx, y - 7, 14, 9, '#1D222A'); rect(mx + 1, y - 6, 12, 6, '#3FC4F2'); rect(mx + 6, y + 2, 2, 2, '#1D222A'); this.overlays.monitors.push([mx + 1, y - 6, 12, 6]); }); rect(x + w / 2 - 6, y + 6, 12, 3, '#2F3540'); };
    const chair = (x, y) => { rect(x, y, 10, 8, '#2E3540'); rect(x + 1, y + 1, 8, 3, '#3D4654'); rect(x + 1.5, y + 1.5, 3, 0.5, '#56607A'); };
    const table = (x, y, w, h) => { shade(x, y, w, h); rect(x, y, w, h, '#C7A276'); rect(x, y, w, 2, '#D6B48B'); speck(x, y + 2, w, h - 2, ['#BD9769', '#CFAB80'], 30); };
    const stool = (x, y) => { rect(x, y, 8, 6, '#6A584A'); rect(x + 1, y + 1, 6, 2, '#7E6A59'); };
    const plant = (x, y) => { rect(x + 3, y + 8, 8, 6, '#8A5A3B'); rect(x + 1, y, 12, 9, '#3F7A3A'); rect(x + 3, y - 2, 8, 4, '#4F8F45'); rect(x + 3, y + 1, 3, 2, '#62A653'); speck(x + 1, y - 2, 12, 10, ['#6AB25A', '#2F6A2C'], 20); };

    const disc = (cx, cy, r, ky, col) => { for (let dy = -r; dy <= r; dy += 0.5) { const w = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)) * 2) / 2; if (w > 0) rect(cx - w, cy + dy * ky, w * 2, Math.max(0.5, ky * 0.5 + 0.01), col); } };
    const gunLocker = (x, y, w) => {
      shade(x, y, w, 26);
      rect(x, y, w, 26, '#4E5B4C'); rect(x, y, w, 2, '#6B7A68'); rect(x, y + 24, w, 2, '#38423A'); rect(x, y, 1, 26, '#62705F');
      rect(x + 2, y + 4, w - 4, 18, '#1C2420');
      for (let rx = x + 4; rx < x + w - 4; rx += 4.5) { rect(rx, y + 5, 1.5, 10, '#0D1110'); rect(rx - 0.5, y + 14, 2.5, 6, '#151817'); rect(rx + 1, y + 6, 0.5, 7, '#3A4440'); rect(rx + 0.5, y + 10, 1, 1.5, '#2A2F2D'); }
      for (let gx = x + 2; gx < x + w - 2; gx += 2) rect(gx, y + 4, 0.5, 18, 'rgba(170,185,175,0.3)');
      rect(x + w / 2 - 0.5, y + 3, 1, 20, '#62705F'); rect(x + w / 2 + 1.5, y + 11, 2, 4, '#E2BB3D'); rect(x + w / 2 + 2, y + 12.5, 1, 1, '#7A6420');
    };
    const radioRack = (x, y) => {
      shade(x, y, 28, 26); rect(x, y, 28, 26, '#2B3038'); rect(x, y, 28, 2, '#454C57');
      for (let k = 0; k < 3; k++) { rect(x + 2, y + 4 + k * 7, 24, 5, '#1B1F25'); rect(x + 3, y + 5 + k * 7, 7, 3, '#3A6E5A'); rect(x + 4, y + 6 + k * 7, 4, 0.5, '#8FE0B8'); rect(x + 12, y + 6 + k * 7, 5, 1, '#7D8794'); this.overlays.leds.push([x + 20 + (k % 2) * 3, y + 6 + k * 7]); }
    };
    const flagStand = (x, y, kr) => {
      rect(x - 2, y, 6, 2, '#7A6420'); rect(x, y - 32, 1.5, 33, '#C9A93A'); rect(x - 0.5, y - 34, 2.5, 2, '#E8C95A');
      if (kr) { rect(x + 1.5, y - 31, 14, 10, '#F7F7F4'); rect(x + 7, y - 28.5, 4, 2, '#D33A3A'); rect(x + 7, y - 26.5, 4, 2, '#2453A6'); [[3, -30], [12.5, -30], [3, -23], [12.5, -23]].forEach((q) => rect(x + q[0], y + q[1], 1.5, 1, '#111111')); }
      else { rect(x + 1.5, y - 31, 14, 10, '#2E4A7A'); rect(x + 6, y - 29, 5, 5, '#C9A93A'); rect(x + 7, y - 28, 3, 3, '#7A1E1E'); rect(x + 1.5, y - 22, 14, 1, '#C9A93A'); }
    };
    const tray = (x, y) => {
      rect(x, y, 10, 6.5, '#9DA4AB'); rect(x + 0.5, y + 0.5, 9, 5.5, '#C9CED3');
      rect(x + 1, y + 1, 3.5, 2.5, '#F6F4EC'); rect(x + 1.5, y + 1.5, 1, 0.5, '#FFFFFF');
      rect(x + 5.5, y + 1, 3.5, 2.5, '#C2522C'); rect(x + 6, y + 1.5, 1.5, 0.5, '#E07A4A');
      rect(x + 1, y + 4, 2.5, 1.5, '#5E9A3A'); rect(x + 4, y + 4, 2, 1.5, '#E0A23A'); rect(x + 6.5, y + 4, 2.5, 1.5, '#B83A2A');
      rect(x + 10.5, y + 1, 0.5, 4.5, '#D8DCE0');
    };

    sect('mess', () => {
    building(6, 5, 22, 15, 'mess', [], [16]);
    board('밀리테리아 · 병영식당', 272, 86);
    rect(102, 112, 340, 64, '#D9DCD6'); for (let i = 102; i < 442; i += 8) rect(i, 112, 0.5, 64, '#C2C6BF'); for (let j = 112; j < 176; j += 8) rect(102, j, 340, 0.5, '#C2C6BF');
    shade(108, 114, 108, 28); rect(108, 114, 108, 28, '#6E757D'); rect(108, 114, 108, 2, '#8C939B'); rect(108, 140, 108, 2, '#4E545B');
    [[126, '#B8572E'], [162, '#F1EEE2'], [198, '#C98A3A']].forEach((k) => {
      disc(k[0], 127, 12, 0.8, '#B8BEC5'); disc(k[0], 126, 11, 0.8, '#D7DCE1'); disc(k[0], 127, 9, 0.75, '#3A3F45'); disc(k[0], 128, 7.5, 0.7, k[1]);
      rect(k[0] - 3, 125, 2, 1, 'rgba(255,255,255,0.45)'); rect(k[0] + 8, 120, 1, 9, '#7D848C'); rect(k[0] + 6, 119.5, 4, 1, '#9AA1A9');
      this.overlays.steam.push([k[0], 122]);
    });
    shade(220, 116, 28, 22); rect(220, 116, 28, 22, '#33383E'); rect(220, 116, 28, 2, '#4E555E'); [[227, 123], [241, 123], [227, 132], [241, 132]].forEach((q) => { disc(q[0], q[1], 4, 0.8, '#1C1F23'); disc(q[0], q[1], 2.5, 0.8, '#3A3F45'); });
    shade(254, 118, 76, 14); rect(254, 118, 76, 14, '#C3C9CF'); rect(254, 118, 76, 1.5, '#E2E6EA'); rect(254, 130, 76, 2, '#8E959C');
    rect(262, 121, 15, 8, '#C9A06A'); rect(262, 121, 15, 0.5, '#E0BC88'); rect(266, 124, 8, 0.5, '#EDEDED'); rect(273, 123.5, 3, 1.5, '#3A3A3A');
    speck(282, 121, 14, 7, ['#5E9A3A', '#7CBF4E', '#4C7F2E'], 40); speck(300, 121, 12, 7, ['#E08A2E', '#F0A04A'], 26); speck(316, 121, 10, 7, ['#F2EFE6', '#DCD8CC'], 20);
    shade(338, 116, 30, 18); rect(338, 116, 30, 18, '#AEB4BA'); rect(341, 119, 24, 12, '#6E757D'); rect(342, 120, 22, 1, '#8E959C'); rect(352, 114, 2, 5, '#D0D5DA');
    shade(372, 116, 24, 16); rect(372, 116, 24, 16, '#8C939B'); disc(378, 123, 4.5, 0.8, '#C3C9CF'); disc(390, 123, 4.5, 0.8, '#C3C9CF'); rect(377, 122, 2, 1, '#6E757D'); rect(389, 122, 2, 1, '#6E757D');
    shade(400, 112, 38, 40); rect(400, 112, 38, 40, '#C3C9CF'); rect(400, 112, 38, 2, '#E2E6EA'); rect(418.5, 114, 1, 36, '#8E959C'); rect(414, 126, 1.5, 9, '#6E757D'); rect(422.5, 126, 1.5, 9, '#6E757D'); rect(400, 150, 38, 2, '#8E959C'); rect(404, 116, 8, 4, '#E8ECEF'); rect(405, 117, 6, 0.5, '#5A7FA0');
    shade(118, 176, 224, 16); rect(118, 176, 224, 8, '#C3C9CF'); rect(118, 176, 224, 1, '#E8ECEF'); rect(118, 184, 224, 8, '#8E959C'); for (let x = 118; x < 342; x += 28) rect(x, 184, 0.5, 8, '#737A82');
    rect(118, 174.5, 224, 1, '#A9D3E8'); rect(118, 174.5, 224, 0.5, '#E2F4FB');
    const pan = (x, w, col, col2) => { rect(x, 177.5, w, 5.5, '#9DA4AB'); rect(x + 0.5, 178, w - 1, 4.5, col); speck(x + 1, 178.5, w - 2, 3.5, [col2], (w * 1.2) | 0); };
    pan(124, 24, '#F3F0E4', '#FFFFFF'); disc(160, 180, 4.5, 0.75, '#7D848C'); disc(160, 180, 3.5, 0.7, '#B8572E'); rect(156, 175.5, 0.5, 4, '#D0D5DA');
    pan(170, 18, '#5E9A3A', '#7CBF4E'); pan(190, 18, '#E0A23A', '#F2C66A'); pan(210, 18, '#B83A2A', '#D85A3A'); pan(230, 18, '#7A4A2A', '#9A6440'); pan(250, 18, '#D9C27A', '#EBD89A');
    for (let k = 0; k < 4; k++) { rect(274 + k * 6, 178, 4, 4.5, '#F4F4F2'); rect(274 + k * 6, 178, 4, 1, '#3C7BB8'); }
    for (let k = 0; k < 3; k++) { rect(304 + k * 10, 178, 8, 4.5, '#E8B04A'); rect(304 + k * 10, 178, 8, 0.5, '#F6D284'); }
    shade(104, 180, 14, 14); for (let k = 0; k < 5; k++) rect(104, 190 - k * 2, 14, 2, k % 2 ? '#B8BEC5' : '#9DA4AB'); rect(104, 196, 14, 5, '#6E757D'); for (let k = 0; k < 6; k++) rect(105.5 + k * 2, 194, 0.5, 3, '#D8DCE0');
    shade(388, 176, 50, 18); rect(388, 176, 50, 10, '#A9AFB6'); rect(388, 176, 50, 1, '#D0D5DA'); rect(388, 186, 50, 8, '#7D848C');
    for (let k = 0; k < 3; k++) { rect(392 + k * 13, 177.5 - (k === 1 ? 1 : 0), 10, 6.5, '#9DA4AB'); speck(393 + k * 13, 178.5, 8, 4, ['#C2522C', '#5E9A3A', '#F6F4EC'], 6); }
    board('퇴식구', 413, 166, 'small');
    board('배식대', 230, 185, 'small');
    const mtab = (x, y, w) => { shade(x, y, w, 16); rect(x, y, w, 16, '#C8B48C'); rect(x, y, w, 1, '#DCCBA6'); rect(x, y + 16, w, 2, '#9C8A66'); rect(x + 3, y + 18, 2, 2, '#6E6250'); rect(x + w - 5, y + 18, 2, 2, '#6E6250'); };
    const occ8 = ['110111', '111011', '011110', '110101', '101101', '011111', '111010', '010110'];
    let dI = 0;
    [[112, 226], [262, 226], [112, 272], [262, 272]].forEach((tb, ti) => {
      mtab(tb[0], tb[1], 130);
      for (let i = 0; i < 6; i++) {
        const sx = tb[0] + 11 + i * 22;
        rect(sx - 3.5, tb[1] - 6, 7, 5, '#4A5560'); rect(sx - 3.5, tb[1] - 6, 7, 1, '#6A7784');
        rect(sx - 3.5, tb[1] + 20, 7, 5, '#4A5560'); rect(sx - 3.5, tb[1] + 20, 7, 1, '#6A7784');
        [0, 1].forEach((side) => {
          if (occ8[ti * 2 + side][i] !== '1') { if ((i + ti + side) % 4 === 0) rect(sx - 2, tb[1] + (side ? 10 : 3), 3, 3, '#E8ECEF'); return; }
          tray(sx - 5, tb[1] + (side ? 8.5 : 1.5));
          rect(sx + 3.5, tb[1] + (side ? 8.5 : 2), 1.5, 2, '#E8ECEF');
          const ty = dI % 5 === 3 ? 'pt' : 'soldier', rk = ['e1', 'e2', 'e3', 'e4'][dI % 4];
          seat(ty, ty === 'pt' ? '' : rk, sx, tb[1] + (side ? 27 : 1), side ? 'up' : 'down', '용사 · 아침 식사');
          dI++;
        });
      }
    });
    plant(106, 296); plant(424, 296);
    });

    sect('hq', () => {
    building(38, 4, 30, 16, 'dark', [], [53]);
    board('대대본부 · 통합관제상황실', 848, 70);
    shade(646, 96, 404, 52); rect(646, 96, 404, 52, '#10151F'); rect(646, 96, 404, 1.5, '#2A3446'); rect(646, 146, 404, 2, '#070A10');
    for (let k = 0; k < 4; k++) { const x = 651 + k * 99; rect(x - 1, 100, 95, 43, '#05080D'); this.wall.push([x, 101, 93, 41]); }
    radioRack(616, 100); gunLocker(1050, 100, 30);
    const vy = (x) => Math.round((x < 820 ? 250 - (820 - x) * 40 / 84 : (x > 876 ? 250 - (x - 876) * 40 / 84 : 250)) * 2) / 2;
    c.fillStyle = 'rgba(0,0,0,0.18)'; for (let x = 736; x <= 960; x++) c.fillRect(x + 3, vy(x) + 8, 1, 4);
    for (let x = 736; x <= 960; x++) { const y = vy(x); rect(x, y - 6, 1, 12, '#7A5A3C'); rect(x, y - 6, 1, 1, '#9A7650'); rect(x, y + 6, 1, 3, '#3E2C1E'); }
    rect(736, vy(736) - 6, 1, 15, '#5C4632'); rect(960, vy(960) - 6, 1, 15, '#5C4632');
    [752, 778, 804, 892, 918, 944].forEach((x, i) => {
      const y = vy(x) - 2, sd = i < 3 ? -1 : 1;
      rect(x - 4, y - 3, 8, 5, '#7D848C'); rect(x - 3.5, y - 2.5, 7, 4, '#A9AFB6'); rect(x - 0.5, y - 1, 1, 1, '#E2E6EA');
      rect(x - sd * 9 - 2.5, y - 3, 5, 6, '#F4F4F0'); rect(x - sd * 9 - 1.5, y - 2, 3, 0.5, '#9AA0A6'); rect(x - sd * 9 - 1.5, y - 0.5, 3, 0.5, '#9AA0A6');
      rect(x + sd * 6, y - 4, 1, 3, '#1D222A');
    });
    rect(830, 245, 8, 6, '#F4F4F0'); rect(831, 246, 6, 0.5, '#9AA0A6'); rect(858, 245, 8, 6, '#F4F4F0'); rect(859, 246, 6, 0.5, '#9AA0A6');
    board('대대장', 848, 240, 'small', { bg: '#5A3F25' });
    rect(836, 252, 24, 20, '#3A2A20'); rect(837, 253, 22, 4, '#56402E'); rect(836, 271, 24, 2, '#24190F');
    rect(840, 211, 16, 5, '#151B26'); rect(842, 212, 12, 3, '#2F6A8E'); rect(845, 212.5, 6, 2, '#7FE3FF');
    const vcon = (x, y0, y1, face) => {
      shade(x, y0, 14, y1 - y0); rect(x, y0, 14, y1 - y0, '#5C4632'); rect(x, y0, 14, 1, '#7A5B3D'); rect(face === 'right' ? x + 13 : x, y0, 1, y1 - y0, '#7A5B3D'); rect(x, y1, 14, 3, '#3E2C1E');
    };
    const vmon = (x, y, face) => {
      const bx = face === 'right' ? x + 1 : x + 9;
      rect(bx, y, 4, 17, '#1D222A'); rect(face === 'right' ? bx + 3 : bx, y + 1, 1, 15, '#3FC4F2');
      rect(face === 'right' ? bx + 3.5 : bx - 0.5, y + 2, 0.5, 4, '#E6F6FF'); rect(x + (face === 'right' ? 7 : 3), y + 5, 4, 8, '#C9CED3'); rect(x + (face === 'right' ? 7.5 : 3.5), y + 6, 3, 0.5, '#9AA0A6');
    };
    vcon(617, 156, 296, 'right'); [164, 192, 220, 248, 276].forEach((y) => vmon(617, y, 'right'));
    vcon(1065, 156, 296, 'left'); [164, 192, 220, 248, 276].forEach((y) => vmon(1065, y, 'left'));
    shade(686, 168, 14, 76); rect(686, 168, 14, 76, '#6B5240'); rect(686, 168, 14, 1, '#86664E'); rect(686, 244, 14, 3, '#3E2C1E');
    [172, 204].forEach((y) => { rect(692, y, 2, 18, '#1D222A'); rect(691, y + 1, 1, 16, '#3FC4F2'); rect(694, y + 1, 1, 16, '#3FC4F2'); rect(687, y + 6, 3, 7, '#C9CED3'); rect(696, y + 6, 3, 7, '#C9CED3'); });
    disc(684, 280, 14, 0.85, '#5A3F28'); disc(684, 279, 13.5, 0.82, '#8A6A4A'); rect(676, 275, 12, 8, '#E9E4D6'); rect(678, 277, 8, 4, '#9CB98A'); rect(680, 278, 2, 1, '#D33A3A'); rect(683, 279, 2, 1, '#2453A6'); rect(692, 276, 2.5, 3, '#F4F4F0');
    shade(976, 172, 56, 12); rect(976, 172, 56, 12, '#6B5240'); rect(976, 172, 56, 1, '#86664E'); rect(976, 184, 44, 3, '#3E2C1E');
    shade(1020, 172, 12, 64); rect(1020, 172, 12, 64, '#6B5240'); rect(1031, 172, 1, 64, '#86664E'); rect(1020, 236, 12, 3, '#3E2C1E');
    [982, 998].forEach((x) => { rect(x, 164, 13, 10, '#1D222A'); rect(x + 1, 165, 11, 7, '#2C5B7E'); rect(x + 2, 166, 4, 3, '#7FE3FF'); rect(x + 7, 168, 4, 0.5, '#E6F6FF'); rect(x + 5.5, 174, 2, 1.5, '#1D222A'); });
    vmon(1020, 200, 'left');
    rect(728, 276, 36, 22, '#8E959C'); rect(729, 277, 34, 18, '#F2F2EE'); rect(732, 280, 14, 9, '#BFD7B0'); rect(735, 283, 6, 1, '#D33A3A'); rect(741, 281, 1, 5, '#D33A3A'); rect(749, 280, 10, 0.5, '#3C7BB8'); rect(749, 283, 8, 0.5, '#3C7BB8'); rect(749, 286, 11, 0.5, '#3C7BB8'); rect(731, 298, 1.5, 8, '#6E757D'); rect(759, 298, 1.5, 8, '#6E757D');
    shade(1032, 290, 20, 16); rect(1032, 290, 20, 16, '#D9DCDF'); rect(1032, 290, 20, 2, '#F2F4F5'); rect(1034, 294, 16, 3, '#2E3540'); rect(1035, 299, 14, 4, '#F4F4F0');
    shade(1058, 286, 14, 22); rect(1058, 286, 14, 22, '#E8ECEF'); rect(1059, 287, 12, 6, '#7FB8E0'); rect(1061, 296, 3, 2, '#3C7BB8'); rect(1066, 296, 3, 2, '#D33A3A');
    shade(960, 294, 18, 16); rect(960, 294, 18, 16, '#3A4048'); rect(960, 294, 18, 2, '#565E68'); disc(969, 302, 3, 1, '#9AA1A9'); rect(974, 300, 1.5, 4, '#C9CED3');
    plant(648, 298);
    });

    // 수송부 주차장: 같은 그림을 네 조각(lotTL·TR·BL·BR)으로 잘라 붙인다 — 가운데 차량 한 줄과 통로 일부가 빠진다
    const lotArt = () => {
      lot(70, 5, 22, 20);
      for (let x = 1130; x <= 1450; x += 40) { rect(x, 92, 1, 76, '#E9E9E3'); rect(x, 292, 1, 76, '#E9E9E3'); }
      [1150, 1190, 1230, 1270, 1410].forEach((x) => bake('k151', x, 130, 180));
      bake('truck', 1330, 140, 180); bake('truck', 1370, 140, 180);
      bake('k151', 1150, 328, 0); bake('k151', 1190, 328, 0); bake('truck', 1270, 322, 0);
    };
    ['lotTL', 'lotTR', 'lotBL', 'lotBR'].forEach((id) => sect(id, lotArt));
    rect(1114, 52, 1, 76, '#E9E9E3'); rect(1114, 180, 1, 76, '#E9E9E3'); // 잘린 자리의 주차선

    sect('fac', () => {
    building(92, 4, 14, 11, 'conc', [], [96, 98]);
    board('차량 정비고', 1584, 70);
    rect(1500, 130, 40, 72, '#5E656F'); for (let y = 132; y < 200; y += 8) { rect(1500, y, 2, 4, '#E2BB3D'); rect(1538, y, 2, 4, '#E2BB3D'); }
    rect(1560, 100, 120, 10, '#4D5763'); for (let x = 1566; x < 1676; x += 10) rect(x, 102, 2, 6, ['#C9CED3', '#E2BB3D', '#D53939'][(x / 10) % 3 | 0]);
    rect(1648, 190, 16, 6, '#1C1C1C'); rect(1648, 196, 16, 6, '#2A2A2A'); rect(1648, 202, 16, 6, '#1C1C1C');
    rect(1662, 120, 12, 14, '#2F5D8A'); rect(1662, 120, 12, 2, '#4C7FB0');
    c.fillStyle = 'rgba(20,20,20,0.18)'; c.fillRect(1590, 200, 14, 6); c.fillRect(1580, 150, 8, 4);
    bake('k151', 1520, 166, 0);
    });
    this.roofs = [{ x: 988, y: 60, w: 174, h: 72 }, { x: 988, y: 178, w: 126, h: 66 }];
    board('수송부 · 전술차량 차양대', 1076, 260, 'post');

    sect('med', () => {
    rect(392, 560, 44, 100, '#A3A59F'); speck(392, 560, 44, 100, ['#ABADA7', '#989A94'], 400);
    building(6, 33, 18, 14, 'tile', [13], []);
    rect(292, 536, 16, 16, '#F4F4F2'); rect(298, 538, 4, 12, '#D63A3A'); rect(294, 542, 12, 4, '#D63A3A');
    rect(110, 566, 48, 16, '#EEF0F2'); rect(110, 566, 48, 2, '#FFFFFF'); rect(110, 581, 48, 1, '#C3C9CF'); rect(133, 566, 1, 16, '#C3C9CF'); rect(120, 570, 3, 7, '#D63A3A'); rect(118, 572, 7, 3, '#D63A3A');
    rect(340, 566, 30, 12, '#C9D0D6'); rect(346, 568, 18, 8, '#9FB4C4'); rect(347, 568.5, 6, 0.5, '#D9E6EE');
    desk(300, 600, 50, [318]);
    [112, 150, 188, 226].forEach((x) => clinicBed(x, 690)); [141, 179, 217].forEach((x) => curtain(x, 686, 50));
    plant(350, 720);
    board('의무실', 150, 534);
    bake('amb', 414, 610, 0);
    });
    this.overlays.amb = RP([[409, 601.5], [419, 601.5]]);

    sect('parade', () => {
    rect(448, 528, 336, 288, '#B99A68'); speck(448, 528, 336, 288, ['#AE8E5E', '#C4A672', '#A8895A', '#CBAE7A'], 40000); mark(28, 33, 21, 18);
    rect(470, 550, 292, 2, '#EFEDE6'); rect(470, 792, 292, 2, '#EFEDE6'); rect(470, 550, 2, 244, '#EFEDE6'); rect(760, 550, 2, 244, '#EFEDE6');
    rect(496, 576, 240, 1, '#E0DBCF'); rect(496, 766, 240, 1, '#E0DBCF'); rect(496, 576, 1, 190, '#E0DBCF'); rect(735, 576, 1, 190, '#E0DBCF');
    const chalk = '#E6E1D3';
    rect(616, 576, 1, 191, chalk);
    for (let a = 0; a < 6.283; a += 0.04) rect(Math.round((616 + Math.cos(a) * 22) * 2) / 2, Math.round((671.5 + Math.sin(a) * 22) * 2) / 2, 1, 1, chalk);
    rect(615, 670.5, 3, 3, chalk);
    [[497, 1], [735, -1]].forEach((g) => {
      const xm = g[0], d = g[1], bx = d > 0 ? xm : xm - 36;
      rect(bx, 628, 36, 1, chalk); rect(bx, 715, 36, 1, chalk); rect(d > 0 ? xm + 36 : xm - 36, 628, 1, 88, chalk);
      rect(d > 0 ? xm : xm - 14, 650, 14, 1, chalk); rect(d > 0 ? xm : xm - 14, 693, 14, 1, chalk); rect(d > 0 ? xm + 14 : xm - 14, 650, 1, 44, chalk);
      rect(xm + d * 24, 671, 1.5, 1.5, chalk);
      const nx = d > 0 ? xm - 10 : xm;
      c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(nx, 652, 10, 44);
      for (let y = 642; y < 694; y += 2) for (let x = nx; x < nx + 10; x += 2) rect(x + ((y / 2) % 2 ? 1 : 0), y, 0.5, 0.5, 'rgba(245,245,240,0.6)');
      rect(nx + (d > 0 ? 0 : 9.5), 652, 0.5, 42, '#B9BEC3'); rect(nx, 652, 10, 0.5, '#B9BEC3'); rect(nx, 694, 10, 0.5, '#B9BEC3');
      rect(xm - 0.75, 640, 1.5, 54, '#FFFFFF'); rect(xm - 1.5, 640, 3, 1.5, '#FFFFFF'); rect(xm + (d > 0 ? 0.75 : -1.25), 641, 0.5, 53, '#B9BEC3');
    });
    const pole = (x, h, kind) => {
      rect(x - 2, 511, 5, 2, '#7D848C'); rect(x, 512 - h, 1.5, h, '#C9CED3'); rect(x + 0.5, 512 - h, 0.5, h, '#F2F4F5'); rect(x - 0.5, 510 - h, 2.5, 2, '#E8C95A');
      const fx = x + 1.5, fy = 513 - h;
      if (kind === 'kr') {
        rect(fx, fy, 18, 12, '#F7F7F4'); rect(fx, fy + 11.5, 18, 0.5, '#D6D6D0');
        disc(fx + 9, fy + 6, 3, 1, '#D33A3A'); rect(fx + 6, fy + 6, 6, 3, '#2453A6'); rect(fx + 6, fy + 6, 3, 1.5, '#D33A3A'); rect(fx + 9, fy + 7.5, 3, 1.5, '#2453A6');
        [[2, 1.5], [14, 1.5], [2, 8.5], [14, 8.5]].forEach((q) => { rect(fx + q[0], fy + q[1], 2.5, 0.5, '#111111'); rect(fx + q[0], fy + q[1] + 1, 2.5, 0.5, '#111111'); rect(fx + q[0], fy + q[1] + 2, 2.5, 0.5, '#111111'); });
      } else if (kind === 'unit') { rect(fx, fy, 16, 11, '#2E4A7A'); rect(fx + 5, fy + 2.5, 6, 6, '#C9A93A'); rect(fx + 6.5, fy + 4, 3, 3, '#7A1E1E'); rect(fx, fy + 10, 16, 1, '#C9A93A'); }
      else { rect(fx, fy, 16, 11, '#8A1E24'); rect(fx + 5, fy + 2.5, 6, 6, '#F2F2EE'); rect(fx + 6.5, fy + 4, 3, 3, '#2E4A7A'); rect(fx, fy + 10, 16, 1, '#E8C95A'); }
    };
    shade(611, 508, 11, 5); rect(611, 508, 11, 5, '#B4B0A4'); rect(611, 508, 11, 1, '#D6D2C6'); rect(612.5, 509.5, 8, 2, '#9C988C');
    this.flagPole = [616, 511];
    shade(562, 514, 108, 30);
    rect(562, 514, 108, 20, '#CFCBC0'); speck(562, 514, 108, 20, ['#D8D4CA', '#C4C0B4'], 260); rect(562, 514, 108, 1, '#E6E3DA');
    rect(562, 534, 108, 10, '#9C988C'); rect(562, 534, 108, 1, '#B4B0A4'); for (let x = 562; x < 670; x += 9) rect(x, 535, 0.5, 9, '#8A867B');
    rect(604, 534, 24, 11, '#B9B5AA'); for (let k = 0; k < 3; k++) { rect(604, 537 + k * 3, 24, 0.5, '#8A867B'); rect(604, 535 + k * 3, 24, 0.5, '#CFCBC0'); }
    rect(562, 514, 2, 30, '#B4B0A4'); rect(668, 514, 2, 30, '#8A867B');
    rect(574, 518, 22, 10, '#9A2A2A'); rect(636, 518, 22, 10, '#9A2A2A');
    shade(608, 518, 16, 14); rect(608, 518, 16, 12, '#6B4F35'); rect(608, 518, 16, 2, '#86643F'); rect(608, 530, 16, 2, '#4A3524'); rect(612, 522, 8, 6, '#C9A93A'); rect(613.5, 523.5, 5, 3, '#7A1E1E'); rect(615.5, 514, 1, 4, '#2A2A2A'); rect(615, 513.5, 2, 1.5, '#1A1A1A');
    board('사열대', 616, 546, 'small', { bg: '#5A3F25' });
    board('연병장', 500, 504, 'post');
    }, [0, 80, 0, 0]); // 사열대·게양대 받침은 연병장 위 보도로 조금 나온다
    this.flagPole = RM(616, 511);

    // 생활관 행정반·수송부 행정반이 함께 쓰는 책상
    const cubicle = (x, y, kind) => {
      rect(x - 1, y - 8, 30, 8, '#C8CBC6'); rect(x - 1, y - 8, 30, 1.5, '#E6E8E4'); rect(x - 1, y - 0.5, 30, 0.5, '#A9ACA6');
      rect(x - 1, y - 8, 1.5, 21, '#B8BBB5'); rect(x + 27.5, y - 8, 1.5, 21, '#B8BBB5');
      rect(x + 0.5, y, 27, 10, '#DCD6C6'); rect(x + 0.5, y + 10, 27, 1.5, '#ACA593');
      if (kind === 'pc') { rect(x + 8, y - 6, 12, 9, '#1D222A'); rect(x + 9, y - 5, 10, 6.5, '#E6EEF6'); rect(x + 9, y - 5, 10, 1, '#3C7BB8'); for (let j = 0; j < 3; j++) rect(x + 10, y - 3 + j * 1.5, 8 - j * 2, 0.5, '#7D9AB8'); rect(x + 13, y + 3, 2, 1.5, '#1D222A'); rect(x + 8, y + 5.5, 11, 2, '#F2F2EE'); rect(x + 21, y + 6, 2, 2.5, '#E8E8E4'); }
      else { rect(x + 8, y - 1, 12, 5, '#1D222A'); rect(x + 9, y - 0.5, 10, 4, '#9FC6E8'); rect(x + 10, y, 5, 0.5, '#FFFFFF'); rect(x + 8, y + 4, 12, 4, '#AEB4BA'); rect(x + 9, y + 4.5, 10, 2.5, '#C9CED3'); }
      rect(x + 2, y + 2, 5, 6, '#FFFFFF'); rect(x + 2.5, y + 3, 4, 0.5, '#B9BEC3'); rect(x + 2.5, y + 4.5, 4, 0.5, '#B9BEC3'); rect(x + 24, y + 2, 2.5, 3, '#B5523C');
      rect(x + 9, y + 13, 10, 6, '#2E3540'); rect(x + 10, y + 14, 8, 2, '#3D4654');
    };
    sect('bar', () => {
    building(63, 32, 46, 27, 'corr', [85], []);
    board('생활관 · 행정반', 1376, 515);
    const RT = [544, 643, 742, 841], RB = 938;
    this.rooms = [];
    const vwall = (x) => { rect(x, 544, 6, RB - 544, '#D2CAB6'); rect(x, 544, 1, RB - 544, '#9C937D'); rect(x + 5, 544, 1, RB - 544, '#BBB29C'); };
    rect(1336, 544, 80, RB - 544, '#C9CFC2'); speck(1336, 544, 80, RB - 544, ['#D1D7CA', '#C0C6B8'], 5000); for (let j = 544; j < RB; j += 12) rect(1336, j, 80, 0.5, '#B6BDAF');
    rect(1368, 544, 16, RB - 544, 'rgba(255,255,255,0.14)'); rect(1370, 544, 2, RB - 544, 'rgba(255,255,255,0.12)');
    vwall(1330); vwall(1416);
    const bed = (x, y, flip) => {
      shade(x, y, 16, 28);
      rect(x, y, 16, 28, '#E9E9E5'); rect(x, y, 16, 0.5, '#FFFFFF'); rect(x + 15.5, y, 0.5, 28, '#B9BAB5');
      const hy = flip ? y + 25 : y, fy = flip ? y : y + 25;
      rect(x, hy, 16, 3, '#C9A877'); rect(x, hy + (flip ? 0 : 2.5), 16, 0.5, '#A8875A');
      rect(x, fy, 16, 3, '#C9A877'); rect(x, fy + (flip ? 2.5 : 0), 16, 0.5, '#A8875A');
      const b0 = flip ? y + 3 : y + 9;
      rect(x + 1, b0, 14, 16, '#4F5B33');
      for (let j = 0; j < 16; j += 2) for (let i = 0; i < 14; i += 2) { const h = (Math.imul((x + i) * 7 + (y + j) * 13, 2654435761) >>> 28) & 3; if (h) rect(x + 1 + i, b0 + j, 2, 2, ['#4F5B33', '#6B6A3E', '#2F3A24', '#8A7A4E'][h]); }
      rect(x + 1, flip ? b0 + 15.5 : b0, 14, 0.5, 'rgba(255,255,255,0.18)');
      const py = flip ? y + 19.5 : y + 3.5;
      rect(x + 2, py, 12, 4.5, '#3F8F4E'); for (let i = 1; i < 12; i += 2) rect(x + 2 + i, py, 0.5, 4.5, '#E2E6DC'); rect(x + 2, py, 12, 0.5, '#6FB37A');
    };
    const gwan = (x, y) => {
      shade(x, y, 12, 26);
      rect(x, y, 12, 26, '#F1F1EC'); rect(x, y, 12, 1, '#FFFFFF'); rect(x + 11.5, y, 0.5, 26, '#C9CAC4'); rect(x, y + 25.5, 12, 0.5, '#B9BAB4');
      rect(x + 1.5, y + 2, 9, 8, '#9AA0A5'); rect(x + 2, y + 2.5, 8, 0.5, '#6E747A');
      rect(x + 2.5, y + 3, 1.5, 6.5, '#55613C'); rect(x + 4.5, y + 3, 1.5, 6.5, '#6B6A3E'); rect(x + 6.5, y + 3, 1.5, 5.5, '#2F3A24'); rect(x + 8.5, y + 3, 1.5, 4, '#17191C');
      rect(x + 1.5, y + 11, 9, 5, '#E3E4DE'); rect(x + 5.5, y + 13, 1, 1, '#9AA0A5'); rect(x + 9, y + 12, 1, 1, '#29BDFD');
      rect(x + 1.5, y + 17, 9, 7, '#B4B9BD'); rect(x + 2.5, y + 20, 3, 3.5, '#22262C'); rect(x + 6.5, y + 18.5, 3, 5, '#5E6B48');
    };
    const gwanBack = (x, y) => { shade(x, y, 12, 26); rect(x, y, 12, 5, '#FAFAF6'); rect(x, y + 5, 12, 21, '#E4E5DF'); rect(x + 6, y + 5, 0.5, 21, '#CFD0CA'); rect(x, y + 25.5, 12, 0.5, '#B9BAB4'); };
    const tvStand = (x, y) => { shade(x, y + 6, 26, 12); rect(x, y + 6, 26, 12, '#E8E6DE'); rect(x, y + 6, 26, 1, '#FFFFFF'); rect(x + 12.75, y + 8, 0.5, 9, '#C9C6BC'); rect(x + 2, y - 5, 22, 12, '#14171B'); rect(x + 3, y - 4, 20, 9, '#2D4E6E'); rect(x + 4, y - 3, 8, 3, '#5E9AD0'); rect(x + 13, y - 1, 8, 1, '#A9D3F0'); rect(x + 12, y + 7, 2, 1, '#14171B'); };
    const shoeRack = (x, y, w) => { shade(x, y, w, 10); rect(x, y, w, 10, '#C9B48C'); rect(x, y, w, 1, '#DCCBA6'); for (let i = 0; i < w - 4; i += 6) { rect(x + 2 + i, y + 2, 4, 2.5, '#1E1E20'); rect(x + 2 + i, y + 6, 4, 2.5, i % 12 ? '#2A2A2C' : '#D6D9DD'); } };
    const roomTable = (x, y) => { shade(x, y, 36, 14); rect(x, y, 36, 14, '#D9C29A'); rect(x, y, 36, 1, '#EAD7B2'); rect(x, y + 14, 36, 2, '#A8916A'); rect(x + 4, y + 3, 6, 4, '#F4F4F0'); rect(x + 24, y + 4, 3, 3, '#3C7BB8'); rect(x + 15, y + 6, 6, 3, '#C25A3A'); };
    const barrack = (x0, x1, top, bot, doorLeft, num) => {
      gunLocker(doorLeft ? x0 + 8 : x1 - 52, top + 1, 44);
      shoeRack(doorLeft ? x0 + 10 : x1 - 46, bot - 11, 36);
      for (let i = 0; i < 5; i++) {
        const ux = doorLeft ? x0 + 62 + i * 31 : x1 - 62 - (i + 1) * 31 + 2;
        gwan(ux, top + 1); bed(ux + 13.5, top + 1, false);
        gwanBack(ux, bot - 27); bed(ux + 13.5, bot - 29, true);
      }
      tvStand(doorLeft ? x1 - 34 : x0 + 8, top + 2);
      const tx = doorLeft ? x1 - 84 : x0 + 48, mid = Math.round((top + bot) / 2);
      roomTable(tx, mid - 7);
      seat('pt', '', tx + 10, mid - 6, 'down', num + ' · 하계 활동복');
      seat('pt', '', tx + 26, mid + 18, 'up', num + ' · 하계 활동복');
      this.rooms.push({ x0: doorLeft ? x0 + 60 : x0 + 100, x1: doorLeft ? x1 - 100 : x1 - 60, y0: top + 44, y1: bot - 30, door: doorLeft ? x0 : x1, mid: mid, name: num });
    };
    const fileCab = (x, y) => { shade(x, y, 13, 24); rect(x, y, 13, 24, '#8A929A'); rect(x, y, 13, 1, '#AEB5BC'); for (let j = 0; j < 3; j++) { rect(x + 1, y + 2 + j * 7, 11, 6, '#9AA2AA'); rect(x + 5, y + 4.5 + j * 7, 3, 1, '#5E656D'); rect(x + 3, y + 3 + j * 7, 7, 1, '#F2F2EE'); } };
    const adminRoom = (x0, x1, top, bot, k) => {
      for (let i = 0; i < 3; i++) fileCab(x0 + 8 + i * 14, top + 1);
      const pat = [['110110', '011011'], ['101101', '111010']][k];
      let wI = 0;
      for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) {
        const dx = x0 + 56 + i * 32, dy = top + (r === 0 ? 14 : 50);
        cubicle(dx, dy, (i + r + k) % 3 === 2 ? 'laptop' : 'pc');
        if (pat[r][i] === '1') { const off = wI % 3 === 1; seat(off ? 'officer' : 'soldier', off ? ['n1', 'n2', 'o1'][wI % 3 === 1 ? (i % 3) : 0] : ['e3', 'e4', 'e2'][i % 3], dx + 14, dy + 20, 'up', off ? (k ? '2중대 행정반 · 간부' : '1중대 행정반 · 간부') : (k ? '2중대 행정반 · 행정병' : '1중대 행정반 · 행정병')); wI++; }
      }
      const bx = x1 - 62, by = top + 20;
      shade(bx, by, 52, 14); rect(bx, by, 52, 14, '#6B4F35'); rect(bx, by, 52, 1.5, '#86643F'); rect(bx, by + 14, 52, 3, '#4A3524');
      shade(bx + 38, by + 14, 14, 22); rect(bx + 38, by + 14, 14, 22, '#6B4F35'); rect(bx + 51, by + 14, 1, 22, '#86643F'); rect(bx + 38, by + 36, 14, 3, '#4A3524');
      rect(bx + 6, by + 2, 14, 7, '#2A2F36'); rect(bx + 24, by + 3, 8, 6, '#F4F4F0'); rect(bx + 40, by + 18, 9, 6, '#F4F4F0'); rect(bx + 40, by + 27, 5, 4, '#1D222A');
      seat('officer', k ? 'n3' : 'o3', bx + 26, by + 1, 'down', k ? '행정보급관 · 상사' : '1중대장 · 대위');
      shade(x1 - 24, bot - 18, 20, 14); rect(x1 - 24, bot - 18, 20, 14, '#D9DCDF'); rect(x1 - 24, bot - 18, 20, 2, '#F2F4F5'); rect(x1 - 22, bot - 14, 16, 3, '#2E3540'); rect(x1 - 21, bot - 9, 14, 3, '#F4F4F0');
    };
    const roomNames = [['1생활관', '1중대 행정반'], ['2생활관', '2중대 행정반'], ['3생활관', '5생활관'], ['4생활관', '6생활관']];
    for (let k = 0; k < 4; k++) {
      const top = k === 0 ? 544 : RT[k] + 12, bot = k === 3 ? RB : RT[k + 1];
      [[1014, 1330], [1422, 1738]].forEach((wg, side) => {
        const adm = side === 1 && k < 2;
        floorPaint(adm ? 'admin' : 'room', wg[0], top, wg[1] - wg[0], bot - top);
        if (k > 0) { rect(wg[0], RT[k], wg[1] - wg[0], 3, '#B4AB95'); rect(wg[0], RT[k] + 3, wg[1] - wg[0], 9, '#E3DCCB'); rect(wg[0], RT[k] + 11, wg[1] - wg[0], 1, '#A89E87'); const cx = (wg[0] + wg[1]) / 2; disc(cx, RT[k] + 7, 3, 1, '#F4F4F0'); rect(cx - 0.25, RT[k] + 5, 0.5, 2, '#222222'); rect(cx, RT[k] + 7, 1.5, 0.5, '#222222'); }
        if (adm) adminRoom(wg[0], wg[1], top, bot, k); else barrack(wg[0], wg[1], top, bot, side === 1, roomNames[k][side]);
        if (adm && k === 1) { rect(wg[0] + 70, RT[k] + 3.5, 70, 7.5, '#F7F7F4'); rect(wg[0] + 70, RT[k] + 3.5, 70, 0.5, '#9AA0A6'); for (let j = 0; j < 3; j++) rect(wg[0] + 74, RT[k] + 5 + j * 2, 30 + j * 8, 0.5, j ? '#3C7BB8' : '#D33A3A'); }
      });
      const mid = Math.round((top + bot) / 2);
      [1330, 1416].forEach((wx) => { rect(wx, mid - 9, 6, 18, '#C9CFC2'); rect(wx, mid - 10, 6, 1.5, '#7C6A55'); rect(wx, mid + 8.5, 6, 1.5, '#7C6A55'); });
      rect(1336, mid - 18, 5, 1, '#5B626A'); rect(1411, mid + 15, 5, 1, '#5B626A');
      board(roomNames[k][0], 1357, mid - 22, 'small', { bg: '#2F4A33' });
      board(roomNames[k][1], 1394, mid + 11, 'small', { bg: roomNames[k][1].indexOf('행정반') >= 0 ? '#3A3550' : '#2F4A33' });
      rect(1337, mid + 14, 3, 6, '#D33A3A'); rect(1337, mid + 14, 3, 1, '#F06A6E');
    }
    shade(1384, 562, 30, 10); rect(1384, 562, 30, 10, '#6B4F35'); rect(1384, 562, 30, 1.5, '#86643F'); rect(1384, 572, 30, 2, '#4A3524'); rect(1388, 564, 8, 5, '#F4F4F0'); rect(1400, 564, 5, 4, '#1D222A'); rect(1407, 564.5, 4, 3, '#C9A93A');
    seat('officer', 'n2', 1399, 563, 'down', '당직부사관 · 중사');
    board('당직', 1399, 576, 'small', { bg: '#5A3F25' });
    shade(1396, 914, 14, 20); rect(1396, 914, 14, 20, '#E8ECEF'); rect(1397, 915, 12, 6, '#7FB8E0'); rect(1399, 924, 3, 2, '#3C7BB8'); rect(1404, 924, 3, 2, '#D33A3A');
    });

    sect('wash', () => {
    rect(1472, 240, 128, 160, '#9FA19C'); speck(1472, 240, 128, 160, ['#A8AAA5', '#95978F', '#8F918A'], 3600); mark(92, 15, 8, 10);
    for (let x = 1476; x < 1600; x += 6) rect(x, 240, 3, 2, '#E2BB3D');
    rect(1480, 290, 54, 66, '#878A8F'); rect(1480, 290, 54, 1, '#A9ACB0'); rect(1480, 355, 54, 1, '#6E7176'); rect(1480, 290, 1, 66, '#6E7176'); rect(1533, 290, 1, 66, '#A9ACB0');
    rect(1500, 344, 14, 4, '#33363A'); for (let x = 1501; x < 1514; x += 2) rect(x, 344.5, 1, 3, '#55595E');
    c.fillStyle = 'rgba(120,175,225,0.35)'; c.fillRect(1486, 340, 16, 6); c.fillRect(1516, 336, 12, 8); c.fillRect(1494, 300, 10, 4);
    disc(1486, 296, 4, 0.9, '#2F6A3A'); disc(1486, 296, 2, 0.9, '#1E3A22'); rect(1489, 297, 12, 0.5, '#2F6A3A');
    board('세차장', 1507, 280, 'small');
    shade(1544, 306, 44, 16); rect(1544, 306, 44, 14, '#B9B5AA'); rect(1544, 306, 44, 1, '#D6D2C6'); for (let x = 1544; x < 1588; x += 4) rect(x, 318, 2, 2, (x / 4) % 2 ? '#1F1F1F' : '#E8B923');
    [1552, 1572].forEach((x) => { shade(x, 296, 10, 16); rect(x, 296, 10, 14, '#C62A30'); rect(x, 296, 10, 1, '#E86A6E'); rect(x + 2, 298, 6, 4, '#1D222A'); rect(x + 3, 299, 4, 1.5, '#7CFFB2'); rect(x + 9, 303, 2, 6, '#2A2A2A'); rect(x + 2, 306, 6, 1, '#F2F2EE'); });
    board('유류 보급', 1566, 284, 'small');
    [[1592, 352], [1592, 372], [1476, 380]].forEach((q) => { rect(q[0], q[1] - 6, 4, 8, '#F07A2A'); rect(q[0] + 0.5, q[1] - 3, 3, 1.5, '#F2F2EE'); rect(q[0] - 1, q[1] + 1.5, 6, 1.5, '#2A2A2A'); });
    bake('k151', 1507, 322, 0);
    });
    this.overlays.wash = RM(1507, 312);

    sect('admin', () => {
    building(100, 17, 9, 7, 'admin', [], [103]); walk(103, 24, 2, 1);
    board('수송부 행정반', 1672, 278);
    shade(1610, 306, 40, 20); rect(1610, 306, 40, 20, '#8E959C'); rect(1611, 307, 38, 17, '#F2F2EE'); rect(1611, 307, 38, 3, '#2E6FA0');
    for (let r = 0; r < 4; r++) { rect(1613, 312 + r * 3, 10, 2, '#3C7BB8'); rect(1625, 312 + r * 3, 6, 2, r % 2 ? '#5E9A3A' : '#E0A23A'); rect(1633, 312.75 + r * 3, 14, 0.5, '#9AA0A6'); }
    shade(1654, 306, 16, 20); rect(1654, 306, 16, 20, '#8A929A'); rect(1655, 307, 14, 17, '#6E757D'); for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) { rect(1656.5 + k * 3.2, 309 + r * 5, 0.5, 1.5, '#C9CED3'); rect(1656 + k * 3.2, 310.5 + r * 5, 1.5, 2, '#E2BB3D'); }
    cubicle(1678, 320, 'pc'); cubicle(1708, 320, 'laptop'); cubicle(1612, 352, 'pc');
    seat('soldier', 'e3', 1692, 340, 'up', '수송부 행정병 · 상병'); seat('soldier', 'e4', 1722, 340, 'up', '배차병 · 병장'); seat('officer', 'n1', 1626, 372, 'up', '수송부사관 · 하사');
    shade(1680, 360, 50, 12); rect(1680, 360, 50, 12, '#6B4F35'); rect(1680, 360, 50, 1.5, '#86643F'); rect(1680, 372, 50, 3, '#4A3524'); rect(1686, 362, 14, 7, '#2A2F36'); rect(1706, 363, 8, 6, '#F4F4F0'); rect(1718, 362, 6, 4, '#1D222A');
    seat('officer', 'o2', 1705, 361, 'down', '수송관 · 중위');
    });

    sect('booth', () => {
    building(44, 52, 7, 7, 'booth', [], [46]);
    desk(740, 872, 60, [750, 780]); chair(760, 890);
    rect(788, 900, 14, 20, '#3B424A'); rect(788, 900, 14, 2, '#525A63'); rect(790, 904, 10, 6, '#29BDFD'); rect(790, 904, 10, 1, '#9BE6FF');
    board('위병소', 760, 838);
    });
    board('웅비대대', 756, 745, 'gate');

    sect('drone', () => {
    shade(970, 340, 60, 46); rect(970, 340, 60, 46, '#8E9196'); speck(970, 340, 60, 46, ['#979A9F', '#85888D'], 600); mark(60, 21, 6, 4);
    for (let x = 970; x < 1030; x += 4) { rect(x, 340, 2, 1.5, '#E2BB3D'); rect(x + 2, 384.5, 2, 1.5, '#E2BB3D'); }
    for (let a = 0; a < 6.283; a += 0.05) rect(Math.round((1000 + Math.cos(a) * 17) * 2) / 2, Math.round((363 + Math.sin(a) * 15) * 2) / 2, 1, 1, '#F2F2EE');
    shade(990, 356, 20, 14); rect(990, 356, 20, 14, '#2A2F36'); rect(990, 356, 20, 1.5, '#4A525C'); rect(992, 358, 16, 9, '#1A1E24'); rect(993, 366, 14, 1, '#29BDFD');
    rect(988, 350, 24, 4, '#3A4048'); rect(988, 350, 24, 1, '#565E68');
    shade(1036, 350, 10, 18); rect(1036, 350, 10, 18, '#C9CED3'); rect(1036, 350, 10, 1.5, '#E6EAED'); rect(1038, 354, 6, 4, '#1D222A'); this.overlays.leds.push([1039, 360]); this.overlays.leds.push([1042, 360]);
    rect(1047, 326, 1, 42, '#8E959C'); rect(1045, 328, 5, 1, '#8E959C'); rect(1045.5, 324, 4, 2, '#D9DCDF');
    board('드론 스테이션', 1000, 328, 'small');
    });
    this.droneS = RM(1000, 362);
    this.cams = [[10, 30, 0.785, '북서 울타리'], [1590, 30, 2.356, '북동 울타리'], [10, 802, -0.785, '남서 울타리'], [1590, 802, -2.356, '남동 울타리'],
      [430, 26, -1.571, '북측 울타리 A'], [1515, 26, -1.571, '북측 울타리 B'], [10, 296, 3.1416, '서측 울타리'], [1590, 296, 0, '동측 울타리'],
      [706, 796, 1.75, '정문 차량 진입로'], [846, 796, 1.4, '정문 보행 출입구'], [1196, 52, 2.356, '수송부 주차장'], [488, 286, 2.2, '대대본부 정면'],
      [848, 374, -1.2, '생활관 출입구'], [376, 286, 1.2, '병영식당 앞']];
    this.cams.forEach((q) => { rect(q[0] - 0.75, q[1] - 18, 1.5, 18, '#7D848C'); rect(q[0] - 0.75, q[1] - 18, 0.5, 18, '#B3B9C0'); rect(q[0] - 2, q[1] - 1, 4, 2, '#5B626A'); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(q[0] - 1, q[1] + 1, 6, 1.5); });
    const fenceH = (x0, x1, y) => { for (let x = x0; x < x1; x += 8) { rect(x, y - 6, 2, 8, '#7F858C'); rect(x, y - 6, 0.5, 8, '#A9AFB6'); } rect(x0, y - 5, x1 - x0, 0.5, '#C5CBD2'); rect(x0, y - 2, x1 - x0, 0.5, '#C5CBD2'); for (let x = x0; x < x1; x += 2) rect(x, y - 4 + (x % 4 ? 0.5 : 1.5), 0.5, 0.5, '#9CA3AB'); };
    const fenceV = (x, y0, y1) => { for (let y = y0; y < y1; y += 8) rect(x, y, 2, 6, '#7F858C'); rect(x + 1, y0, 0.5, y1 - y0, '#C5CBD2'); };
    const coilH = (x0, x1, yc, r) => {
      c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x0, yc + r + 1, x1 - x0, 0.5);
      for (let x = x0 + r; x < x1 - r; x += r * 1.3) for (let a = 0; a < 6.283; a += 0.5 / r) {
        const s = Math.sin(a), px = Math.round((x + Math.cos(a) * r * 0.85) * 2) / 2, py = Math.round((yc + s * r) * 2) / 2;
        rect(px, py, 0.5, 0.5, s < -0.2 ? '#DCE1E6' : (s > 0.45 ? '#6E757D' : '#A5ACB4'));
      }
    };
    const coilV = (x, y0, y1, r) => {
      for (let y = y0 + r; y < y1 - r; y += r * 1.3) for (let a = 0; a < 6.283; a += 0.5 / r) {
        const s = Math.sin(a), px = Math.round((x + Math.cos(a) * r) * 2) / 2, py = Math.round((y + s * r * 0.85) * 2) / 2;
        rect(px, py, 0.5, 0.5, s < -0.2 ? '#DCE1E6' : (s > 0.45 ? '#6E757D' : '#A5ACB4'));
      }
    };
    // 나무: 울타리 바깥 둘레 숲(PAD)은 소나무로 빽빽하게, 안쪽은 비어 있는 잔디에 드문드문
    const trees = [];
    for (let ty = -Math.ceil(PAD / T); ty < BOT / T; ty++) for (let tx = -Math.ceil(PAD / T); tx < (MAP_W + PAD) / T; tx++) {
      const x = tx * T, y = ty * T;
      if (x < -8 || x > MAP_W - 8 || y < -12 || y > MAP_H) {
        if (y > MAP_H - 16 && x > 690 && x < 864) continue; // 정문 앞 길
        if (R() < 0.85) trees.push({ x: x + (R() * 6 | 0) - 3, y: y + (R() * 6 | 0) - 6, pine: true });
      } else if (x > 16 && x < MAP_W - 32 && y > 16 && y < MAP_H - 32) {
        let free = true;
        for (let j = -1; j <= 1 && free; j++) for (let i = -1; i <= 1; i++) if (occN.has((tx + i) + ',' + (ty + j))) { free = false; break; }
        if (free && R() < 0.1) trees.push({ x: x + (R() * 4 | 0), y: y + (R() * 4 | 0) - 4, pine: false });
      }
    }
    for (let ty = -Math.ceil(PAD / T); ty < BOT / T; ty++) for (let tx = Math.ceil((MAP_W + PAD) / T); tx < (MAP_W + PAD_R) / T; tx++) {
      if (R2() < 0.85) trees.push({ x: tx * T + (R2() * 6 | 0) - 3, y: ty * T + (R2() * 6 | 0) - 6, pine: true });
    }
    const pine = (x, y) => { c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(x + 2, y + 20, 14, 3); rect(x + 7, y + 17, 3, 5, '#5B3F26'); rect(x + 7, y, 3, 3, '#2E5A2A'); rect(x + 5, y + 3, 7, 4, '#2E5A2A'); rect(x + 3, y + 7, 11, 5, '#2E5A2A'); rect(x + 1, y + 12, 15, 6, '#2E5A2A'); rect(x + 6, y + 3, 2, 3, '#3E7436'); rect(x + 4, y + 7, 3, 4, '#3E7436'); rect(x + 2, y + 12, 3, 5, '#3E7436'); rect(x + 11, y + 14, 4, 3, '#244A21'); speck(x + 2, y + 2, 13, 15, ['#4C8642', '#21441F'], 26); };
    const tree = (x, y) => { c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(x + 3, y + 20, 13, 2); rect(x + 8, y + 15, 3, 6, '#6A4A2D'); rect(x + 8, y + 15, 0.5, 6, '#86603C'); rect(x + 4, y, 10, 2, '#3B6A2C'); rect(x + 2, y + 2, 14, 2, '#3B6A2C'); rect(x + 1, y + 4, 16, 8, '#3B6A2C'); rect(x + 2, y + 12, 14, 2, '#3B6A2C'); rect(x + 4, y + 14, 10, 1, '#3B6A2C'); rect(x + 4, y + 2, 6, 2, '#558E3F'); rect(x + 3, y + 4, 4, 3, '#558E3F'); rect(x + 10, y + 10, 6, 3, '#2F5824'); speck(x + 2, y + 1, 14, 12, ['#6AA650', '#2B5222', '#4D8638'], 36); };
    const drawTr = (tr) => (tr.pine ? pine(tr.x, tr.y) : tree(tr.x, tr.y));
    const keep = [].concat(...this.mods.map((m) => m.keepOut || []));
    for (let i = trees.length - 1; i >= 0; i--) { const tr = trees[i]; if (keep.some((k) => tr.x + 18 > k[0] && tr.x < k[2] && tr.y + 23 > k[1] && tr.y < k[3])) trees.splice(i, 1); }
    trees.sort((a, b) => a.y - b.y);
    trees.filter((tr) => tr.y < 0).forEach(drawTr); // 위쪽 숲은 울타리 뒤
    fenceH(4, 1596, 12); coilH(4, 1596, 3, 3);
    fenceV(4, 12, 812); fenceV(1594, 12, 812); coilV(5, 16, 808, 3); coilV(1595, 16, 808, 3);
    trees.filter((tr) => tr.y >= 0 && tr.y + 22 < 812).forEach(drawTr);
    fenceH(4, 704, 812); fenceH(852, 1596, 812); coilH(4, 704, 803, 3); coilH(852, 1596, 803, 3);
    trees.filter((tr) => tr.y >= 0 && tr.y + 22 >= 812).forEach(drawTr);

    this.hook('bake', c); // 모듈은 map.inBlock(c, 블록, fn)으로 원래 좌표 그대로 굽는다
    this.map = cv;
    const mm = this.mk(224, Math.round(224 * MAP_H / MAP_W)), mc = mm.getContext('2d');
    mc.imageSmoothingEnabled = true; mc.drawImage(cv, PAD * 2, PAD * 2, MAP_W * 2, MAP_H * 2, 0, 0, mm.width, mm.height);
    this.mm = mm;
    const mkCoil = (w) => {
      const cc = this.mk(w * 2, 24), g = cc.getContext('2d'), r = 4, yc = 6;
      g.setTransform(2, 0, 0, 2, 0, 0);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, yc + r + 1, w, 0.5);
      for (let x = r; x < w - r + 1; x += r * 1.3) for (let a = 0; a < 6.283; a += 0.5 / r) {
        const s = Math.sin(a);
        g.fillStyle = s < -0.2 ? '#DCE1E6' : (s > 0.45 ? '#6E757D' : '#A5ACB4');
        g.fillRect(Math.round((x + Math.cos(a) * r * 0.85) * 2) / 2, Math.round((yc + s * r) * 2) / 2, 0.5, 0.5);
      }
      return cc;
    };
    this.coilG = mkCoil(88);
  }

  // 블록 굽기: 원래 좌표로 그리는 fn을 블록의 새 자리로 옮겨(translate) 그리고, 블록 밖으로 번지지 않게 자른다(clip).
  // grow = [왼, 위, 오른, 아래] 자르기 여유. 그동안 쌓인 간판·좌석·모니터·LED·김·영상벽·방 좌표도 같은 거리만큼 옮긴다.
  inBlock(c, id, fn, grow) {
    const b = BLOCKS[id], q = blockRect(id), g = grow || [0, 0, 0, 0], dx = b.d[0], dy = b.d[1], O = this.overlays;
    const n = [this.signs.length, this.seatDefs.length, O.leds.length, O.monitors.length, O.steam.length, this.wall.length, (this.rooms || []).length];
    c.save(); c.beginPath(); c.rect(q[0] - g[0], q[1] - g[1], q[2] - q[0] + g[0] + g[2], q[3] - q[1] + g[1] + g[3]); c.clip(); c.translate(dx, dy);
    try { fn(); } finally { c.restore(); }
    const mv = (p) => { p.x += dx; p.y += dy; }, mvA = (a) => { a[0] += dx; a[1] += dy; };
    this.signs.slice(n[0]).forEach(mv); this.seatDefs.slice(n[1]).forEach(mv);
    [O.leds.slice(n[2]), O.monitors.slice(n[3]), O.steam.slice(n[4]), this.wall.slice(n[5])].forEach((L) => L.forEach(mvA));
    (this.rooms || []).slice(n[6]).forEach((r) => { r.x0 += dx; r.x1 += dx; r.y0 += dy; r.y1 += dy; if (r.door != null) r.door += dx; if (r.mid != null) r.mid += dy; });
  }
  // 매 프레임 그리기에서 원래 좌표 그대로 그리는 코드(시연 소품 등)를 블록의 새 자리에 그린다 — w2s·wrect 기준점만 잠시 옮긴다
  local(id, fn) { const d = BLOCKS[id].d; this.cxs -= d[0]; this.cys -= d[1]; try { fn(); } finally { this.cxs += d[0]; this.cys += d[1]; } }
  bub(text, style, life) { return { text: text, style: style, life: life, max: life }; }
  later(t, fn) { this.timers.push({ t: t, fn: fn }); }
  wander(x0, x1, y0, y1, n) { const p = []; for (let i = 0; i < n; i++) p.push({ x: Math.round(x0 + Math.random() * (x1 - x0)), y: Math.round(y0 + Math.random() * (y1 - y0)), w: 0.6 + Math.random() * 2.4 }); return p; }
  initEnts() {
    const E = [];
    this.ents = E;
    const ch = (type, x, y, o) => { const e = Object.assign({ kind: 'ch', type: type, rank: '', x: x, y: y, dir: 'down', moving: false, speed: 34, path: null, i: 0, wait: 0, fadeW: 0, alpha: 1, bubble: null, label: '', alertT: 0, anim: Math.random() * 10 }, o || {}); E.push(e); return e; };
    const veh = (vk, x, y, o) => { const e = Object.assign({ kind: 'veh', vk: vk, x: x, y: y, heading: 0, moving: false, speed: 60, path: null, i: 0, wait: 0, fadeW: 0, alpha: 1, bubble: null, label: '', anim: 0 }, o || {}); E.push(e); return e; };
    // 원래 좌표(layout.js 이전 배치)로 적힌 캐릭터는 chO·halfO로 넣는다 — 위치와 경로를 새 배치로 바꿔 준다.
    // 방·좌석(this.rooms, this.seatDefs)은 굽기에서 이미 새 좌표라 ch를 그대로 쓴다.
    const reP = (o) => { if (o && o.path) o.path = o.path.map((w) => { const p = RM(w.x, w.y); return Object.assign({}, w, { x: p[0], y: p[1] }); }); return o; };
    const chO = (type, x, y, o) => { const p = RM(x, y); return ch(type, p[0], p[1], reP(o)); };

    const robot = ch('robot', 854, 828, { dir: 'left', label: '휴머노이드 아미 NO.7 · 출입 관제' });
    this.robot = robot;
    chO('soldier', 770, 906, { dir: 'up', rank: 'e3', label: '상병 · 위병소 상황 근무' });
    ch('trainee', 708, 830, { dir: 'down', rank: 'e2', label: '정문 경계 · 일병 (방탄모·방탄복·K2)' });
    ch('trainee', 804, 830, { dir: 'down', rank: 'e3', label: '정문 경계 · 상병 (방탄모·방탄복·K2)' });
    const car = veh('k151', 776, 1000, { speed: 70, label: 'K-151 전술차량', path: [
      { x: 776, y: 830, w: 2.8, act: () => this.startScan(car) },
      { x: 776, y: 340 }, { x: 1094, y: 340 },
      { x: 1094, y: 224, w: 2.5, fade: true },
      { x: 776, y: 1000, jump: true, w: 5 }
    ] });
    this.car = car;
    veh('truck', MAP_W + PAD + 40, 316, { speed: 52, heading: 270, label: '5톤 트럭', path: [{ x: -PAD - 40, y: 316 }, { x: MAP_W + PAD + 50, y: 316, jump: true, w: 7 }] });

    this.song = chO('officer', 960, 1150, { speed: 34, rank: 'n3', label: '송 상사 · 간부', path: [
      { x: 960, y: 1004, w: 3.8, face: 'up', act: (e) => {
        e.bubble = this.bub('안녕 아미!', 'say', 1.4);
        this.kioskFlash = 2.6;
        this.sendFree(e.x, e.y - 18, 'gate', '안면 인식', () => this.send('gate', 'hq', '송 상사 출입', () => {
          this.log('gate', 'hq', '송 상사 안면인식 출입 확인 · 기록 전송'); this.hqLine('송 상사 출입'); this.stats.present = Math.min(398, this.stats.present + 1);
          this.later(0.3, () => {
            this.send('hq', 'per', '출근 처리', () => this.log('hq', 'per', '송 상사 출근 처리 · 오늘 생일자 알림'));
            this.send('hq', 'mess', '중식 +1', () => this.log('hq', 'mess', '중식 식수 인원 +1 반영'));
          });
        }));
        this.later(1.3, () => { robot.dir = 'left'; robot.bubble = this.bub('송 상사님, 오늘 생일이시네요! 최고의 하루 되세요', 'agent', 2.6); });
        this.later(1.4, () => { this.pedT = 1; });
      } },
      { x: 960, y: 940 }, { x: 960, y: 872 }, { x: 920, y: 840 }, { x: 920, y: 408 }, { x: 864, y: 392 }, { x: 864, y: 330 },
      { x: 864, y: 296, w: 1.6, fade: true },
      { x: 960, y: 1150, jump: true, w: 8 }
    ] });

    const medic = chO('medic', 338, 642, { dir: 'left', label: '군의관 · 대위' });
    chO('pt', 1200, 706, { speed: 44, label: '박 상병 · 하계 활동복 · AI 아미 워치 (2생활관)', path: [
      { x: 1200, y: 706, w: 4.2, face: 'down', act: (e) => {
        e.alertT = 4.2;
        e.bubble = this.bub('워치: 미열 37.8℃ 감지', 'alert', 2);
        this.sendFree(e.x + 4, e.y - 10, 'per', '체온 37.8℃', () => this.send('per', 'med', '미열 감지', () => {
          this.log('per', 'med', '박 상병 워치 체온 37.8℃ · 미열 감지');
          e.bubble = this.bub('의무실 진료 예약 완료 · 10:20', 'agent', 2.4);
          this.send('med', 'hq', '진료 예약', () => {
            this.log('med', 'hq', '박 상병 의무실 진료 10:20 예약 확정'); this.hqLine('박 상병 진료 예약'); this.stats.sick = 1;
            this.later(0.3, () => this.send('hq', 'trn', '훈련 열외', () => this.log('hq', 'trn', '박 상병 오전 체력단련 열외 처리')));
          });
        }));
      } },
      { x: 1316, y: 706 }, { x: 1316, y: 698 }, { x: 1362, y: 698 }, { x: 1362, y: 552 }, { x: 1376, y: 532 }, { x: 1376, y: 488 }, { x: 224, y: 488 }, { x: 224, y: 548 }, { x: 236, y: 620 },
      { x: 300, y: 642, w: 3.6, face: 'right', act: () => { medic.bubble = this.bub('박 상병, 체온 한 번 더 잴게요', 'say', 2.6); } },
      { x: 300, y: 642, w: 1.2, fade: true },
      { x: 1200, y: 706, jump: true, w: 3 }
    ] });

    const track = [{ x: 478, y: 560 }, { x: 754, y: 560 }, { x: 754, y: 786 }, { x: 478, y: 786 }];
    const tr = ['e2', 'e3', 'e1', 'e4', 'e2', 'e3'];
    for (let k = 0; k < 6; k++) { const e = chO('trainee', 478, 560, { speed: 46, rank: tr[k], label: '훈련 용사 · 방탄헬멧 · 방탄복 · K2', path: track.map((p) => Object.assign({}, p)) }); this.advance(e, k * 30); }
    let trnI = 0;
    const trnMsg = [['체력 기록 6명', '1중대 체력단련 기록 6명 실시간 동기화'], ['심박 이상 0', '훈련 인원 심박·체온 이상 없음 확인'], ['랩타임 갱신', '연병장 3km 구보 랩타임 갱신']];
    for (let r = 0; r < 2; r++) for (let k = 0; k < 5; k++) chO('soldier', 580 + k * 18, 604 + r * 22, { dir: 'up', rank: ['e1', 'e2', 'e3', 'e4', 'e2'][(k + r) % 5], label: '1중대 · 집합' });
    chO('officer', 616, 519, { rank: 'o3', half: true, dir: 'down', label: '강 대위 · 중대장 (사열대 연설)', path: [{ x: 616, y: 519, w: 8, face: 'down', act: (e) => {
      e.bubble = this.bub('1중대! 3km 구보 후 체력측정 실시!', 'say', 2.4);
      this.later(2.6, () => { e.bubble = this.bub('체력 데이터 실시간 동기화 중', 'agent', 2.4); });
      const m = trnMsg[trnI++ % trnMsg.length];
      this.sendFree(e.x + 8, e.y - 14, 'trn', '태블릿 업로드', () => this.send('trn', 'hq', m[0], () => { this.log('trn', 'hq', m[1]); this.hqLine(m[0]); }));
    } }] });

    const wn = ['김 일병', '이 상병', '정 일병', '최 이병', '한 병장', '오 상병', '윤 일병', '장 상병'];
    (this.rooms || []).forEach((r, i) => {
      const n = r.name === '2생활관' ? 1 : 2;
      for (let k = 0; k < n; k++) ch(k === 1 && i % 2 ? 'soldier' : 'pt', r.x0 + 20 + k * 60, r.y1, { rank: 'e' + (1 + ((i + k) % 4)), label: wn[(i * 2 + k) % wn.length] + ' · ' + r.name, path: this.wander(r.x0, r.x1, r.y0, r.y1, 4) });
    });
    (this.seatDefs || []).forEach((s) => ch(s.type, s.x, s.y, { rank: s.rank, dir: s.dir, label: s.label, half: true }));

    const half = (type, rank, x, y, dir, label, o) => chO(type, x, y, Object.assign({ rank: rank, dir: dir, label: label, half: true }, o || {}));
    chO('cook', 126, 160, { dir: 'up', label: '조리병 · 상병 (국 조리)', path: [{ x: 126, y: 160, w: 7, face: 'up', act: (e) => { e.bubble = this.bub('미역국 간 맞췄습니다!', 'say', 2); } }] });
    chO('cook', 198, 160, { dir: 'up', label: '조리병 · 일병 (볶음 조리)' });
    chO('cook', 300, 156, { dir: 'up', label: '조리병 · 일병 (재료 손질)' });
    half('cook', '', 170, 176, 'down', '취사병 · 병장 (배식)', { path: [{ x: 170, y: 176, w: 6, face: 'down', act: (e) => { e.bubble = this.bub('맛있게 드십시오!', 'say', 1.8); } }] });
    half('cook', '', 226, 176, 'down', '취사병 · 상병 (배식)');
    half('cook', '', 282, 176, 'down', '취사병 · 일병 (배식)');
    chO('officer', 352, 168, { rank: 'n2', label: '급양관리관 · 중사', path: [{ x: 352, y: 168, w: 11, face: 'down', act: (e) => {
      e.bubble = this.bub('식수 인원 자동 집계 확인', 'agent', 2.2);
      this.sendFree(e.x + 8, e.y - 14, 'mess', '배식 현황', () => this.send('mess', 'hq', '배식 진행 68%', () => { this.log('mess', 'hq', '조식 배식 진행률 68% · 잔반 예측 4%'); this.hqLine('배식 진행 68%'); }));
    } }] });
    chO('soldier', 150, 204, { dir: 'up', rank: 'e2', label: '용사 · 배식 대기' });
    chO('pt', 178, 206, { dir: 'up', label: '용사 · 배식 대기' });
    chO('soldier', 206, 204, { dir: 'up', rank: 'e4', label: '용사 · 배식 대기' });

    this.cmdr = half('officer', 'f2', 848, 267, 'up', '대대장 · 중령 (지휘관석)');
    half('officer', 'n2', 752, 235, 'up', '최 중사 · 작전관', { path: [{ x: 752, y: 235, w: 9, face: 'up', act: (e) => {
      e.bubble = this.bub('통합관제: 부대 전 구역 정상', 'agent', 2.8);
      ['gate', 'med', 'trn', 'per', 'fac', 'mess'].forEach((id) => this.send('hq', id, '', null, true));
      this.log('hq', 'all', '부대 현황 브리핑 · 전 에이전트 배포');
    } }] });
    half('officer', 'o3', 778, 247, 'up', '인사과장 · 대위');
    half('officer', 'f1', 804, 259, 'up', '작전과장 · 소령');
    half('officer', 'o3', 944, 235, 'up', '정보과장 · 대위');
    half('officer', 'o2', 918, 247, 'up', '군수과장 · 중위');
    half('officer', 'o1', 892, 259, 'up', '통신관 · 소위');
    [['soldier', 'e3', '상황병 · 상병'], ['officer', 'n1', '상황부사관 · 하사'], ['soldier', 'e4', '상황병 · 병장'], ['soldier', 'e2', '상황병 · 일병'], ['officer', 'n2', '상황간부 · 중사']].forEach((q, i) => half(q[0], q[1], 641, 182 + i * 28, 'left', q[2]));
    [['soldier', 'e3', 'CCTV 관제병 · 상병'], ['officer', 'n1', '통합방위 · 하사'], ['soldier', 'e4', '통신병 · 병장'], ['soldier', 'e2', '통신병 · 일병'], ['officer', 'o1', '정보장교 · 소위']].forEach((q, i) => half(q[0], q[1], 1055, 182 + i * 28, 'right', q[2]));
    half('soldier', 'e3', 676, 190, 'right', '작전병 · 상병'); half('soldier', 'e2', 676, 222, 'right', '작전병 · 일병');
    half('officer', 'n1', 710, 190, 'left', '훈련부사관 · 하사'); half('soldier', 'e4', 710, 222, 'left', '정보병 · 병장');
    half('officer', 'o2', 684, 267, 'down', '작전장교 · 중위'); half('soldier', 'e3', 663, 287, 'right', '작전병 · 상병'); half('officer', 'n2', 705, 287, 'left', '군수부사관 · 중사');
    half('soldier', 'e4', 990, 200, 'up', '드론 운용병 · 병장'); half('officer', 'n1', 1008, 224, 'right', '드론 통제관 · 하사');

    chO('soldier', 1534, 340, { rank: 'e3', dir: 'left', label: '수송병 · 상병 (세차)', path: [{ x: 1534, y: 340, w: 9, face: 'left', act: (e) => { e.bubble = this.bub('세차 완료, 배차 대기!', 'say', 2); } }] });
    chO('soldier', 1566, 344, { rank: 'e2', dir: 'up', label: '운전병 · 일병 (주유)' });
    chO('soldier', 1520, 214, { rank: 'e4', dir: 'up', label: '정비병 · 병장 (리프트 정비)' });
    chO('soldier', 1180, 222, { speed: 30, rank: 'e4', label: '병장 · 수송 용사', path: [{ x: 1180, y: 222, w: 1.5 }, { x: 1440, y: 222, w: 2 }] });
    let facI = 0;
    const facMsg = [['정비 승인', '5톤 트럭 정비 점검 결과 승인'], ['부품 발주', '타이어 4본 자동 발주 요청'], ['점검 완료', 'K-151 2대 일일 점검 완료']];
    chO('tech', 1600, 172, { dir: 'left', label: '이 주무관 · 정비담당관(군무원)', path: [{ x: 1600, y: 172, w: 8, face: 'left', act: (e) => {
      e.bubble = this.bub('정비 점검 결과 승인', 'agent', 2.4);
      const m = facMsg[facI++ % facMsg.length];
      this.sendFree(e.x - 8, e.y - 14, 'fac', '점검 결과', () => this.send('fac', 'hq', m[0], () => { this.log('fac', 'hq', m[1]); this.hqLine(m[0]); }));
    } }] });
    chO('soldier', 140, 410, { speed: 30, rank: 'e2', label: '일병 · 순찰', path: [{ x: 140, y: 410, w: 1 }, { x: 780, y: 410, w: 1 }] });
    const p2 = chO('soldier', 140, 410, { speed: 30, rank: 'e3', label: '상병 · 순찰', path: [{ x: 140, y: 410, w: 1 }, { x: 780, y: 410, w: 1 }] });
    this.advance(p2, 20);
  }
  advance(e, dist) { let moved = 0, guard = 0; while (moved < dist && guard < 2000) { const bx = e.x, by = e.y; this.stepEnt(e, 0.05); moved += Math.hypot(e.x - bx, e.y - by); guard++; } }
  startScan(target) {
    this.scan = { t: 0, target: target };
    this.robot.dir = 'left';
    this.later(0.4, () => { this.robot.bubble = this.bub('차량 번호 확인 · 출입 승인', 'agent', 2.2); });
    this.later(1.2, () => { this.gateT = 1; });
    this.sendFree(target.x, target.y - 10, 'gate', '번호판 인식', () => this.send('gate', 'hq', 'K-151 출입', () => {
      this.log('gate', 'hq', 'K-151 전술차량 출입 승인 · 기록 전송'); this.hqLine('K-151 출입 승인'); this.stats.cars++;
      this.later(0.4, () => this.send('hq', 'fac', '주차 B-3', () => this.log('hq', 'fac', 'K-151 주차 구역 B-3 배정 · 정비 이력 연동')));
    }));
  }

  initFlow() {
    const N = (name, code, place, x, y, hex, rgb, hub) => { const p = RM(x, y); return { name: name, code: code, place: place, x: p[0], y: p[1], hex: hex, rgb: rgb, hub: !!hub, hit: 0 }; };
    this.nodes = {
      hq: N('통합관제', '관제', '대대본부 통합관제상황실', 848, 200, '#7FE3FF', '127,227,255', true),
      gate: N('출입관제', '출입', '위병소 정문', 932, 924, '#29BDFD', '41,189,253'),
      med: N('의무지원', '의무', '의무실', 350, 546, '#FF4F6E', '255,79,110'),
      trn: N('훈련관리', '훈련', '연병장 · 사열대', 694, 526, '#FFAF00', '255,175,0'),
      per: N('인사생활', '인사', '생활관 · 행정반', 1376, 645, '#A98BFF', '169,139,255'),
      fac: N('정비수송', '정비', '수송부 · 차량 정비고', 1560, 262, '#9DCA1C', '157,202,28'),
      mess: N('급양관리', '급양', '밀리테리아 · 병영식당', 366, 156, '#EB56C5', '235,86,197')
    };
    this.nodeIds = Object.keys(this.nodes);
    const pairs = [['gate', 'hq'], ['med', 'hq'], ['trn', 'hq'], ['per', 'hq'], ['fac', 'hq'], ['mess', 'hq'], ['per', 'med'], ['med', 'trn'], ['gate', 'fac'], ['gate', 'per'], ['mess', 'per'], ['trn', 'per']];
    this.links = pairs.map((p, i) => { const A = this.nodes[p[0]], B = this.nodes[p[1]]; return { a: p[0], b: p[1], hub: p[1] === 'hq', act: 0, arc: this.arcPts(A.x, A.y, B.x, B.y, i < 6 ? 0.2 : 0.16) }; });
    this.packets = []; this.logs = []; this.hqFlash = 0;
    this.stats = { total: 412, present: 397, out: 3, leave: 5, sick: 0, cars: 0 };
    this.hqLines = ['출입 관제 대기', '에이전트 7개 연결', '부대 전 구역 정상'];
    this.ambT = 0.6; this.namedT = 2.2; this.namedI = 0; this.camEvT = 4; this.camEvI = 0; this.camFlash = {};
    this.chatter = [
      ['mess', 'hq', '식수 412명', '중식 식수 인원 412명 집계 완료'],
      ['hq', 'trn', '소나기 예보', '오후 소나기 예보 · 실내 훈련 전환 권고'],
      ['per', 'hq', '인원 현황', '생활관 인원 현황 · 외출 3명 · 휴가 5명'],
      ['fac', 'hq', '가동률 94%', '전술차량 가동률 94% · 정비 대기 2대'],
      ['trn', 'med', '부상위험 0명', '체력단련 부상 위험 인원 0명 확인'],
      ['gate', 'hq', '방문 2건', '방문 차량 사전 등록 2건 확인'],
      ['hq', 'per', '당직표 갱신', '이번 주 당직 근무표 갱신 배포'],
      ['med', 'per', '접종 알림', '예방접종 대상 12명 일정 알림'],
      ['hq', 'fac', '배차 3대', 'K-151 3대 오후 기동 배차 요청'],
      ['per', 'mess', '생일자 2명', '오늘 생일자 2명 · 축하 케이크 준비'],
      ['fac', 'gate', '출문 예정', '정비 완료 차량 10:30 출문 예정 통보'],
      ['trn', 'per', '측정 연동', '저녁 점호 체력 측정 결과 연동'],
      ['gate', 'hq', 'CCTV 14대', 'CCTV 14대 AI 영상 분석 · 경계 구역 이상 없음']
    ];
  }
  arcPts(x1, y1, x2, y2, k) {
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
    let px = -dy / d, py = dx / d;
    if (py > 0 || (py === 0 && px < 0)) { px = -px; py = -py; }
    const off = Math.min(150, d * k), cx = (x1 + x2) / 2 + px * off, cy = (y1 + y2) / 2 + py * off;
    const pts = [], n = Math.max(8, Math.ceil(d / 3));
    let len = 0, prev = null;
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, e = u * u;
      const x = a * x1 + b * cx + e * x2, y = a * y1 + b * cy + e * y2;
      if (prev) len += Math.hypot(x - prev[0], y - prev[1]);
      pts.push([x, y, len]); prev = [x, y];
    }
    return { pts: pts, len: len };
  }
  at(arc, s) {
    const P = arc.pts, L = Math.max(0, Math.min(1, s)) * arc.len;
    let lo = 0, hi = P.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m][2] < L) lo = m; else hi = m; }
    const a = P[lo], b = P[hi], seg = (b[2] - a[2]) || 1, u = Math.max(0, Math.min(1, (L - a[2]) / seg));
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  }
  send(from, to, chip, cb, small) {
    const L = this.links.find((l) => (l.a === from && l.b === to) || (l.a === to && l.b === from));
    if (!L) { if (cb) cb(); return; }
    const n = this.nodes[from];
    this.packets.push({ arc: L.arc, fwd: L.a === from, s: 0, speed: small ? 420 : 250, link: L, to: to, hex: n.hex, rgb: n.rgb, chip: small ? '' : chip, cb: cb, small: !!small });
  }
  sendFree(x, y, to, chip, cb) {
    const N = this.nodes[to];
    const arcF = this.arcPts(x, y, N.x, N.y, 0.3);
    this.packets.push({ arc: arcF, fwd: true, s: 0, speed: Math.max(150, arcF.len / 3), link: null, to: to, hex: '#FFFFFF', rgb: N.rgb, chip: chip, cb: cb, small: false, free: true });
  }
  // 한꺼번에 몰려온 로그는 LOG_GAP초 간격으로 차례로 띄운다 (age < 0 = 아직 대기 중)
  log(from, to, msg) {
    const prev = this.logs[0], age = prev ? Math.min(0, prev.age - LOG_GAP) : 0;
    this.logs.unshift({ tm: this.clock(), from: from, to: to, msg: msg, age: age, a: 0, y: 0 });
    if (this.logs.length > 12) this.logs.length = 12;
  }
  hqLine(s) { this.hqLines.unshift(s); if (this.hqLines.length > 3) this.hqLines.length = 3; this.hqFlash = 1; }
  clock() {
    const s = Math.floor(7 * 3600 + 40 * 60 + this.simT), p = (v) => (v < 10 ? '0' : '') + v;
    return p(Math.floor(s / 3600)) + ':' + p(Math.floor(s / 60) % 60) + ':' + p(s % 60);
  }
  stepFlow(dt) {
    this.simT += dt;
    this.ambT -= dt;
    if (this.ambT <= 0) {
      this.ambT = 0.22 + Math.random() * 0.4;
      const L = this.links[Math.random() < 0.7 ? Math.floor(Math.random() * 6) : 6 + Math.floor(Math.random() * 6)];
      if (Math.random() < 0.5) this.send(L.a, L.b, '', null, true); else this.send(L.b, L.a, '', null, true);
    }
    const amb = this.mode === 'ambient'; // 시연 중엔 상시 통신·CCTV 이벤트를 멈춘다
    // 평소 모드 시나리오(life.js)가 진행 중이면 상시 통신 로그를 쉬어 시나리오 로그가 밀리지 않게 한다
    const isQuiet = () => !!(this.life && this.life.quiet && this.life.quiet()), quiet = isQuiet(), logOK = () => this.mode === 'ambient' && !isQuiet();
    this.namedT -= dt;
    if (quiet && this.namedT < 2) this.namedT = 2 + Math.random() * 2;
    if (amb && !quiet && this.namedT <= 0) {
      this.namedT = 7 + Math.random() * 4;
      let k = Math.floor(Math.random() * this.chatter.length); if (k === this.namedI) k = (k + 1) % this.chatter.length;
      this.namedI = k;
      const m = this.chatter[k];
      this.send(m[0], m[1], m[2], () => { if (!logOK()) return; this.log(m[0], m[1], m[3]); if (m[1] === 'hq') this.hqLine(m[2]); });
    }
    this.camEvT -= dt;
    if (quiet && this.camEvT < 3) this.camEvT = 3 + Math.random() * 3;
    if (amb && !quiet && this.camEvT <= 0 && this.cams) {
      this.camEvT = 13 + Math.random() * 7;
      const order = [4, 9, 6, 10, 1, 13, 7, 2, 11, 5, 0, 12, 3, 8], i = order[this.camEvI % order.length], q = this.cams[i];
      const ev = ['순찰 인원 확인', '이상 없음', '야생동물 감지 · 오탐 제외', '접근 차량 번호 확인'][this.camEvI % 4], num = 'CCTV ' + (i < 9 ? '0' : '') + (i + 1);
      this.camEvI++; this.camFlash[i] = 1.6;
      this.sendFree(q[0], q[1] - 18, 'gate', num, () => this.send('gate', 'hq', num + ' 분석', () => { if (logOK()) this.log('gate', 'hq', num + ' ' + q[3] + ' · ' + ev); }));
    }
    Object.keys(this.camFlash).forEach((k) => { this.camFlash[k] -= dt; if (this.camFlash[k] <= 0) delete this.camFlash[k]; });
    const done = [];
    this.packets.forEach((pk) => {
      pk.s += dt * pk.speed / Math.max(40, pk.arc.len);
      if (pk.link) pk.link.act = 1;
      if (pk.s >= 1) done.push(pk);
    });
    if (done.length) {
      this.packets = this.packets.filter((pk) => pk.s < 1);
      done.forEach((pk) => { const N = this.nodes[pk.to]; N.hit = pk.small ? Math.max(N.hit, 0.45) : 1; if (pk.to === 'hq' && !pk.small) this.hqFlash = 1; if (pk.cb) pk.cb(); });
    }
    this.links.forEach((l) => { l.act = Math.max(0, l.act - dt * 0.7); });
    this.nodeIds.forEach((id) => { const N = this.nodes[id]; N.hit = Math.max(0, N.hit - dt * 1.2); });
    // 토스트: 최근 LOG_MAX건만 LOG_LIFE초 동안 보인다. 새 로그가 맨 위에 들어오면 아래 것들이 한 칸씩 내려가고, 넘친 것·오래된 것은 흐려지며 빠진다
    let slot = 0;
    this.logs.forEach((l) => {
      l.age += dt;
      if (l.age < 0) return;
      const on = l.age < LOG_LIFE && slot < LOG_MAX;
      l.a = on ? Math.min(1, l.a + dt * 5) : Math.max(0, l.a - dt * (slot < LOG_MAX ? 2.5 : 4));
      if (on || l.a > 0) { l.y += (Math.min(slot, LOG_MAX) * LOG_STEP - l.y) * Math.min(1, dt * 10); slot++; } // 넘친 것은 한 칸 아래까지만 밀려나며 흐려진다
    });
    if (this.hqFlash > 0) this.hqFlash = Math.max(0, this.hqFlash - dt * 1.6);
  }
  drawLinks(c, t) {
    const z = this.z, x0 = this.cxs - 8, x1 = this.cxs + 1600 / z + 8, y0 = this.cys - 8, y1 = this.cys + 900 / z + 8;
    const ds = Math.max(3, Math.round(z * 1.5));
    this.links.forEach((L) => {
      const a = Math.max(L.hub ? 0.55 : 0, Math.min(1, L.act));
      if (a < 0.03) return;
      const P = L.arc.pts, hex = this.nodes[L.a].hex;
      c.globalAlpha = a * 0.42; c.strokeStyle = hex; c.lineWidth = Math.max(1.5, z * 0.75);
      c.beginPath();
      P.forEach((q, i) => { const sp = this.w2s(q[0], q[1]); if (i) c.lineTo(sp[0], sp[1]); else c.moveTo(sp[0], sp[1]); });
      c.stroke();
      c.fillStyle = hex; c.globalAlpha = a;
      for (let i = 0; i < P.length; i += 2) {
        if ((((i / 2 - t * 6) % 6) + 6) % 6 >= 1) continue;
        const q = P[i];
        if (q[0] < x0 || q[0] > x1 || q[1] < y0 || q[1] > y1) continue;
        const sp = this.w2s(q[0], q[1]);
        c.fillRect(sp[0] - (ds >> 1), sp[1] - (ds >> 1), ds, ds);
      }
    });
    c.globalAlpha = 1;
  }
  drawPackets(c) {
    const z = this.z, K = z < 2 ? 2 : 1;
    this.packets.forEach((pk) => {
      const sgn = pk.fwd ? 1 : -1, s = pk.fwd ? pk.s : 1 - pk.s, head = this.at(pk.arc, s), gap = (pk.small ? 7 : 5) * K;
      for (let k = 6; k >= 1; k--) {
        const ss = s - sgn * k * gap / pk.arc.len;
        if (ss < 0 || ss > 1) continue;
        const q = this.at(pk.arc, ss), sz = (pk.small ? 1 : 1.5) * K;
        c.globalAlpha = (1 - k / 7) * 0.9;
        this.wrect(c, q[0] - sz / 2, q[1] - sz / 2, sz, sz, pk.free ? '#DFF6FF' : pk.hex);
      }
      const hp = this.w2s(head[0], head[1]), G = (pk.small ? 10 : 18) * z * K;
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.85;
      c.drawImage(this.glow(pk.rgb), hp[0] - G / 2, hp[1] - G / 2, G, G);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      const sz = (pk.small ? 2 : 3) * K;
      this.wrect(c, head[0] - sz / 2 - 0.5, head[1] - sz / 2 - 0.5, sz + 1, sz + 1, '#05070A');
      this.wrect(c, head[0] - sz / 2, head[1] - sz / 2, sz, sz, pk.free ? '#FFFFFF' : pk.hex);
      if (!pk.small) this.wrect(c, head[0] - 0.5, head[1] - 0.5, 1, 1, '#FFFFFF');
      pk.hp = hp;
    });
  }
  drawChips(c) {
    this.packets.forEach((pk) => { if (pk.chip && pk.hp) this.dataChip(c, pk.chip, pk.hp[0], pk.hp[1] - 10, this.nodes[pk.to].hex, pk.free); });
  }
  // 패킷 칩 — 시연 중엔 알림 말풍선처럼 두 배(24px)로, 오른쪽 팝업 열은 비켜 선다
  dataChip(c, text, cx, by, hex, free) {
    const K = this.mode === 'demo' ? 2 : 1, right = K > 1 ? this.viewR() - 8 : 1596;
    c.font = (12 * K) + 'px Galmuri11, sans-serif';
    const tw = Math.ceil(c.measureText(text).width), w = tw + 24 * K, h = 20 * K - (K > 1 ? 4 : 0);
    const x = Math.max(4, Math.min(right - w, Math.round(cx - w / 2))), y = Math.round(by - h);
    c.fillStyle = hex; c.fillRect(x - 2, y, w + 4, h); c.fillRect(x, y - 2, w, h + 4);
    c.fillStyle = free ? '#F4FBFF' : '#0B111A'; c.fillRect(x, y, w, h);
    c.fillStyle = hex; c.fillRect(x + 6 * K, y + Math.round((h - 8 * K) / 2), 8 * K, 8 * K);
    c.fillStyle = free ? '#0B111A' : '#FFFFFF'; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillText(text, x + 18 * K, y + h / 2 + K);
  }
  drawNodes(c, t) {
    const z = this.z;
    this.nodeIds.forEach((id, i) => {
      const N = this.nodes[id], bob = Math.round(Math.sin(t * 2 + i * 1.3) * 2) / 2, x = N.x, y = N.y + bob, R = z < 2 ? (N.hub ? 7 : 5) : (N.hub ? 5 : 3);
      this.wrect(c, x - R, N.y + R + 5, R * 2, 1.5, 'rgba(0,0,0,0.25)');
      const p = this.w2s(x, y), G = (N.hub ? 44 : 26) * z * (1 + N.hit * 0.35);
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = Math.min(1, 0.32 + 0.12 * Math.sin(t * 3 + i) + N.hit * 0.5);
      c.drawImage(this.glow(N.rgb), p[0] - G / 2, p[1] - G / 2, G, G);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      if (N.hit > 0.02) {
        const r = (1 - N.hit) * 16 + R + 3, a = this.w2s(x - r, y - r);
        c.globalAlpha = N.hit; c.strokeStyle = N.hex; c.lineWidth = Math.max(1, z);
        c.strokeRect(a[0], a[1], Math.round(2 * r * z), Math.round(2 * r * z));
        c.globalAlpha = 1;
      }
      if (N.hub) for (let k = 0; k < 4; k++) { const an = t * 1.6 + k * Math.PI / 2; this.wrect(c, x + Math.cos(an) * 12 - 0.75, y + Math.sin(an) * 5 - 0.75, 1.5, 1.5, '#E6F7FF'); }
      const dia = (r, col) => { for (let dy = -r; dy <= r; dy++) { const w = (r - Math.abs(dy)) * 2 + 1; this.wrect(c, x - w / 2, y + dy - 0.5, w, 1, col); } };
      dia(R + 1, '#05070A'); dia(R, N.hex); if (R > 2) dia(R - 2, this.light(N.hex, 0.55));
      this.wrect(c, x - 0.5, y - 0.5, 1, 1, '#FFFFFF');
      N.sp = p;
    });
    c.font = '12px Galmuri11, sans-serif';
    this.nodeIds.forEach((id) => {
      const N = this.nodes[id], R = z < 2 ? (N.hub ? 7 : 5) : (N.hub ? 5 : 3), text = N.name + (N.hub ? ' AI 허브' : ' AI');
      const tw = Math.ceil(c.measureText(text).width), w = tw + 12, h = 18;
      const x = N.sp[0] + Math.round((R + 4) * z), y = N.sp[1] - h / 2;
      N.lr = [x - 2, y - 2, w + 4, h + 4]; // 이름표 화면 영역 (클릭 판정)
      c.fillStyle = '#05070A'; c.fillRect(x - 2, y, w + 4, h); c.fillRect(x, y - 2, w, h + 4);
      c.fillStyle = N.hex; c.fillRect(x, y, w, h);
      c.fillStyle = '#05070A'; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText(text, x + 6, y + h / 2 + 1);
    });
  }
  codeChip(c, id, x, cy) {
    const N = id === 'all' ? { code: '전체', hex: '#E8EDF5' } : this.nodes[id];
    const tw = Math.ceil(c.measureText(N.code).width), w = tw + 12;
    c.fillStyle = N.hex; c.fillRect(x, cy - 8, w, 16);
    c.fillStyle = '#05070A'; c.fillText(N.code, x + 6, cy + 1);
    return x + w;
  }
  fit(c, s, maxW) {
    if (c.measureText(s).width <= maxW) return s;
    let r = s;
    while (r.length > 1 && c.measureText(r + '…').width > maxW) r = r.slice(0, -1);
    return r + '…';
  }
  // 통신 로그 토스트 — 들어올 땐 오른쪽에서 밀려 들어오며 에이전트 색으로 잠깐 빛나고, 수명이 다하면 흐려진다
  drawLog(c) {
    const live = this.logs.filter((l) => l.a > 0.01), x = LOG_X, w = LOG_W, h = LOG_H;
    if (!live.length) { this.logRect = null; return; }
    let bot = LOG_Y;
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.font = '12px Galmuri11, sans-serif';
    for (let i = live.length - 1; i >= 0; i--) { // 새 로그를 맨 위에 그린다
      const L = live[i], y = Math.round(LOG_Y + L.y), X = x + Math.round(Math.pow(1 - Math.min(1, L.age / 0.3), 3) * 28);
      const hex = L.from === 'all' ? '#E8EDF5' : this.nodes[L.from].hex;
      bot = Math.max(bot, y + h);
      c.globalAlpha = L.a;
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(X + 4, y + 4, w, h);
      c.fillStyle = '#05070A'; c.fillRect(X - 2, y, w + 4, h); c.fillRect(X, y - 2, w, h + 4);
      c.fillStyle = 'rgba(12,16,24,0.9)'; c.fillRect(X, y, w, h);
      if (L.age < 0.9) { c.globalAlpha = L.a * (1 - L.age / 0.9) * 0.3; c.fillStyle = hex; c.fillRect(X, y, w, h); c.globalAlpha = L.a; }
      c.fillStyle = hex; c.fillRect(X, y, 3, h);
      const ax = this.codeChip(c, L.from, X + 12, y + 14);
      c.fillStyle = '#9AA6B8'; c.fillText('→', ax + 6, y + 14);
      this.codeChip(c, L.to, ax + 22, y + 14);
      c.fillStyle = '#7F8B9E'; c.textAlign = 'right'; c.fillText(L.tm, X + w - 12, y + 14); c.textAlign = 'left';
      c.fillStyle = '#E8EDF5'; c.fillText(this.fit(c, L.msg, w - 26), X + 12, y + 32);
    }
    c.globalAlpha = 1;
    this.logRect = [x - 2, LOG_Y - 2, w + 4, bot - LOG_Y + 4];
  }
  drawVideoWall(c, t) {
    const z = this.z, st = this.stats;
    const heads = ['부대 인원 현황', '부대 배치 · 실시간', '에이전트 처리 로그', '일정 · 기상'];
    const cols = ['#2E6FA0', '#2E7A5E', '#5A4A9A', '#9A6A2A'];
    this.wall.forEach((s, i) => {
      const x = s[0], y = s[1], w = s[2], h = s[3], by = y + 7;
      this.wrect(c, x, y, w, h, '#06121F');
      this.wrect(c, x, y, w, 6, cols[i]);
      if (i === 1) {
        const mh = h - 9, mw = mh * this.mm.width / this.mm.height, mx = x + (w - mw) / 2, p = this.w2s(mx, by), k = mw / MAP_W;
        c.imageSmoothingEnabled = true; c.globalAlpha = 0.8; c.drawImage(this.mm, p[0], p[1], mw * z, mh * z); c.globalAlpha = 1; c.imageSmoothingEnabled = false;
        this.ents.forEach((e) => { if (e.alpha < 0.3 || e.y > MAP_H || e.y < 0) return; this.wrect(c, mx + e.x * k - 0.5, by + e.y * k - 0.5, 1, 1, e.kind === 'veh' ? '#FFC247' : '#FFFFFF'); });
        this.nodeIds.forEach((id) => { const N = this.nodes[id]; this.wrect(c, mx + N.x * k - 1, by + N.y * k - 1, 2, 2, N.hex); });
        if (this.droneP) this.wrect(c, mx + this.droneP[0] * k - 1, by + this.droneP[1] * k - 1, 2, 2, Math.floor(t * 4) % 2 ? '#7FE3FF' : '#FFFFFF');
        this.packets.forEach((pk) => { if (pk.small) return; const q = this.at(pk.arc, pk.fwd ? pk.s : 1 - pk.s); this.wrect(c, mx + q[0] * k - 0.75, by + q[1] * k - 0.75, 1.5, 1.5, Math.floor(t * 8) % 2 ? '#FFFFFF' : '#7FE3FF'); });
      }
      if (z < 2) {
        if (i === 0) [[st.present / st.total, '#3FC4F2'], [st.out / 10, '#FFC247'], [st.leave / 10, '#A98BFF'], [st.sick / 3 + 0.04, '#FF4F6E']].forEach((b, k) => this.wrect(c, x + 4, by + 3 + k * 8, Math.max(2, (w - 8) * Math.min(1, b[0])), 4, b[1]));
        if (i === 2) this.hqLines.forEach((ln, k) => this.wrect(c, x + 4, by + 4 + k * 10, Math.min(w - 8, ln.length * 7), 4, k === 0 ? '#7FE3FF' : '#4E6A82'));
        if (i === 3) { this.wrect(c, x + 5, by + 5, 7, 7, '#FFC247'); this.wrect(c, x + 6, by + 6, 5, 5, '#FFE08A'); [0, 1, 2].forEach((k) => this.wrect(c, x + 18, by + 4 + k * 10, 60 - k * 12, 4, k === 2 ? '#7FB8E0' : '#C9D6E2')); }
        return;
      }
      const p = this.w2s(x, y);
      c.save(); c.beginPath(); c.rect(p[0], p[1], w * z, h * z); c.clip();
      c.font = (6 * z) + 'px Galmuri11, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'left';
      c.fillStyle = '#FFFFFF'; c.fillText(heads[i], p[0] + 2 * z, p[1] + 3.4 * z);
      if (i !== 1) {
        const lines = i === 0 ? ['총원 ' + st.total + ' · 현재 ' + st.present, '외출 ' + st.out + ' · 휴가 ' + st.leave, '환자 ' + st.sick + ' · 진료예약 ' + st.sick, '차량 출입 ' + st.cars + '대']
          : (i === 2 ? this.hqLines.map((l, k) => (k ? '  ' : '> ') + l) : [this.clock().slice(0, 5) + ' 맑음 27℃', '10:20 박 상병 진료', '14:00 소나기 60%', '15:00 K-151 3대 기동']);
        lines.forEach((ln, k) => { c.fillStyle = (i === 0 && k === 2 && st.sick) ? '#FF8FA3' : (k === 0 ? (i === 2 ? '#7FE3FF' : '#E8F4FF') : '#A9BCCF'); c.fillText(ln, p[0] + 3 * z, p[1] + (11.5 + k * 8.5) * z); });
      }
      c.restore();
    });
  }
  drawRoofs(c) {
    const z = this.z, H = 14;
    (this.roofs || []).forEach((r) => {
      const p = this.w2s(r.x, r.y - H);
      if (p[0] > 1600 || p[1] > 900 || p[0] + r.w * z < 0 || p[1] + (r.h + H) * z < 0) return;
      for (let x = r.x + 2; x < r.x + r.w - 4; x += 44) this.wrect(c, x, r.y + r.h - H, 1.5, H, '#8E959C');
      this.wrect(c, r.x + r.w - 3.5, r.y + r.h - H, 1.5, H, '#8E959C');
      c.globalAlpha = 0.5; this.wrect(c, r.x, r.y - H, r.w, r.h, '#4E7A64');
      c.globalAlpha = 0.22; for (let x = r.x + 3; x < r.x + r.w; x += 4) this.wrect(c, x, r.y - H, 1, r.h, '#DDF0E4');
      c.globalAlpha = 0.6; for (let x = r.x; x < r.x + r.w; x += 44) this.wrect(c, x, r.y - H, 1, r.h, '#3A4650');
      c.globalAlpha = 1;
      this.wrect(c, r.x, r.y - H, r.w, 1, '#9FC2AE'); this.wrect(c, r.x, r.y + r.h - H - 3, r.w, 3, '#3E5E4E'); this.wrect(c, r.x, r.y + r.h - H - 3, r.w, 0.5, '#7FA892');
    });
  }
  drawSigns(c) {
    const z = this.z;
    this.signs.forEach((s) => {
      const big = s.k !== 'small', fw = big ? 12 : 6, h = big ? 16 : 8;
      if (s.w == null) { c.font = '12px Galmuri11, sans-serif'; s.w = Math.ceil(c.measureText(s.t).width * fw / 12) + (big ? 14 : 6); }
      const x = s.x - s.w / 2, y = s.y, p = this.w2s(x, y);
      if (p[0] > 1600 || p[1] > 900 || p[0] + s.w * z < 0 || p[1] + (h + 12) * z < 0) return;
      if (s.k === 'post') { this.wrect(c, x + 4, y + h, 1.5, 10, '#5B626A'); this.wrect(c, x + s.w - 5.5, y + h, 1.5, 10, '#5B626A'); this.wrect(c, x + 2, y + h + 9, s.w - 4, 1.5, 'rgba(0,0,0,0.18)'); }
      if (s.k === 'gate') { this.wrect(c, x + 6, y + h, 1, 4, '#5B626A'); this.wrect(c, x + s.w - 7, y + h, 1, 4, '#5B626A'); }
      this.wrect(c, x - 1, y - 1, s.w + 2, h + 2, '#0B1018');
      this.wrect(c, x, y, s.w, h, s.bg || '#1C2B40');
      this.wrect(c, x, y, s.w, big ? 1 : 0.5, 'rgba(255,255,255,0.2)');
      if (big) { this.wrect(c, x + 1.5, y + 1.5, s.w - 3, 0.5, '#C9A93A'); this.wrect(c, x + 1.5, y + h - 2, s.w - 3, 0.5, '#C9A93A'); this.wrect(c, x + 0.5, y + h + 1, s.w, 1, 'rgba(0,0,0,0.25)'); }
      if (!big && z < 2) { this.wrect(c, x + 2, y + 3.5, s.w - 4, 1, 'rgba(255,255,255,0.6)'); return; }
      c.font = (fw * z) + 'px Galmuri11, sans-serif'; c.fillStyle = s.fg || '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(s.t, p[0] + s.w * z / 2, p[1] + h * z / 2 + Math.max(1, z / 2));
      c.textAlign = 'left';
    });
  }
  // 정문 (울타리 선 y 812): 차량 미닫이문은 도로(716~804)를 막고 열리면 위병소 쪽(620~708)으로 밀려난다.
  // 보행 출입구(812~844)는 스피드 게이트 — 유리 날개가 기둥 안으로 접힌다.
  drawGateShadow(c) {
    const z = this.z, lw = Math.max(1, Math.round(z * 0.75)), Y = 813;
    c.strokeStyle = 'rgba(16,20,26,0.2)'; c.lineWidth = lw;
    const x0 = 716 - 96 * this.gateO, w = 88, L = 16;
    c.beginPath();
    for (let bx = x0 + 3; bx < x0 + w - 2; bx += 4) { const a = this.w2s(bx + 0.5, Y), b = this.w2s(bx + 0.5 - L * 0.45, Y + L); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
    c.stroke();
    const a = this.w2s(x0 - L * 0.45, Y + L), b = this.w2s(x0 + w - L * 0.45, Y + L);
    c.fillStyle = 'rgba(16,20,26,0.2)'; c.fillRect(a[0], a[1] - z, b[0] - a[0], 2 * z);
    [[708, 18], [804, 18], [812, 8], [840, 8]].forEach((q) => { const p = this.w2s(q[0] - 6, Y), r = this.w2s(q[0] + 8, Y + q[1]); c.fillStyle = 'rgba(16,20,26,0.16)'; c.fillRect(p[0], p[1], r[0] - p[0], r[1] - p[1]); });
  }
  drawGate(c, t) {
    const W = (x, y, w, h, col) => this.wrect(c, x, y, w, h, col);
    const x = 716 - 96 * this.gateO, top = 778, w = 88, h = 34;
    for (let bx = x + 3; bx < x + w - 2; bx += 4) { W(bx, top + 2, 1, h - 5, '#9AA2AB'); W(bx + 0.5, top + 2, 0.5, h - 5, '#646B73'); }
    W(x, top, w, 2, '#8A929B'); W(x, top, w, 0.5, '#CDD3D9');
    const my = top + Math.round(h * 0.45); W(x, my, w, 1, '#7E868F'); W(x, my, w, 0.5, '#B3BAC2');
    W(x, top + h - 3, w, 3, '#6B727A'); W(x, top + h - 3, w, 0.5, '#A3AAB2');
    W(x, top, 2, h, '#7E868F'); W(x, top, 0.5, h, '#B3BAC2'); W(x + w - 2, top, 2, h, '#5E656D');
    W(x + w / 2 - 1, top, 2, h, '#7E868F'); W(x + w / 2 - 1, top, 0.5, h, '#B3BAC2');
    W(x + 6, top + h, 3, 1, '#26282C'); W(x + w - 9, top + h, 3, 1, '#26282C');
    const z = this.z, cg = this.w2s(x, top - 11);
    c.drawImage(this.coilG, cg[0], cg[1], w * z, 12 * z);
    [708, 804].forEach((px) => {
      W(px, 768, 8, 44, '#7D848C'); W(px, 768, 1, 44, '#A9AFB6'); W(px + 7, 768, 1, 44, '#5B626A');
      W(px - 1, 765, 10, 3, '#9AA1A9'); W(px - 1, 765, 10, 0.5, '#D0D5DA'); W(px, 809, 8, 3, '#5B626A');
    });
    // 스피드 게이트: 기둥 두 개 + 유리 날개
    const f = 12 * (1 - this.pedO);
    [812, 840].forEach((px) => { W(px, 790, 4, 22, '#3B424A'); W(px, 790, 4, 1, '#5A636D'); W(px + 1, 794, 2, 1.5, '#29BDFD'); W(px, 810, 4, 2, '#23282E'); });
    if (f > 0.3) { c.globalAlpha = 0.6; W(816, 796, f, 9, '#9FD8F2'); W(840 - f, 796, f, 9, '#9FD8F2'); c.globalAlpha = 1; W(816, 796, f, 0.5, '#E4F6FF'); W(840 - f, 796, f, 0.5, '#E4F6FF'); }
    const moving = Math.abs(this.gateT - this.gateO) > 0.03;
    W(710, 762, 4, 3, '#4A4E55');
    W(710.5, 762.5, 3, 2, moving && Math.floor(t * 6) % 2 ? '#FFB020' : '#7A5A1E');
    if (moving) { const p = this.w2s(712, 763), G = 14 * this.z; c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.floor(t * 6) % 2 ? 0.8 : 0.2; c.drawImage(this.glow('255,176,32'), p[0] - G / 2, p[1] - G / 2, G, G); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
    const fl = this.kioskFlash > 0;
    W(845, 788, 6, 10, '#1D2128'); W(846, 789, 4, 6, fl ? (Math.sin(t * 18) > 0 ? '#7CFFB2' : '#29BDFD') : '#29BDFD'); W(846, 789, 4, 0.5, '#BFF1FF');
  }
  stepEnt(e, dt) {
    if (e.bubble) { e.bubble.life -= dt; if (e.bubble.life <= 0) e.bubble = null; }
    if (e.alertT > 0) e.alertT -= dt;
    if (!e.path || !e.path.length) { e.moving = false; return; }
    if (e.wait > 0) {
      e.wait -= dt; e.moving = false;
      if (e.fadeW > 0) e.alpha = Math.max(0, e.wait / e.fadeW); else e.alpha = Math.min(1, e.alpha + dt * 2);
      return;
    }
    e.fadeW = 0;
    e.alpha = Math.min(1, e.alpha + dt * 2);
    const wp = e.path[e.i];
    if (wp.jump) { e.x = wp.x; e.y = wp.y; e.alpha = 0; e.i = (e.i + 1) % e.path.length; e.wait = wp.w || 0; e.fadeW = 0; e.moving = false; return; }
    const dx = wp.x - e.x, dy = wp.y - e.y, d = Math.sqrt(dx * dx + dy * dy), sp = e.speed * dt;
    if (d <= sp) {
      e.x = wp.x; e.y = wp.y; e.moving = false;
      if (wp.face) e.dir = wp.face;
      if (wp.act) wp.act(e);
      e.wait = wp.w || 0; e.fadeW = wp.fade ? e.wait : 0;
      e.i = (e.i + 1) % e.path.length;
    } else {
      e.x += dx / d * sp; e.y += dy / d * sp; e.moving = true;
      e.anim += dt * e.speed / 34;
      if (e.kind === 'veh') e.heading = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 90 : 270) : (dy > 0 ? 180 : 0);
      else e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
  }
  viewR() { return this.mode === 'demo' ? 1204 : 1600; } // 시연: 오른쪽 팝업 열(x 1220~)을 비워 둔다
  zFit() { return Math.min(this.viewR() / MAP_W, (900 - TOP) / MAP_H); }
  // 맵이 영역보다 작아지는 축은 가운데 정렬, 아니면 맵 밖으로 못 나가게.
  // 시연 중에는 둘레 숲 띠(PAD)까지 갈 수 있다 — 맵 가장자리(정문·울타리) 장면도 대사창 위 가운데에 놓이게.
  clampXY(x, y, z) {
    // 범위가 배율에 따라 끊기지 않게: 갈 수 있는 구간이 없어지는 순간 그 가운데로 이어진다
    const vw = this.viewR() / z, vh = 900 / z, top = TOP / z, P = this.mode === 'demo' ? PAD : 0;
    const ax = -P, bx = MAP_W + P - vw, ay = -top - P, by = MAP_H + P - vh;
    // 시연에서 숲 띠까지 세로로 다 들어오는 배율(피날레 전체 보기)이면 위 숲 끝에 붙인다 — 남는 아래쪽은 컷신 띠가 가린다 (가운데 정렬과 경계에서 같은 값)
    return [bx < ax ? (MAP_W - vw) / 2 : Math.max(ax, Math.min(bx, x)), by < ay ? (P ? ay : (MAP_H - vh - top) / 2) : Math.max(ay, Math.min(by, y))];
  }
  clampCam() { const p = this.clampXY(this.camX, this.camY, this.z); this.camX = p[0]; this.camY = p[1]; }
  w2s(x, y) { return [Math.round((x - this.cxs) * this.z), Math.round((y - this.cys) * this.z)]; }
  wrect(c, x, y, w, h, col) { const z = this.z; c.fillStyle = col; c.fillRect(Math.round((x - this.cxs) * z), Math.round((y - this.cys) * z), Math.max(1, Math.ceil(w * z)), Math.max(1, Math.ceil(h * z))); }
  pill(c, text, cx, by, style) {
    const icon = style === 'agent' || style === 'alert';
    // 시연 중 AI·워치 알림(agent·alert)은 두 배(24px)로 — 행사장 큰 화면에서도 읽히게. 오른쪽 팝업 열(x 1204~)은 비켜 선다
    const K = this.mode === 'demo' && icon ? 2 : 1, right = K > 1 ? this.viewR() - 8 : 1596;
    c.font = (12 * K) + 'px Galmuri11, sans-serif';
    const tw = Math.ceil(c.measureText(text).width);
    const w = tw + (16 + (icon ? 12 : 0)) * K, h = 22 * K - (K > 1 ? 4 : 0);
    const x = Math.max(4, Math.min(right - w, Math.round(cx - w / 2))), y = Math.round(by - h - (style === 'label' || style === 'name' ? 0 : 8 * K));
    const S = { label: ['rgba(12,16,24,0.88)', '#E9EEF5', '#05070A'], name: ['#14171C', '#FFFFFF', '#4FD1FF'], say: ['#FFFFFF', '#14171C', '#14171C'], agent: ['#E3F7FF', '#083445', '#1E9CC9'], alert: ['#FFE9E9', '#5E0F0F', '#D93A3A'] }[style];
    c.fillStyle = S[2]; c.fillRect(x - 2, y, w + 4, h); c.fillRect(x, y - 2, w, h + 4);
    c.fillStyle = S[0]; c.fillRect(x, y, w, h);
    if (style === 'say' || style === 'agent' || style === 'alert') {
      const tx = Math.max(x + 6 * K, Math.min(x + w - 6 * K, Math.round(cx)));
      c.fillStyle = S[2]; c.fillRect(tx - 4 * K, y + h + 2 * K, 8 * K, 2 * K); c.fillRect(tx - 2 * K, y + h + 4 * K, 4 * K, 2 * K);
      c.fillStyle = S[0]; c.fillRect(tx - 2 * K, y + h, 4 * K, 2 * K);
    }
    if (icon) { const iy = y + Math.round((h - 8 * K) / 2); c.fillStyle = S[2]; c.fillRect(x + 8 * K, iy, 8 * K, 8 * K); c.fillStyle = S[0]; c.fillRect(x + 10 * K, iy + 2 * K, 4 * K, 4 * K); }
    c.fillStyle = S[1]; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillText(text, x + (8 + (icon ? 12 : 0)) * K, y + h / 2 + K);
  }
  drawOverlays(c, t) {
    const O = this.overlays;
    this.drawVideoWall(c, t);
    O.leds.forEach((l, i) => { if (Math.sin(t * 2.2 + i * 1.3) > -0.3) this.wrect(c, l[0], l[1], 1, 1, '#45F08A'); });
    O.steam.forEach((s, i) => {
      for (let k = 0; k < 5; k++) {
        const ph = (t * 0.55 + k / 5 + i * 0.17) % 1, x = s[0] - 4 + ((k * 5 + i * 3) % 9) + Math.sin(t * 2 + k) * 1.5, y = s[1] - ph * 22;
        c.globalAlpha = (1 - ph) * 0.55; this.wrect(c, x, y, 2 + ph * 2, 1.5 + ph, '#FFFFFF');
      }
    });
    if (O.wash) for (let k = 0; k < 8; k++) { const ph = (t * 1.4 + k / 8) % 1, x = O.wash[0] + 14 - ph * 12 + (k % 3), y = O.wash[1] - 8 + ph * 18 + Math.sin(k * 2.3) * 3; c.globalAlpha = (1 - ph) * 0.8; this.wrect(c, x, y, 1, 1, '#BFE4FF'); }
    c.globalAlpha = 1;
    if (this.hqFlash > 0) { c.globalAlpha = this.hqFlash * 0.4; this.wall.forEach((s) => this.wrect(c, s[0], s[1], s[2], s[3], '#BFF3FF')); c.globalAlpha = 1; }
    if (O.amb.length) { const on = Math.floor(t * 3) % 2; this.wrect(c, O.amb[0][0], O.amb[0][1], 3, 0.5, on ? '#FF5A5A' : '#5A1E1E'); this.wrect(c, O.amb[1][0], O.amb[1][1], 3, 0.5, on ? '#2A4E88' : '#4A9BFF'); }
    if (this.z >= 2 && this.signRect) {
      const r = this.signRect, z = this.z, p = this.w2s(r[0], r[1]), W = r[2] * z, H = r[3] * z;
      c.fillStyle = '#C62A30'; c.fillRect(p[0], p[1], W, H);
      c.fillStyle = '#F06A6E'; c.fillRect(p[0], p[1], W, Math.max(1, z / 2));
      c.font = (6 * z) + 'px Galmuri11, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'center';
      c.fillStyle = '#FFFFFF'; c.fillText('일단정지', p[0] + W / 2, p[1] + H / 2 + 1);
      c.textAlign = 'left';
    }
  }
  wrist(e, fr) {
    const sw = fr === 1 ? -1 : (fr === 2 ? 1 : 0);
    if (e.dir === 'down') return [e.x - 8 + 12.5, e.y - 24 + (33 - sw + 0.5) / 2];
    if (e.dir === 'up') return [e.x - 8 + 3.25, e.y - 24 + (33 + sw + 0.5) / 2];
    if (e.dir === 'left') { const pos = fr === 1 ? [11.5, 32] : (fr === 2 ? [19.5, 32] : [15.5, 33]); return [e.x - 8 + pos[0] / 2, e.y - 24 + (pos[1] + 0.5) / 2]; }
    return null;
  }
  // 앉은 자세 종류: cover(앞의 식탁·책상·조리대·사열대가 허리 아래를 가림) · chair · stool · free(가구 없이 다리만)
  // 자리(spot)에 sit이 있으면 그것을 쓰고, 없으면 장소로 정한다 (모듈이 sitZones에 구역을 더할 수 있다)
  sitKind(e) {
    const s = !e.actor && e.lf && e.lf.spot;
    if (s && s.sit && Math.abs(s.x - e.x) < 2 && Math.abs(s.y - e.y) < 2) return s.sit;
    const x = e.x, y = e.y, g = this.gym, d = e.dir;
    for (const q of this.sitZones || []) if (x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1) return q.kind;
    if (g && x >= g.x0 && x <= g.x1 && y >= g.y0 && y <= g.y1) return d === 'down' ? 'cover' : 'free';
    if (x >= 372 && x <= 708 && y >= 377 && y <= 665) return 'free'; // 연병장
    if (d === 'down') return 'cover';
    if (x < 384 && y < 290) return 'stool'; // 밀리테리아
    if (x < 324 && y > 369 && y < 609) return 'free'; // 의무실
    return 'chair';
  }
  drawSeated(c, e) {
    const z = this.z, k = this.sitKind(e), p = this.w2s(e.x - 8, e.y - 17);
    const s = k !== 'cover' && this.sitSprite(e.type, e.rank, e.dir, k);
    if (s) { c.drawImage(s, p[0], p[1], 16 * z, 24 * z); return; }
    c.drawImage(this.sprite(e.type, e.rank, e.dir, 0), 0, 0, 32, 34, p[0], p[1], 16 * z, 17 * z);
  }
  drawEnt(c, e, t) {
    const z = this.z;
    c.globalAlpha = Math.max(0, Math.min(1, e.alpha));
    if (e.kind === 'veh') {
      const s = this.VS[e.vk], w = s.width / 2, h = s.height / 2, p = this.w2s(e.x, e.y);
      c.save(); c.translate(p[0], p[1]); c.rotate(e.heading * Math.PI / 180);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect((-w / 2 + 2) * z, (-h / 2 + 2) * z, w * z, h * z);
      c.drawImage(s, -w / 2 * z, -h / 2 * z, w * z, h * z);
      c.restore();
    } else {
      const fr = e.moving ? [1, 0, 2, 0][Math.floor(e.anim * 8) % 4] : 0;
      const s = this.sprite(e.type, e.rank, e.dir, fr);
      if (e.half) {
        this.drawSeated(c, e);
        c.globalAlpha = 1;
        return;
      }
      this.wrect(c, e.x - 5, e.y - 2, 10, 2, 'rgba(0,0,0,0.26)'); this.wrect(c, e.x - 4, e.y, 8, 1, 'rgba(0,0,0,0.18)');
      const p = this.w2s(e.x - 8, e.y - 24);
      c.drawImage(s, p[0], p[1], 16 * z, 24 * z);
      let gp = null, rgb = '41,224,255', pulse = 0.4 + 0.25 * Math.sin(t * 2.4 + e.anim), sz = 7;
      if (e.type === 'robot') {
        if (e.dir === 'down') gp = [e.x, e.y - 17.5]; else if (e.dir === 'right') gp = [e.x - 8 + 11.25, e.y - 17.5]; else if (e.dir === 'left') gp = [e.x - 8 + 4.75, e.y - 17.5];
        rgb = '41,189,253'; sz = 10;
      } else if (e.type === 'pt') {
        gp = this.wrist(e, fr);
        if (e.alertT > 0) { rgb = '255,77,77'; pulse = 0.6 + 0.4 * Math.sin(t * 10); sz = 14; }
      }
      if (gp) {
        const q = this.w2s(gp[0], gp[1]), S = sz * z;
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = Math.max(0, Math.min(1, e.alpha * pulse));
        c.drawImage(this.glow(rgb), q[0] - S / 2, q[1] - S / 2, S, S);
        c.globalCompositeOperation = 'source-over';
        if (e.alertT > 0) { const k = (t * 1.6) % 1; c.globalAlpha = (1 - k) * e.alpha; c.strokeStyle = '#FF4D4D'; c.lineWidth = Math.max(1, z / 2); c.strokeRect(q[0] - (3 + 8 * k) * z, q[1] - (3 + 8 * k) * z, (6 + 16 * k) * z, (6 + 16 * k) * z); }
      }
    }
    c.globalAlpha = 1;
  }
  drawScan(c) {
    if (!this.scan) return;
    const r = this.robot, tg = this.scan.target, k = this.scan.t;
    const a = Math.sin(Math.min(1, k / 1.8) * Math.PI);
    const p0 = this.w2s(r.x - 6, r.y - 17), pa = this.w2s(tg.x + 10, tg.y - 16), pb = this.w2s(tg.x + 10, tg.y + 16);
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(41,189,253,' + (0.25 * a).toFixed(3) + ')';
    c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(pa[0], pa[1]); c.lineTo(pb[0], pb[1]); c.closePath(); c.fill();
    this.wrect(c, tg.x - 10, tg.y - 16 + ((k * 40) % 32), 20, 0.5, 'rgba(140,235,255,' + a.toFixed(3) + ')');
    c.globalCompositeOperation = 'source-over';
  }
  drawDrone(c, t, dt) {
    const d = this.drone, S = this.droneS;
    const route = this.droneRoute || (this.droneRoute = RP([[1000, 300], [1640, 120], [1700, 560], [1640, 930], [940, 900], [140, 930], [80, 500], [140, 110], [720, 92], [1000, 300]]).concat([[S[0], S[1]]]));
    if (d.bubble) { d.bubble.life -= dt; if (d.bubble.life <= 0) d.bubble = null; }
    if (d.ph === 'charge') {
      d.t -= dt; d.bat = Math.min(100, d.bat + dt * 9); d.alt = 0; d.x = S[0]; d.y = S[1];
      if (d.t <= 0) { d.ph = 'up'; d.t = 1.4; d.bubble = this.bub('드론 이륙 · 정찰 비행 시작', 'agent', 2); this.hqLine('드론 이륙'); }
    } else if (d.ph === 'up') {
      d.t -= dt; d.alt = 26 * (1 - Math.max(0, d.t) / 1.4);
      if (d.t <= 0) { d.ph = 'fly'; d.wp = 0; }
    } else if (d.ph === 'fly') {
      const w = route[d.wp], dx = w[0] - d.x, dy = w[1] - d.y, dist = Math.hypot(dx, dy), sp = 120 * dt;
      d.bat = Math.max(15, d.bat - dt * 1.4);
      if (dist <= sp) { d.x = w[0]; d.y = w[1]; d.wp++; if (d.wp >= route.length) { d.ph = 'down'; d.t = 1.8; } }
      else { d.x += dx / dist * sp; d.y += dy / dist * sp; }
    } else if (d.ph === 'down') {
      d.t -= dt; d.alt = 26 * Math.max(0, d.t) / 1.8;
      if (d.t <= 0) {
        d.ph = 'charge'; d.t = 8; d.alt = 0;
        d.bubble = this.bub('복귀 완료 · 충전 시작 ' + Math.round(d.bat) + '%', 'agent', 2.4);
        this.sendFree(S[0], S[1] - 8, 'hq', '정찰 영상 업로드', () => { this.log('hq', 'trn', '드론 정찰 영상 분석 · 울타리·훈련 지형 이상 없음'); this.hqLine('드론 정찰 완료'); this.send('hq', 'trn', '지형 분석', null); });
      }
    }
    const x = d.x, y = d.y - d.alt, z = this.z, sh = 1 - d.alt / 40;
    this.wrect(c, d.x - 5 * sh, d.y + 2, 10 * sh, 2.5, 'rgba(0,0,0,' + (0.15 + 0.15 * sh).toFixed(2) + ')');
    const p = this.w2s(x - 6, y - 6);
    c.drawImage(this.VS.drone, p[0], p[1], 12 * z, 12 * z);
    if (d.ph !== 'charge' && Math.floor(t * 14) % 2) [[1.5, 1.5], [10, 1.5], [1.5, 10], [10, 10]].forEach((r) => this.wrect(c, x - 6 + r[0], y - 6 + r[1], 0.5, 0.5, '#FFFFFF'));
    if (d.ph === 'charge') { const n = Math.floor(d.bat / 25); for (let k = 0; k < 4; k++) this.wrect(c, S[0] - 6 + k * 3.5, S[1] + 5.5, 2.5, 1, k < n || (k === n && Math.floor(t * 3) % 2) ? '#45F08A' : '#24402E'); }
    this.droneP = [x, y];
    if (d.bubble) { const b = d.bubble, q = this.w2s(x, y - 8); c.globalAlpha = Math.min(1, b.life / 0.25, (b.max - b.life) / 0.15 + 0.2); this.pill(c, b.text, q[0], q[1], b.style); c.globalAlpha = 1; }
  }
  drawCams(c, t) {
    const z = this.z, L = 64;
    (this.cams || []).forEach((q, i) => {
      const hx = q[0], hy = q[1] - 18, p = this.w2s(hx, hy);
      if (p[0] < -L * z - 20 || p[0] > 1600 + L * z + 20 || p[1] < -L * z - 20 || p[1] > 900 + L * z + 20) return;
      const a = q[2] + Math.sin(t * 0.45 + i * 1.7) * 0.55, hw = 0.36, fl = this.camFlash && this.camFlash[i] > 0;
      c.fillStyle = fl ? 'rgba(255,196,71,0.16)' : 'rgba(80,200,255,0.09)';
      c.beginPath(); c.moveTo(p[0], p[1]);
      for (let k = -6; k <= 6; k++) { const aa = a + hw * k / 6; c.lineTo(p[0] + Math.cos(aa) * L * z, p[1] + Math.sin(aa) * L * z * 0.8); }
      c.closePath(); c.fill();
      c.strokeStyle = fl ? 'rgba(255,196,71,0.5)' : 'rgba(80,200,255,0.28)'; c.lineWidth = Math.max(1, z * 0.5);
      c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] + Math.cos(a - hw) * L * z, p[1] + Math.sin(a - hw) * L * z * 0.8); c.moveTo(p[0], p[1]); c.lineTo(p[0] + Math.cos(a + hw) * L * z, p[1] + Math.sin(a + hw) * L * z * 0.8); c.stroke();
      this.wrect(c, hx - 2.5, hy - 2, 5, 3, '#2A2F36'); this.wrect(c, hx - 2.5, hy - 2, 5, 0.5, '#4A525C');
      this.wrect(c, hx + Math.cos(a) * 2.2 - 0.5, hy - 1 + Math.sin(a) * 0.8, 1.2, 1.2, '#29BDFD');
      if (Math.floor(t * 2 + i) % 2) this.wrect(c, hx - 2, hy - 2.5, 1, 1, '#FF4D4D');
    });
  }
  drawFlag(c, t) {
    if (!this.flagPole) return;
    const z = this.z, px = this.flagPole[0], pb = this.flagPole[1], top = pb - 72;
    if (!this.flagImg) {
      const W = 144, H = 96, cv = this.mk(W, H), g = cv.getContext('2d'), D = H / 2, R = D / 2, ang = Math.atan2(2, 3);
      g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
      g.save(); g.translate(W / 2, H / 2); g.rotate(ang);
      g.fillStyle = '#CD2E3A'; g.beginPath(); g.arc(0, 0, R, Math.PI, Math.PI * 2); g.fill();
      g.fillStyle = '#0047A0'; g.beginPath(); g.arc(0, 0, R, 0, Math.PI); g.fill();
      g.fillStyle = '#CD2E3A'; g.beginPath(); g.arc(-R / 2, 0, R / 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0047A0'; g.beginPath(); g.arc(R / 2, 0, R / 2, 0, Math.PI * 2); g.fill();
      g.restore();
      const th = D / 12, gp = D / 24, BL = D / 2;
      const tri = (phi, pat) => {
        g.save(); g.translate(W / 2, H / 2); g.rotate(phi); g.fillStyle = '#000000';
        pat.forEach((solid, k) => { const x0 = D * 0.75 + k * (th + gp); if (solid) g.fillRect(x0, -BL / 2, th, BL); else { g.fillRect(x0, -BL / 2, th, BL / 2 - gp / 2); g.fillRect(x0, gp / 2, th, BL / 2 - gp / 2); } });
        g.restore();
      };
      tri(Math.PI + ang, [1, 1, 1]); tri(-ang, [0, 1, 0]); tri(Math.PI - ang, [1, 0, 1]); tri(ang, [0, 0, 0]);
      this.flagImg = cv;
    }
    const W = 36, H = 24, src = this.flagImg, fx = px + 1.5, fy = top + 3;
    this.wrect(c, px - 0.25, top, 1.5, pb - top, '#C9CED3'); this.wrect(c, px + 0.25, top, 0.5, pb - top, '#F4F6F8'); this.wrect(c, px + 1, top, 0.5, pb - top, '#8E959C');
    this.wrect(c, px + 1.5, top + 2, 0.5, pb - top - 4, 'rgba(230,226,215,0.8)');
    this.wrect(c, px - 1.25, top - 3.5, 3.5, 3.5, '#E8C95A'); this.wrect(c, px - 0.75, top - 4.5, 2.5, 1, '#F4DE8C'); this.wrect(c, px - 0.25, top - 3, 1, 1, '#FFF2C0'); this.wrect(c, px - 1.75, top - 0.5, 4.5, 1, '#B8952E');
    const cols = 48, sw = src.width / cols;
    for (let i = 0; i < cols; i++) {
      const u = i / cols, amp = 1.8 * u, ph = t * 3.2 - u * 7, off = Math.sin(ph) * amp, q = this.w2s(fx + u * W, fy + off);
      const qw = this.w2s(fx + (i + 1) / cols * W, fy);
      c.drawImage(src, i * sw, 0, sw, src.height, q[0], q[1], Math.max(1, qw[0] - q[0]), H * z * (1 - 0.06 * u));
      const sh = Math.cos(ph);
      c.fillStyle = sh > 0 ? 'rgba(255,255,255,' + (sh * 0.12).toFixed(3) + ')' : 'rgba(0,0,0,' + (-sh * 0.16).toFixed(3) + ')';
      c.fillRect(q[0], q[1], Math.max(1, qw[0] - q[0]), H * z * (1 - 0.06 * u));
    }
    this.wrect(c, fx - 0.5, fy - 0.5, 1, H + 1, '#D9D4C8');
  }
  drawMinimap(c) {
    const mw = this.mm.width, mh = this.mm.height, x = 1600 - mw - 20, y = 900 - mh - 20;
    this.mmRect = [x, y, mw, mh];
    c.fillStyle = '#05070A'; c.fillRect(x - 4, y - 4, mw + 8, mh + 8);
    c.fillStyle = '#E8E1CF'; c.fillRect(x - 2, y - 2, mw + 4, mh + 4);
    c.imageSmoothingEnabled = true; c.drawImage(this.mm, x, y, mw, mh); c.imageSmoothingEnabled = false;
    const k = mw / MAP_W;
    if (this.flow) this.nodeIds.forEach((id) => { const N = this.nodes[id]; c.fillStyle = '#05070A'; c.fillRect(Math.round(x + N.x * k) - 3, Math.round(y + N.y * k) - 3, 6, 6); c.fillStyle = N.hex; c.fillRect(Math.round(x + N.x * k) - 2, Math.round(y + N.y * k) - 2, 4, 4); });
    this.ents.forEach((e) => { if (e.alpha < 0.3 || e.y > MAP_H) return; c.fillStyle = e.kind === 'veh' ? '#FFC247' : (e.type === 'pt' ? '#4FD1FF' : '#FFFFFF'); c.fillRect(Math.round(x + e.x * k) - 1, Math.round(y + e.y * k) - 1, 3, 3); });
    const vx = Math.max(0, this.cxs), vy = Math.max(0, this.cys + TOP / this.z), vw = Math.min(MAP_W, this.cxs + 1600 / this.z) - vx, vh = Math.min(MAP_H, this.cys + 900 / this.z) - vy;
    c.strokeStyle = '#4FD1FF'; c.lineWidth = 2; c.strokeRect(x + vx * k, y + vy * k, vw * k, vh * k);
  }
  frame(now) {
    const cv = this.cv;
    if (!cv || !this.map) return;
    const res = Math.max(1, Math.min(3, (window.devicePixelRatio || 1) * (this.viewScale || 1)));
    if (!this.ctx || Math.abs(res - (this.dpr || 0)) > 0.01) {
      cv.width = Math.round(1600 * res); cv.height = Math.round(900 * res);
      this.dpr = res; this.ctx = cv.getContext('2d'); this.ctx.imageSmoothingQuality = 'high';
    }
    const c = this.ctx;
    // freeze: 시연 일시정지 — 그리기는 계속하되 시간(dt·t)은 멈춘다. maxDt: 시연 빨리 감기 때만 한 프레임 간격을 늘린다.
    if (this.freeze) { if (this.frozenAt == null) this.frozenAt = now; } else if (this.frozenAt != null) { this.t0 += now - this.frozenAt; this.frozenAt = null; }
    const t = ((this.frozenAt != null ? this.frozenAt : now) - this.t0) / 1000;
    const dt = this.freeze ? 0 : (this.last ? Math.min(this.maxDt || 0.05, Math.max(0.001, (now - this.last) / 1000)) : 0.016);
    this.last = now;
    this.timers.forEach((tm) => { tm.t -= dt; });
    const due = this.timers.filter((tm) => tm.t <= 0);
    this.timers = this.timers.filter((tm) => tm.t > 0);
    due.forEach((tm) => tm.fn());
    if (this.camT) {
      const T = this.camT, k = Math.min(1, dt * 6), o = this.center();
      const done = Math.abs(Math.log(T.z / this.z)) < 0.003 && Math.abs(T.x - o[0]) < 0.3 && Math.abs(T.y - o[1]) < 0.3;
      if (done) { this.view(T.x, T.y, T.z); this.camT = null; this.atFit = T.z <= this.zFit() * 1.001; }
      else this.view(o[0] + (T.x - o[0]) * k, o[1] + (T.y - o[1]) * k, this.z * Math.pow(T.z / this.z, k));
    } else if (this.atFit || this.z < this.zFit()) { // 시연이 끝나 맵 영역 폭이 바뀌면 전체 보기 배율도 따라간다
      this.atFit = true; if (this.z !== this.zFit()) this.view(0, 0, this.zFit());
    }
    this.clampCam();
    const z = this.z;
    this.cxs = Math.round(this.camX * z) / z; this.cys = Math.round(this.camY * z) / z;
    this.ents.forEach((e) => (e.brain ? e.brain(e, dt) : this.stepEnt(e, dt))); // brain: 자율 행동 모듈이 직접 움직이는 캐릭터
    this.gateO += (this.gateT - this.gateO) * Math.min(1, dt * 2.4);
    this.pedO += (this.pedT - this.pedO) * Math.min(1, dt * 3);
    if (this.gateT === 1 && !this.gateHold && this.car && this.car.y < 758) this.gateT = 0; // gateHold/pedHold: life.js가 지나가는 동안 붙잡아 둔다
    if (this.pedT === 1 && !this.pedHold && this.song && this.song.y < 776) this.pedT = 0;
    if (this.scan) { this.scan.t += dt; if (this.scan.t > 1.8) this.scan = null; }
    if (this.kioskFlash > 0) this.kioskFlash -= dt;
    this.stepFlow(dt);
    this.hook('step', dt, t);

    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#0C1016'; c.fillRect(0, 0, 1600, 900);
    c.imageSmoothingEnabled = z * this.dpr < 2; // 2배 해상도 맵을 줄여 그릴 땐 부드럽게(잔무늬 방지)
    c.drawImage(this.map, (-PAD - this.cxs) * z, (-PAD - this.cys) * z, (MAP_W + PAD + PAD_R) * z, (MAP_H + PAD * 2) * z);
    c.imageSmoothingEnabled = false;
    this.drawOverlays(c, t);
    this.hook('drawFloor', c, t);
    this.drawGateShadow(c);
    this.drawSigns(c);
    const vw = 1600 / z, vh = 900 / z;
    const list = this.ents.filter((e) => !e.hide && e.alpha > 0.02 && e.x > this.cxs - 40 && e.x < this.cxs + vw + 40 && e.y > this.cys - 40 && e.y < this.cys + vh + 60).sort((a, b) => a.y - b.y);
    let gateDone = false, flagDone = false;
    list.forEach((e) => {
      if (!flagDone && e.y > this.flagPole[1]) { this.drawFlag(c, t); flagDone = true; }
      if (!gateDone && e.y > 812) { this.drawGate(c, t); gateDone = true; }
      this.drawEnt(c, e, t);
      this.hook('drawEnt', c, e, t);
    });
    if (!flagDone) this.drawFlag(c, t);
    if (!gateDone) this.drawGate(c, t);
    this.drawCams(c, t);
    this.drawRoofs(c);
    this.drawScan(c);
    this.drawDrone(c, t, dt);
    this.hook('drawWorld', c, t);
    if (this.flow) { this.drawLinks(c, t); this.drawPackets(c); this.drawNodes(c, t); }
    if (this.flow) this.drawChips(c);
    list.forEach((e) => { if (!e.bubble) return; const b = e.bubble, p = this.w2s(e.x, e.y - (e.half ? 20 : 27)); c.globalAlpha = Math.min(1, b.life / 0.25, (b.max - b.life) / 0.15 + 0.2); this.pill(c, b.text, p[0], p[1], b.style); c.globalAlpha = 1; });
    const lr = (this.flow && this.showLog) ? this.logRect : null, inLog = lr && this.mx >= lr[0] && this.mx <= lr[0] + lr[2] && this.my >= lr[1] && this.my <= lr[1] + lr[3];
    if (this.my > 66 && !this.drag && !inLog && !(this.mmRect && this.mx >= this.mmRect[0] && this.my >= this.mmRect[1])) {
      const wx = this.cxs + this.mx / z, wy = this.cys + this.my / z;
      let hit = null;
      list.forEach((e) => { const hw = e.kind === 'veh' ? 14 : 8, top = e.kind === 'veh' ? 20 : (e.half ? 17 : 24), bot = e.kind === 'veh' ? 20 : (e.half ? 5 : 1); if (wx > e.x - hw && wx < e.x + hw && wy > e.y - top && wy < e.y + bot) hit = e; });
      if (this.cams) this.cams.forEach((q, i) => { if (Math.abs(wx - q[0]) < 4 && wy > q[1] - 22 && wy < q[1] + 1) hit = { label: 'CCTV ' + (i < 9 ? '0' : '') + (i + 1) + ' · ' + q[3] + ' (AI 영상 분석)', x: q[0], y: q[1] - 12, kind: 'ch' }; });
      const ds = this.droneS;
      if (ds && Math.abs(wx - ds[0]) < 30 && Math.abs(wy - ds[1]) < 22) hit = { label: '드론 스테이션 · 자동 충전·영상 업로드', x: ds[0], y: ds[1] - 6, kind: 'ch' };
      if (this.droneP && Math.abs(wx - this.droneP[0]) < 9 && Math.abs(wy - this.droneP[1]) < 9) hit = { label: '정찰 드론 · ' + ({ charge: '충전 중', up: '이륙 중', fly: '순찰 비행', down: '복귀 착륙' })[this.drone.ph] + ' · 배터리 ' + Math.round(this.drone.bat) + '%', x: this.droneP[0], y: this.droneP[1] + 4, kind: 'ch' };
      const nid = this.nodeAtScreen(this.mx, this.my); // 에이전트(◆ · 이름표)는 눌러서 분석 화면을 연다 (agentview.js)
      if (nid) { const N = this.nodes[nid]; hit = { label: N.name + ' 에이전트 · ' + N.place + (this.mode === 'ambient' ? ' · 눌러서 보기' : ''), x: N.x, y: N.y + 18, kind: 'ch' }; }
      if (hit && hit.label && !hit.bubble && !this.agentFocus) { const p = this.w2s(hit.x, hit.y - (hit.kind === 'veh' ? 22 : (hit.half ? 20 : 27))); this.pill(c, hit.label, p[0], p[1], 'name'); }
      this.cv.style.cursor = nid && this.mode === 'ambient' ? 'pointer' : '';
    } else this.cv.style.cursor = '';
    if (this.flow && this.showLog && !this.agentFocus) this.drawLog(c); else this.logRect = null; // 분석 화면이 열려 있으면 통신 로그는 쉰다
    if (z > this.zFit() * 1.001) this.drawMinimap(c); else this.mmRect = null;
    this.hook('drawScreen', c, t);
  }

  // ---- UI 연동 (헤더 버튼·마우스) ----
  setState(s) { this.state = Object.assign({}, this.state || {}, s); if (this.onChange) this.onChange(this.state); }
  pause() { this.paused = true; }
  resume() { this.paused = false; this.last = 0; }
  pos(e) { const r = this.cv.getBoundingClientRect(); const k = 1600 / (r.width || 1600); return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]; }
  // 카메라는 '보이는 영역 가운데(헤더 아래)의 월드 좌표 + 배율'로 다룬다
  center() { return [this.camX + this.viewR() / 2 / this.z, this.camY + (TOP + 900) / 2 / this.z]; }
  view(cx, cy, z) {
    this.z = z; this.camX = cx - this.viewR() / 2 / z; this.camY = cy - (TOP + 900) / 2 / z; this.clampCam();
    if (this.state.z !== z) this.setState({ z });
  }
  // 부드럽게 이동·확대 (목표도 미리 맵 안으로 맞춰 둔다)
  flyTo(cx, cy, nz) {
    const z = Math.max(this.zFit(), Math.min(Z_MAX, nz)), hx = this.viewR() / 2, hy = (TOP + 900) / 2;
    const p = this.clampXY(cx - hx / z, cy - hy / z, z);
    this.camT = { x: p[0] + hx / z, y: p[1] + hy / z, z }; this.atFit = false;
  }
  goTo(wx, wy, nz = this.z) { this.flyTo(wx, wy, nz); }
  setZoom(nz) { const o = this.center(); this.flyTo(o[0], o[1], nz); }
  fitAll() { this.flyTo(MAP_W / 2, MAP_H / 2, this.zFit()); }
  zoomStep(dir) {
    const cur = this.camT ? this.camT.z : this.z, steps = [this.zFit()].concat(Z_STEPS);
    const next = dir > 0 ? steps.find((s) => s > cur * 1.01) : steps.filter((s) => s < cur / 1.01).pop();
    if (next) this.setZoom(next);
  }
  // 화면 좌표(sx, sy) 아래 지점을 고정한 채 확대·축소 (휠)
  zoomAt(nz, sx, sy) {
    const zf = this.zFit(), z = Math.max(zf, Math.min(Z_MAX, nz)), wx = this.camX + sx / this.z, wy = this.camY + sy / this.z;
    this.camT = null; this.atFit = z <= zf; this.z = z; this.camX = wx - sx / z; this.camY = wy - sy / z; this.clampCam();
    this.setState({ z });
  }
  toggleFlow() { this.flow = !this.flow; this.setState({ flow: this.flow }); }
  toggleLog() { this.showLog = !this.showLog; this.setState({ log: this.showLog }); }
  places() {
    return [['위병소', 900, 960], ['의무실', 300, 640], ['생활관', 1376, 720], ['연병장', 616, 670], ['상황실', 848, 205], ['수송부', 1400, 260], ['식당', 272, 210]].map((q) => [q[0]].concat(RM(q[1], q[2])));
  }
  onDown(e) {
    const p = this.pos(e); this.mx = p[0]; this.my = p[1];
    const m = this.mmRect;
    if (m && p[0] >= m[0] && p[0] <= m[0] + m[2] && p[1] >= m[1] && p[1] <= m[1] + m[3]) { this.goTo((p[0] - m[0]) / m[2] * MAP_W, (p[1] - m[1]) / m[3] * MAP_H); return; }
    this.drag = { x: p[0], y: p[1], cx: this.camX, cy: this.camY }; this.camT = null;
    this.press = [p[0], p[1]];
  }
  // 화면 좌표의 에이전트 — ◆ 둘레 14px 또는 이름표 안
  nodeAtScreen(sx, sy) {
    if (!this.flow || !this.nodeIds) return null;
    let best = null;
    this.nodeIds.forEach((id) => {
      const N = this.nodes[id], p = N.sp, r = N.lr;
      if ((p && Math.abs(sx - p[0]) < 14 && Math.abs(sy - p[1]) < 14) || (r && sx >= r[0] && sx <= r[0] + r[2] && sy >= r[1] && sy <= r[1] + r[3])) best = id;
    });
    return best;
  }
  onMove(e) {
    const p = this.pos(e); this.mx = p[0]; this.my = p[1];
    if (this.drag) { this.camX = this.drag.cx - (p[0] - this.drag.x) / this.z; this.camY = this.drag.cy - (p[1] - this.drag.y) / this.z; this.clampCam(); }
  }
  onUp() {
    this.drag = null;
    const p = this.press; this.press = null;
    if (p && Math.hypot(this.mx - p[0], this.my - p[1]) < 5) this.hook('click', p[0], p[1]); // 끌지 않고 누른 것만 클릭
  }
  onLeave() { this.drag = null; this.press = null; this.mx = -1; this.my = -1; }
  onWheel(e) {
    const p = this.pos(e), dy = e.deltaY * (e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? 400 : 1));
    this.zoomAt(this.z * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.002)), p[0], p[1]); // ctrlKey = 트랙패드 핀치
  }

  // ---- 외부 에이전트 이벤트 주입 (실제 에이전트 백엔드 연동용) ----
  // from/to: 'hq' | 'gate' | 'med' | 'trn' | 'per' | 'fac' | 'mess'
  pushEvent(from, to, chip, msg) {
    if (!this.nodes || !this.nodes[from] || !this.nodes[to]) return false;
    this.send(from, to, chip || '', () => { this.log(from, to, msg || chip || ''); if (to === 'hq') this.hqLine(chip || msg || ''); });
    return true;
  }
}
