import { buildQueue, Round } from './engine.js';
import { TiltDetector, requestTiltPermission, SENSITIVITY } from './tilt.js';
import * as audio from './audio.js';
import { load, save, versionFromCacheNames } from './storage.js';
import { t, setLang, getLang, initLang, applyI18n } from './i18n.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  decks: {},
  settings: load('settings', { lang: null, categories: [], difficulty: 0, roundLength: 60 }),
  players: load('players', []),
  scores: load('scores', {}),
  turn: load('turn', 0),
  used: new Set(),
  round: null,
  tiltOk: false,
  wakeLock: null,
};

// Settings saved before these options existed lack the tilt keys.
if (!(state.settings.tiltCorrect in SENSITIVITY)) state.settings.tiltCorrect = 'medium';
if (!(state.settings.tiltPass in SENSITIVITY)) state.settings.tiltPass = 'low';

const roundCtl = { onOrient: null, timer: null, endAt: 0, feedbackUntil: 0, detector: null, lastTick: -1 };

function deck() { return state.decks[getLang()]; }
function currentPlayer() { return state.players[state.turn % state.players.length]; }

function show(id) {
  $$('main > section').forEach((sec) => (sec.hidden = sec.id !== 'screen-' + id));
}

function persist() {
  save('settings', state.settings);
  save('players', state.players);
  save('scores', state.scores);
  save('turn', state.turn);
}

// ---------- home ----------
function renderHome() {
  applyI18n();
  $$('#lang-toggle button').forEach((b) => b.classList.toggle('active', b.dataset.lang === getLang()));
}

function bindHome() {
  $$('#lang-toggle button').forEach((b) => b.addEventListener('click', () => {
    setLang(b.dataset.lang);
    state.settings.lang = b.dataset.lang;
    persist();
    renderHome();
  }));
  $('#btn-play').addEventListener('click', () => { audio.unlock(); renderPlayers(); show('players'); });
  $('#btn-scores').addEventListener('click', () => { renderScores(false); show('scores'); });
  $('#btn-howto').addEventListener('click', () => { applyI18n(); show('howto'); });
  $('#btn-howto-back').addEventListener('click', () => { renderHome(); show('home'); });
}

// ---------- players ----------
function renderPlayers() {
  applyI18n();
  const ul = $('#player-list');
  ul.innerHTML = '';
  state.players.forEach((name, i) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = name;
    const del = document.createElement('button');
    del.textContent = '✕';
    del.className = 'del';
    del.addEventListener('click', () => {
      state.players.splice(i, 1);
      delete state.scores[name];
      if (state.turn >= state.players.length) state.turn = 0;
      persist();
      renderPlayers();
    });
    li.append(span, del);
    ul.append(li);
  });
}

function addPlayer() {
  const input = $('#player-input');
  let name = input.value.trim();
  if (!name) return;
  if (state.players.includes(name)) {
    let n = 2;
    while (state.players.includes(`${name} ${n}`)) n++;
    name = `${name} ${n}`;
  }
  state.players.push(name);
  state.scores[name] = state.scores[name] || 0;
  input.value = '';
  input.focus();
  persist();
  renderPlayers();
}

function bindPlayers() {
  $('#btn-add-player').addEventListener('click', addPlayer);
  $('#player-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') addPlayer(); });
  $('#btn-players-continue').addEventListener('click', () => {
    if (state.players.length === 0) { alert(t('needPlayer')); return; }
    renderSetup();
    show('setup');
  });
  $('#btn-players-back').addEventListener('click', () => { renderHome(); show('home'); });
}

// ---------- setup ----------
function renderSetup() {
  applyI18n();
  const grid = $('#category-grid');
  grid.innerHTML = '';
  for (const cat of deck().categories) {
    const btn = document.createElement('button');
    btn.className = 'cat';
    btn.textContent = `${cat.emoji} ${cat.name}`;
    btn.classList.toggle('active', state.settings.categories.includes(cat.id));
    btn.addEventListener('click', () => {
      const i = state.settings.categories.indexOf(cat.id);
      if (i >= 0) state.settings.categories.splice(i, 1);
      else state.settings.categories.push(cat.id);
      persist();
      renderSetup();
    });
    grid.append(btn);
  }
  $$('#difficulty-seg button').forEach((b) =>
    b.classList.toggle('active', Number(b.dataset.d) === state.settings.difficulty));
  $$('#length-seg button').forEach((b) =>
    b.classList.toggle('active', Number(b.dataset.s) === state.settings.roundLength));
  $$('#sens-correct-seg button').forEach((b) =>
    b.classList.toggle('active', b.dataset.v === state.settings.tiltCorrect));
  $$('#sens-pass-seg button').forEach((b) =>
    b.classList.toggle('active', b.dataset.v === state.settings.tiltPass));
}

