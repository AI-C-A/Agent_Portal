// 시연 음성(TTS) — 대사(say)에 붙은 음성 파일(assets/voice/<id>.mp3)을 재생한다.
// 앞 음성이 아직 나오고 있으면 끝난 뒤 이어서 낸다(겹치지 않게). 일시정지·이동·중지와 함께 멈추거나 끊는다.
// 브라우저는 사용자가 화면을 한 번 누르기 전에는 소리를 막을 수 있다 — 막히면 조용히 넘어간다(시연은 그대로 진행).
const BASE = 'assets/voice/';
const cache = new Map();
let cur = null;      // 지금 나오는 음성
let queue = [];      // 앞 음성이 끝나면 낼 음성
let held = false;    // 일시정지 중

function audio(id) {
  let a = cache.get(id);
  if (!a && typeof Audio !== 'undefined') { a = new Audio(BASE + id + '.mp3'); a.preload = 'auto'; a.dataset.id = id; cache.set(id, a); }
  return a;
}
function start(a) {
  cur = a;
  a.currentTime = 0;
  a.onended = () => { if (cur === a) cur = null; next(); };
  const p = a.play();
  if (p && p.catch) p.catch(() => { if (cur === a) cur = null; next(); });
}
function next() { if (held || cur) return; const a = queue.shift(); if (a) start(a); }

export const voice = {
  preload(ids) { ids.forEach(audio); },
  say(id) {
    const a = audio(id); if (!a) return;
    if (cur || held) queue.push(a); else start(a);
  },
  pause() { held = true; if (cur && !cur.paused) cur.pause(); },
  resume() {
    held = false;
    if (cur && cur.paused && !cur.ended) { const p = cur.play(); if (p && p.catch) p.catch(() => { cur = null; next(); }); }
    else next();
  },
  stop() {
    queue = []; held = false;
    if (cur) { cur.onended = null; cur.pause(); cur.currentTime = 0; }
    cur = null;
  },
  get state() { return { playing: cur ? cur.dataset.id : null, paused: held, queued: queue.map((a) => a.dataset.id) }; } // 확인용
};
