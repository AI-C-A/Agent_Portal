// 평소 모드 — 장소 효과: 맥동 링, 센서 핑, 스캔 빔, 시나리오 드론, 멧돼지, 4족 보행 경계로봇, 패킷, 멀티비전 등
// 모두 월드 좌표. 목록 길이는 상한(120)을 둬서 몇 시간을 돌아도 늘지 않는다.

const HEX = { hq: '#7FE3FF', gate: '#29BDFD', med: '#FF4F6E', trn: '#FFAF00', per: '#A98BFF', fac: '#9DCA1C', mess: '#EB56C5' };
const RGB = { hq: '127,227,255', gate: '41,189,253', med: '255,79,110', trn: '255,175,0', per: '169,139,255', fac: '157,202,28', mess: '235,86,197', red: '255,77,77', green: '69,240,138', white: '230,246,255' };
export { HEX, RGB };

export class FX {
  constructor(life) {
    this.life = life; this.map = life.map; this.list = []; this.t = 0;
  }
  add(o) { o.t0 = this.t; this.list.push(o); if (this.list.length > 120) this.list.splice(0, this.list.length - 120); return o; }
  clear(owner) { this.list.forEach((o) => { if (owner == null || o.owner === owner) o.dead = true; }); }
  ring(x, y, rgb, o) { return this.add(Object.assign({ k: 'ring', x, y, rgb: rgb || RGB.hq, r0: 6, r1: 44, per: 1.3, life: 4 }, o || {})); }
  ping(x, y, rgb, o) { return this.add(Object.assign({ k: 'ping', x, y, rgb: rgb || RGB.trn, life: 3 }, o || {})); }
  label(x, y, text, style, o) { return this.add(Object.assign({ k: 'label', x, y, text, style: style || 'agent', life: 3 }, o || {})); }
  cone(src, x, y, w, rgb, o) { return this.add(Object.assign({ k: 'cone', src, x, y, w: w || 30, rgb: rgb || RGB.gate, life: 3 }, o || {})); }
  // 노드·사람 사이를 잇는 패킷 (map.send 는 노드끼리만 되므로 직접 그린다)
  pkt(a, b, hex, chip, cb, o) {
    const d = Math.hypot(this.px(b)[0] - a[0], this.px(b)[1] - a[1]);
    return this.add(Object.assign({ k: 'pkt', a, b, hex: hex || '#FFFFFF', chip: chip || '', cb, dur: Math.max(0.8, d / 220), life: 30 }, o || {}));
  }
  px(b) { return Array.isArray(b) ? b : [b.x, b.y - 14]; }
  drone(x, y, path, o) { return this.add(Object.assign({ k: 'drone', x, y, alt: 0, path: path || [], sp: 130, life: 60, up: 1.2, anim: 0 }, o || {})); }
  boar(x, y, o) { return this.add(Object.assign({ k: 'boar', x, y, ox: x, oy: y, dir: 1, life: 40, flee: false, a: 0, anim: 0 }, o || {})); }
  ripple(x, y, o) { return this.add(Object.assign({ k: 'ripple', x, y, r1: 1700, dur: 5, life: 5.2, id: Math.random() }, o || {})); }
  trail(ent, hex, o) { return this.add(Object.assign({ k: 'trail', ent, hex, pts: [], st: 0, life: 40 }, o || {})); }
  panel(x, y, o) { return this.add(Object.assign({ k: 'panel', x, y, w: 42, h: 26, life: 14 }, o || {})); }
  cloud(x, y, o) { return this.add(Object.assign({ k: 'cloud', x, y, life: 14 }, o || {})); }
  sparkle(x, y, o) { return this.add(Object.assign({ k: 'spark', x, y, life: 6 }, o || {})); }

