// 시연 화면 UI (화면 좌표 1600×900) — 컷신 띠·장소 배너·타이틀 카드·대사창(초상화 + 타자 효과)·오른쪽 팝업·진행 막대
// 글자는 Galmuri11 12px·24px(48px는 타이틀 카드)만 써서 픽셀이 또렷하게 보이게 한다.
import { gymVitals } from './props.js';
import { emblemCanvas } from '../emblem.js';
export const BAR = 64;
export const FOCUS_Y = 380; // 대사창 위 화면 가운데 — 카메라 초점이 놓이는 화면 y
const BX = 148, BY = 696, BW = 908, BH = 164;
const PX = 1220, PY = 368, PW = 360;
const F12 = '12px Galmuri11, sans-serif', B12 = '700 12px Galmuri11, sans-serif';
const F24 = '24px Galmuri11, sans-serif', B24 = '700 24px Galmuri11, sans-serif', B48 = '700 48px Galmuri11, sans-serif';
const CPS = 24; // 타자 속도 (글자/초)
const clamp01 = (u) => Math.max(0, Math.min(1, u));
const easeOut = (u) => 1 - Math.pow(1 - clamp01(u), 3);

function txt(c, s, x, y, font, col, align) { c.font = font; c.fillStyle = col; c.textAlign = align || 'left'; c.textBaseline = 'middle'; c.fillText(s, Math.round(x), Math.round(y)); }
function tw(c, s, font) { c.font = font; return Math.ceil(c.measureText(s).width); }
function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function frame(c, x, y, w, h, bg, edge) { rect(c, x - 2, y, w + 4, h, edge || '#05070A'); rect(c, x, y - 2, w, h + 4, edge || '#05070A'); rect(c, x, y, w, h, bg); }
function chip(c, s, x, y, bg, fg, right) { const w = tw(c, s, F12) + 16, xx = right ? x - w : x; rect(c, xx, y, w, 20, bg); txt(c, s, xx + 8, y + 11, F12, fg); return w; }
function bar(c, x, y, w, h, v, col, bg) { rect(c, x, y, w, h, bg || '#1A2030'); rect(c, x, y, Math.max(0, w * clamp01(v)), h, col); }
function check(c, x, y, ok) {
  rect(c, x, y, 16, 16, ok ? '#45F08A' : '#1A2030'); if (!ok) { rect(c, x + 2, y + 2, 12, 12, '#0B111A'); return; }
  [[3, 8], [5, 10], [7, 8], [9, 6], [11, 4]].forEach((q) => rect(c, x + q[0], y + q[1], 2, 2, '#06200F'));
  rect(c, x + 5, y + 8, 2, 2, '#06200F');
}
function along2(pts, u) {
  const L = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
  let s = clamp01(u) * tot;
  for (let i = 0; i < L.length; i++) { if (s <= L[i]) { const k = L[i] ? s / L[i] : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]; } s -= L[i]; }
  return pts[pts.length - 1];
}
function pdisc(c, cx, cy, r, col) { c.fillStyle = col; for (let dy = -r; dy < r; dy += 2) { const w = Math.round(Math.sqrt(Math.max(0, r * r - (dy + 1) * (dy + 1))) / 2) * 2; c.fillRect(cx - w, cy + dy, w * 2, 2); } }
function ecg(i) { const p = ((i % 24) + 24) % 24; return p === 10 ? -11 : (p === 11 ? 14 : (p === 12 ? -5 : ((p >= 4 && p <= 6) ? -2 : ((p >= 16 && p <= 19) ? -3 : 0)))); }
function wrap(c, s, maxW, font) {
  c.font = font; const out = []; let line = '';
  s.split(' ').forEach((wd) => { const tryL = line ? line + ' ' + wd : wd; if (c.measureText(tryL).width > maxW && line) { out.push(line); line = wd; } else line = tryL; });
  if (line) out.push(line);
  return out;
}

// ---------------------------------------------------------------- 진입점
export function drawUI(map, c, S, SPEAKERS) {
  const T = S.T;
  drawOut(map, c, S);
  drawCardDim(c, S, T);
  drawPopup(map, c, S, T);
  drawGpt(map, c, S, T);
  drawBars(c, S, T);
  drawBanner(c, S, T);
  drawSay(map, c, S, T, SPEAKERS);
  drawCardText(c, S, T);
  drawChapter(c, S, T);
  drawPaused(c, S);
  drawProgress(c, S, T);
}

function lbK(S, T) { const L = S.lb; if (!L) return 0; const k = easeOut((T - L.t0) / 0.6); return L.on ? k : 1 - k; }
function drawBars(c, S, T) {
  const k = lbK(S, T); if (k <= 0) return;
  const h = Math.round(BAR * k);
  rect(c, 0, 0, 1600, h, '#05070A'); rect(c, 0, 900 - h, 1600, h, '#05070A');
  rect(c, 0, h - 2, 1600, 2, '#141B28'); rect(c, 0, 900 - h, 1600, 2, '#141B28');
}
// 진행 막대 — 평소엔 맨 아래 얇은 줄. 마우스를 아래쪽에 가져가거나 멈추거나 끄는 동안엔 아래 컷신 띠 안에서 펼친다:
// 재생·일시정지 단추 · 시간(0:42 / 1:12) · 장면 눈금 · 손잡이 · 마우스 자리의 시각과 장면 이름.
const PB = { x0: 168, x1: 1572, y: 868 };
const fmtT = (s) => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export function progressTime(S, x) { return clamp01((x - PB.x0) / (PB.x1 - PB.x0)) * S.total; }
export function progressHit(S, x, y) { // 'toggle'(재생 단추) · 시각(막대) · null
  if (!S || lbK(S, S.T) < 0.99 || y < 846 || y > 900) return null;
  if (x >= 10 && x < 50) return 'toggle';
  if (x >= PB.x0 - 14 && x <= PB.x1 + 14) return progressTime(S, x);
  return null;
}
function drawProgress(c, S, T) {
  const k = lbK(S, T); if (k < 0.99 || !S.total) return;
  const C = S.ctl || {}, scrub = C.scrub != null;
  const open = S.paused || scrub || (C.y >= 700 && performance.now() - C.moved < 2500);
  const at = scrub ? C.scrub : T, v = clamp01(at / S.total);
  if (!open) {
    rect(c, 0, 896, 1600, 4, '#141B28'); rect(c, 0, 896, Math.round(1600 * v), 4, '#4FD1FF');
    (S.beats || []).forEach((b) => rect(c, Math.round(1600 * b / S.total) - 1, 892, 2, 8, b <= T ? '#4FD1FF' : '#3A4356'));
    return;
  }
  const x0 = PB.x0, W = PB.x1 - PB.x0, y = PB.y, kx = x0 + Math.round(W * v);
  if (S.paused) { c.fillStyle = '#FFFFFF'; c.beginPath(); c.moveTo(22, y - 10); c.lineTo(40, y); c.lineTo(22, y + 10); c.closePath(); c.fill(); } // 재생
  else { rect(c, 22, y - 9, 6, 18, '#FFFFFF'); rect(c, 33, y - 9, 6, 18, '#FFFFFF'); } // 일시정지
  txt(c, fmtT(at) + ' / ' + fmtT(S.total), 58, y + 1, B12, '#E8EDF5');
  rect(c, x0, y - 4, W, 8, '#1E2838'); rect(c, x0, y - 4, kx - x0, 8, '#4FD1FF');
  (S.beats || []).forEach((b) => rect(c, x0 + Math.round(W * b / S.total) - 1, y - 8, 2, 16, b <= at ? '#BFEFFF' : '#5E6878'));
  rect(c, kx - 7, y - 11, 14, 22, '#05070A'); rect(c, kx - 5, y - 9, 10, 18, scrub ? '#FFC247' : '#FFFFFF');
  const hx = scrub ? kx : C.x;
  if (scrub || (C.y >= 846 && C.x >= x0 - 14 && C.x <= PB.x1 + 14)) { // 그 자리의 시각과 장면
    const ht = scrub ? C.scrub : clamp01((C.x - x0) / W) * S.total;
    let name = ''; (S.beats || []).forEach((b, i) => { if (b <= ht + 0.05) name = (S.beatNames || [])[i] || ''; });
    const s = fmtT(ht) + (name ? '  ' + name : ''), w = tw(c, s, B12) + 20, bx = Math.max(8, Math.min(1592 - w, hx - w / 2));
    rect(c, bx, y - 44, w, 26, '#05070A'); rect(c, bx + 2, y - 42, w - 4, 22, '#1C2B40'); txt(c, s, bx + 10, y - 30, B12, '#FFFFFF');
  }
}
function drawPaused(c, S) { // 일시정지 표시: 멈추는 순간 가운데 크게 → 멈춘 화면을 가리지 않게 맵 위쪽 작은 표시로
  if (!S.paused || (S.ctl && S.ctl.scrub != null)) return;
  const u = (performance.now() - (S.pausedAt || 0)) / 1000;
  if (u < 0.9) {
    const cx = 602, cy = 360; c.globalAlpha = Math.min(1, (0.9 - u) / 0.3);
    rect(c, cx - 120, cy - 64, 240, 128, 'rgba(5,7,10,0.78)'); rect(c, cx - 120, cy - 64, 240, 2, '#4FD1FF');
    rect(c, cx - 22, cy - 44, 14, 44, '#FFFFFF'); rect(c, cx + 8, cy - 44, 14, 44, '#FFFFFF');
    txt(c, '일시정지', cx, cy + 22, B24, '#FFFFFF', 'center');
    txt(c, 'Space 재생 · ←/→ 5초 이동', cx, cy + 48, F12, '#9AA6B8', 'center');
    c.globalAlpha = 1;
  }
  const s = '일시정지 · Space 재생', w = tw(c, s, B12) + 44, x = 602 - w / 2, y = 72;
  c.globalAlpha = clamp01((u - 0.5) / 0.3);
  rect(c, x, y, w, 28, 'rgba(5,7,10,0.8)'); rect(c, x + 12, y + 8, 4, 12, '#FFFFFF'); rect(c, x + 19, y + 8, 4, 12, '#FFFFFF');
  txt(c, s, x + 32, y + 15, B12, '#FFFFFF'); c.globalAlpha = 1;
}

