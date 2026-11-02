// ARMY CENTER 엠블럼 (인공지능센터 육각 배지 픽셀판 · 38×42) — 시작 화면 상징탑 간판과 시연의 ArmyGPT 버튼이 함께 쓴다
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PF = { A: ['.#.', '#.#', '###', '#.#', '#.#'], R: ['##.', '#.#', '##.', '#.#', '#.#'], M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'], Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], C: ['.##', '#..', '#..', '#..', '.##'], E: ['###', '#..', '##.', '#..', '###'], N: ['#..#', '##.#', '#.##', '#..#', '#..#'], T: ['###', '.#.', '.#.', '.#.', '.#.'] };
function pword(g, s, cx, y, col) {
  let x = Math.round(cx - (s.split('').reduce((a, ch) => a + PF[ch][0].length + 1, -1)) / 2);
  g.fillStyle = col;
  for (const ch of s) { PF[ch].forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') g.fillRect(x + i, y + j, 1, 1); }); x += PF[ch][0].length + 1; }
}
// g에 1픽셀 단위로 그린다. 왼쪽 위가 (x0, y0)이고 테두리까지 대략 x0-2 ~ x0+40, y0-1 ~ y0+43을 쓴다.
export function emblem(g, x0, y0) {
  const cx = x0 + 19, hw = (y) => (y < 10.5 ? 19 * (y + 0.5) / 10.5 : (y > 31.5 ? 19 * (41.5 - y) / 10 : 19));
  const ink = ['#0A347F', '#0D46A3', '#1A62C9', '#2C7EE3'], P = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const inner = (x, y) => Math.abs(x + 0.5 - cx) < hw(y - y0) - 2.2;
  for (let y = y0 - 1; y < y0 + 43; y++) for (let x = cx - 21; x <= cx + 21; x++) {
    const d = Math.abs(x + 0.5 - cx), h = hw(y - y0);
    if (d < h - 2.2) { const v = 1 - Math.hypot(d / 19, (y - y0 - 14) / 30); P(x, y, ink[clamp(Math.floor(v * 4 + ((x + y) & 1) * 0.45), 0, 3)]); }
    else if (d < h) P(x, y, '#EAF2FF');
    else if (d < h + 1.2) P(x, y, '#081A3D');
  }
  // 회로 무늬
  const trace = (x1, y1, x2, y2) => { for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) if (inner(x, y)) P(x, y, '#3C8FEA'); };
  trace(cx - 17, y0 + 13, cx - 12, y0 + 13); trace(cx - 12, y0 + 13, cx - 12, y0 + 17); P(cx - 13, y0 + 18, '#7FC0FF'); P(cx - 12, y0 + 18, '#7FC0FF');
  trace(cx + 11, y0 + 11, cx + 17, y0 + 11); trace(cx + 13, y0 + 11, cx + 13, y0 + 16); P(cx + 13, y0 + 17, '#7FC0FF');
  trace(cx - 17, y0 + 20, cx - 13, y0 + 20); trace(cx + 13, y0 + 20, cx + 17, y0 + 20);
  trace(cx - 6, y0 + 36, cx + 5, y0 + 36); P(cx - 7, y0 + 36, '#7FC0FF'); P(cx + 6, y0 + 36, '#7FC0FF');
  // A · 별
  for (let y = 5; y <= 21; y++) { const a = (y - 5) * 11 / 16; for (let x = Math.round(cx - a); x < Math.round(cx + a); x++) P(x, y0 + y, x < cx ? '#FFFFFF' : '#D6E8FF'); }
  for (let y = 11; y <= 21; y++) { const a = (y - 11) * 0.55; for (let x = Math.round(cx + 1 - a); x <= Math.round(cx + 1 + a); x++) P(x, y0 + y, ink[1]); } // 두 다리 사이
  ['..#..', '#####', '.###.', '.#.#.', '#...#'].forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') P(cx - 9 + i, y0 + 16 + j, ink[2]); }); // 왼쪽 다리의 별
  P(cx - 1, y0 + 4, '#BFE0FF'); P(cx, y0 + 4, '#BFE0FF');
  pword(g, 'ARMY', cx, y0 + 23, '#FFFFFF'); pword(g, 'CENTER', cx, y0 + 29, '#FFFFFF');
  return { x: cx, y: y0 + 21, apex: [cx, y0 + 5] };
}
// 엠블럼 하나만 담은 44×46 캔버스 (확대해서 그릴 때 imageSmoothingEnabled = false)
let one = null;
export function emblemCanvas() {
  if (one) return one;
  one = document.createElement('canvas'); one.width = 44; one.height = 46;
  emblem(one.getContext('2d'), 3, 2);
  return one;
}
