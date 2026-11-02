// 시연 효과음 — 대본의 sfx 단계가 assets/sfx/<이름>.mp3 를 낸다(경고음·문 열림·드론·처리 완료 체크).
// 대사 음성과 달리 줄을 세우지 않는다: 그 시각에 바로 나고, 대사·다른 효과음과 겹쳐도 된다. 음량은 파일에 맞춰 두었다(tools/sfx/gen-sfx.mjs).
// Web Audio 로 미리 풀어 둔 소리를 내므로 늦지 않고, 일시정지는 소리 전체를 그 자리에서 멈춘다(AudioContext suspend/resume).
// 브라우저가 소리를 막으면(화면을 한 번도 누르지 않음) 조용히 넘어간다 — 시연은 그대로 진행.
const BASE = 'assets/sfx/';
const buf = new Map();   // 이름 → 풀어 둔 소리 (읽는 중이면 Promise)
const live = new Set();  // 지금 나는 소리
let ctx = null;
let held = false;        // 일시정지 중

function context() {
  if (!ctx && typeof AudioContext !== 'undefined') ctx = new AudioContext();
  return ctx;
}
function wake() { if (ctx && ctx.state === 'suspended' && !held) ctx.resume().catch(() => {}); }

export const sfx = {
  preload(names) {
    const c = context(); if (!c) return;
    wake();
    names.forEach((n) => {
      if (buf.has(n)) return;
      buf.set(n, fetch(BASE + n + '.mp3').then((r) => r.arrayBuffer()).then((b) => c.decodeAudioData(b))
        .then((b) => { buf.set(n, b); return b; }, () => { buf.delete(n); return null; }));
    });
  },
  play(name) {
    const b = buf.get(name);
    if (!ctx || !b || b instanceof Promise || held) return; // 아직 못 읽었으면 그 소리는 건너뛴다
    wake();
    const s = ctx.createBufferSource();
    s.buffer = b; s.connect(ctx.destination);
    s.onended = () => live.delete(s);
    live.add(s); s.start();
  },
  pause() { held = true; if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
  resume() { held = false; wake(); },
  stop() {
    live.forEach((s) => { s.onended = null; try { s.stop(); } catch {} });
    live.clear(); held = false; wake();
  },
  get state() { return { ctx: ctx ? ctx.state : null, live: live.size, loaded: [...buf].filter(([, b]) => !(b instanceof Promise)).map(([n]) => n) }; } // 확인용
};
