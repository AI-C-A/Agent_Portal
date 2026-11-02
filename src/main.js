// AXIS 웅비대대 에이전트 포털 — 진입점
import { BaseMap, Z_MAX } from './baseMap.js';
import { CharacterSheet } from './sheet.js';
import { life } from './life.js';
import { demo } from './demo.js';
import { tiger } from './tiger.js';
import { createTitle } from './title.js';
import { agentView } from './agentview.js';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

const stageTitle = $('#stage-title');
const stageMap = $('#stage-map');
const stageSheet = $('#stage-sheet');

// 시작 화면 메뉴 → 주소(#map 평소 모드 · #demo 1분 시연 · #sheet 캐릭터 시트)로 넘긴다
const title = createTitle(stageTitle, { onGo: (id) => { location.hash = id === 'demo' ? '#demo' : (id === 'sheet' ? '#sheet' : '#map'); } });

const map = new BaseMap($('#map-canvas'), { onChange: syncControls });
map.use(life).use(demo).use(tiger); // tiger는 맨 뒤: 훈련 자세를 마지막에 덮어쓰고, 통제관이 평소 모드 두뇌를 받지 않게
map.use(agentView); // 에이전트를 누르면 분석 화면 (맨 위에 그린다)
const sheet = new CharacterSheet($('#sheet-canvas'));

// ---------- 헤더 컨트롤 ----------
const nav = $('#places');
map.places().forEach(([name, x, y]) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'pbtn'; b.textContent = name;
  b.addEventListener('click', () => map.goTo(x, y, Math.max(map.z, 2)));
  nav.appendChild(b);
});
$('#btn-fit').addEventListener('click', () => map.fitAll());
$('#btn-zin').addEventListener('click', () => map.zoomStep(1));
$('#btn-zout').addEventListener('click', () => map.zoomStep(-1));
$('#btn-flow').addEventListener('click', () => map.toggleFlow());
$('#btn-log').addEventListener('click', () => map.toggleLog());

// ---------- 1분 시연 (버튼 · D 키 · #demo 자동 재생, Esc 중지) ----------
const btnDemo = $('#btn-demo');
const inDemo = () => demo.playing;
demo.onChange = (on) => {
  stageMap.classList.toggle('demo', on);
  if (btnDemo) { btnDemo.textContent = on ? '시연 중지' : '시연 재생'; btnDemo.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  if (on) stageMap.classList.remove('dragging');
};
if (btnDemo) btnDemo.addEventListener('click', () => { demo.toggle(map); btnDemo.blur(); });
// 임시 바로 가기(ArmyGPT 장면 확인용 — 나중에 지운다): 주소에 ?from=초 가 있으면 그 시점부터 재생한다. 예) /?from=52#demo
const FROM = Number(new URLSearchParams(location.search).get('from')) || 0;
function playDemo() {
  if (stageMap.classList.contains('hidden') || inDemo()) return;
  let go = false;
  const start = () => { if (go) return; go = true; if (!inDemo()) { demo.play(map); if (FROM > 0) demo.seek(map, FROM); } };
  // 픽셀 폰트가 준비된 뒤 시작한다 (늦어도 1.5초 안에)
  try { if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('12px Galmuri11'), document.fonts.load('700 24px Galmuri11')]).then(start, start); else start(); } catch (err) { start(); }
  setTimeout(start, 1500);
}

function setPressed(el, on) { el.classList.toggle('on', on); el.setAttribute('aria-pressed', on ? 'true' : 'false'); }
function syncControls(state = {}) {
  const z = state.z || map.z || 1, atFit = z <= map.zFit() * 1.001;
  $('#zoom-level').textContent = Math.round(z * 100) + '%';
  setPressed($('#btn-fit'), atFit);
  $('#btn-zout').disabled = atFit;
  $('#btn-zin').disabled = z >= Z_MAX * 0.999;
  setPressed($('#btn-flow'), state.flow !== false);
  setPressed($('#btn-log'), state.log !== false);
}