  age(o) { return this.t - o.t0; }
  fade(o) { if (o.life == null) return 1; const a = this.age(o); return Math.max(0, Math.min(1, a / 0.3, (o.life - a) / 0.6)); }
  step(dt) {
    this.t += dt;
    const map = this.map, ag = this.life.agents;
    for (const o of this.list) {
      if (o.dead) continue;
      if (o.k === 'pkt') {
        o.s = Math.min(1, this.age(o) / o.dur);
        if (o.s >= 1 && !o.done) { o.done = true; o.dead = true; if (o.cb) { try { o.cb(); } catch (err) { console.warn('life.fx', err); } } }
      } else if (o.k === 'drone') {
        o.anim += dt;
        if (o.land) { o.alt = Math.max(0, o.alt - dt * 18); if (o.alt <= 0) o.dead = true; continue; }
        o.alt = Math.min(24, o.alt + dt * 20);
        const w = o.path[0];
        if (w) { const dx = w[0] - o.x, dy = w[1] - o.y, d = Math.hypot(dx, dy), s = o.sp * dt; if (d <= s) { o.x = w[0]; o.y = w[1]; o.path.shift(); if (!o.path.length && o.onEnd) o.onEnd(o); } else { o.x += dx / d * s; o.y += dy / d * s; } }
        else if (o.orbit) { o.oa = (o.oa || 0) + dt * o.orbit.w; o.x = o.orbit.cx + Math.cos(o.oa) * o.orbit.r; o.y = o.orbit.cy + Math.sin(o.oa) * o.orbit.r * 0.7; }
      } else if (o.k === 'boar') {
        o.anim += dt;
        if (o.flee) { o.x += dt * 38 * (o.fvx || 0); o.y += dt * 38 * (o.fvy == null ? -1 : o.fvy); o.a = Math.max(0, o.a - dt * 0.6); if (o.a <= 0) o.dead = true; }
        else { o.a = Math.min(1, o.a + dt * 2); o.y += o.dir * dt * 9; if (Math.abs(o.y - o.oy) > 14) o.dir *= -1; }
      } else if (o.k === 'ripple') {
        const r = Math.min(1, this.age(o) / o.dur) * o.r1;
        o.r = r;
        if (ag && ag.list) for (const e of ag.list) {
          const lf = e.lf; if (!lf || lf.robot || lf.pingId === o.id || e.alpha < 0.5) continue;
          const d = Math.hypot(e.x - o.x, e.y - o.y);
          if (Math.abs(d - r) < 26) { lf.pingId = o.id; lf.ping = 1.6; if (o.onHit) o.onHit(e); }
        }
      } else if (o.k === 'trail') {
        o.st -= dt;
        if (o.st <= 0 && o.ent && !o.stop) { o.st = 0.25; o.pts.push([o.ent.x, o.ent.y]); if (o.pts.length > 90) o.pts.shift(); }
      }
    }
    if (this.list.some((o) => o.dead || (o.life != null && this.t - o.t0 > o.life))) this.list = this.list.filter((o) => !o.dead && (o.life == null || this.t - o.t0 <= o.life));
    void map;
  }
  // ---------- 그리기 ----------
  drawWorld(c, t) {
    const map = this.map, z = map.z, W = (x, y, w, h, col) => map.wrect(c, x, y, w, h, col);
    for (const o of this.list) {
      if (o.dead) continue;
      const f = this.fade(o);
      if (o.k === 'ring') {
        const p = map.w2s(o.x, o.y);
        for (let j = 0; j < (o.n || 2); j++) {
          const k = (((this.age(o) + j * o.per / (o.n || 2)) % o.per) / o.per), r = (o.r0 + (o.r1 - o.r0) * k) * z;
          c.globalAlpha = (1 - k) * 0.9 * f; c.strokeStyle = 'rgba(' + o.rgb + ',1)'; c.lineWidth = Math.max(1.5, z * 1.4);
          c.beginPath(); c.ellipse(p[0], p[1], r, r * 0.72, 0, 0, Math.PI * 2); c.stroke();
        }
        const G = (o.r0 + 18) * z * 2;
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 * f * (0.7 + 0.3 * Math.sin(t * 5)); c.drawImage(map.glow(o.rgb), p[0] - G / 2, p[1] - G / 2, G, G);
        c.globalCompositeOperation = 'source-over';
      } else if (o.k === 'ping') {
        const on = Math.floor(t * 5 + o.x) % 2, p = map.w2s(o.x, o.y), k = (this.age(o) * 1.4) % 1;
        c.globalAlpha = f; W(o.x - 0.75, o.y - 14, 1.5, 14, 'rgba(' + o.rgb + ',0.55)');
        W(o.x - 2, o.y - 16, 4, 4, on ? '#FFFFFF' : 'rgba(' + o.rgb + ',1)');
        c.globalAlpha = (1 - k) * f; c.strokeStyle = 'rgba(' + o.rgb + ',1)'; c.lineWidth = Math.max(1, z);
        const r = (3 + k * 12) * z; c.beginPath(); c.ellipse(p[0], p[1] - 14 * z, r, r, 0, 0, Math.PI * 2); c.stroke();
      } else if (o.k === 'cone') {
        const s = o.src && o.src.k === 'drone' ? [o.src.x, o.src.y - o.src.alt] : this.px(o.src);
        const p0 = map.w2s(s[0], s[1]), pa = map.w2s(o.x - o.w / 2, o.y), pb = map.w2s(o.x + o.w / 2, o.y);
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = f * (0.22 + 0.1 * Math.sin(t * 7)); c.fillStyle = 'rgba(' + o.rgb + ',1)';
        c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(pa[0], pa[1]); c.lineTo(pb[0], pb[1]); c.closePath(); c.fill();
        c.globalAlpha = f * 0.8; W(o.x - o.w / 2, o.y - 1 + ((this.age(o) * 22) % 10) - 5, o.w, 0.6, 'rgba(' + o.rgb + ',1)');
        c.globalCompositeOperation = 'source-over';
      } else if (o.k === 'pkt') {
        const a = o.a, b = this.px(o.b), mx = (a[0] + b[0]) / 2, my = Math.min(a[1], b[1]) - 30 - Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.12;
        const at = (s) => { const u = 1 - s; return [u * u * a[0] + 2 * u * s * mx + s * s * b[0], u * u * a[1] + 2 * u * s * my + s * s * b[1]]; };
        const s = o.s || 0;
        for (let k = 5; k >= 1; k--) { const ss = s - k * 0.025; if (ss < 0) continue; const q = at(ss); c.globalAlpha = (1 - k / 6) * 0.9; W(q[0] - 0.75, q[1] - 0.75, 1.5, 1.5, o.hex); }
        const h = at(s), hp = map.w2s(h[0], h[1]), G = 18 * z;
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.85; c.drawImage(map.glow(o.rgb || '230,246,255'), hp[0] - G / 2, hp[1] - G / 2, G, G); c.globalCompositeOperation = 'source-over';
        c.globalAlpha = 1; W(h[0] - 2, h[1] - 2, 4, 4, '#05070A'); W(h[0] - 1.5, h[1] - 1.5, 3, 3, o.hex);
        o.hp = hp;
      } else if (o.k === 'drone') {
        const x = o.x, y = o.y - o.alt, sh = 1 - o.alt / 40;
        c.globalAlpha = 1; W(o.x - 5 * sh, o.y + 2, 10 * sh, 2.5, 'rgba(0,0,0,' + (0.15 + 0.15 * sh).toFixed(2) + ')');
        const p = map.w2s(x - 6, y - 6); c.drawImage(map.VS.drone, p[0], p[1], 12 * z, 12 * z);
        if (Math.floor(t * 14) % 2) [[1.5, 1.5], [10, 1.5], [1.5, 10], [10, 10]].forEach((r) => W(x - 6 + r[0], y - 6 + r[1], 0.5, 0.5, '#FFFFFF'));
        W(x - 0.5, y - 0.5, 1, 1, Math.floor(t * 3) % 2 ? '#FF4D4D' : '#45F08A');
      } else if (o.k === 'boar') {
        c.globalAlpha = o.a; const d = o.dir, x = o.x, y = o.y, st = Math.floor(o.anim * (o.flee ? 12 : 6)) % 2;
        W(x - 5, y + 1, 10, 1.5, 'rgba(0,0,0,0.2)');
        W(x - 4.5, y - 5, 9, 4.5, '#5A4030'); W(x - 4.5, y - 5, 9, 1, '#76573F'); W(x - 4, y - 6, 6, 1, '#3E2A1E');
        const hx = o.flee || d > 0 ? x - 1.5 : x - 1.5; W(hx, o.flee ? y - 7.5 : y - 1.5, 3, 3, '#4A3426'); W(hx + 1, o.flee ? y - 8 : y + 1, 1, 1, '#F2EEE6');
        W(x - 3.5, y - 0.5, 1, st ? 1.5 : 1, '#2E2018'); W(x + 2.5, y - 0.5, 1, st ? 1 : 1.5, '#2E2018');
      } else if (o.k === 'ripple') {
        const p = map.w2s(o.x, o.y), r = (o.r || 0) * z, k = this.age(o) / o.dur;
        c.globalAlpha = Math.max(0, 1 - k) * 0.6; c.strokeStyle = '#7FE3FF'; c.lineWidth = Math.max(2, z * 2);
        c.beginPath(); c.ellipse(p[0], p[1], r, r * 0.72, 0, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = Math.max(0, 1 - k) * 0.25; c.lineWidth = Math.max(6, z * 6); c.stroke();
      } else if (o.k === 'trail') {
        if (o.pts.length < 2) continue;
        c.globalAlpha = 0.9 * f; c.fillStyle = o.hex;
        for (let i = 0; i < o.pts.length; i++) { if (i % 2) continue; const q = map.w2s(o.pts[i][0], o.pts[i][1]), s = Math.max(2, Math.round(z * 2)); c.fillRect(q[0] - s / 2, q[1] - s / 2, s, s); }
        const L = o.pts[o.pts.length - 1], q = map.w2s(L[0], L[1]), s = Math.max(4, Math.round(z * 4));
        c.globalAlpha = f; c.strokeStyle = o.hex; c.lineWidth = Math.max(1, z); c.strokeRect(q[0] - s, q[1] - s, s * 2, s * 2);
      } else if (o.k === 'panel') {
        c.globalAlpha = f; const x = o.x, y = o.y, w = o.w, h = o.h;
        W(x + 3, y + h, 1.5, 8, '#5B626A'); W(x + w - 4.5, y + h, 1.5, 8, '#5B626A');
        W(x - 1, y - 1, w + 2, h + 2, '#0B1018'); W(x, y, w, h, '#06121F'); W(x, y, w, 4, '#9A6A2A');
        (o.rows || []).forEach((r, i) => { const on = this.age(o) > 0.6 + i * 0.7; if (!on) return; W(x + 3, y + 7 + i * 6, 3, 3, r[0]); W(x + 8, y + 7.5 + i * 6, (w - 12) * r[1], 2, Math.floor(t * 2 + i) % 3 ? '#C9D6E2' : '#FFFFFF'); });
      } else if (o.k === 'cloud') {
        c.globalAlpha = f * 0.95; const x = o.x, y = o.y + Math.sin(t * 1.2) * 1.5;
        W(x - 14, y - 4, 28, 8, '#AEB8C4'); W(x - 10, y - 9, 14, 6, '#C3CCD6'); W(x + 0, y - 11, 10, 7, '#D3DAE2'); W(x - 14, y + 3, 28, 1.5, '#8A95A2');
        for (let k = 0; k < 7; k++) { const ph = (t * 1.6 + k / 7) % 1; W(x - 12 + k * 4, y + 6 + ph * 16, 0.8, 3, 'rgba(127,200,255,' + (0.9 * (1 - ph)).toFixed(2) + ')'); }
      } else if (o.k === 'spark') {
        const k = this.age(o); c.globalAlpha = f;
        for (let i = 0; i < 4; i++) { const a = t * 4 + i * 1.57, r = 4 + 2 * Math.sin(t * 6 + i); W(o.x + Math.cos(a) * r - 0.5, o.y - 10 + Math.sin(a) * r * 0.7 - 0.5, 1, 1, i % 2 ? '#45F08A' : '#FFFFFF'); }
        void k;
      }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }
  // 화면 좌표 위에 얹는 말풍선·이름표 (캐릭터 말풍선과 같은 모양)
  drawScreen(c, t) {
    const map = this.map;
    const vr = map.viewR ? map.viewR() : 1204;
    for (const o of this.list) {
      if (o.dead) continue;
      if (o.k === 'label') {
        const p = map.w2s(o.x, o.y); c.globalAlpha = this.fade(o);
        map.pill(c, o.text, Math.max(40, Math.min(vr - 40, p[0])), Math.max(92, p[1]), o.style); c.globalAlpha = 1;
      } else if (o.k === 'pkt' && o.chip && o.hp && map.flow) {
        map.dataChip(c, o.chip, o.hp[0], o.hp[1] - 10, o.hex, true);
      }
    }
    c.globalAlpha = 1;
  }
}