function drawBanner(c, S, T) {
  const b = S.banner; if (!b) return;
  const u = T - b.t0; if (u < 0 || u > b.dur) return;
  const a = Math.min(1, u / 0.3, (b.dur - u) / 0.4), x = 28 - (1 - easeOut(u / 0.4)) * 40;
  c.globalAlpha = Math.max(0, a);
  rect(c, x - 12, 14, 4, 36, '#FFC247');
  txt(c, b.time, x, 26, B24, '#FFC247');
  const w = tw(c, b.time, B24);
  if (b.em) { const pw = tw(c, b.place, B24) + 28; rect(c, x + w + 10, 10, pw, 32, '#FFC247'); rect(c, x + w + 12, 12, pw - 4, 28, '#2A1C00'); txt(c, b.place, x + w + 24, 26, B24, '#FFC247'); chip(c, '핵심 장면', x + w + 18 + pw, 16, '#FFC247', '#2A1C00'); txt(c, b.sub, x, 52, F12, '#FFE08A'); }
  else { txt(c, b.place, x + w + 14, 26, B24, '#FFFFFF'); txt(c, b.sub, x, 50, F12, '#9AA6B8'); }
  c.globalAlpha = 1;
}

function cardA(S, T) { const k = S.card; if (!k) return 0; const u = T - k.t0; if (u < 0 || u > k.dur) return 0; return Math.min(1, u / 0.5, (k.dur - u) / 0.5); }
function drawCardDim(c, S, T) { const a = cardA(S, T); if (a <= 0) return; c.fillStyle = 'rgba(5,7,10,' + (0.62 * a).toFixed(3) + ')'; c.fillRect(0, 0, 1600, 900); }
function drawCardText(c, S, T) {
  const a = cardA(S, T); if (a <= 0) return;
  const k = S.card, u = T - k.t0;
  c.globalAlpha = a;
  const y = 430 - (1 - easeOut(u / 0.8)) * 12;
  txt(c, k.l1, 800, y - 30, B48, '#FFFFFF', 'center');
  const hw = Math.min(700, Math.max(180, tw(c, k.l1, B48) / 2 + 20));
  rect(c, 800 - hw, y + 6, hw * 2, 2, '#C9A93A'); rect(c, 800 - hw - 4, y + 5, 4, 4, '#C9A93A'); rect(c, 800 + hw, y + 5, 4, 4, '#C9A93A');
  txt(c, k.l2, 800, y + 40, F24, '#C9D2DF', 'center');
  c.globalAlpha = 1;
}

