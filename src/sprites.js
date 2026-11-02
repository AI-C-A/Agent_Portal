// 픽셀 스프라이트 공용 모듈 — 캐릭터(32×48)·계급장·차량을 코드로 그린다
export class SpriteKit {
  constructor() { this.SC = {}; this.GL = {}; this.VS = {}; this.initPal(); }
  initPal() {
    this.P = {
      skin: '#F3CBA5', hair: '#2A2220', eye: '#2A2224', blush: '#F2A6A2', mouth: '#B4555B',
      camo5: ['#8C8A74', '#4E5536', '#3F5A39', '#523E2D', '#2F302C'],
      tshirt: '#4A4F38', brim: '#2F3424', belt: '#2C2E24', buckle: '#8F8E7C', lace: '#4A4A44', boot: '#1C1C1E',
      tag: '#6E7150', ink: '#151515',
      helmRim: '#2A2E22', strap: '#22251C',
      vest: '#4B5238', vestD: '#3A402C', vestL: '#5F6849',
      ptTop: '#17191C', ptLogo: '#F2F2F2', sock: '#ECECEC', sneaker: '#D6D9DD',
      gown: '#F5F5F2', scrub: '#5A8EC8', shoeW: '#EDEDEB',
      robot: '#E7EBF0', robotS: '#A9B3C0', robotD: '#56606D', visor: '#29BDFD',
      rifle: '#232528', tablet: '#1E222A', screen: '#4FD1FF', watch: '#29E0FF', stetho: '#6E7885',
      flagW: '#F4F4F2', flagR: '#CD2E3A', flagB: '#0047A0', unitA: '#C9A93A', unitB: '#7A1E1E',
      tire: '#1B1B1B', tireL: '#333333', rim: '#80848A', bumper: '#2B2D28', lamp: '#F4E7A1', glass: '#2A3A4A', glassL: '#7896B2',
      hatch: '#3A4130', canvas: '#5E6445', canvasL: '#737A55', canvasD: '#484E35', amb: '#5B6546', white: '#F1F1EE', red: '#D53939',
      droneA: '#4E5661', droneB: '#262B33'
    };
    this.TYPES = {
      officer: { head: 'cap', top: 'camo', bottom: 'camo', item: 'tablet', seed: 3 },
      soldier: { head: 'cap', top: 'camo', bottom: 'camo', seed: 5 },
      trainee: { head: 'helmet', top: 'vest', bottom: 'camo', item: 'rifle', seed: 9 },
      pt: { head: 'hair', top: 'pt', bottom: 'pt', item: 'watch', seed: 2 },
      medic: { head: 'hair', top: 'gown', bottom: 'scrub', seed: 4 },
      robot: { head: 'robot', top: 'robot', bottom: 'robot', seed: 6 },
      cook: { head: 'cookcap', top: 'cook', bottom: 'camo', seed: 7 }
    };
  }
  mk(w, h) {
    let cv;
    if (typeof OffscreenCanvas !== 'undefined') cv = new OffscreenCanvas(w, h);
    else { cv = document.createElement('canvas'); cv.width = w; cv.height = h; }
    return cv;
  }
  dark(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  light(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.min(255, Math.round(v + (255 - v) * k));
    return '#' + ((1 << 24) + (f((n >> 16) & 255) << 16) + (f((n >> 8) & 255) << 8) + f(n & 255)).toString(16).slice(1);
  }
  camo5(x, y, seed) {
    const h = (a, b, s) => { let v = Math.imul(a + s * 31, 374761393) ^ Math.imul(b + s * 17, 668265263); v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
    const n = h(x >> 2, y >> 2, seed) * 0.55 + h(x >> 1, y >> 1, seed + 3) * 0.45;
    return n < 0.3 ? 1 : (n < 0.52 ? 2 : (n < 0.7 ? 0 : (n < 0.86 ? 3 : 4)));
  }
  gridNew(w, h) { const g = []; for (let y = 0; y < h; y++) g.push(new Array(w).fill(null)); return g; }
  outline(g) {
    const H = g.length, W = g[0].length, o = g.map((r) => r.slice());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (g[y][x]) continue;
      const nb = (y < H - 1 && g[y + 1][x]) || (x > 0 && g[y][x - 1]) || (x < W - 1 && g[y][x + 1]) || (y > 0 && g[y - 1][x]);
      if (nb) o[y][x] = this.dark(nb, 0.4);
    }
    return o;
  }
  toCanvas(g) {
    const H = g.length, W = g[0].length, cv = this.mk(W, H), c = cv.getContext('2d');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x]) { c.fillStyle = g[y][x]; c.fillRect(x, y, 1, 1); }
    return cv;
  }
  rankGlyph(rk) {
    const t = rk[0], n = parseInt(rk[1], 10) || 1, pix = [];
    if (t === 'e') { const s = Math.floor((7 - (2 * n - 1)) / 2); for (let k = 0; k < n; k++) for (let x = 1; x <= 4; x++) pix.push([x, s + k * 2]); return { w: 6, h: 7, pix: pix }; }
    if (t === 'n') { for (let x = 0; x <= 5; x++) pix.push([x, 6]); for (let k = 0; k < n; k++) { const a = 4 - k * 2; pix.push([1, a], [4, a], [2, a + 1], [3, a + 1]); } return { w: 6, h: 7, pix: pix }; }
    const cx = n === 1 ? [4] : (n === 2 ? [2, 6] : [1, 4, 7]);
    cx.forEach((c) => { if (t === 'o') pix.push([c, 1], [c - 1, 2], [c + 1, 2], [c, 3]); else pix.push([c - 1, 1], [c + 1, 1], [c, 2], [c - 1, 3], [c + 1, 3]); });
    return { w: 9, h: 5, pix: pix };
  }
  flagPatch(set, x, y, sub) {
    const P = this.P, Wc = sub ? '#6A6C55' : P.flagW, K = sub ? '#2E3026' : '#222222', R = sub ? '#3E4032' : P.flagR, B = sub ? '#3E4032' : P.flagB;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) set(x + i, y + j, Wc);
    set(x, y, K); set(x + 3, y, K); set(x, y + 2, K); set(x + 3, y + 2, K); set(x + 1, y + 1, R); set(x + 2, y + 1, B);
  }
  unitPatch(set, x, y) {
    const P = this.P;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) set(x + i, y + j, '#2A2A22');
    set(x + 1, y + 1, P.unitA); set(x + 2, y + 1, P.unitB);
  }
  paintChar(spec, dir, f) {
    if (dir === 'left') return this.paintChar(Object.assign({}, spec, { _near: 'left' }), 'right', f).map((r) => r.slice().reverse());
    const P = this.P, W = 32, H = 48, g = this.gridNew(W, H);
    const set = (x, y, c) => { if (c && x >= 0 && x < W && y >= 0 && y < H) g[y][x] = typeof c === 'function' ? c(x, y) : c; };
    const F = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
    const sh = (hex, lv) => (lv === 0 ? hex : (lv > 0 ? this.light(hex, 0.18 * lv) : this.dark(hex, lv === -1 ? 0.78 : 0.6)));
    const sd = spec.seed || 1;
    const camo = (lv) => (x, y) => sh(P.camo5[this.camo5(x, y, sd)], lv || 0);
    const helm = (lv) => (x, y) => sh(P.camo5[this.camo5(x + 7, y + 3, sd + 11)], lv || 0);
    const sol = (hex) => (lv) => () => sh(hex, lv || 0);
    const dkM = (m) => (lv) => (x, y) => this.dark(m(lv)(x, y), 0.78);
    const box = (x, y, w, h, m) => { F(x, y, w, h, m(0)); F(x, y, 1, h, m(1)); F(x + w - 1, y, 1, h, m(-1)); };
    const skin = sol(P.skin), hair = sol(P.hair);
    const top = spec.top, bot = spec.bottom, rk = spec.rank || '';
    const topM = (top === 'camo' || top === 'vest') ? camo : sol({ pt: P.ptTop, gown: P.gown, robot: P.robot, cook: '#F2F2EE' }[top]);
    const botM = bot === 'camo' ? camo : sol({ pt: P.ptTop, scrub: P.scrub, robot: P.robotS }[bot]);
    const bootC = { camo: P.boot, pt: P.sneaker, scrub: P.shoeW, robot: P.robotD }[bot];
    const isRobot = spec.head === 'robot';
    const handM = isRobot ? sol(P.robotD) : skin;
    const rifle = spec.item === 'rifle';
    const sleeveM = top === 'vest' ? camo : topM;
    const nameTag = (x, y) => { F(x, y, 5, 2, P.tag); set(x + 1, y, P.ink); set(x + 1, y + 1, P.ink); set(x + 3, y, P.ink); set(x + 3, y + 1, P.ink); set(x + 2, y + 1, P.ink); };
    const rankPatch = (r, px, py) => { const gl = this.rankGlyph(r); F(px, py, gl.w, gl.h, P.tag); gl.pix.forEach((q) => set(px + q[0], py + q[1], P.ink)); };
    if (dir === 'down' || dir === 'up') {
      const front = dir === 'down';
      const lUp = f === 1 ? 1 : 0, rUp = f === 2 ? 1 : 0;
      const leg = (x, up, outer) => {
        if (bot === 'pt') { box(x, 36, 6, 4, botM); F(x, 39, 6, 1, botM(-1)); box(x + 1, 40, 4, 3 - up, skin); F(x + 1, 43 - up, 4, 1, P.sock); }
        else { box(x, 36, 6, 7 - up, botM); F(x, 42 - up, 6, 1, botM(-1)); }
        const by = 43 - up, bx = outer < 0 ? x - 1 : x;
        F(bx, by, 7, 4, bootC); F(bx, by, 7, 1, this.light(bootC, 0.22)); F(bx, by + 3, 7, 1, this.dark(bootC, 0.55));
        if (bot === 'camo' && front) { set(bx + 3, by + 1, P.lace); set(bx + 4, by + 1, P.lace); set(bx + 3, by + 2, P.lace); }
        if (bot === 'pt') { F(bx, by + 3, 7, 1, '#8E949B'); F(bx + 1, by + 1, 3, 1, '#FFFFFF'); }
      };
      leg(10, lUp, -1); leg(16, rUp, 1);
      if (bot !== 'pt') F(15, 37, 1, 4, botM(-2));
      box(9, 24, 14, 12, topM); F(8, 24, 1, 3, topM(1)); F(23, 24, 1, 3, topM(-1)); F(10, 34, 12, 1, topM(-1));
      const sw = f === 1 ? -1 : (f === 2 ? 1 : 0);
      const armAt = (x, swing, outerLeft) => {
        const len = rifle ? 7 : 9 + swing;
        if (top === 'pt') { box(x, 25, 4, 3, topM); F(x, 27, 4, 1, topM(-1)); box(x, 28, 4, len - 3, skin); }
        else { box(x, 25, 4, len, sleeveM); F(x, 24 + len, 4, 1, sleeveM(-1)); }
        if (isRobot) F(x, 29, 4, 1, P.robotD);
        const hy = 25 + len;
        if (!rifle) { F(x, hy, 4, 3, handM(0)); F(outerLeft ? x : x + 3, hy, 1, 3, handM(-1)); F(x, hy + 2, 4, 1, handM(-1)); }
        return hy;
      };
      const hyL = armAt(5, sw, true), hyR = armAt(23, -sw, false);
      if (top === 'camo' || top === 'vest') { this.flagPatch(set, front ? 5 : 23, 26, top === 'vest'); this.unitPatch(set, front ? 23 : 5, 26); }
      if (top === 'camo') {
        F(9, 35, 14, 2, P.belt); F(9, 35, 14, 1, this.light(P.belt, 0.18));
        if (front) {
          F(12, 23, 3, 2, camo(1)); F(17, 23, 3, 2, camo(0)); F(15, 23, 2, 2, P.tshirt);
          F(15, 25, 1, 10, camo(-2));
          F(10, 26, 5, 1, camo(-1)); F(10, 27, 5, 1, camo(-2)); F(17, 26, 5, 1, camo(-1)); F(17, 27, 5, 1, camo(-2));
          F(14, 35, 4, 2, P.buckle); set(15, 35, this.light(P.buckle, 0.35));
          nameTag(10, 24);
          F(17, 24, 5, 1, P.tag); set(18, 24, P.ink); set(20, 24, P.ink);
          if (rk) { const gl = this.rankGlyph(rk); if (gl.w === 9) rankPatch(rk, 14, 29); else rankPatch(rk, 17, 28); }
        } else { F(9, 27, 14, 1, camo(-1)); F(12, 23, 8, 1, camo(1)); }
      }
      if (top === 'vest') {
        F(9, 24, 14, 13, P.vest); F(9, 24, 1, 13, P.vestL); F(22, 24, 1, 13, P.vestD); F(10, 36, 12, 1, P.vestD);
        F(9, 23, 3, 2, P.vestL); F(20, 23, 3, 2, P.vest);
        if (front) {
          F(12, 23, 8, 2, camo(0)); F(13, 23, 6, 1, P.tshirt);
          [10, 14, 18].forEach((px) => { F(px, 30, 4, 5, P.vestD); F(px, 30, 4, 1, P.vestL); set(px + 1, 31, P.vestL); });
          nameTag(10, 26);
          if (rk && rk[0] === 'e') { const n = parseInt(rk[1], 10) || 1; F(17, 25, 5, 5, P.tag); const s0 = Math.floor((5 - (2 * n - 1)) / 2); for (let k = 0; k < n; k++) F(18, 25 + s0 + k * 2, 3, 1, P.ink); }
        } else { F(12, 25, 8, 9, P.vestD); F(14, 24, 4, 2, '#2A2E22'); }
      }
      if (top === 'pt') {
        F(9, 35, 14, 1, this.dark(P.ptTop, 0.7));
        if (front) {
          F(13, 23, 6, 1, this.light(P.ptTop, 0.15)); F(14, 24, 4, 1, skin(-1));
          [[17, 27], [19, 27], [20, 27], [17, 28], [18, 28], [20, 28]].forEach((q) => set(q[0], q[1], P.ptLogo));
          F(5, 26, 4, 1, '#8A9096');
        } else {
          [[15, 26], [16, 26], [15, 28], [16, 29], [15, 30], [16, 31]].forEach((q) => set(q[0], q[1], P.ptLogo));
        }
      }
      if (top === 'gown') {
        const gm = sol(P.gown);
        box(8, 23, 16, 19, gm); F(9, 41, 14, 1, gm(-1));
        if (front) {
          F(15, 25, 2, 16, gm(-1)); F(12, 23, 3, 4, gm(1)); F(17, 23, 3, 4, gm(1)); F(14, 23, 4, 2, P.scrub);
          F(10, 34, 4, 3, gm(-1)); F(18, 34, 4, 3, gm(-1));
          F(18, 27, 3, 4, '#FFFFFF'); F(18, 27, 3, 1, P.scrub); set(19, 29, '#7B8794');
          [[12, 24], [12, 25], [13, 26], [13, 27], [19, 24], [19, 25]].forEach((q) => set(q[0], q[1], P.stetho)); F(13, 28, 2, 2, '#B9C2CC');
        } else F(10, 33, 12, 1, gm(-1));
      }
      if (top === 'cook') {
        if (front) {
          F(12, 23, 3, 2, topM(1)); F(17, 23, 3, 2, topM(0)); F(15, 23, 2, 2, skin(-1));
          [26, 29].forEach((yy) => { set(13, yy, '#8E959C'); set(18, yy, '#8E959C'); });
          F(10, 31, 12, 9, '#E4E4DE'); F(10, 31, 12, 1, '#CDCDC6'); F(21, 32, 1, 8, '#CDCDC6'); F(14, 35, 4, 2, '#D6D6D0');
        } else { F(9, 33, 14, 1, '#D2D2CC'); F(14, 32, 4, 3, '#D2D2CC'); }
      }
      if (top === 'robot') {
        F(9, 29, 14, 1, P.robotS); F(9, 33, 14, 1, P.robotS); F(9, 35, 14, 2, P.robotD);
        if (front) { F(14, 25, 4, 3, P.robotD); F(15, 26, 2, 1, P.visor); F(18, 30, 3, 1, P.robotD); set(20, 31, P.robotD); set(19, 32, P.robotD); }
        else { F(12, 25, 8, 7, P.robotS); F(13, 26, 6, 2, P.robotD); }
      }
      if (!isRobot) {
        F(13, 22, 6, 2, skin(-1));
        if (front) {
          F(7, 13, 1, 4, skin(0)); F(24, 13, 1, 4, skin(-1)); set(7, 14, skin(-1)); set(24, 14, skin(-2));
          F(9, 9, 14, 1, skin(0)); F(8, 10, 16, 10, skin(0)); F(9, 20, 14, 1, skin(0)); F(10, 21, 12, 1, skin(-1)); F(12, 22, 8, 1, skin(-1));
          F(22, 11, 2, 9, skin(-1)); F(8, 11, 1, 8, skin(1));
          const eye = (x) => { set(x, 14, P.eye); set(x + 1, 14, P.eye); set(x, 15, '#FFFFFF'); set(x + 1, 15, P.eye); set(x, 16, P.eye); set(x + 1, 16, P.eye); };
          eye(11); eye(19);
          F(10, 12, 3, 1, hair(0)); F(19, 12, 3, 1, hair(0));
          F(9, 17, 2, 1, P.blush); F(21, 17, 2, 1, P.blush);
          set(16, 17, skin(-1));
          set(14, 19, P.mouth); set(17, 19, P.mouth); F(15, 20, 2, 1, P.mouth);
        } else {
          F(9, 9, 14, 12, hair(0)); F(8, 10, 16, 10, hair(0)); F(7, 13, 1, 4, skin(-1)); F(24, 13, 1, 4, skin(-1));
          F(12, 21, 8, 2, skin(-1));
        }
        F(11, 3, 10, 1, hair(1)); F(9, 4, 14, 1, hair(0)); F(8, 5, 16, 4, hair(0)); F(10, 4, 4, 2, hair(1)); F(22, 5, 2, 4, hair(-1));
        if (front) { F(8, 9, 16, 1, hair(-1)); F(8, 10, 1, 3, hair(0)); F(23, 10, 1, 3, hair(0)); for (let x = 9; x < 23; x += 2) set(x, 9, skin(0)); }
      }
      if (spec.head === 'cap') {
        F(9, 1, 14, 1, camo(1)); F(8, 2, 16, 6, camo(0)); F(8, 2, 1, 6, camo(1)); F(23, 2, 1, 6, camo(-1)); F(8, 8, 16, 1, camo(-1));
        if (front) {
          F(7, 9, 18, 2, P.brim); F(7, 9, 18, 1, this.light(P.brim, 0.22)); F(9, 11, 14, 1, skin(-1));
          F(8, 11, 1, 2, hair(0)); F(23, 11, 1, 2, hair(0));
          if (rk && rk[0] !== 'e') {
            F(13, 3, 6, 5, P.tag);
            if (rk[0] === 'n') { set(14, 4, P.ink); set(17, 4, P.ink); set(15, 5, P.ink); set(16, 5, P.ink); F(14, 6, 4, 1, P.ink); }
            else if (rk[0] === 'o') { set(15, 4, P.ink); set(14, 5, P.ink); set(16, 5, P.ink); set(15, 6, P.ink); }
            else { set(14, 4, P.ink); set(16, 4, P.ink); set(15, 5, P.ink); set(14, 6, P.ink); set(16, 6, P.ink); }
          }
        } else F(8, 9, 16, 1, camo(-1));
      }
      if (spec.head === 'cookcap') {
        F(9, 1, 14, 1, '#FFFFFF'); F(8, 2, 16, 6, '#F4F4F0'); F(8, 2, 1, 6, '#FFFFFF'); F(23, 2, 1, 6, '#D6D6D0'); F(8, 7, 16, 2, '#E2E2DC');
        if (front) { F(10, 4, 12, 1, '#E6E6E0'); set(15, 3, '#E6E6E0'); } else F(10, 5, 12, 1, '#E6E6E0');
      }
      if (spec.head === 'helmet') {
        F(11, 0, 10, 1, helm(1)); F(8, 1, 16, 1, helm(1)); F(7, 2, 18, 1, helm(0)); F(6, 3, 20, 7, helm(0));
        F(6, 3, 1, 7, helm(1)); F(24, 3, 2, 7, helm(-1)); F(6, 10, 20, 1, P.helmRim);
        if (front) {
          F(7, 11, 18, 1, skin(-1)); F(14, 4, 4, 3, '#3A3D40'); F(15, 5, 2, 1, '#5E6368');
          for (let y = 12; y <= 20; y++) { set(8, y, P.strap); set(23, y, P.strap); }
          F(10, 21, 12, 1, P.strap);
        } else F(13, 6, 6, 2, '#3A3D40');
      }
      if (isRobot) {
        F(10, 2, 12, 1, P.robot); F(8, 3, 16, 18, P.robot); F(9, 21, 14, 1, P.robotS);
        F(8, 3, 1, 18, this.light(P.robot, 0.3)); F(22, 3, 2, 18, P.robotS);
        F(6, 10, 2, 6, P.robotS); F(24, 10, 2, 6, P.robotS);
        F(15, 0, 2, 2, P.robotD); set(15, 0, P.visor); F(13, 22, 6, 2, P.robotD);
        if (front) { F(9, 11, 14, 5, P.robotD); F(10, 12, 12, 3, P.visor); F(10, 12, 12, 1, this.light(P.visor, 0.45)); F(13, 18, 6, 1, P.robotS); }
        else { F(11, 6, 10, 10, P.robotS); F(13, 8, 6, 2, P.robotD); }
      }
      if (front) {
        if (rifle) {
          for (let i = 0; i <= 22; i++) { const x = 5 + i, y = 39 - Math.round(i * 0.55); set(x, y, P.rifle); set(x, y - 1, i % 4 === 0 ? this.light(P.rifle, 0.35) : P.rifle); }
          F(3, 38, 4, 3, P.rifle); set(3, 38, this.light(P.rifle, 0.35));
          F(16, 32, 2, 4, P.rifle); F(17, 35, 2, 2, P.rifle);
          F(8, 36, 3, 2, P.skin); F(21, 30, 3, 2, P.skin);
        }
        if (spec.item === 'tablet') { F(21, 31, 6, 8, P.tablet); F(22, 32, 4, 5, '#3E9CC4'); F(22, 32, 4, 1, '#8FDDF7'); set(23, 34, '#CFF3FF'); F(23, hyR, 4, 2, P.skin); }
        if (spec.item === 'watch') { const wy = hyR - 1; F(23, wy, 4, 1, '#151515'); set(24, wy, P.watch); set(25, wy, P.watch); }
      } else {
        if (rifle) { for (let i = 0; i <= 16; i++) set(8 + i, 24 + Math.round(i * 0.6), P.rifle); F(7, 23, 2, 2, P.rifle); }
        if (spec.item === 'watch') { const wy = hyL - 1; F(5, wy, 4, 1, '#151515'); set(6, wy, P.watch); }
      }
    } else {
      const nearLeft = spec._near === 'left';
      const legS = (thx, shx, bx, up, far) => {
        const m = far ? dkM(botM) : botM, bc = far ? this.dark(bootC, 0.78) : bootC;
        if (bot === 'pt') { box(thx, 36, 5, 4, m); box(shx + 1, 40, 3, 3 - up, far ? dkM(skin) : skin); F(shx + 1, 43 - up, 3, 1, far ? '#C9C9C9' : P.sock); }
        else { box(thx, 36, 5, 4, m); box(shx, 40, 5, 3 - up, m); }
        const by = 43 - up;
        F(bx, by, 7, 4, bc); F(bx, by, 7, 1, this.light(bc, 0.2)); F(bx, by + 3, 7, 1, this.dark(bc, 0.55));
      };
      if (f === 0) { legS(12, 12, 12, 0, true); legS(15, 15, 15, 0, false); }
      else if (f === 1) { legS(11, 9, 8, 0, true); legS(16, 18, 19, 1, false); }
      else { legS(16, 18, 19, 1, true); legS(11, 9, 8, 0, false); }
      if (top === 'gown') box(11, 23, 11, 19, topM); else box(12, 24, 10, 12, sleeveM);
      F(13, 34, 8, 1, sleeveM(-1));
      if (top === 'camo') { F(12, 35, 10, 2, P.belt); F(20, 35, 2, 2, P.buckle); F(17, 26, 4, 1, camo(-1)); F(17, 27, 4, 1, camo(-2)); F(13, 23, 4, 2, camo(1)); }
      if (top === 'vest') { F(11, 24, 12, 13, P.vest); F(11, 24, 1, 13, P.vestL); F(22, 24, 1, 13, P.vestD); F(20, 30, 3, 5, P.vestD); F(20, 30, 3, 1, P.vestL); F(11, 26, 2, 8, P.vestD); F(14, 23, 4, 2, camo(0)); }
      if (top === 'pt') { F(12, 35, 10, 1, this.dark(P.ptTop, 0.7)); F(15, 23, 4, 1, skin(-1)); }
      if (top === 'gown') { F(20, 25, 1, 15, topM(-1)); F(19, 23, 3, 3, P.scrub); F(13, 30, 1, 10, topM(-1)); [[20, 24], [21, 25], [21, 26]].forEach((q) => set(q[0], q[1], P.stetho)); }
      if (top === 'robot') { F(12, 29, 10, 1, P.robotS); F(12, 35, 10, 2, P.robotD); F(19, 26, 3, 2, P.visor); }
      if (!isRobot) {
        F(14, 21, 5, 3, skin(-1));
        F(13, 9, 11, 12, skin(0)); F(14, 21, 9, 1, skin(0)); F(16, 22, 6, 1, skin(-1));
        F(24, 13, 1, 5, skin(0)); set(25, 16, skin(0)); set(25, 17, skin(-1));
        F(14, 13, 3, 4, skin(-1)); set(15, 14, skin(-2));
        set(20, 14, P.eye); set(21, 14, P.eye); set(20, 15, '#FFFFFF'); set(21, 15, P.eye); set(20, 16, P.eye); set(21, 16, P.eye);
        F(20, 12, 3, 1, hair(0)); F(21, 17, 2, 1, P.blush); set(22, 19, P.mouth); set(23, 19, P.mouth);
        F(10, 5, 4, 14, hair(0)); F(11, 3, 11, 2, hair(0)); F(10, 4, 13, 5, hair(0)); F(12, 3, 4, 1, hair(1)); F(13, 9, 3, 3, hair(0));
        F(9, 8, 1, 9, hair(-1)); F(10, 17, 3, 3, hair(-1));
      }
      if (spec.head === 'cap') {
        F(11, 1, 11, 1, camo(1)); F(10, 2, 13, 6, camo(0)); F(10, 2, 1, 6, camo(1)); F(10, 8, 13, 1, camo(-1));
        F(18, 9, 9, 2, P.brim); F(18, 9, 9, 1, this.light(P.brim, 0.22)); F(19, 11, 5, 1, skin(-1));
      }
      if (spec.head === 'cookcap') { F(11, 1, 11, 1, '#FFFFFF'); F(10, 2, 13, 6, '#F4F4F0'); F(10, 2, 1, 6, '#FFFFFF'); F(10, 8, 13, 2, '#E2E2DC'); F(12, 5, 9, 1, '#E6E6E0'); }
      if (top === 'cook') { F(19, 30, 3, 9, '#E4E4DE'); F(19, 30, 3, 1, '#CDCDC6'); F(13, 33, 6, 1, '#CDCDC6'); }
      if (spec.head === 'helmet') {
        F(11, 0, 11, 1, helm(1)); F(9, 1, 15, 1, helm(1)); F(8, 2, 17, 8, helm(0)); F(8, 2, 1, 8, helm(1)); F(7, 4, 1, 6, helm(0));
        F(7, 10, 19, 1, P.helmRim); F(23, 4, 3, 3, '#3A3D40'); F(19, 11, 5, 1, skin(-1));
        for (let i = 0; i < 9; i++) set(17 + Math.round(i * 0.25), 12 + i, P.strap);
      }
      if (isRobot) {
        F(11, 2, 12, 1, P.robot); F(10, 3, 14, 18, P.robot); F(10, 3, 1, 18, this.light(P.robot, 0.3)); F(10, 21, 13, 1, P.robotS);
        F(13, 9, 3, 7, P.robotS); F(14, 11, 1, 3, P.robotD);
        F(19, 11, 6, 5, P.robotD); F(20, 12, 5, 3, P.visor); F(20, 12, 5, 1, this.light(P.visor, 0.45));
        F(14, 0, 2, 2, P.robotD); F(14, 22, 5, 2, P.robotD);
      }
      const armF = rifle ? 0 : f;
      let hx, hy, px;
      if (armF === 0) { if (top === 'pt') { box(14, 25, 4, 3, topM); box(14, 28, 4, 6, skin); } else box(14, 25, 4, 9, sleeveM); hx = 14; hy = 34; px = 14; }
      else if (armF === 1) { if (top === 'pt') { box(15, 25, 4, 3, topM); box(16, 28, 4, 2, skin); box(17, 30, 4, 3, skin); } else { box(15, 25, 4, 5, sleeveM); box(17, 30, 4, 3, sleeveM); } hx = 18; hy = 33; px = 15; }
      else { if (top === 'pt') { box(13, 25, 4, 3, topM); box(12, 28, 4, 2, skin); box(11, 30, 4, 3, skin); } else { box(13, 25, 4, 5, sleeveM); box(11, 30, 4, 3, sleeveM); } hx = 10; hy = 33; px = 13; }
      if (!rifle) { F(hx, hy, 4, 3, handM(0)); F(hx, hy + 2, 4, 1, handM(-1)); }
      if (top === 'camo' || top === 'vest') { if (nearLeft) this.unitPatch(set, px, 26); else this.flagPatch(set, px, 26, top === 'vest'); }
      if (spec.item === 'watch' && nearLeft) { F(hx, hy - 1, 4, 1, '#151515'); set(hx + 1, hy - 1, P.watch); set(hx + 2, hy - 1, P.watch); }
      if (spec.item === 'tablet') { F(21, 27, 3, 9, P.tablet); F(22, 28, 1, 6, P.screen); }
      if (rifle) {
        for (let x = 5; x <= 30; x++) { set(x, 31, P.rifle); if (x < 24) set(x, 32, P.rifle); }
        F(3, 30, 5, 4, P.rifle); set(3, 30, this.light(P.rifle, 0.35)); F(18, 33, 2, 4, P.rifle); F(19, 36, 2, 1, P.rifle); set(30, 30, P.rifle);
        F(13, 31, 3, 2, P.skin); F(22, 30, 3, 2, P.skin);
      }
    }
    return spec._raw ? g : this.outline(g);
  }
  paintVehicle(kind) {
    const P = this.P;
    const dims = { k151: [40, 64], truck: [48, 116], amb: [44, 80], drone: [24, 24] }[kind];
    const W = dims[0], H = dims[1], g = this.gridNew(W, H);
    const set = (x, y, c) => { if (c && x >= 0 && x < W && y >= 0 && y < H) g[y][x] = typeof c === 'function' ? c(x, y) : c; };
    const F = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
    const camo = (x, y) => P.camo5[this.camo5(x, y, 21)];
    const camoD = (x, y) => this.dark(camo(x, y), 0.8);
    const camoL = (x, y) => this.light(camo(x, y), 0.08);
    const tire = (x, y, h) => { F(x, y, 4, h, P.tire); for (let j = 0; j < h; j += 2) F(x, y + j, 4, 1, P.tireL); };
    if (kind === 'k151') {
      [[0, 8], [36, 8], [0, 42], [36, 42]].forEach((w) => tire(w[0], w[1], 14));
      F(4, 2, 32, 60, camo); F(4, 2, 1, 60, camoL); F(35, 2, 1, 60, camoD);
      F(6, 0, 28, 3, P.bumper); for (let x = 8; x < 32; x += 3) F(x, 1, 1, 2, '#454840');
      F(6, 3, 4, 2, P.lamp); F(30, 3, 4, 2, P.lamp);
      F(6, 6, 28, 11, camoL); F(6, 17, 28, 1, camoD);
      F(8, 19, 24, 7, P.glass); F(8, 19, 24, 1, '#1A2530'); F(10, 20, 3, 4, P.glassL); F(13, 20, 2, 2, P.glassL);
      F(7, 27, 26, 18, camoD); F(7, 27, 26, 1, camo);
      F(15, 31, 10, 10, P.hatch); F(16, 32, 8, 8, '#2C3224'); F(17, 33, 3, 2, '#55604A');
      F(6, 46, 28, 14, camo); F(6, 46, 28, 1, camoD);
      F(13, 49, 14, 10, P.tire); F(16, 52, 8, 4, P.rim); F(18, 53, 4, 2, '#5A5E63');
      F(2, 20, 2, 4, P.bumper); F(36, 20, 2, 4, P.bumper);
      for (let i = 0; i < 14; i++) set(33, 46 + i, '#2A2A2A');
      F(4, 61, 32, 2, P.bumper); F(6, 61, 3, 2, '#B83030'); F(31, 61, 3, 2, '#B83030');
    }
    if (kind === 'truck') {
      [[0, 10], [44, 10], [0, 66], [44, 66], [0, 84], [44, 84]].forEach((w) => tire(w[0], w[1], 14));
      F(4, 2, 40, 28, camo); F(4, 2, 1, 28, camoL); F(43, 2, 1, 28, camoD);
      F(6, 0, 36, 3, P.bumper); for (let x = 9; x < 39; x += 3) F(x, 1, 1, 2, '#454840');
      F(6, 3, 5, 2, P.lamp); F(37, 3, 5, 2, P.lamp);
      F(6, 6, 36, 9, camoL); F(6, 15, 36, 1, camoD);
      F(8, 17, 32, 6, P.glass); F(10, 18, 4, 4, P.glassL);
      F(6, 24, 36, 6, camoD); F(2, 18, 2, 5, P.bumper); F(44, 18, 2, 5, P.bumper);
      F(6, 30, 36, 3, '#25271F');
      F(4, 33, 40, 80, P.canvas); F(4, 33, 40, 2, P.canvasL); F(4, 33, 1, 80, P.canvasL); F(43, 33, 1, 80, P.canvasD);
      for (let y = 44; y < 110; y += 12) { F(4, y, 40, 2, P.canvasD); F(4, y + 2, 40, 1, P.canvasL); }
      F(6, 110, 36, 3, P.canvasD); F(4, 113, 40, 2, P.bumper); F(6, 113, 4, 2, '#B83030'); F(38, 113, 4, 2, '#B83030');
    }
    if (kind === 'amb') {
      const aL = this.light(P.amb, 0.1), aD = this.dark(P.amb, 0.8);
      [[0, 10], [40, 10], [0, 56], [40, 56]].forEach((w) => tire(w[0], w[1], 12));
      F(4, 2, 36, 76, P.amb); F(4, 2, 1, 76, aL); F(39, 2, 1, 76, aD);
      F(6, 0, 32, 3, P.bumper); F(6, 3, 4, 2, P.lamp); F(34, 3, 4, 2, P.lamp);
      F(6, 6, 32, 6, aL); F(8, 13, 28, 6, P.glass); F(10, 14, 4, 4, P.glassL);
      F(10, 22, 24, 3, '#2B2B2B'); F(12, 23, 6, 1, '#E23B3B'); F(26, 23, 6, 1, '#2F7BEA');
      F(10, 32, 24, 24, P.white); F(10, 32, 24, 1, '#FFFFFF'); F(19, 35, 6, 18, P.red); F(13, 41, 18, 6, P.red);
      F(21, 62, 2, 14, aD); F(4, 77, 36, 3, P.bumper); F(6, 77, 3, 2, '#B83030'); F(35, 77, 3, 2, '#B83030');
    }
    if (kind === 'drone') {
      for (let i = 2; i < 22; i++) { set(i, i, P.droneA); set(i + 1, i, P.droneA); set(23 - i, i, P.droneA); set(22 - i, i, P.droneA); }
      F(8, 8, 8, 8, P.droneB); F(9, 9, 6, 1, '#3D444E'); F(11, 11, 2, 2, '#29BDFD');
      [[0, 0], [17, 0], [0, 17], [17, 17]].forEach((r) => { F(r[0] + 1, r[1], 5, 7, '#9AA3AE'); F(r[0], r[1] + 1, 7, 5, '#9AA3AE'); F(r[0] + 2, r[1] + 2, 3, 3, '#C6CDD5'); });
    }
    return this.outline(g);
  }
  sprite(type, rank, dir, f) {
    const key = type + '|' + (rank || '') + '|' + dir + '|' + f;
    if (!this.SC[key]) this.SC[key] = this.toCanvas(this.paintChar(Object.assign({}, this.TYPES[type], { rank: rank || '' }), dir, f));
    return this.SC[key];
  }
  glow(rgb) {
    if (this.GL[rgb]) return this.GL[rgb];
    const cv = this.mk(32, 32), c = cv.getContext('2d');
    const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(' + rgb + ',1)');
    g.addColorStop(0.25, 'rgba(' + rgb + ',0.5)');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    c.fillStyle = g; c.fillRect(0, 0, 32, 32);
    this.GL[rgb] = cv;
    return cv;
  }

}