function bindSetup() {
  $$('#difficulty-seg button').forEach((b) => b.addEventListener('click', () => {
    state.settings.difficulty = Number(b.dataset.d);
    persist();
    renderSetup();
  }));
  $$('#length-seg button').forEach((b) => b.addEventListener('click', () => {
    state.settings.roundLength = Number(b.dataset.s);
    persist();
    renderSetup();
  }));
  $$('#sens-correct-seg button').forEach((b) => b.addEventListener('click', () => {
    state.settings.tiltCorrect = b.dataset.v;
    persist();
    renderSetup();
  }));
  $$('#sens-pass-seg button').forEach((b) => b.addEventListener('click', () => {
    state.settings.tiltPass = b.dataset.v;
    persist();
    renderSetup();
  }));
  $('#btn-setup-continue').addEventListener('click', () => {
    if (state.settings.categories.length === 0) { alert(t('needCategory')); return; }
    renderHandoff();
    show('handoff');
  });
  $('#btn-setup-back').addEventListener('click', () => { renderPlayers(); show('players'); });
}

// ---------- handoff / countdown ----------
function renderHandoff() {
  applyI18n();
  $('#handoff-name').textContent = currentPlayer();
}

function bindHandoff() {
  $('#btn-start-round').addEventListener('click', async () => {
    audio.unlock();
    state.tiltOk = await requestTiltPermission();
    startCountdown();
  });
  $('#btn-handoff-back').addEventListener('click', () => { renderSetup(); show('setup'); });
}

async function acquireWakeLock() {
  try { state.wakeLock = await navigator.wakeLock.request('screen'); } catch {}
}
function releaseWakeLock() {
  if (state.wakeLock) { state.wakeLock.release().catch(() => {}); state.wakeLock = null; }
}

function startCountdown() {
  show('countdown');
  applyI18n();
  acquireWakeLock();
  let n = 3;
  $('#countdown-num').textContent = n;
  audio.tick();
  const iv = setInterval(() => {
    n--;
    if (n === 0) { clearInterval(iv); startRound(); return; }
    $('#countdown-num').textContent = n;
    audio.tick();
  }, 1000);
}

// ---------- round ----------
function startRound() {
  state.round = new Round(buildQueue(deck(), state.settings.categories, state.settings.difficulty, state.used));
  roundCtl.detector = new TiltDetector({
    fireDownAt: SENSITIVITY[state.settings.tiltCorrect],
    fireUpAt: SENSITIVITY[state.settings.tiltPass],
  });
  roundCtl.feedbackUntil = 0;
  roundCtl.lastTick = -1;
  show('round');
  $('#tap-hint').hidden = state.tiltOk;
  showWord();
  roundCtl.endAt = performance.now() + state.settings.roundLength * 1000;
  onTimer();
  roundCtl.timer = setInterval(onTimer, 100);
  if (state.tiltOk) {
    roundCtl.onOrient = (e) => {
      if (e.beta === null || e.gamma === null) return;
      const action = roundCtl.detector.update(e.beta, e.gamma, performance.now());
      if (action === 'correct') mark(true);
      else if (action === 'pass') mark(false);
    };
    window.addEventListener('deviceorientation', roundCtl.onOrient);
  }
}

function showWord() {
  if (!state.round.current) {
    // Filtered pool exhausted mid-round: recycle it and keep going.
    state.round.queue.push(...buildQueue(deck(), state.settings.categories, state.settings.difficulty, state.used));
  }
  const cur = state.round.current;
  if (cur) {
    state.used.add(cur.w);
    $('#word').textContent = cur.w;
  }
}