// ---------------------------------------------------------------- 대사창
function drawSay(map, c, S, T, SPEAKERS) {
  const s = S.say; if (!s) return;
  const u = T - s.t0, spk = SPEAKERS[s.who];
  if (!spk || u < 0 || u > s.dur + 0.25) return;
  const a = (s.fresh ? Math.min(1, u / 0.15) : 1) * (u > s.dur ? Math.max(0, 1 - (u - s.dur) / 0.25) : 1);
  const slide = s.fresh ? (1 - easeOut(u / 0.25)) * 16 : 0, y0 = BY + slide;
  c.globalAlpha = a;
  frame(c, BX, y0, BW, BH, '#0E1420');
  rect(c, BX, y0, BW, 2, 'rgba(255,255,255,0.10)'); rect(c, BX + 6, y0 + 6, BW - 12, 2, '#1E2838'); rect(c, BX + 6, y0 + BH - 8, BW - 12, 2, '#1E2838');
  // 초상화
  const px = BX + 14, py = y0 + 14, N = spk.agent && map.nodes ? map.nodes[spk.agent] : null, accent = N ? N.hex : '#FFC247';
  frame(c, px, py, 136, 136, N ? '#08101A' : '#1C2B40', accent);
  if (N) {
    const cx = px + 68, cy = py + 58, R = 9;
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = a * (0.45 + 0.2 * Math.sin(T * 4)); c.drawImage(map.glow(N.rgb), cx - 70, cy - 70, 140, 140); c.globalCompositeOperation = 'source-over'; c.globalAlpha = a;
    for (let dy = -R - 1; dy <= R + 1; dy++) { const w = (R + 1 - Math.abs(dy)) * 2 + 1; rect(c, cx - w * 2, cy + dy * 4 - 2, w * 4, 4, '#05070A'); }
    for (let dy = -R; dy <= R; dy++) { const w = (R - Math.abs(dy)) * 2 + 1; rect(c, cx - w * 2, cy + dy * 4 - 2, w * 4, 4, N.hex); }
    for (let dy = -4; dy <= 4; dy++) { const w = (4 - Math.abs(dy)) * 2 + 1; rect(c, cx - w * 2, cy + dy * 4 - 2, w * 4, 4, map.light(N.hex, 0.55)); }
    rect(c, cx - 2, cy - 2, 4, 4, '#FFFFFF');
    txt(c, spk.code || (N.code + ' AI'), cx, py + 118, B12, N.hex, 'center');
  } else {
    rect(c, px, py + 96, 136, 40, '#24364F');
    const spr = map.sprite(spk.type, spk.rank || '', 'down', 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(spr, 0, 0, 32, 32, px + 4, py + 6, 128, 128);
  }
  // 이름 · 소속
  const nx = BX + 172;
  txt(c, spk.name, nx, y0 + 34, B24, accent);
  txt(c, spk.sub, nx + tw(c, spk.name, B24) + 14, y0 + 36, F12, '#9AA6B8');
  rect(c, nx, y0 + 56, BW - 172 - 24, 2, '#1E2838');
  // 본문 (타자 효과)
  if (!s.lines) s.lines = wrap(c, s.text, BW - 172 - 40, F24);
  let left = Math.floor(u * CPS);
  s.lines.forEach((ln, i) => { if (left <= 0) return; const part = ln.slice(0, left); left -= ln.length + 1; txt(c, part, nx, y0 + 88 + i * 36, F24, '#F2F5FA'); });
  if (Math.floor(u * CPS) >= s.text.length && Math.floor(T * 3) % 2) { const ax = BX + BW - 34, ay = y0 + BH - 30; rect(c, ax, ay, 12, 4, accent); rect(c, ax + 2, ay + 4, 8, 4, accent); rect(c, ax + 4, ay + 8, 4, 4, accent); }
  c.globalAlpha = 1;
}

// ---------------------------------------------------------------- 오른쪽 팝업
function drawPopup(map, c, S, T) {
  const p = S.pop; if (!p) return;
  const P = POPS[p.id], u = T - p.t0;
  if (!P || u < 0 || u > p.dur + 0.3) return;
  const a = (p.fresh ? Math.min(1, u / 0.2) : 1) * (u > p.dur ? Math.max(0, 1 - (u - p.dur) / 0.3) : 1);
  const x = PX + (p.fresh ? (1 - easeOut(u / 0.3)) * 40 : 0), y = PY, w = PW, h = P.h;
  c.globalAlpha = a;
  rect(c, x + 6, y + 6, w, h, 'rgba(0,0,0,0.35)');
  frame(c, x, y, w, h, 'rgba(12,16,24,0.97)');
  rect(c, x, y, w, 30, P.hex); rect(c, x, y, w, 2, 'rgba(255,255,255,0.35)');
  txt(c, P.title, x + 14, y + 16, B12, '#05070A');
  if (P.sub) txt(c, P.sub, x + w - 14, y + 16, F12, '#05070A', 'right');
  try { P.draw(c, x, y, w, h, u * (p.rate || 1), { map, S, T }); } finally { c.globalAlpha = 1; }
}

function watchFace(c, fx, fy, fw, fh) {
  rect(c, fx + fw / 2 - 52, fy - 12, 104, 14, '#2A2F36'); rect(c, fx + fw / 2 - 52, fy + fh - 2, 104, 14, '#2A2F36');
  for (let k = 0; k < 3; k++) { rect(c, fx + fw / 2 - 44, fy - 9 + k * 4, 88, 1, '#3A414B'); rect(c, fx + fw / 2 - 44, fy + fh + 2 + k * 4, 88, 1, '#3A414B'); }
  rect(c, fx + 8, fy - 2, fw - 16, fh + 4, '#05070A'); rect(c, fx - 2, fy + 8, fw + 4, fh - 16, '#05070A'); rect(c, fx + 2, fy, fw - 4, fh, '#05070A'); rect(c, fx, fy + 2, fw, fh - 4, '#05070A');
  rect(c, fx + 8, fy + 2, fw - 16, fh - 4, '#3A414B'); rect(c, fx + 2, fy + 8, fw - 4, fh - 16, '#3A414B');
  rect(c, fx + 10, fy + 6, fw - 20, fh - 12, '#070B10'); rect(c, fx + 6, fy + 10, fw - 12, fh - 20, '#070B10');
}

const POPS = {
  watchKim: { h: 320, hex: '#4FD1FF', title: 'AI 아미 워치', sub: '김 일병 · 2생활관', draw(c, x, y, w, h, u) {
    const fx = x + 64, fy = y + 50, fw = w - 128, fh = 244, cx = fx + fw / 2;
    watchFace(c, fx, fy, fw, fh);
    txt(c, '06:30', cx, fy + 32, B24, '#FFFFFF', 'center');
    txt(c, '밤사이 컨디션 리포트', cx, fy + 56, F12, '#7F8B9E', 'center');
    const rows = [['수면', '7시간 12분', '#4FD1FF'], ['심박', '62 bpm', '#FF6B81'], ['체온', '36.5℃', '#45F08A'], ['피로도', '낮음', '#45F08A']];
    rows.forEach((r, k) => {
      if (u < 0.3 + k * 0.25) return;
      const ry = fy + 86 + k * 30;
      rect(c, fx + 18, ry - 4, 8, 8, r[2]); txt(c, r[0], fx + 32, ry, F12, '#9AA6B8'); txt(c, r[1], fx + fw - 18, ry, B12, '#FFFFFF', 'right');
      if (k === 1) for (let i = 0; i < 16; i++) rect(c, fx + 74 + i * 3, ry + ecg(i * 2 + Math.floor(u * 30)) * 0.5 - 1, 2, 2, '#FF6B81');
      if (k === 0) bar(c, fx + 74, ry - 2, 48, 4, 0.9, '#4FD1FF');
    });
    if (u > 1.4) { const t = '컨디션 양호 · 훈련 가능', cw = tw(c, t, B12) + 20; rect(c, cx - cw / 2, fy + fh - 42, cw, 24, '#1F4A2E'); txt(c, t, cx, fy + fh - 29, B12, '#7CFFB2', 'center'); }
  } },
  watchPark: { h: 320, hex: '#FF4F6E', title: 'AI 아미 워치', sub: '박 상병 · 2생활관', draw(c, x, y, w, h, u, { T }) {
    const fx = x + 64, fy = y + 50, fw = w - 128, fh = 244, cx = fx + fw / 2;
    watchFace(c, fx, fy, fw, fh);
    txt(c, '06:31', cx, fy + 28, B12, '#9AA6B8', 'center');
    txt(c, '37.8℃', cx - 18, fy + 60, B24, Math.floor(T * 3) % 2 ? '#FF6B81' : '#FF8FA3', 'center');
    chip(c, '미열', cx + 46, fy + 50, '#5A1E2A', '#FFD6DC');
    rect(c, fx + 14, fy + 88, fw - 28, 38, '#FF4F6E'); rect(c, fx + 16, fy + 90, fw - 32, 34, '#3A1018');
    txt(c, '의무실 진료를 권장합니다', cx, fy + 107, B12, '#FFD6DC', 'center');
    const bx = fx + 22, by = fy + 140, bw = fw - 44, bh = 36;
    if (u < 1.0) { rect(c, bx, by, bw, bh, '#29BDFD'); txt(c, '진료 예약', cx, by + bh / 2 + 1, B12, '#05202B', 'center'); if (Math.floor(T * 3) % 2) { rect(c, bx - 3, by - 3, bw + 6, 2, '#7FE3FF'); rect(c, bx - 3, by + bh + 1, bw + 6, 2, '#7FE3FF'); } }
    else if (u < 1.25) { rect(c, bx, by, bw, bh, '#1E7FA0'); txt(c, '진료 예약', cx, by + bh / 2 + 1, B12, '#CFF3FF', 'center'); }
    else if (u < 2.2) { rect(c, bx, by, bw, bh, '#1B2A3A'); txt(c, '군의관 연결 중' + '...'.slice(0, 1 + Math.floor(T * 4) % 3), cx, by + bh / 2 + 1, B12, '#7FE3FF', 'center'); }
    else { rect(c, bx, by, bw, bh, '#45F08A'); rect(c, bx + 2, by + 2, bw - 4, bh - 4, '#1F4A2E'); txt(c, '진료 예약 완료 · 10:20', cx, by + bh / 2 + 1, B12, '#7CFFB2', 'center'); }
    if (u >= 0.9 && u < 1.5) { const k = (u - 0.9) / 0.6, e = 2 + k * 14, A = c.globalAlpha; c.globalAlpha = A * Math.max(0, 1 - k); c.strokeStyle = '#FFFFFF'; c.lineWidth = 2; c.strokeRect(bx - e, by - e, bw + e * 2, bh + e * 2); c.globalAlpha = A; }
    txt(c, u < 2.2 ? '의무지원 AI 연동' : '의무지원 AI · 군의관 연결 완료', cx, fy + 198, F12, u < 2.2 ? '#7F8B9E' : '#7CFFB2', 'center');
  } },
  program: { h: 300, hex: '#A98BFF', title: 'AI 맞춤 운동 프로그램', sub: '김 일병 · 인사생활 AI', draw(c, x, y, w, h, u) {
    const rows = [['러닝머신', '인터벌 20분 · 목표 심박 150', '#4FD1FF'], ['실내 사이클', '지구력 15분 · 케이던스 80', '#45F08A'], ['근력 운동', '하체 3세트 · 스쿼트', '#FFC247']];
    rows.forEach((r, k) => {
      if (u < 0.15 + k * 0.2) return;
      const ry = y + 44 + k * 46;
      rect(c, x + 14, ry, 28, 28, r[2]); rect(c, x + 18, ry + 4, 20, 20, '#0B111A'); rect(c, x + 22, ry + 12, 12, 4, r[2]);
      txt(c, r[0], x + 54, ry + 8, B12, '#FFFFFF'); txt(c, r[1], x + 54, ry + 24, F12, '#9AA6B8');
      chip(c, k === 0 ? '진행 중' : '예정', x + w - 14, ry + 2, k === 0 ? '#123A4A' : '#1A2030', k === 0 ? '#7FE3FF' : '#7F8B9E', true);
      if (k === 0) bar(c, x + 54, ry + 36, w - 68, 4, 0.35 + u / 8, '#4FD1FF');
    });
    const gy = y + 190, gw = w - 28;
    rect(c, x + 14, gy, gw, 64, '#08101A');
    for (let i = 0; i < gw / 3 - 1; i++) rect(c, x + 16 + i * 3, gy + 34 + ecg(i - Math.floor(u * 22)) * 1.4, 2, 2, '#FF6B81');
    rect(c, x + w - 110, gy + 6, 90, 52, 'rgba(8,16,26,0.85)');
    txt(c, String(146 + Math.round(2 * Math.sin(u * 3))), x + w - 62, gy + 30, B24, '#FFFFFF', 'right'); txt(c, 'bpm', x + w - 24, gy + 33, F12, '#9AA6B8', 'right');
    txt(c, '심박', x + w - 104, gy + 48, F12, '#FF8FA3');
    txt(c, '워치 연동 기구 6대 · 트레이너 실시간 확인', x + 14, y + h - 22, F12, '#9AA6B8');
  } },
  fitApp: { h: 262, hex: '#A98BFF', title: '건강관리 앱', sub: '인사참모 AI', draw(c, x, y, w, h, u) {
    const cx = x + 58, cy = y + 106;
    rect(c, cx - 22, y + 44, 16, 34, '#3C7BB8'); rect(c, cx + 6, y + 44, 16, 34, '#D33A3A');
    pdisc(c, cx, cy, 30, '#8A6A10'); pdisc(c, cx, cy, 28, '#C9A93A'); pdisc(c, cx, cy, 22, '#FFD86A');
    txt(c, '1', cx, cy + 2, B24, '#5A3F00', 'center');
    if (Math.floor(u * 4) % 2) { rect(c, cx + 18, cy - 26, 4, 4, '#FFFFFF'); rect(c, cx - 24, cy + 14, 4, 4, '#FFF2C0'); }
    txt(c, '체력 등급', x + 110, y + 64, F12, '#C9D2DF');
    txt(c, '1단계 달성', x + 110, y + 92, B24, '#FFC247');
    txt(c, '김 일병님, 축하합니다!', x + 110, y + 120, F12, '#FFFFFF');
    rect(c, x + 14, y + 152, w - 28, 2, '#1E2838');
    txt(c, '주간 운동 목표', x + 14, y + 176, F12, '#9AA6B8'); bar(c, x + 120, y + 172, w - 190, 8, Math.min(1, u / 0.8), '#45F08A'); txt(c, '100%', x + w - 14, y + 176, B12, '#7CFFB2', 'right');
    check(c, x + 14, y + 198, u >= 0.8); txt(c, 'AI 등급 산정 · 인사 기록 자동 반영', x + 40, y + 206, B12, u >= 0.8 ? '#FFFFFF' : '#5E6878');
    txt(c, '인사참모 AI → 통합관제 · 인사 기록', x + 14, y + h - 20, F12, '#7F8B9E');
    if (u < 2.6) { const A = c.globalAlpha, cols = ['#FFC247', '#4FD1FF', '#FF6B81', '#45F08A', '#A98BFF']; for (let k = 0; k < 22; k++) { const px = x + 8 + ((k * 53) % (w - 16)), py = y + 34 + ((u * 70 + k * 37) % 130); c.globalAlpha = A * Math.max(0, 1 - u / 2.6); rect(c, px, py, 4, 4, cols[k % 5]); } c.globalAlpha = A; }
  } },
  order: { h: 270, hex: '#EB56C5', title: '밀리테리아 · 스마트 주문', sub: '급양관리 AI', draw(c, x, y, w, h, u) {
    const ix = x + 14, iy = y + 42;
    rect(c, ix, iy, 40, 50, '#1A2030'); rect(c, ix + 10, iy + 10, 20, 32, '#4A5562'); rect(c, ix + 12, iy + 12, 16, 28, '#DCEFF7'); rect(c, ix + 12, iy + 22, 16, 18, '#EDE3D2'); rect(c, ix + 12, iy + 22, 16, 5, '#9A6A44');
    rect(c, ix + 14, iy + 14, 4, 4, '#FFFFFF'); rect(c, ix + 22, iy + 16, 4, 4, '#E8F7FF'); rect(c, ix + 22, iy + 2, 2, 12, '#2E7D4A');
    txt(c, '아이스 카페라테', x + 66, y + 58, B24, '#FFFFFF'); txt(c, '1잔 · 테이크아웃 · 김 일병', x + 66, y + 84, F12, '#9AA6B8');
    const st = u < 0.6 ? 0 : (u < 3.6 ? 1 : 2), labels = ['주문 접수', '로봇 제조', u >= 3.9 ? '픽업 완료' : '픽업 대기'];
    let cx = x + 14;
    labels.forEach((l, k) => { const done = k < st || (k === 2 && u >= 3.9), act = k === st && !done; cx += chip(c, l, cx, y + 106, act ? '#EB56C5' : (done ? '#3A2A38' : '#1A2030'), act ? '#2A0820' : (done ? '#F2C6E6' : '#5E6878')) + 6; });
    bar(c, x + 14, y + 134, w - 28, 4, u / 3.9, '#EB56C5');
    rect(c, x + 14, y + 150, w - 28, 2, '#1E2838');
    [['오늘의 메뉴', '따뜻한 샌드위치 · 갓 구움'], ['조식 인원', '412명 · 잔반 예측 4%'], ['급양팀장', '바리스타 로봇 · 재고 자동 연동']].forEach((r, k) => {
      const ry = y + 174 + k * 30; txt(c, r[0], x + 14, ry, F12, '#9AA6B8'); txt(c, r[1], x + 104, ry, B12, '#FFFFFF');
    });
    chip(c, '잔여 36', x + w - 14, y + 164, '#3A2A38', '#F2C6E6', true);
  } },
  access: { h: 334, hex: '#29BDFD', title: '무인 출입 시스템', sub: '정문 · 출입관제 AI', draw(c, x, y, w, h, u, { map, T }) {
    const px = x + 14, py = y + 44, done = u >= 3.0;
    frame(c, px, py, 108, 108, '#1C2B40', done ? '#45F08A' : '#29BDFD');
    const spr = map.sprite('officer', 'n3', 'down', 0); c.imageSmoothingEnabled = false; c.drawImage(spr, 0, 0, 32, 32, px + 6, py + 6, 96, 96);
    if (!done) { rect(c, px, py + ((u * 1.2) % 1) * 106, 108, 2, '#7FE3FF'); const A = c.globalAlpha; c.globalAlpha = 0.15 * A; rect(c, px, py, 108, 108, '#29BDFD'); c.globalAlpha = A; }
    const bc = done ? '#45F08A' : '#7FE3FF';
    [[px + 4, py + 4, 1, 1], [px + 104, py + 4, -1, 1], [px + 4, py + 104, 1, -1], [px + 104, py + 104, -1, -1]].forEach((b) => { rect(c, b[2] > 0 ? b[0] : b[0] - 14, b[3] > 0 ? b[1] : b[1] - 2, 14, 2, bc); rect(c, b[2] > 0 ? b[0] : b[0] - 2, b[3] > 0 ? b[1] : b[1] - 14, 2, 14, bc); });
    txt(c, '송 상사', x + 138, y + 60, B24, '#FFFFFF'); txt(c, '간부 · 08:20 출근', x + 138, y + 86, F12, '#9AA6B8');
    if (!done) { txt(c, String(Math.max(1, 3 - Math.floor(u))), x + w - 40, y + 70, B48, '#29BDFD', 'center'); txt(c, '초', x + w - 40, y + 104, F12, '#7FE3FF', 'center'); }
    else { const qx = x + w - 66, qy = y + 46; rect(c, qx, qy, 52, 52, '#45F08A'); [[6, 24], [12, 30], [18, 36], [24, 30], [30, 24], [36, 18], [42, 12]].forEach((q) => rect(c, qx + q[0], qy + q[1], 8, 8, '#06200F')); }
    bar(c, x + 138, y + 124, w - 152, 8, u / 3.0, done ? '#45F08A' : '#29BDFD');
    [['안면 인식', '99.2% 일치', 1.0], ['홍채 스캔', '일치', 2.0], ['출입 권한', '간부 · 승인', 2.8]].forEach((r, k) => {
      const ry = y + 170 + k * 32, ok = u >= r[2];
      check(c, x + 14, ry - 8, ok); txt(c, r[0], x + 40, ry, B12, ok ? '#FFFFFF' : '#C9D2DF');
      txt(c, ok ? r[1] : '확인 중' + '...'.slice(0, 1 + Math.floor(T * 4) % 3), x + w - 14, ry, ok ? B12 : F12, ok ? '#7CFFB2' : '#7F8B9E', 'right');
    });
    if (done) { rect(c, x + 14, y + 262, w - 28, 32, '#45F08A'); rect(c, x + 16, y + 264, w - 32, 28, '#1F4A2E'); txt(c, '출입 승인 · 출입문 열림', x + w / 2, y + 279, B12, '#7CFFB2', 'center'); }
    else txt(c, '3초 안면·홍채 인증', x + 14, y + 279, F12, '#7F8B9E');
    if (u >= 3.4) txt(c, '아미 NO.7 · 오늘 생일자 확인', x + 14, y + 314, F12, '#FFC247');
  } },
  diag: { h: 318, hex: '#9DCA1C', title: '정비수송 AI · 실시간 진단', sub: '정찰로봇 RQ-03', draw(c, x, y, w, h, u, { T }) {
    txt(c, '다족 보행 정찰로봇 · 보행 시험', x + 14, y + 48, B12, '#FFFFFF');
    const bad = u >= 0.6;
    [['좌전방', 'LF'], ['우전방', 'RF'], ['좌후방', 'LH'], ['우후방', 'RH']].forEach((r, k) => {
      const ry = y + 82 + k * 44, hot = bad && k === 2, amp = 4 + (hot ? Math.min(10, (u - 0.6) * 14) : 0);
      txt(c, r[0], x + 14, ry - 6, B12, hot ? '#FF8FA3' : '#E8EDF5'); txt(c, r[1], x + 14, ry + 10, F12, '#7F8B9E');
      const bx = x + 74, bw = 196; rect(c, bx, ry - 16, bw, 32, '#08101A'); rect(c, bx, ry, bw, 1, '#1E2838');
      for (let i = 0; i < bw / 2 - 1; i++) {
        let v = Math.sin(i * 0.7 + u * 14 + k) * amp * 0.6 + Math.sin(i * 1.9 + u * 9 + k * 2) * amp * 0.4;
        if (hot && (i + Math.floor(u * 20)) % 17 === 0) v = (i % 2 ? 1 : -1) * 14;
        rect(c, bx + 1 + i * 2, ry + Math.max(-15, Math.min(14, v)), 2, 2, hot ? '#FF4D4D' : '#45F08A');
      }
      txt(c, hot ? '1.9g' : '0.7g', x + w - 14, ry - 6, B12, hot ? '#FF8FA3' : '#FFFFFF', 'right');
      txt(c, hot ? '+38%' : '정상', x + w - 14, ry + 10, F12, hot ? '#FF4D4D' : '#7CFFB2', 'right');
    });
    if (u >= 1.0) {
      const on = Math.floor(T * 3) % 2;
      rect(c, x + 14, y + 256, w - 28, 48, on ? '#FF4F6E' : '#8A2A3A'); rect(c, x + 16, y + 258, w - 32, 44, '#3A1018');
      txt(c, '이상 징후 감지 · 좌후방 무릎 관절', x + 26, y + 270, B12, '#FFD6DC');
      txt(c, '정비 인원 확인 전 AI가 먼저 감지', x + 26, y + 289, F12, '#FF8FA3');
    }
  } },
  predict: { h: 290, hex: '#9DCA1C', title: '고장 예측 · 자동 조치', sub: '정비수송 AI', draw(c, x, y, w, h, u) {
    txt(c, '예측 부품', x + 14, y + 50, F12, '#9AA6B8'); txt(c, '무릎 관절 감속기 (좌후방)', x + 100, y + 50, B12, '#FFFFFF');
    txt(c, '고장 예측', x + 14, y + 82, F12, '#9AA6B8'); txt(c, '72시간 이내', x + 100, y + 82, B24, '#FF8FA3');
    txt(c, '잔여 수명', x + 14, y + 112, F12, '#9AA6B8'); bar(c, x + 100, y + 108, w - 160, 8, 0.18, '#FF4D4D'); txt(c, '18%', x + w - 14, y + 112, B12, '#FF8FA3', 'right');
    rect(c, x + 14, y + 132, w - 28, 2, '#1E2838');
    [['교체 부품 자동 발주', '발주 완료', 0.5], ['민간 기술지원팀 배정', '윤 책임', 1.1], ['정비 작업 등록', '즉시 착수', 1.7]].forEach((r, k) => {
      const ry = y + 160 + k * 40, ok = u >= r[2];
      check(c, x + 14, ry - 8, ok); txt(c, r[0], x + 40, ry, B12, ok ? '#FFFFFF' : '#5E6878');
      chip(c, ok ? r[1] : '처리 중', x + w - 14, ry - 10, ok ? '#2E3A10' : '#1A2030', ok ? '#D6F28A' : '#5E6878', true);
    });
  } },
  update: { h: 240, hex: '#9DCA1C', title: '보행 제어 알고리즘', sub: 'v4.1 → v4.2', draw(c, x, y, w, h, u) {
    check(c, x + 14, y + 42, true); txt(c, '감속기 모듈 교체 완료', x + 40, y + 50, B12, '#FFFFFF');
    const k = clamp01((u - 0.3) / 1.6);
    txt(c, '알고리즘 업데이트', x + 14, y + 86, B12, '#FFFFFF'); txt(c, Math.round(k * 100) + '%', x + w - 14, y + 86, B12, k < 1 ? '#D6F28A' : '#7CFFB2', 'right');
    bar(c, x + 14, y + 100, w - 28, 10, k, k < 1 ? '#9DCA1C' : '#45F08A');
    txt(c, '보행 제어 v4.1 → v4.2 · 민간 전문가 원격 배포', x + 14, y + 128, F12, '#9AA6B8');
    check(c, x + 14, y + 154, u >= 2.0); txt(c, '보행 시험 · 진동 0.7g 정상', x + 40, y + 162, B12, u >= 2.0 ? '#FFFFFF' : '#5E6878');
    check(c, x + 14, y + 186, u >= 2.3); txt(c, '민간 기술지원팀 검증 완료', x + 40, y + 194, B12, u >= 2.3 ? '#FFFFFF' : '#5E6878');
  } },
  approve: { h: 344, hex: '#9DCA1C', title: '정비 결과 승인', sub: '이 주무관 · 태블릿', draw(c, x, y, w, h, u, { T }) {
    rect(c, x + 10, y + 40, w - 20, h - 50, '#1D222A'); rect(c, x + 10, y + 40, w - 20, 2, '#3A414B');
    const sx = x + 20, sy = y + 50, sw = w - 40;
    rect(c, sx, sy, sw, h - 70, '#0B111A');
    txt(c, '다족 보행 정찰로봇 RQ-03', sx + 12, sy + 18, B12, '#FFFFFF'); txt(c, '대대 정비센터 · 운용 준비 점검', sx + 12, sy + 36, F12, '#9AA6B8');
    [['부품 교체', '민간 기술지원팀'], ['알고리즘 업데이트', 'v4.2'], ['보행 시험', '진동 정상']].forEach((r, k) => {
      const ry = sy + 66 + k * 30, ok = u >= 0.15 + k * 0.15;
      check(c, sx + 12, ry - 8, ok); txt(c, r[0], sx + 36, ry, B12, '#FFFFFF'); txt(c, r[1], sx + sw - 12, ry, F12, '#9AA6B8', 'right');
    });
    const bx = sx + 12, by = sy + 164, bw = sw - 24, bh = 48;
    if (u < 1.3) { rect(c, bx, by, bw, bh, '#FFC247'); txt(c, '운용 준비 상태 최종 승인', bx + bw / 2, by + bh / 2 + 1, B12, '#2A1C00', 'center'); if (Math.floor(T * 3) % 2) { rect(c, bx - 3, by - 3, bw + 6, 2, '#FFE08A'); rect(c, bx - 3, by + bh + 1, bw + 6, 2, '#FFE08A'); } }
    else if (u < 1.5) { rect(c, bx, by, bw, bh, '#C9952E'); txt(c, '운용 준비 상태 최종 승인', bx + bw / 2, by + bh / 2 + 1, B12, '#2A1C00', 'center'); }
    else {
      const k = easeOut((u - 1.5) / 0.25), ex = (1 - k) * 10;
      rect(c, bx - ex, by - 8 - ex, bw + ex * 2, bh + 16 + ex * 2, '#45F08A'); rect(c, bx + 3 - ex, by - 5 - ex, bw - 6 + ex * 2, bh + 10 + ex * 2, '#0B111A');
      rect(c, bx + 6, by - 2, bw - 12, bh + 4, '#45F08A'); rect(c, bx + 8, by, bw - 16, bh, '#12301C');
      txt(c, '승인 완료', bx + bw / 2, by + 18, B24, '#7CFFB2', 'center'); txt(c, '운용 준비 상태 · 준비 완료', bx + bw / 2, by + 38, F12, '#C9F5D8', 'center');
    }
    if (u >= 1.2 && u < 1.8) { const k = (u - 1.2) / 0.6, e = 4 + k * 16, A = c.globalAlpha; c.globalAlpha = A * Math.max(0, 1 - k); c.strokeStyle = '#FFFFFF'; c.lineWidth = 2; c.strokeRect(bx - e, by - e, bw + e * 2, bh + e * 2); c.globalAlpha = A; }
    txt(c, u >= 1.5 ? '이 주무관 전자 서명 · 10:42' : '정비담당관 확인 대기', sx + 12, sy + h - 92, F12, u >= 1.5 ? '#7CFFB2' : '#7F8B9E');
  } },
  drone: { h: 268, hex: '#FFAF00', title: '드론 편대 정찰', sub: '훈련관리 AI', draw(c, x, y, w, h, u, { S }) {
    const du = S.fx.drones ? (S.T - S.fx.drones.t0) * (S.fx.drones.rate || 1) : u;
    txt(c, '임무 · 다음 주 훈련 지형·장애물 정찰', x + 14, y + 50, B12, '#FFFFFF');
    [98, 96, 97, 95].forEach((b, k) => {
      const ry = y + 86 + k * 34, st = du < 0.8 + k * 0.2 ? 0 : (du < 1.8 ? 1 : 2);
      txt(c, '편대 ' + (k + 1), x + 14, ry, B12, '#E8EDF5');
      rect(c, x + 80, ry - 5, 74, 10, '#1A2030'); rect(c, x + 82, ry - 3, 70 * b / 100, 6, '#45F08A'); rect(c, x + 154, ry - 3, 3, 6, '#3A4356');
      txt(c, b + '%', x + 164, ry, F12, '#9AA6B8');
      chip(c, ['대기', '이륙', '정찰 비행'][st], x + w - 14, ry - 10, ['#1A2030', '#3A2A10', '#123A4A'][st], ['#7F8B9E', '#FFC247', '#7FE3FF'][st], true);
    });
    txt(c, '정찰 영상 실시간 분석 → 훈련 계획 반영', x + 14, y + h - 22, F12, '#9AA6B8');
  } },
  cmd: { h: 286, hex: '#7FE3FF', title: '일체형 개인 전투체계', sub: '훈련 계획 수신', draw(c, x, y, w, h, u, { S, T }) {
    txt(c, '다음 주 훈련 계획 · B안', x + 14, y + 50, B12, '#FFFFFF'); txt(c, '대대장 결심 · 디지털 트윈 성과 향상 91%', x + 14, y + 70, F12, '#9AA6B8');
    const n = S.outDone || 0;
    [['강 대위 · 1중대장', 'TIGER 보완 훈련 · 엄폐·노출'], ['2중대장', '야외 전술훈련 · 화·목'], ['3중대장', '체력·야간 사격 · 수·금']].forEach((r, k) => {
      const ry = y + 104 + k * 44, ok = n > k;
      rect(c, x + 14, ry - 12, 24, 24, ok ? '#7FE3FF' : '#1A2030'); rect(c, x + 18, ry - 8, 16, 16, '#0B111A'); rect(c, x + 22, ry - 4, 8, 8, ok ? '#7FE3FF' : '#3A4356');
      txt(c, r[0], x + 48, ry - 6, B12, '#FFFFFF'); txt(c, r[1], x + 48, ry + 10, F12, '#9AA6B8');
      chip(c, ok ? '훈련 계획 수신' : '전송 중', x + w - 14, ry - 10, ok ? '#1F4A2E' : '#3A2A10', ok ? '#7CFFB2' : (Math.floor(T * 4) % 2 ? '#FFC247' : '#9A7A2A'), true);
    });
    txt(c, '3개 중대 수신 ' + Math.min(3, n) + '/3', x + 14, y + h - 24, B12, n >= 3 ? '#7CFFB2' : '#7FE3FF');
  } }
};

// ---------------------------------------------------------------- 핵심 장면 표지 (훈련 성과 분석 회의)
function drawChapter(c, S, T) {
  const k = S.chapter; if (!k) return;
  const u = T - k.t0; if (u < 0 || u > k.dur) return;
  const a = Math.max(0, Math.min(1, u / 0.35, (k.dur - u) / 0.45)), grow = easeOut(u / 0.5);
  c.globalAlpha = a;
  const w = Math.round(520 + 260 * grow), x = 602 - w / 2, y = 300;
  rect(c, x, y, w, 124, 'rgba(8,10,16,0.88)');
  rect(c, x, y, w, 3, '#FFC247'); rect(c, x, y + 121, w, 3, '#FFC247');
  rect(c, x - 6, y + 58, 6, 8, '#FFC247'); rect(c, x + w, y + 58, 6, 8, '#FFC247');
  txt(c, k.l1, 602, y + 46, B48, '#FFC247', 'center');
  txt(c, k.l2, 602, y + 94, F24, '#E8EDF5', 'center');
  c.globalAlpha = 1;
}

// ---------------------------------------------------------------- 시연 2판 팝업 (체력단련실 AI · 훈련 성과 분석 회의)
function tablet(c, x, y, w, h) { rect(c, x + 10, y + 40, w - 20, h - 50, '#1D222A'); rect(c, x + 10, y + 40, w - 20, 2, '#3A414B'); rect(c, x + 20, y + 50, w - 40, h - 70, '#0B111A'); }
function stamp(c, s, cx, cy, col, k) {
  const e = (1 - easeOut(k)) * 10, tw0 = tw(c, s, B24) + 36;
  rect(c, cx - tw0 / 2 - e, cy - 22 - e, tw0 + e * 2, 44 + e * 2, col); rect(c, cx - tw0 / 2 + 3 - e, cy - 19 - e, tw0 - 6 + e * 2, 38 + e * 2, '#0B111A');
  txt(c, s, cx, cy + 1, B24, col, 'center');
}
Object.assign(POPS, {
  gymAI: { h: 318, hex: '#A98BFF', title: '인사참모 AI · 맞춤 운동 자동 설정', sub: '워치 데이터', draw(c, x, y, w, h, u, { S }) {
    txt(c, '밤사이 수면·피로도 분석 → 기구별 프로그램 자동 설정', x + 14, y + 48, F12, '#C9D2DF');
    [['김 일병', '수면 7시간 12분 · 피로 낮음', '인터벌 러닝', '#123A4A', '#7FE3FF'], ['정 일병', '수면 5시간 40분 · 피로 높음', '저강도 러닝', '#3A2A10', '#FFC247'], ['이 상병', '수면 6시간 50분 · 피로 보통', '지구력 사이클', '#1F4A2E', '#7CFFB2']].forEach((r, k) => {
      if (u < 0.4 + k * 0.25) return;
      const ry = y + 78 + k * 44;
      txt(c, r[0], x + 14, ry - 6, B12, '#FFFFFF'); txt(c, r[1], x + 14, ry + 11, F12, '#9AA6B8');
      chip(c, r[2], x + w - 14, ry - 10, r[3], r[4], true);
    });
    const fu = S.fx.gymAI ? (S.T - S.fx.gymAI.t0) : u, v = gymVitals(fu), gy = y + 214, gw = w - 28;
    rect(c, x + 14, gy, gw, 60, '#08101A');
    for (let i = 0; i < gw / 3 - 40; i++) rect(c, x + 16 + i * 3, gy + 32 + ecg(i - Math.floor(fu * 22)) * 1.2, 2, 2, '#FF6B81');
    txt(c, '김 일병 심박 ' + v.hr, x + w - 22, gy + 18, B12, '#FFFFFF', 'right');
    txt(c, '속도 자동 ' + v.spd.toFixed(1) + 'km/h', x + w - 22, gy + 40, B12, '#7FE3FF', 'right');
    txt(c, 'AI가 분석하고 · 트레이너가 지도합니다', x + 14, y + h - 22, F12, '#C9A8FF');
  } },
  insight: { h: 300, hex: '#FFC247', title: '트레이너 태블릿', sub: '인사참모 AI 알림', draw(c, x, y, w, h, u, { T }) {
    tablet(c, x, y, w, h);
    const sx = x + 20, sw = w - 40, on = Math.floor(T * 3) % 2;
    rect(c, sx + 10, y + 62, sw - 20, 58, on ? '#FFC247' : '#9A7A2A'); rect(c, sx + 12, y + 64, sw - 24, 54, '#2A1C00');
    txt(c, '정 일병 · 무릎 부하 높음', sx + 22, y + 80, B12, '#FFE08A'); txt(c, '착지 충격 1.8배 · 피로도 높음', sx + 22, y + 102, F12, '#E8D9A8');
    txt(c, '→ 사이클 저강도 20분 전환 권고', sx + 12, y + 142, B12, '#7FE3FF');
    const bx = sx + 12, by = y + 164, bw = sw - 24, bh = 40;
    if (u < 1.0) { rect(c, bx, by, bw, bh, '#29BDFD'); txt(c, '권고 적용', bx + bw / 2, by + bh / 2 + 1, B12, '#05202B', 'center'); }
    else { rect(c, bx, by, bw, bh, '#45F08A'); rect(c, bx + 2, by + 2, bw - 4, bh - 4, '#1F4A2E'); txt(c, '적용 완료 · 트레이너 확인', bx + bw / 2, by + bh / 2 + 1, B12, '#7CFFB2', 'center'); }
    if (u >= 0.85 && u < 1.4) { const k = (u - 0.85) / 0.55, e = 2 + k * 12, A = c.globalAlpha; c.globalAlpha = A * Math.max(0, 1 - k); c.strokeStyle = '#FFFFFF'; c.lineWidth = 2; c.strokeRect(bx - e, by - e, bw + e * 2, bh + e * 2); c.globalAlpha = A; }
    txt(c, 'AI는 분석 · 코칭은 트레이너', sx + 12, y + 228, B12, '#FFC247');
  } },
  brief: { h: 300, hex: '#7FE3FF', title: 'AI 참모 · 훈련 성과 분석', sub: '통합관제 에이전트', draw(c, x, y, w, h, u) {
    txt(c, '분석 자료', x + 14, y + 48, F12, '#9AA6B8');
    [['지난주 TIGER 합성훈련 결과', '3개 중대', 0.3], ['드론 훈련 영상 · 분대 기동', '12건', 0.7], ['체력·건강 데이터 (워치)', '412명', 1.1], ['다음 주 기상·장비 일정', '연동', 1.5]].forEach((r, k) => {
      const ry = y + 74 + k * 30, ok = u >= r[2];
      check(c, x + 14, ry - 8, ok); txt(c, r[0], x + 40, ry, B12, ok ? '#FFFFFF' : '#5E6878');
      if (ok) chip(c, r[1], x + w - 14, ry - 10, '#123A4A', '#7FE3FF', true);
    });
    const k = clamp01((u - 0.5) / 2.2);
    txt(c, '훈련 데이터 1,284건 분석', x + 14, y + 204, F12, '#C9D2DF'); txt(c, Math.round(k * 100) + '%', x + w - 14, y + 204, B12, '#7FE3FF', 'right');
    bar(c, x + 14, y + 216, w - 28, 8, k, k < 1 ? '#7FE3FF' : '#45F08A');
    if (k >= 1) { rect(c, x + 14, y + 238, w - 28, 40, '#45F08A'); rect(c, x + 16, y + 240, w - 32, 36, '#12301C'); txt(c, '보완 과제 도출 · 훈련 계획 3안', x + w / 2, y + 258, B12, '#7CFFB2', 'center'); }
  } },
  coa: { h: 324, hex: '#7FE3FF', title: '다음 주 훈련 계획 비교', sub: 'AI 참모 권고 · 예상 성과 향상', draw(c, x, y, w, h, u) {
    [['A', '야외 전술훈련 집중', 62, '기상 영향 큼 · 부상 위험'], ['B', 'TIGER 반복 + 야외 병행', 91, '1중대 엄폐·노출 집중 보완'], ['C', '야간 훈련 확대', 74, '피로도 증가 · 일정 부담']].forEach((r, k) => {
      if (u < 0.15 + k * 0.3) return;
      const ry = y + 42 + k * 82, b = r[0] === 'B', fill = clamp01((u - 0.15 - k * 0.3) / 0.6);
      rect(c, x + 12, ry, w - 24, 74, b ? '#C9A93A' : '#1E2838'); rect(c, x + 14, ry + 2, w - 28, 70, b ? '#1E1808' : '#0E1420');
      rect(c, x + 22, ry + 12, 40, 40, b ? '#FFC247' : '#3A4356'); txt(c, r[0] + '안', x + 42, ry + 33, B12, b ? '#2A1C00' : '#FFFFFF', 'center');
      txt(c, r[1], x + 74, ry + 20, B12, '#FFFFFF'); txt(c, Math.round(r[2] * fill) + '%', x + w - 26, ry + 24, B24, b ? '#7CFFB2' : '#C9D2DF', 'right');
      bar(c, x + 74, ry + 38, w - 170, 8, r[2] / 100 * fill, b ? '#45F08A' : '#7F8B9E');
      txt(c, r[3], x + 74, ry + 60, F12, b ? '#FFE08A' : '#9AA6B8');
      if (b && u > 1.2) chip(c, 'AI 추천', x + w - 26, ry + 48, '#FFC247', '#2A1C00', true);
    });
    txt(c, '결심은 지휘관이 합니다', x + 14, y + h - 20, F12, '#FFC247');
  } },
  twin: { h: 324, hex: '#45F08A', title: '디지털 트윈 일정 검증', sub: 'B안 · TIGER 반복 + 야외 병행', draw(c, x, y, w, h, u) {
    // 다음 주 요일 × 오전·오후 일정표가 B안으로 채워지고, 기상(수요일 비)·장비 일정과 겹치지 않는지 가상으로 돌려 본다
    const mx = x + 14, my = y + 42, mw = w - 28, cw = mw / 5, rh = 52;
    const days = ['월', '화', '수', '목', '금'], plan = [['야외', 'TIGER'], ['체력', 'TIGER'], ['TIGER', 'TIGER'], ['야외', '체력'], ['TIGER', '평가']];
    const col = { 야외: ['#1F4A2E', '#7CFFB2'], TIGER: ['#123A4A', '#7FE3FF'], 체력: ['#2A2252', '#C9A8FF'], 평가: ['#3A2A10', '#FFC247'] };
    days.forEach((d, i) => {
      const cx = mx + i * cw;
      txt(c, d, cx + cw / 2, my + 8, B12, i === 2 ? '#9FD3F2' : '#C9D2DF', 'center');
      plan[i].forEach((p, j) => {
        const k = clamp01((u - 0.1 - (i * 2 + j) * 0.09) / 0.25), cy = my + 20 + j * (rh + 4);
        rect(c, cx + 3, cy, cw - 6, rh, '#0E1420');
        if (k > 0) { const A = c.globalAlpha; c.globalAlpha = A * k; rect(c, cx + 3, cy, cw - 6, rh, col[p][0]); rect(c, cx + 3, cy, cw - 6, 3, col[p][1]); txt(c, p, cx + cw / 2, cy + rh / 2 + 2, B12, col[p][1], 'center'); c.globalAlpha = A; }
      });
    });
    if (u > 0.9) txt(c, '수요일 비 예보 → 전일 TIGER 실내', mx, my + 142, F12, '#9FD3F2');
    const k = clamp01((u - 0.3) / 1.6), n = Math.floor(k * 100);
    txt(c, '가상 일정 ' + n + '/100회', x + 14, y + 214, B12, '#FFFFFF');
    bar(c, x + 14, y + 226, w - 28, 8, k, k < 1 ? '#3FC4F2' : '#45F08A');
    if (k >= 1) { txt(c, '성과 향상 91%', x + 14, y + 262, B24, '#45F08A'); txt(c, '일정 충돌 0건', x + w - 14, y + 264, B12, '#C9F5D8', 'right'); }
    else txt(c, '검증 중', x + 14, y + 262, F12, '#9AB8D8');
    txt(c, 'AI 권고 → 지휘관 결심 대기', x + 14, y + h - 20, F12, '#FFC247');
  } },
  meal: { h: 318, hex: '#EB56C5', title: '급양관리 AI · 맞춤 식단', sub: '워치·체력·진료 데이터', draw(c, x, y, w, h, u) {
    // 다른 에이전트가 보낸 데이터 → 장병별 식단 추천 → 식수 예측으로 조리량 조정
    [['김 일병', '체력단련 1단계 · 520kcal 소모', '단백질 +20g', '#123A4A', '#7FE3FF', '인사생활'], ['박 상병', '미열 37.8℃ · 진료 예약', '죽 · 수분 보충', '#3A1830', '#FFB3C6', '의무지원'], ['1중대', '오전 체력단련 · 기온 31℃', '전해질 음료', '#1F4A2E', '#7CFFB2', '훈련관리']].forEach((r, k) => {
      if (u < 0.25 + k * 0.35) return;
      const ry = y + 58 + k * 50;
      txt(c, r[0], x + 14, ry - 8, B12, '#FFFFFF'); txt(c, r[1], x + 14, ry + 10, F12, '#9AA6B8');
      chip(c, r[2], x + w - 14, ry - 18, r[3], r[4], true); txt(c, r[5] + ' AI', x + w - 14, ry + 14, F12, '#6E7A8E', 'right');
    });
    const k = clamp01((u - 1.4) / 1.2), by = y + 214;
    rect(c, x + 14, by, w - 28, 62, '#1A0E1A');
    txt(c, '오늘 조식 식수 예측', x + 26, by + 16, F12, '#C9D2DF'); txt(c, Math.round(412 * k) + '명', x + w - 26, by + 16, B24, '#FFFFFF', 'right');
    bar(c, x + 26, by + 34, w - 52, 6, k, '#EB56C5');
    txt(c, k >= 1 ? '조리량 자동 조정 · 잔반 예측 4%' : '집계 중', x + 26, by + 50, F12, k >= 1 ? '#F2C6E6' : '#7F8B9E');
    txt(c, 'AI가 식단을 추천 · 급양팀장이 배식합니다', x + 14, y + h - 18, F12, '#EB56C5');
  } },
  perim: { h: 318, hex: '#29BDFD', title: '통합관제 AI · 주둔지 경계작전', sub: 'CCTV · 드론 · 로봇개', draw(c, x, y, w, h, u, { T }) {
    // 감지 → 자동 출동 → AI 판별 → 상황 종료: 사람은 결과만 확인한다
    const steps = [['CCTV 03 · 남서 울타리 외곽', '움직임 감지', 0.2, '#FF4F6E'], ['숲 정찰 드론 D-2', '자동 출동 · 열화상', 0.9, '#FFC247'], ['경계로봇 RQ-01 (4족 보행)', '현장 이동 · 확인', 1.3, '#29BDFD'], ['AI 영상 판별', '멧돼지 1마리 · 위협 아님', 2.2, '#45F08A'], ['상황 종료', '경계 태세 정상 · 순찰 복귀', 3.0, '#7CFFB2']];
    steps.forEach((r, k) => {
      const ry = y + 52 + k * 46, ok = u >= r[2], cur = ok && (k === steps.length - 1 || u < steps[k + 1][2]);
      if (k < steps.length - 1) rect(c, x + 25, ry + 12, 2, 34, ok && u >= steps[k + 1][2] ? r[3] : '#2A3242');
      rect(c, x + 16, ry - 10, 20, 20, ok ? r[3] : '#1A2030'); rect(c, x + 20, ry - 6, 12, 12, '#0B111A'); if (ok) rect(c, x + 23, ry - 3, 6, 6, cur && Math.floor(T * 4) % 2 ? '#FFFFFF' : r[3]);
      txt(c, r[0], x + 46, ry - 6, B12, ok ? '#FFFFFF' : '#5E6878'); txt(c, r[1], x + 46, ry + 11, F12, ok ? '#C9D2DF' : '#3E4858');
    });
    txt(c, '오경보 자동 판별 · 상황병은 결과 확인만', x + 14, y + h - 18, F12, '#7FE3FF');
  } },
  tiger: { h: 318, hex: '#29BDFD', title: '개인 전투체계 · TIGER 합성훈련', sub: '1중대장 강 대위', draw(c, x, y, w, h, u, { T }) {
    // 합성훈련 지형 위 분대 기동로와 분대원 6명 위치 (훈련장 스크린과 같은 그림)
    const mx = x + 14, my = y + 42, mw = w - 28, mh = 132;
    rect(c, mx, my, mw, mh, '#0E2436'); rect(c, mx, my, mw, 40, '#17375A');
    for (let k = 0; k < 4; k++) rect(c, mx + 12 + k * 78, my + 98 + (k % 2) * 6, 50, 2, '#2F5A3A');
    rect(c, mx, my + 70, mw, mh - 70, '#284D36'); rect(c, mx, my + 104, mw, mh - 104, '#335F3C');
    const hill = [mx + mw * 0.82, my + 30];
    rect(c, hill[0] - 34, hill[1] + 10, 68, 30, '#284D36'); rect(c, hill[0] - 18, hill[1], 36, 12, '#284D36');
    if (Math.floor(T * 3) % 2) { rect(c, hill[0] - 5, hill[1] - 5, 10, 10, '#05070A'); rect(c, hill[0] - 4, hill[1] - 4, 8, 8, '#FFC247'); }
    txt(c, '목표 지점', hill[0] - 10, hill[1] + 1, F12, '#FFE08A', 'right');
    const route = [[0.04, 0.92], [0.18, 0.86], [0.3, 0.68], [0.46, 0.58], [0.62, 0.44], [0.76, 0.3]].map((q) => [mx + mw * q[0], my + mh * q[1]]);
    for (let k = 0; k < 40; k++) { const q = along2(route, k / 40); if (k % 2) rect(c, q[0] - 1.5, q[1] - 1.5, 3, 3, '#FAC775'); }
    const prog = clamp01(0.45 + u / 7);
    for (let k = 0; k < 6; k++) { const q = along2(route, Math.max(0, prog - k * 0.04)); rect(c, q[0] - 5, q[1] - 5 + (k % 2) * 4, 10, 10, '#05070A'); rect(c, q[0] - 4, q[1] - 4 + (k % 2) * 4, 8, 8, '#3C7BB8'); rect(c, q[0] - 2, q[1] - 2 + (k % 2) * 4, 4, 4, '#9FD4FF'); }
    txt(c, '보완 과제 · 엄폐 간격·노출 시간', mx + 8, my + 14, B12, '#FFE08A');
    txt(c, '실시간 위치 6/6', mx + mw - 8, my + 14, F12, '#7FE3FF', 'right');
    const rows = [['명중률', '87%', 0.87, '#7F77DD'], ['노출 시간', '12초 단축', 0.6, '#5DCAA5'], ['심박·체온', '6명 정상', 1, '#45F08A']];
    rows.forEach((r, k) => {
      if (u < 0.3 + k * 0.35) return;
      const ry = y + 196 + k * 26;
      txt(c, r[0], x + 14, ry, F12, '#9AA6B8'); txt(c, r[1], x + w - 14, ry, B12, '#FFFFFF', 'right');
      bar(c, x + 92, ry - 3, w - 186, 6, r[2] * clamp01((u - 0.3 - k * 0.35) / 0.5), r[3]);
    });
    txt(c, '결과는 다음 훈련 성과 분석으로 · 훈련관리 AI', x + 14, y + h - 20, F12, '#7FE3FF');
  } },
  decide: { h: 270, hex: '#FFC247', title: '지휘관 결심', sub: 'AI는 권고 · 결심은 지휘관', draw(c, x, y, w, h, u) {
    txt(c, 'AI 참모 권고', x + 14, y + 52, F12, '#9AA6B8'); txt(c, 'B안 · TIGER 반복 + 야외 병행 (91%)', x + 120, y + 52, B12, '#FFFFFF');
    txt(c, '대대장 결심', x + 14, y + 86, F12, '#9AA6B8');
    if (u >= 0.5) { txt(c, 'B안 승인', x + 120, y + 86, B12, '#FFC247'); stamp(c, '결심 · B안', x + w / 2, y + 152, '#FFC247', (u - 0.5) / 0.3); }
    txt(c, '훈련 계획 → 각 중대 일체형 개인 전투체계', x + 14, y + h - 24, F12, '#C9D2DF');
  } }
});

// ---------------------------------------------------------------- ArmyGPT 문서 작성 (작전관 PC 화면)
// 화면은 ArmyGPT 로컬 v1 FE(a-gpt-FE-export-format)의 실제 캡처다(assets/armygpt/screen-01~06, 1280×735 화면을 1.1배로 찍음 — API 응답은
// 아래 문서를 만든 실제 데이터: 가상 대화·Gemma 31B 초안·군 서식 HWPX). 결과 문서는 같은 v1(문서 에이전트)로 실제 만든 군 서식 PDF 첫 쪽 그림이다.
const GPT_HEX = '#2C7EE3';
const img = (src) => (typeof Image === 'undefined' ? null : Object.assign(new Image(), { src }));
const ready = (im) => !!(im && im.complete && im.naturalWidth > 0);
const GPT_DOC = img('assets/armygpt/plan-p1.png');
const GPT_SCREENS = [1, 2, 3, 4, 5, 6].map((n) => img('assets/armygpt/screen-0' + n + '.jpg'));
const GPT_TITLE = 'TIGER 및 야외훈련 병행 1중대 보완훈련 계획';
// 캡처 순서와 시각(v초 — 화면이 다 커진 뒤부터), 마우스가 누르는 단추 가운데(캡처 화면 CSS px, 1280×735)와 누르는 시각
const SHOT_W = 1280, SHOT_H = 735;
const GPT_STEPS = [
  { at: 0.0, shot: 0, click: [839, 25, 0.6] },  // 대화 → '문서 초안 생성'
  { at: 0.7, shot: 1, click: [943, 451, 1.3] }, // 생성 창(추가 요청 입력) → '문서 초안 생성'
  { at: 1.4, shot: 2 },                         // 생성중
  { at: 1.9, shot: 3, click: [1036, 24, 2.7] }, // 초안이 문서 작업실(오른쪽 서랍)에 열림 → '다운로드' → 'HWPX 다운로드'
  { at: 2.8, shot: 4, click: [827, 566, 3.3] }, // HWPX 다운로드(군 서식, 부대 줄) → 'HWPX로 내보내기'
  { at: 3.4, shot: 5 }                          // 군 서식으로 다듬는 중
];
const GPT_PDF_AT = 3.9; // 이때부터 한글 PDF(3초 넘게 멈춰 보여 줌)
const fxT = (S, n) => (S.fx[n] ? (S.T - S.fx[n].t0) * (S.fx[n].rate || 1) : -1);
function docPage(c, x, y, w, h) { // 실제 PDF 쪽 (그림을 아직 못 읽었으면 빈 종이)
  rect(c, x, y, w, h, '#FFFFFF');
  if (ready(GPT_DOC)) { const s = c.imageSmoothingEnabled; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(GPT_DOC, x, y, w, h); c.imageSmoothingEnabled = s; }
  else for (let k = 0; k < 14; k++) rect(c, x + w * 0.1, y + h * (0.12 + k * 0.055), w * (k % 4 === 3 ? 0.5 : 0.8), 3, '#C9D2DF');
}
function emblemAt(c, cx, cy, s) { const e = emblemCanvas(), w = Math.round(e.width * s), h = Math.round(e.height * s); c.imageSmoothingEnabled = false; c.drawImage(e, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h); }
function drawGpt(map, c, S, T) { drawGptPc(map, c, S, T); }

// 인공지능센터 로고 + "ArmyGPT가 실제로 생성한 문서입니다" (cx = 가운데, y = 로고 위끝)
function gptCaption(c, cx, y, s) {
  const A = c.globalAlpha, eh = Math.round(46 * s);
  c.globalAlpha = A * 0.5; pdisc(c, cx, y + eh / 2, Math.round(eh * 0.62), '#0B2A5B'); c.globalAlpha = A;
  emblemAt(c, cx, y + eh / 2, s);
  txt(c, 'ArmyGPT가 실제로', cx, y + eh + 30, B24, '#FFFFFF', 'center');
  txt(c, '생성한 문서입니다', cx, y + eh + 62, B24, '#FFFFFF', 'center');
  rect(c, cx - 110, y + eh + 86, 220, 2, GPT_HEX);
  txt(c, '인공지능센터 ArmyGPT · 문서 에이전트', cx, y + eh + 106, F12, '#BFE0FF', 'center');
  txt(c, '군 서식 HWPX → 한글 PDF · 1쪽', cx, y + eh + 126, F12, '#9AA6B8', 'center');
}

// 작전관 PC 화면: 화면이 커지며 ArmyGPT 실제 화면(대화 → 문서 초안 생성 → 초안 → HWPX 내보내기·군 서식) → 한글 PDF → 대대장 결재
const PC = { x: 92, y: 76, w: 1020, h: 604 };
let pcScreen = null; // 화면 안쪽은 제 크기로 따로 그린 뒤 모니터 크기에 맞춰 옮긴다 (커지고 작아지는 동안에도 내용이 보이게)
function drawGptPc(map, c, S, T) {
  const f = S.fx.gptPc, u = fxT(S, 'gptPc');
  if (!f || u < 0 || u > f.dur) return;
  const e = S.actors.choi, p = e ? map.w2s(e.x, e.y - 20) : [602, 380];
  const g = u < 0.45 ? easeOut(u / 0.45) : (u > f.dur - 0.4 ? 1 - easeOut((u - f.dur + 0.4) / 0.4) : 1);
  const w = 44 + (PC.w - 44) * g, h = 30 + (PC.h - 30) * g, x = p[0] - 22 + (PC.x - p[0] + 22) * g, y = p[1] - 15 + (PC.y - p[1] + 15) * g;
  c.globalAlpha = 0.6 * g; rect(c, 0, 64, 1600, 836, '#05070A'); c.globalAlpha = 1;
  rect(c, x + 8, y + 8, w, h, 'rgba(0,0,0,0.4)'); rect(c, x, y, w, h, '#1B1F26'); rect(c, x, y, w, 2, '#3A414B');
  rect(c, x + w / 2 - 6, y + h - 10, 12, 3, '#45F08A');
  const SW = PC.w - 24, SH = PC.h - 32, k = Math.max(1, c.getTransform().a), W = Math.round(SW * k), H = Math.round(SH * k);
  if (!pcScreen) pcScreen = document.createElement('canvas');
  if (pcScreen.width !== W || pcScreen.height !== H) { pcScreen.width = W; pcScreen.height = H; }
  const g2 = pcScreen.getContext('2d');
  g2.setTransform(k, 0, 0, k, 0, 0); g2.clearRect(0, 0, SW, SH);
  gptScreen(g2, 0, 0, SW, SH, Math.max(0, u - 0.45), T);
  c.imageSmoothingEnabled = true; c.drawImage(pcScreen, x + 12, y + 12, w - 24, h - 32);
}
function gptScreen(c, x, y, w, h, v, T) {
  if (v >= GPT_PDF_AT) { gptPdf(c, x, y, w, h, v - GPT_PDF_AT, T); return; }
  let i = 0; GPT_STEPS.forEach((s, k) => { if (s.at <= v) i = k; });
  const shot = (n, a) => { // 캡처가 없으면(공개 저장소에는 넣지 않음) 빈 화면에 파일 이름만 적는다
    const im = GPT_SCREENS[n]; c.globalAlpha = a;
    if (ready(im)) { c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(im, x, y, w, h); }
    else { rect(c, x, y, w, h, '#FFFFFF'); txt(c, 'ArmyGPT 화면 캡처 없음 · assets/armygpt/screen-0' + (n + 1) + '.jpg', x + w / 2, y + h / 2, B12, '#6B7685', 'center'); }
    c.globalAlpha = 1;
  };
  const fade = i > 0 ? clamp01((v - GPT_STEPS[i].at) / 0.15) : 1;
  if (fade < 1) shot(GPT_STEPS[i - 1].shot, 1);
  shot(GPT_STEPS[i].shot, fade);
  // 마우스: 앞에서 누른 자리 → 이번에 누를 단추로 옮겨 가서 누른다 (단추 자리는 캡처에서 잰 값)
  const sx = w / SHOT_W, sy = h / SHOT_H, at = (q) => [x + q[0] * sx, y + q[1] * sy];
  let from = [x + w * 0.62, y + h * 0.78]; for (let k = i - 1; k >= 0; k--) if (GPT_STEPS[k].click) { from = at(GPT_STEPS[k].click); break; }
  const cl = GPT_STEPS[i].click; let pos = from, down = false;
  if (cl) {
    const to = at(cl), t0 = GPT_STEPS[i].at + 0.1, m = easeOut(clamp01((v - t0) / Math.max(0.1, cl[2] - 0.12 - t0)));
    pos = [from[0] + (to[0] - from[0]) * m, from[1] + (to[1] - from[1]) * m]; down = v >= cl[2] && v < cl[2] + 0.12;
    if (v >= cl[2] && v < cl[2] + 0.3) { const r = 8 + (v - cl[2]) / 0.3 * 22; c.globalAlpha = 1 - (v - cl[2]) / 0.3; c.strokeStyle = GPT_HEX; c.lineWidth = 3; c.beginPath(); c.arc(to[0], to[1], r, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; }
  }
  cursor(c, pos[0], pos[1], down);
}
function cursor(c, x, y, down) { // 마우스 화살표 (누르면 살짝 작게)
  const s = down ? 0.85 : 1, P = (dx, dy, ww, hh, col) => rect(c, x + dx * s, y + dy * s, ww * s, hh * s, col);
  for (let k = 0; k < 14; k++) P(0, k * 2, Math.max(2, (k < 10 ? k : 20 - k) * 2 + 2), 2, '#05070A');
  for (let k = 1; k < 12; k++) P(2, k * 2, Math.max(0, (k < 9 ? k : 18 - k) * 2 - 1), 2, '#FFFFFF');
}
function gptPdf(c, x, y, w, h, v, T) { // 한글 PDF 미리보기: 쪽이 올라와 살짝 다가가고, 왼쪽에 로고·안내, 오른쪽에 대대장 결재
  rect(c, x, y, w, h, '#45494E');
  const k = easeOut(clamp01(v / 0.35)), z = 1 + 0.28 * easeOut(clamp01((v - 0.6) / 0.8));
  const ph = (h - 48) * z, pw = ph / Math.SQRT2, cx = x + w * 0.56, py = y + 40 + (1 - k) * 40 - (z - 1) * h * 0.1;
  c.globalAlpha = k; rect(c, cx - pw / 2 + 6, py + 6, pw, ph, 'rgba(0,0,0,0.3)'); docPage(c, cx - pw / 2, py, pw, ph); c.globalAlpha = 1;
  rect(c, x, y, w, 30, '#2F3337'); txt(c, GPT_TITLE + '.pdf · 1/1쪽', x + 16, y + 15, F12, '#E8EDF5'); txt(c, 'ArmyGPT HWPX → 한글 PDF', x + w - 16, y + 15, F12, '#B8C0CC', 'right');
  const L = cx - pw / 2 - x; // 쪽 왼쪽 여백 가운데에 안내
  c.globalAlpha = clamp01(v / 0.3); gptCaption(c, x + L / 2, y + 120, 2.2); c.globalAlpha = 1;
  if (v >= 1.85) { const R = x + w - (x + w - (cx + pw / 2)) / 2; stamp(c, '대대장 결재', R, y + h - 120, '#FFC247', (v - 1.85) / 0.3); txt(c, '각 중대 하달', R, y + h - 80, B12, '#FFE08A', 'center'); }
}

// ---------------------------------------------------------------- 통합관제 → 중대장 패킷
function drawOut(map, c, S) {
  (S.out || []).forEach((o) => {
    const s = clamp01(o.s), z = map.z, K = z < 2 ? 2 : 1;
    if (!o.done) {
      const hex = o.hex || '#7FE3FF', rgb = o.rgb || '127,227,255';
      for (let k = 6; k >= 1; k--) { const ss = s - k * 5 * K / o.arc.len; if (ss < 0) continue; const q = map.at(o.arc, ss); c.globalAlpha = (1 - k / 7) * 0.9; map.wrect(c, q[0] - 0.75 * K, q[1] - 0.75 * K, 1.5 * K, 1.5 * K, hex); }
      c.globalAlpha = 1;
      const hq = map.at(o.arc, s), hp = map.w2s(hq[0], hq[1]), G = 18 * z * K;
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.85; c.drawImage(map.glow(rgb), hp[0] - G / 2, hp[1] - G / 2, G, G); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      map.wrect(c, hq[0] - 2 * K, hq[1] - 2 * K, 4 * K, 4 * K, '#05070A'); map.wrect(c, hq[0] - 1.5 * K, hq[1] - 1.5 * K, 3 * K, 3 * K, hex);
      if (o.chip) map.dataChip(c, o.chip, hp[0], hp[1] - 10, hex, false);
    } else if (o.hit > 0) {
      const p = map.w2s(o.x, o.y), k = 1 - o.hit / 0.9, r = (6 + k * 26) * Math.max(1, z * 0.6);
      c.globalAlpha = Math.max(0, o.hit / 0.9); c.strokeStyle = o.hex || '#7FE3FF'; c.lineWidth = 2; c.strokeRect(p[0] - r, p[1] - r, r * 2, r * 2); c.globalAlpha = 1;
    }
  });
}