// ---- 시연(demo)용 추가 캐릭터 ----
// 기존 paintChar를 그대로 쓰고 팔레트만 잠시 바꿔 칠한 뒤 작은 소품을 덧그린다(기존 스프라이트 코드는 그대로).
// map.useExtraSprites()가 TYPES에 등록하고 스프라이트 캐시(SC)를 미리 채워 두면 drawEnt·sprite()가 그대로 그린다.
//   trainer: 전문 트레이너 — 빨간 트레이닝 상의·짙은 반바지·호루라기·태블릿
//   tech:    민간 기술지원팀 — 남색 작업복(반사띠)·흰 안전모
const EXTRA_SPRITES = {
  trainer: { spec: { head: 'hair', top: 'pt', bottom: 'pt', item: 'tablet', seed: 2 }, pal: { ptTop: '#B8322E' }, keepBottom: true },
  tech: { spec: { head: 'hair', top: 'gown', bottom: 'scrub', seed: 8 }, pal: { gown: '#3A5672', scrub: '#2C3644', shoeW: '#3A3B3F', stetho: '#C9D1D8' } }
};
SpriteKit.prototype.paintExtra = function (type, dir, f) {
  const d = EXTRA_SPRITES[type], P = this.P, save = {};
  Object.keys(d.pal).forEach((k) => { save[k] = P[k]; P[k] = d.pal[k]; });
  let g;
  try { g = this.paintChar(Object.assign({}, d.spec), dir, f); } finally { Object.keys(save).forEach((k) => { P[k] = save[k]; }); }
  if (d.keepBottom) { const b = this.paintChar(Object.assign({}, d.spec), dir, f); for (let y = 36; y < g.length; y++) g[y] = b[y]; }
  const side = dir === 'left' || dir === 'right';
  const set = (x, y, c) => { const xx = dir === 'left' ? 31 - x : x; if (xx >= 0 && xx < 32 && y >= 0 && y < 48) g[y][xx] = c; };
  const F = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
  if (type === 'trainer') {
    if (dir === 'down') { [[13, 24], [13, 25], [14, 26], [18, 24], [18, 25], [17, 26]].forEach((q) => set(q[0], q[1], '#F2F2F2')); F(15, 27, 2, 2, '#C9CED3'); set(15, 27, '#FFFFFF'); set(16, 28, '#7D848C'); }
    else if (dir === 'up') F(13, 24, 6, 1, '#E8E8E8');
    else { set(19, 24, '#F2F2F2'); set(20, 25, '#C9CED3'); }
  }
  if (type === 'tech') {
    const coat = side ? [12, 9] : [9, 14];
    [31, 38].forEach((y) => F(coat[0], y, coat[1], 1, '#D7DEE5'));
    const hat = '#F4F4F0', hatD = '#D6D9DC', ol = '#4A4E53';
    if (!side) {
      F(11, 0, 10, 1, ol); F(9, 1, 2, 1, ol); F(21, 1, 2, 1, ol); set(8, 2, ol); set(23, 2, ol); F(7, 3, 1, 4, ol); F(24, 3, 1, 4, ol); set(6, 7, ol); set(25, 7, ol); F(7, 8, 18, 1, ol);
      F(11, 1, 10, 1, hat); F(9, 2, 14, 1, hat); F(8, 3, 16, 4, hat); F(7, 7, 18, 1, hatD); F(20, 3, 4, 4, hatD); F(15, 1, 2, 6, hatD);
    } else {
      F(12, 0, 9, 1, ol); set(11, 1, ol); set(21, 1, ol); set(10, 2, ol); set(22, 2, ol); F(9, 3, 1, 4, ol); F(23, 3, 1, 3, ol); F(24, 6, 2, 1, ol); set(26, 7, ol); F(9, 8, 17, 1, ol);
      F(12, 1, 9, 1, hat); F(11, 2, 11, 1, hat); F(10, 3, 13, 4, hat); F(10, 7, 16, 1, hatD); F(22, 6, 2, 1, hatD); F(14, 1, 2, 6, hatD);
    }
  }
  return g;
};
// ---- 앉은 자세 ----
// 상체(0~36행)는 선 자세(f=0)를 그대로 쓰고 허리 아래만 앉은 모양으로 다시 그린다. 34행(허리)이 앉은 자리 y에 온다.
//   chair: 사무용 의자 — 정면은 좌판 끝·기둥·바퀴, 뒷모습은 등받이가 허리를 가림, 옆모습은 등받이·좌판·기둥
//   stool: 식당 의자 — 좌판·다리
//   free:  가구 없이(침대 걸터앉기·바닥·운동기구) — 다리만 그린다, 뒷모습은 엉덩이까지
// 정면 앉기에서 앞에 식탁·책상이 있으면(cover) 스프라이트를 쓰지 않고 허리에서 자른다(baseMap.drawSeated).
SpriteKit.prototype.paintSit = function (spec, dir, kind) {
  if (dir === 'left') return this.paintSit(Object.assign({}, spec, { _near: 'left' }), 'right', kind).map((r) => r.slice().reverse());
  const P = this.P, W = 32, H = 48, g = this.paintChar(Object.assign({}, spec, { _raw: true }), dir, 0);
  for (let y = 37; y < H; y++) g[y].fill(null);
  const put = (x, y, c, behind) => { if (c && x >= 0 && x < W && y >= 0 && y < H && !(behind && g[y][x])) g[y][x] = typeof c === 'function' ? c(x, y) : c; };
  const F = (x, y, w, h, c, behind) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c, behind); };
  const sh = (hex, lv) => (lv === 0 ? hex : (lv > 0 ? this.light(hex, 0.18 * lv) : this.dark(hex, lv === -1 ? 0.78 : 0.6)));
  const sd = spec.seed || 1, bot = spec.bottom;
  const botM = (lv) => (bot === 'camo' ? (x, y) => sh(P.camo5[this.camo5(x, y, sd)], lv || 0) : () => sh({ pt: P.ptTop, scrub: P.scrub, robot: P.robotS }[bot], lv || 0));
  const dkM = (lv) => (x, y) => this.dark(botM(lv)(x, y), 0.78);
  const skin = (lv) => () => sh(P.skin, lv || 0);
  const box = (x, y, w, h, m) => { F(x, y, w, h, m(0)); F(x, y, 1, h, m(1)); F(x + w - 1, y, 1, h, m(-1)); };
  const bootC = { camo: P.boot, pt: P.sneaker, scrub: P.shoeW, robot: P.robotD }[bot];
  const boot = (x, y, w) => {
    F(x, y, w, 3, bootC); F(x, y, w, 1, this.light(bootC, 0.22)); F(x, y + 2, w, 1, this.dark(bootC, 0.55));
    if (bot === 'pt') { F(x, y + 2, w, 1, '#8E949B'); F(x + 1, y + 1, 3, 1, '#FFFFFF'); }
  };
  const CH = '#46505E', CHL = '#6A7586', CHD = '#2A3038', WH = '#15181C';
  const pt = bot === 'pt';
  if (dir === 'down') {
    // 허벅지는 앞으로 뻗어 짧게 보이고, 무릎 아래로 정강이와 군화 코가 보인다
    box(9, 37, 6, pt ? 2 : 3, botM); box(17, 37, 6, pt ? 2 : 3, botM); F(15, 37, 2, pt ? 2 : 3, botM(-2)); F(9, 37, 14, 1, botM(1));
    if (pt) { box(10, 39, 4, 3, skin); box(18, 39, 4, 3, skin); F(10, 42, 4, 1, P.sock); F(18, 42, 4, 1, P.sock); }
    else { F(9, 40, 6, 1, botM(-1)); F(17, 40, 6, 1, botM(-1)); box(10, 41, 4, 2, botM); box(18, 41, 4, 2, botM); }
    boot(9, 43, 6); boot(17, 43, 6);
    if (bot === 'camo') { put(11, 44, P.lace); put(12, 44, P.lace); put(19, 44, P.lace); put(20, 44, P.lace); }
    if (kind === 'chair') { F(6, 37, 20, 2, CH, true); F(6, 37, 20, 1, CHL, true); F(15, 41, 2, 4, CHD, true); F(10, 46, 12, 1, CHD); [10, 15, 21].forEach((x) => put(x, 47, WH)); }
    if (kind === 'stool') { F(6, 37, 20, 2, CH, true); F(6, 37, 20, 1, CHL, true); F(7, 39, 2, 6, CHD, true); F(23, 39, 2, 6, CHD, true); }
  } else if (dir === 'up') {
    // 뒷모습: 다리는 몸 앞(화면 위쪽)으로 뻗어 보이지 않는다
    box(9, 37, 14, 2, botM); F(15, 37, 2, 2, botM(-2));
    if (kind === 'chair') {
      F(11, 29, 10, 1, CHL); F(10, 30, 12, 8, CH); F(10, 30, 1, 8, CHL); F(21, 30, 1, 8, CHD); F(12, 32, 8, 1, CHL);
      F(8, 38, 16, 2, CH); F(8, 38, 16, 1, CHL); F(15, 40, 2, 3, CHD); F(10, 43, 12, 1, CHD); [10, 15, 21].forEach((x) => put(x, 44, WH));
    }
    if (kind === 'stool') { F(8, 39, 16, 2, CH); F(8, 39, 16, 1, CHL); F(9, 41, 2, 4, CHD); F(21, 41, 2, 4, CHD); F(11, 43, 10, 1, CHD); }
  } else {
    // 옆모습: 엉덩이 → 허벅지(앞으로) → 무릎에서 꺾여 정강이(아래로) → 군화 코가 앞을 향한다
    box(14, 36, 9, 2, dkM);
    if (pt) { box(11, 36, 8, 3, botM); box(19, 36, 5, 3, skin); box(20, 39, 4, 3, skin); F(20, 42, 4, 1, P.sock); }
    else { box(11, 36, 13, 3, botM); F(11, 36, 13, 1, botM(1)); F(11, 38, 13, 1, botM(-1)); box(20, 39, 4, 4, botM); }
    boot(19, 43, 8);
    if (kind === 'chair') { F(8, 24, 3, 13, CH, true); F(8, 24, 1, 13, CHL, true); F(8, 24, 3, 1, CHL, true); F(8, 39, 12, 2, CH, true); F(8, 39, 12, 1, CHL, true); F(13, 41, 2, 3, CHD, true); F(9, 44, 10, 1, CHD, true); [9, 14, 18].forEach((x) => put(x, 45, WH, true)); }
    if (kind === 'stool') { F(9, 39, 11, 2, CH, true); F(9, 39, 11, 1, CHL, true); F(10, 41, 2, 4, CHD, true); F(17, 41, 2, 4, CHD, true); }
  }
  return this.outline(g);
};
// 앉은 스프라이트(캐시). 시연용 추가 캐릭터(trainer·tech)는 팔레트가 달라 null → 허리 자르기로 그린다
SpriteKit.prototype.sitSprite = function (type, rank, dir, kind) {
  if (EXTRA_SPRITES[type] || !this.TYPES[type]) return null;
  const key = 'sit|' + type + '|' + (rank || '') + '|' + dir + '|' + kind;
  if (!this.SC[key]) this.SC[key] = this.toCanvas(this.paintSit(Object.assign({}, this.TYPES[type], { rank: rank || '' }), dir, kind));
  return this.SC[key];
};
SpriteKit.prototype.useExtraSprites = function () {
  Object.keys(EXTRA_SPRITES).forEach((type) => {
    if (!this.TYPES[type]) this.TYPES[type] = Object.assign({}, EXTRA_SPRITES[type].spec);
    ['down', 'up', 'left', 'right'].forEach((dir) => [0, 1, 2].forEach((f) => {
      const key = type + '||' + dir + '|' + f;
      if (!this.SC[key]) this.SC[key] = this.toCanvas(this.paintExtra(type, dir, f));
    }));
  });
};