function mark(got) {
  if (!roundCtl.timer) return;
  const now = performance.now();
  if (now < roundCtl.feedbackUntil) return;
  if (!state.round.current) return;
  roundCtl.feedbackUntil = now + 450;
  if (got) {
    state.round.correct();
    audio.ding();
    audio.vibrate(80);
    flash('correct');
  } else {
    state.round.pass();
    audio.whoosh();
    flash('pass');
  }
  setTimeout(() => { if (roundCtl.timer) showWord(); }, 440);
}

function flash(kind) {
  const el = $('#round-flash');
  el.textContent = t(kind);
  el.className = 'show ' + kind;
  setTimeout(() => { el.className = ''; }, 420);
}

function onTimer() {
  const msLeft = roundCtl.endAt - performance.now();
  const s = Math.max(0, Math.ceil(msLeft / 1000));
  $('#round-timer').textContent = s;
  if (s <= 3 && s >= 1 && s !== roundCtl.lastTick) { roundCtl.lastTick = s; audio.tick(); }
  if (msLeft <= 0) endRound();
}

function endRound() {
  clearInterval(roundCtl.timer);
  roundCtl.timer = null;
  if (roundCtl.onOrient) {
    window.removeEventListener('deviceorientation', roundCtl.onOrient);
    roundCtl.onOrient = null;
  }
  releaseWakeLock();
  audio.buzzer();
  audio.vibrate([120, 60, 120]);
  state.round.finish();
  renderRecap();
  show('recap');
}

function bindRound() {
  $('#zone-correct').addEventListener('click', () => mark(true));
  $('#zone-pass').addEventListener('click', () => mark(false));
}

// ---------- recap ----------
function renderRecap() {
  applyI18n();
  const ul = $('#recap-list');
  ul.innerHTML = '';
  state.round.results.forEach((r, i) => {
    const li = document.createElement('li');
    li.className = r.got ? 'got' : 'missed';
    li.textContent = (r.got ? '✓  ' : '✗  ') + r.word;
    li.addEventListener('click', () => { state.round.toggleResult(i); renderRecap(); });
    ul.append(li);
  });
  $('#recap-score').textContent = `${currentPlayer()}: +${state.round.score} ${t('points')}`;
}

function bindRecap() {
  $('#btn-recap-confirm').addEventListener('click', () => {
    state.scores[currentPlayer()] = (state.scores[currentPlayer()] || 0) + state.round.score;
    state.turn = (state.turn + 1) % state.players.length;
    persist();
    renderScores(true);
    show('scores');
  });
}

// ---------- scoreboard ----------
function renderScores(inGame) {
  applyI18n();
  const ul = $('#score-list');
  ul.innerHTML = '';
  const rows = state.players
    .map((p) => [p, state.scores[p] || 0])
    .sort((a, b) => b[1] - a[1]);
  for (const [name, pts] of rows) {
    const li = document.createElement('li');
    const s = document.createElement('span');
    s.textContent = name;
    const b = document.createElement('b');
    b.textContent = pts;
    li.append(s, b);
    ul.append(li);
  }
  $('#btn-next-player').hidden = !inGame || state.players.length === 0;
}

function bindScores() {
  $('#btn-next-player').addEventListener('click', () => { renderHandoff(); show('handoff'); });
  $('#btn-new-game').addEventListener('click', () => {
    if (!confirm(t('resetConfirm'))) return;
    for (const p of state.players) state.scores[p] = 0;
    state.turn = 0;
    persist();
    renderScores(false);
  });
  $('#btn-scores-home').addEventListener('click', () => { renderHome(); show('home'); });
}

// ---------- boot ----------
async function boot() {
  initLang(state.settings.lang);
  const [en, es] = await Promise.all([
    fetch('decks/en.json').then((r) => r.json()),
    fetch('decks/es.json').then((r) => r.json()),
  ]);
  state.decks = { en, es };
  for (const p of state.players) state.scores[p] = state.scores[p] || 0;
  bindHome(); bindPlayers(); bindSetup(); bindHandoff(); bindRound(); bindRecap(); bindScores();
  renderHome();
  show('home');
  try {
    const v = versionFromCacheNames(await caches.keys());
    if (v) $('#version-tag').textContent = v;
  } catch {}
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && roundCtl.timer) acquireWakeLock();
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot().catch(() => {
  document.body.innerHTML =
    '<p class="boot-error">Connect to the internet once to install the game — after that it works fully offline.<br><br>' +
    'Conéctate a internet una vez para instalar el juego; después funciona sin conexión.</p>';
});
