// 캐릭터·계급장·차량 시트
import { SpriteKit } from './sprites.js';

export class CharacterSheet extends SpriteKit {
  constructor(canvas) { super(); this.cv = canvas; this.ctx = null; this.viewScale = 1; this.paused = false; }
  start() {
    this.initPal();
    this.SC = {}; this.GL = {}; this.VS = {};
    ['k151', 'truck', 'amb', 'drone'].forEach((k) => { this.VS[k] = this.toCanvas(this.paintVehicle(k)); });
    this.t0 = performance.now();
    try { if (document.fonts && document.fonts.load) document.fonts.load('12px Galmuri11'); } catch (err) {}
    const loop = (now) => {
      this.raf = requestAnimationFrame(loop);
      try { if (!this.paused) this.frame(now); } catch (err) { if (!this.warned) { this.warned = true; console.warn(err); } }
    };
    this.raf = requestAnimationFrame(loop);
  }
  pause() { this.paused = true; }
  resume() { this.paused = false; }
  cardDefs() {
    return [
      { type: 'officer', rank: 'n3', name: '간부 · 송 상사', desc: '전투복 · 전투모(정면 계급장) · 가슴 계급장 · 명찰 · 태블릿', role: '같은 몸에 계급만 바꿔 씀: 최 중사 · 강 대위 · 대대장(중령)' },
      { type: 'soldier', rank: 'e3', name: '일반 용사 · 상병', desc: '전투복 · 전투모 · 가슴 계급장(가로줄 3) · 명찰 · 태극기', role: '시나리오: 위병소 상황 근무 · 순찰 · 수송' },
      { type: 'trainee', rank: 'e2', name: '훈련·경계 용사', desc: '방탄헬멧(위장 커버) · 방탄복 · K2 소총 · 위장색 태극기', role: '시나리오: 정문 경계 · 연병장 구보' },
      { type: 'pt', rank: '', name: '하계 활동복 용사', desc: '검정 반팔 · 검정 반바지 · ROKA 로고 · AI 아미 워치(손목 발광)', role: '시나리오: 박 상병 미열 감지 → 의무실 진료 예약' },
      { type: 'medic', rank: '', name: '군의관', desc: '가운 · 청진기 · 수술복 하의', role: '시나리오: 의무실 진료' },
      { type: 'robot', rank: '', name: '휴머노이드 아미 NO.7', desc: '흰 외장 · 시안 바이저', role: '시나리오: 정문 차량 번호·안면 인식 · 생일 인사' }
    ].map((d, i) => Object.assign(d, { x: [32, 560, 1088][i % 3], y: [96, 400][Math.floor(i / 3)] }));
  }
  rankDefs() {
    const R = [['e1', '이병'], ['e2', '일병'], ['e3', '상병'], ['e4', '병장'], ['n1', '하사'], ['n2', '중사'], ['n3', '상사'], ['o1', '소위'], ['o2', '중위'], ['o3', '대위'], ['f1', '소령'], ['f2', '중령'], ['f3', '대령']];
    const gi = [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3];
    return R.map((r, i) => ({ code: r[0], name: r[1], cx: 760 + 28 + i * 56 + gi[i] * 18 }));
  }
  box(c, x, y, w, h, bg) {
    c.fillStyle = '#05070A'; c.fillRect(x - 2, y, w + 4, h); c.fillRect(x, y - 2, w, h + 4);
    c.fillStyle = bg; c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(x, y, w, 2);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + h - 3, w, 3);
  }
  drawSprite(c, d, dir, f, x, y, sc, t) {
    const s = this.sprite(d.type, d.rank, dir, f);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x + 7 * sc, y + 46 * sc, 18 * sc, 2 * sc);
    c.drawImage(s, x, y, 32 * sc, 48 * sc);
    const sw = f === 1 ? -1 : (f === 2 ? 1 : 0);
    if (d.type === 'pt' && (dir === 'down' || dir === 'up')) {
      const wx = dir === 'down' ? 25 : 7, wy = dir === 'down' ? 33.5 - sw : 33.5 + sw;
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.55 + 0.3 * Math.sin(t * 3);
      c.drawImage(this.glow('41,224,255'), x + wx * sc - 6 * sc, y + wy * sc - 6 * sc, 12 * sc, 12 * sc);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
    if (d.type === 'robot' && dir === 'down') {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 + 0.25 * Math.sin(t * 2.4);
      c.drawImage(this.glow('41,189,253'), x + 6 * sc, y + 7 * sc, 20 * sc, 13 * sc);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
  }
  frame(now) {
    const cv = this.cv;
    if (!cv) return;
    const res = Math.max(1, Math.min(3, (window.devicePixelRatio || 1) * (this.viewScale || 1)));
    if (!this.ctx || Math.abs(res - (this.dpr || 0)) > 0.01) {
      cv.width = Math.round(1600 * res); cv.height = Math.round(900 * res);
      this.dpr = res; this.ctx = cv.getContext('2d');
    }
    const c = this.ctx, t = (now - this.t0) / 1000;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#20262F'; c.fillRect(0, 0, 1600, 900);
    c.fillStyle = 'rgba(255,255,255,0.025)';
    for (let x = 0; x < 1600; x += 16) c.fillRect(x, 0, 1, 900);
    for (let y = 0; y < 900; y += 16) c.fillRect(0, y, 1600, 1);
    const SC = 3;
    this.cardDefs().forEach((d) => {
      this.box(c, d.x, d.y, 480, 288, '#2A313C');
      [['down', 0], ['right', 0], ['up', 0]].forEach((sl, k) => {
        const sx = d.x + 24 + k * 112, sy = d.y + 66;
        c.fillStyle = '#1E242D'; c.fillRect(sx, sy, 96, 144);
        this.drawSprite(c, d, sl[0], sl[1], sx, sy, SC, t);
      });
      const sx = d.x + 360, sy = d.y + 66;
      c.fillStyle = '#16304A'; c.fillRect(sx, sy, 96, 144);
      c.fillStyle = '#05070A'; c.fillRect(sx, sy + 140, 96, 4);
      // 걷기 네 방향 → 의자에 앉기 네 방향 (로봇은 걷기만)
      const ph = Math.floor(t / 1.6) % 8, dir = ['down', 'right', 'up', 'left'][ph % 4];
      const sit = ph >= 4 && d.type !== 'robot' && this.sitSprite(d.type, d.rank, dir, 'chair');
      if (sit) c.drawImage(sit, sx, sy, 32 * SC, 48 * SC);
      else { const fr = [1, 0, 2, 0][Math.floor(t * 8) % 4]; this.drawSprite(c, d, dir, fr, sx, sy + (fr === 0 ? 0 : -SC), SC, t); }
    });
    this.box(c, 32, 704, 1536, 164, '#2A313C');
    const veh = [['k151', 128, 792, 2], ['truck', 332, 792, 2], ['amb', 552, 792, 2], ['drone', 680, 792, 2]];
    veh.forEach((v) => {
      const s = this.VS[v[0]], sc = v[3], w = s.width * sc, h = s.height * sc;
      c.save(); c.translate(v[1], v[2]); c.rotate(v[0] === 'drone' ? 0 : Math.PI / 2);
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-w / 2 + 2 * sc, -h / 2 + 2 * sc, w, h);
      c.drawImage(s, -w / 2, -h / 2, w, h);
      c.restore();
    });
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(744, 724, 2, 128);
    const P = this.P;
    this.rankDefs().forEach((r) => {
      const gl = this.rankGlyph(r.code), sc = 4, w = gl.w * sc, h = gl.h * sc, x = r.cx - w / 2, y = 778 - h / 2;
      c.fillStyle = '#05070A'; c.fillRect(x - 2, y - 2, w + 4, h + 4);
      c.fillStyle = P.tag; c.fillRect(x, y, w, h);
      c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(x, y, w, 2);
      c.fillStyle = P.ink; gl.pix.forEach((q) => c.fillRect(x + q[0] * sc, y + q[1] * sc, sc, sc));
    });
  }
}