// ---------- 마우스 · 키보드 ----------
const isUi = (e) => !!(e.target && e.target.closest && e.target.closest('button, a, header, .agent-panel'));
const stagePt = (e) => { const r = stageMap.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 1600, (e.clientY - r.top) / r.height * 900]; };
stageMap.addEventListener('mousedown', (e) => {
  if (isUi(e) || e.button !== 0) return;
  if (inDemo()) { // 시연 중: 아래 진행 막대 — 재생 단추는 일시정지/재생, 막대는 눌러 끌어서 옮긴다(손을 떼면 이동)
    const p = stagePt(e), h = demo.hit(p[0], p[1]);
    if (h === 'toggle') demo.togglePause(map); else if (h != null) { demo.scrubAt(h); e.preventDefault(); }
    return;
  }
  map.onDown(e); stageMap.classList.add('dragging');
});
// 아래 조작 안내는 마우스를 움직일 때만 잠시 보인다 (상시 전시 화면에서 맵 아래쪽 정문을 가리지 않게)
const hint = $('.hint');
let hintT = 0;
const wakeHint = () => { if (!hint) return; hint.classList.remove('idle'); clearTimeout(hintT); hintT = setTimeout(() => hint.classList.add('idle'), 5000); };
wakeHint();
stageMap.addEventListener('mousemove', (e) => { map.onMove(e); wakeHint(); if (inDemo()) { const p = stagePt(e); demo.pointer(p[0], p[1]); } });
window.addEventListener('mousemove', (e) => { if (demo.scrubbing) demo.scrubX(stagePt(e)[0]); });
stageMap.addEventListener('mouseleave', () => { map.onLeave(); stageMap.classList.remove('dragging'); if (inDemo()) demo.pointer(-1, -1); });
window.addEventListener('mouseup', () => { if (demo.scrubbing) demo.scrubEnd(map); map.onUp(); stageMap.classList.remove('dragging'); });
stageMap.addEventListener('wheel', (e) => { if (isUi(e)) return; e.preventDefault(); if (!inDemo()) map.onWheel(e); }, { passive: false });
window.addEventListener('keydown', (e) => {
  if (stageMap.classList.contains('hidden') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (inDemo()) { // 시연 중엔 확대·이동 키를 막고, 영상처럼 Space 일시정지·재생, ←/→ 5초 이동, Esc 중지
    if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); demo.stop(map); }
    else if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); if (!e.repeat) demo.togglePause(map); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); demo.seek(map, demo.time + (e.key === 'ArrowLeft' ? -5 : 5)); }
    return;
  }
  if (e.key === 'd' || e.key === 'D') { if (!e.repeat) demo.play(map); }
  else if (e.key === '+' || e.key === '=') map.zoomStep(1);
  else if (e.key === '-' || e.key === '_') map.zoomStep(-1);
  else if (e.key === '0') map.fitAll();
  else if (e.key === 'f' || e.key === 'F') map.toggleFlow();
  else if (e.key === 'l' || e.key === 'L') map.toggleLog();
});

// ---------- 창 크기 맞춤 (1600×900 무대 확대·축소) ----------
function fit() {
  const k = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
  [stageTitle, stageMap, stageSheet].forEach((s) => { s.style.transform = `translate(-50%, -50%) scale(${k})`; });
  map.viewScale = k; sheet.viewScale = k; title.viewScale = k;
  title.fit();
}
window.addEventListener('resize', fit);
fit();

// ---------- 캐릭터 시트 DOM ----------
function buildSheetDom() {
  const wrap = $('#sheet-cards');
  sheet.cardDefs().forEach((d) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.left = d.x + 'px'; card.style.top = d.y + 'px';
    card.innerHTML = `
      <h2></h2><p class="desc"></p>
      <span class="cap" style="left:24px;top:220px">정면</span>
      <span class="cap" style="left:136px;top:220px">측면</span>
      <span class="cap" style="left:248px;top:220px">후면</span>
      <span class="cap walk" style="left:360px;top:220px">걷기 · 앉기</span>
      <p class="role"></p>`;
    card.querySelector('h2').textContent = d.name;
    card.querySelector('.desc').textContent = d.desc;
    card.querySelector('.role').textContent = d.role;
    wrap.appendChild(card);
  });
  const strip = $('#sheet-strip');
  sheet.rankDefs().forEach((r) => {
    const s = document.createElement('span');
    s.className = 'cap rank'; s.style.left = (r.cx - 28 - 32) + 'px'; s.textContent = r.name;
    strip.appendChild(s);
  });
}
buildSheetDom();

// ---------- 화면 전환 (시작 화면 / #map · #demo / #sheet) ----------
// 주소가 없거나 #title이면 시작 화면. 헤더의 AXIS 로고를 누르면 시작 화면으로 돌아온다.
function route() {
  const h = location.hash, showSheet = h === '#sheet', showMap = h === '#map' || h === '#demo', showTitle = !showSheet && !showMap;
  stageTitle.classList.toggle('hidden', !showTitle);
  stageMap.classList.toggle('hidden', !showMap);
  stageSheet.classList.toggle('hidden', !showSheet);
  if (!showMap && inDemo()) demo.stop(map);
  if (showMap) map.resume(); else map.pause();
  if (showSheet) sheet.resume(); else sheet.pause();
  if (showTitle) title.show(); else title.hide();
  document.title = showSheet ? 'AXIS · 캐릭터 시트' : 'AXIS · 웅비대대 에이전트 포털';
}
window.addEventListener('hashchange', () => { route(); if (location.hash === '#demo') playDemo(); });

map.start();
sheet.start();
route();
syncControls(map.state);
if (location.hash === '#demo') playDemo();

// ---------- 외부 연동 API ----------
// 콘솔이나 다른 스크립트에서 실제 에이전트 이벤트를 흘려보낼 수 있다.
//   agentPortal.emit('gate', 'hq', '차량 출입', '12가 3456 출입 승인')
window.agentPortal = {
  map, sheet,
  agents: () => Object.fromEntries(Object.entries(map.nodes).map(([id, n]) => [id, n.name])),
  emit: (from, to, chip, msg) => map.pushEvent(from, to, chip, msg),
  goTo: (x, y, z) => map.goTo(x, y, z),
  zoom: (z) => map.setZoom(z),
  demo: { play: () => demo.play(map), stop: () => demo.stop(map), get playing() { return demo.playing; }, get time() { return demo.time; } }
};
