# Arriba — Offline HeadsUp PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A free, fully offline, bilingual (EN / ES-LatAm) HeadsUp-style party game as a static PWA with tilt controls, category/difficulty selection, and per-player scores.

**Architecture:** Static site, no build step, no dependencies. ES modules split by concern; pure game logic in `engine.js` / `tilt.js` (DOM-free, browser-tested via `test/tests.html`); `app.js` owns screens and wiring; decks are JSON; a precache service worker makes it offline; GitHub Pages provides the HTTPS needed for iOS gyroscope permission.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules), DeviceOrientation API, WebAudio, Wake Lock, Service Worker, `localStorage`. Python stdlib script for PNG icons. Local server: `python3 -m http.server`.

**Verification environment:** the in-app Browser pane via `preview_start` (launch config below), navigating to `http://localhost:8613/…`.

Spec: `docs/superpowers/specs/2026-08-10-arriba-headsup-design.md`

---

## File map

```
index.html                 app shell, all screens
styles.css                 all styling incl. portrait→landscape rotation
js/engine.js               deck filtering, shuffle, queue, Round (pure)
js/tilt.js                 gravity math + neutral-zone state machine (pure) + permission helper
js/audio.js                WebAudio sounds + vibration
js/storage.js              localStorage JSON wrapper
js/i18n.js                 EN/ES strings, t(), applyI18n()
js/app.js                  screens, game loop, wake lock, SW registration
decks/en.json              English deck (8 categories, ≥90 words each)
decks/es.json              Spanish LatAm deck (same category ids)
test/tests.html            browser test harness: engine, tilt, i18n parity, deck validation
tools/gen_icons.py         stdlib-only PNG icon generator
icons/                     icon.svg + generated PNGs
sw.js                      precache-all, cache-first
manifest.webmanifest       installable PWA metadata
.claude/launch.json        local server config
README.md                  play + deploy instructions
```

---

### Task 1: Scaffold — shell, styles, launch config

**Files:**
- Create: `.claude/launch.json`, `index.html`, `styles.css`, `README.md`

- [ ] **Step 1: Create `.claude/launch.json`**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "arriba",
      "runtimeExecutable": "python3",
      "runtimeArgs": ["-m", "http.server", "8613"],
      "port": 8613
    }
  ]
}
```

- [ ] **Step 2: Create `index.html`** (complete final shell — later tasks only add JS/decks/PWA files)

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#12122b">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>Arriba</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<main>

<section id="screen-home" class="menu">
  <h1 class="logo">¡ARRIBA!</h1>
  <p class="tagline" data-i18n="tagline"></p>
  <div id="lang-toggle" class="seg">
    <button data-lang="en">English</button>
    <button data-lang="es">Español</button>
  </div>
  <button id="btn-play" class="primary big" data-i18n="play"></button>
  <button id="btn-scores" class="secondary" data-i18n="scoreboard"></button>
  <button id="btn-howto" class="secondary" data-i18n="howto"></button>
</section>

<section id="screen-players" class="menu" hidden>
  <h2 data-i18n="players"></h2>
  <ul id="player-list" class="rows"></ul>
  <div class="row-input">
    <input id="player-input" data-i18n-placeholder="playerPlaceholder" autocomplete="off" maxlength="20">
    <button id="btn-add-player" class="secondary" data-i18n="addPlayer"></button>
  </div>
  <button id="btn-players-continue" class="primary" data-i18n="continue"></button>
  <button id="btn-players-back" class="ghost" data-i18n="back"></button>
</section>

<section id="screen-setup" class="menu" hidden>
  <h2 data-i18n="categories"></h2>
  <div id="category-grid"></div>
  <h2 data-i18n="difficulty"></h2>
  <div id="difficulty-seg" class="seg">
    <button data-d="0" data-i18n="dMixed"></button>
    <button data-d="1" data-i18n="dEasy"></button>
    <button data-d="2" data-i18n="dMedium"></button>
    <button data-d="3" data-i18n="dHard"></button>
  </div>
  <h2 data-i18n="roundLength"></h2>
  <div id="length-seg" class="seg">
    <button data-s="30">30s</button>
    <button data-s="60">60s</button>
    <button data-s="90">90s</button>
    <button data-s="120">120s</button>
  </div>
  <button id="btn-setup-continue" class="primary" data-i18n="continue"></button>
  <button id="btn-setup-back" class="ghost" data-i18n="back"></button>
</section>

<section id="screen-handoff" class="menu" hidden>
  <p data-i18n="passTo"></p>
  <h2 id="handoff-name" class="huge"></h2>
  <p data-i18n="holdUp"></p>
  <button id="btn-start-round" class="primary big" data-i18n="start"></button>
  <button id="btn-handoff-back" class="ghost" data-i18n="back"></button>
</section>

<section id="screen-countdown" class="landscape" hidden>
  <p data-i18n="holdUp"></p>
  <div id="countdown-num" class="giant">3</div>
</section>

<section id="screen-round" class="landscape" hidden>
  <div id="round-timer"></div>
  <div id="word"></div>
  <p id="tap-hint" data-i18n="tapHint" hidden></p>
  <div id="zone-pass" class="zone left"></div>
  <div id="zone-correct" class="zone right"></div>
  <div id="round-flash"></div>
</section>

<section id="screen-recap" class="menu" hidden>
  <h2 data-i18n="recap"></h2>
  <p id="recap-score" class="score-line"></p>
  <p class="hint" data-i18n="tapToFix"></p>
  <ul id="recap-list" class="rows"></ul>
  <button id="btn-recap-confirm" class="primary" data-i18n="confirm"></button>
</section>

<section id="screen-scores" class="menu" hidden>
  <h2 data-i18n="scoreboard"></h2>
  <ul id="score-list" class="rows"></ul>
  <button id="btn-next-player" class="primary" data-i18n="nextPlayer"></button>
  <button id="btn-new-game" class="secondary" data-i18n="newGame"></button>
  <button id="btn-scores-home" class="ghost" data-i18n="back"></button>
</section>

<section id="screen-howto" class="menu" hidden>
  <h2 data-i18n="howto"></h2>
  <p class="howto-text" data-i18n="howtoText"></p>
  <button id="btn-howto-back" class="ghost" data-i18n="back"></button>
</section>

</main>
<script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `styles.css`** (complete)

```css
:root {
  --bg: #12122b;
  --bg2: #1d1d40;
  --fg: #f5f4ff;
  --muted: #9c9ac2;
  --primary: #ff5470;
  --accent: #9ff26b;
  --warn: #ffb347;
}

* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

html, body { height: 100%; }

body {
  background: var(--bg);
  color: var(--fg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}

main { height: 100%; }

section {
  height: 100%;
  padding: max(1.2rem, env(safe-area-inset-top)) 1.2rem max(1.2rem, env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
  text-align: center;
}

section[hidden] { display: none; }

.menu { overflow-y: auto; }

.logo {
  font-size: clamp(3rem, 14vw, 5rem);
  letter-spacing: 0.04em;
  color: var(--primary);
  text-shadow: 0 4px 0 #7a1f33;
  transform: rotate(-3deg);
}

.tagline { color: var(--muted); }
h2 { font-size: 1.4rem; }
.huge { font-size: clamp(2.2rem, 10vw, 3.5rem); color: var(--accent); }
.giant { font-size: clamp(6rem, 30vw, 12rem); font-weight: 800; color: var(--accent); }
.hint { color: var(--muted); font-size: 0.9rem; }
.score-line { font-size: 1.3rem; color: var(--accent); }
.howto-text { max-width: 34rem; line-height: 1.5; white-space: pre-line; text-align: left; }

button {
  font: inherit;
  border: none;
  border-radius: 14px;
  padding: 0.9rem 1.6rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--fg);
  background: var(--bg2);
  cursor: pointer;
  min-width: 12rem;
}

button.primary { background: var(--primary); color: #fff; }
button.big { font-size: 1.5rem; padding: 1.1rem 2.4rem; }
button.secondary { background: var(--bg2); }
button.ghost { background: transparent; color: var(--muted); min-width: 0; }

.seg { display: flex; gap: 0.4rem; flex-wrap: wrap; justify-content: center; }
.seg button { min-width: 0; padding: 0.6rem 1rem; border-radius: 10px; }
.seg button.active { background: var(--primary); color: #fff; }

#category-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(9rem, 12rem));
  gap: 0.5rem;
}
#category-grid .cat { min-width: 0; padding: 0.8rem 0.5rem; font-size: 1rem; }
#category-grid .cat.active { background: var(--primary); color: #fff; }

.rows { list-style: none; width: min(100%, 24rem); display: flex; flex-direction: column; gap: 0.4rem; max-height: 40vh; overflow-y: auto; }
.rows li {
  background: var(--bg2);
  border-radius: 10px;
  padding: 0.7rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.1rem;
}
.rows li .del { background: none; color: var(--muted); min-width: 0; padding: 0 0.4rem; }
.rows li.got { background: #1d4022; color: var(--accent); }
.rows li.missed { background: #40222a; color: var(--warn); }

.row-input { display: flex; gap: 0.4rem; width: min(100%, 24rem); }
.row-input input {
  flex: 1;
  font: inherit;
  font-size: 1.1rem;
  padding: 0.7rem 1rem;
  border-radius: 10px;
  border: 2px solid var(--bg2);
  background: var(--bg2);
  color: var(--fg);
  min-width: 0;
}
.row-input button { min-width: 0; }

/* ---- round / countdown (landscape-first) ---- */
.landscape { position: relative; }

#round-timer {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 2rem;
  font-weight: 800;
  color: var(--muted);
}

#word {
  font-size: clamp(2.5rem, 11vmin, 6rem);
  font-weight: 800;
  line-height: 1.1;
  padding: 0 1rem;
  max-width: 100%;
  overflow-wrap: break-word;
}

#tap-hint { position: absolute; bottom: 0.8rem; left: 0; right: 0; color: var(--muted); font-size: 0.85rem; }

.zone { position: absolute; top: 0; bottom: 0; width: 50%; }
.zone.left { left: 0; }
.zone.right { right: 0; }

#round-flash {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(3rem, 14vmin, 7rem);
  font-weight: 800;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.1s;
}
#round-flash.show { opacity: 1; }
#round-flash.correct { background: #1d6a2ae6; color: #fff; }
#round-flash.pass { background: #b3541ae6; color: #fff; }

@media (orientation: portrait) {
  section.landscape:not([hidden]) {
    position: fixed;
    top: 50%;
    left: 50%;
    width: 100vh;
    height: 100vw;
    transform: translate(-50%, -50%) rotate(90deg);
  }
}

.boot-error { padding: 3rem 1.5rem; font-size: 1.2rem; text-align: center; }
```

- [ ] **Step 4: Create `README.md`** (stub; finished in Task 9)

```markdown
# ¡Arriba! — offline heads-up party game

Static PWA. No build step. Serve the folder over HTTP and open `index.html`.

Local dev: `python3 -m http.server 8613` then http://localhost:8613/
```

- [ ] **Step 5: Verify the server serves the shell**

Start preview (`preview_start` name `arriba`), navigate to `http://localhost:8613/`.
Expected: dark screen with ¡ARRIBA! logo (no JS yet — buttons unlabeled, console 404 for js/app.js is fine at this stage).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: app shell, styles, launch config"
```

---

### Task 2: Test harness + engine.js (TDD)

**Files:**
- Create: `test/tests.html` (harness + engine tests; more tests appended later)
- Create: `js/engine.js`

- [ ] **Step 1: Write the failing tests — create `test/tests.html`**

```html
<!doctype html>
<meta charset="utf-8">
<title>Arriba tests</title>
<style>body{font-family:monospace;background:#111;color:#eee}pre{white-space:pre-wrap}</style>
<pre id="out">running…</pre>
<script type="module">
import { filterWords, shuffle, buildQueue, Round } from '../js/engine.js';

const results = [];
function test(name, fn) {
  try { fn(); results.push('PASS ' + name); }
  catch (e) { results.push('FAIL ' + name + ' — ' + e.message); }
}
function eq(a, b, msg = '') {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v, msg = 'expected truthy') { if (!v) throw new Error(msg); }

const DECK = { categories: [
  { id: 'a', name: 'A', emoji: 'x', words: [{ w: 'a1', d: 1 }, { w: 'a2', d: 2 }, { w: 'a3', d: 3 }] },
  { id: 'b', name: 'B', emoji: 'y', words: [{ w: 'b1', d: 1 }, { w: 'b2', d: 2 }] },
] };

test('filterWords: one category, one difficulty', () => {
  eq(filterWords(DECK, ['a'], 2), [{ w: 'a2', d: 2, cat: 'a' }]);
});
test('filterWords: difficulty 0 = mixed', () => {
  eq(filterWords(DECK, ['b'], 0).map(e => e.w), ['b1', 'b2']);
});
test('filterWords: multiple categories', () => {
  eq(filterWords(DECK, ['a', 'b'], 1).map(e => e.w), ['a1', 'b1']);
});

test('shuffle: permutation, deterministic with seeded rng', () => {
  let n = 0;
  const rng = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  const arr = [1, 2, 3, 4, 5];
  const s = shuffle(arr, rng);
  eq(arr, [1, 2, 3, 4, 5], 'input untouched:');
  eq(s.slice().sort(), [1, 2, 3, 4, 5], 'same elements:');
});

test('buildQueue: excludes used words', () => {
  const used = new Set(['a1', 'a3']);
  eq(buildQueue(DECK, ['a'], 0, used, () => 0).map(e => e.w), ['a2']);
});
test('buildQueue: resets pool when all words used', () => {
  const used = new Set(['a1', 'a2', 'a3']);
  const q = buildQueue(DECK, ['a'], 0, used, () => 0);
  eq(q.length, 3);
  eq(used.size, 0, 'used cleared for pool:');
});

test('Round: correct/pass record results and score', () => {
  const r = new Round([{ w: 'x', d: 1 }, { w: 'y', d: 1 }, { w: 'z', d: 1 }]);
  eq(r.current.w, 'x');
  r.correct();
  r.pass();
  eq(r.results, [{ word: 'x', got: true }, { word: 'y', got: false }]);
  eq(r.score, 1);
  eq(r.current.w, 'z');
});
test('Round: toggleResult flips a miscall', () => {
  const r = new Round([{ w: 'x', d: 1 }]);
  r.pass();
  r.toggleResult(0);
  eq(r.score, 1);
});
test('Round: finish counts the in-flight word as missed', () => {
  const r = new Round([{ w: 'x', d: 1 }]);
  r.finish();
  eq(r.results, [{ word: 'x', got: false }]);
  ok(r.exhausted);
});
test('Round: actions after exhaustion are no-ops', () => {
  const r = new Round([{ w: 'x', d: 1 }]);
  r.correct();
  r.correct();
  r.finish();
  eq(r.results.length, 1);
});

const failures = results.filter(r => r.startsWith('FAIL'));
document.getElementById('out').textContent =
  results.join('\n') + `\n\n${failures.length === 0 ? 'ALL PASS' : failures.length + ' FAILURES'} (${results.length} tests)`;
</script>
```

- [ ] **Step 2: Run tests to verify they fail**

Navigate Browser pane to `http://localhost:8613/test/tests.html`.
Expected: page stuck on "running…" (module import of missing `../js/engine.js` fails — check console shows 404/import error).

- [ ] **Step 3: Create `js/engine.js`**

```js
// Pure game logic — no DOM access.

// difficulty: 0 = mixed, 1/2/3 = easy/medium/hard
export function filterWords(deck, categoryIds, difficulty) {
  const out = [];
  for (const cat of deck.categories) {
    if (!categoryIds.includes(cat.id)) continue;
    for (const entry of cat.words) {
      if (difficulty === 0 || entry.d === difficulty) {
        out.push({ w: entry.w, d: entry.d, cat: cat.id });
      }
    }
  }
  return out;
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// usedWords: Set of words already shown this session. When every word in the
// filtered pool has been used, the pool's words are removed from the set so
// play can continue.
export function buildQueue(deck, categoryIds, difficulty, usedWords, rng = Math.random) {
  const pool = filterWords(deck, categoryIds, difficulty);
  let fresh = pool.filter((e) => !usedWords.has(e.w));
  if (fresh.length === 0) {
    for (const e of pool) usedWords.delete(e.w);
    fresh = pool;
  }
  return shuffle(fresh, rng);
}

export class Round {
  constructor(queue) {
    this.queue = queue;
    this.index = 0;
    this.results = []; // { word, got }
  }
  get current() {
    return this.index < this.queue.length ? this.queue[this.index] : null;
  }
  get exhausted() { return this.current === null; }
  get score() { return this.results.filter((r) => r.got).length; }
  correct() { this._advance(true); }
  pass() { this._advance(false); }
  finish() { this._advance(false); }
  toggleResult(i) {
    if (this.results[i]) this.results[i].got = !this.results[i].got;
  }
  _advance(got) {
    if (!this.current) return;
    this.results.push({ word: this.current.w, got });
    this.index++;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Reload `http://localhost:8613/test/tests.html`.
Expected: `ALL PASS (10 tests)`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: game engine (filter, shuffle, no-repeat queue, Round) with browser tests"
```

---

### Task 3: tilt.js (TDD)

**Files:**
- Modify: `test/tests.html` (add tilt tests)
- Create: `js/tilt.js`

**Background for the engineer:** `deviceorientation` gives Euler angles (beta, gamma) that gimbal-flip near the vertical pose the game is played in. Instead of thresholding raw angles, convert to the gravity component along the screen normal: `gz = -cos(beta)·cos(gamma)` (degrees→radians first). `gz = +1` screen faces the floor (CORRECT), `-1` faces the ceiling (PASS), `≈0` vertical on the forehead (neutral). This is continuous through the flip and works in any landscape direction.

- [ ] **Step 1: Add failing tilt tests to `test/tests.html`** — add this import under the engine import, and the tests before the `failures` line:

```js
import { faceDown, TiltDetector } from '../js/tilt.js';
```

```js
function approx(a, b, msg = '') {
  if (Math.abs(a - b) > 1e-6) throw new Error(`${msg} expected ~${b}, got ${a}`);
}

test('faceDown: flat screen-up reads -1', () => approx(faceDown(0, 0), -1));
test('faceDown: vertical landscape reads 0', () => approx(faceDown(0, -90), 0));
test('faceDown: tilted toward floor is strongly positive', () => {
  ok(faceDown(175, 20) > 0.9, `got ${faceDown(175, 20)}`);
});
test('faceDown: tilted toward ceiling is negative', () => {
  approx(faceDown(0, -30), -Math.cos(30 * Math.PI / 180));
});

test('TiltDetector: fires correct, then requires neutral before next fire', () => {
  const d = new TiltDetector();
  eq(d.update(0, -90, 0), null);          // neutral
  eq(d.update(175, 20, 500), 'correct');  // tilt down
  eq(d.update(175, 20, 1000), null);      // still down — not re-armed
  eq(d.update(0, -90, 1500), null);       // back to neutral re-arms
  eq(d.update(0, -30, 2000), 'pass');     // tilt up
});
test('TiltDetector: minIntervalMs suppresses rapid re-fire', () => {
  const d = new TiltDetector({ minIntervalMs: 400 });
  eq(d.update(175, 20, 0), 'correct');
  eq(d.update(0, -90, 100), null);        // re-armed but…
  eq(d.update(0, -30, 200), null);        // …within min interval
  eq(d.update(0, -30, 500), 'pass');
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Reload tests page. Expected: import error (missing `../js/tilt.js`) — page stuck on "running…".

- [ ] **Step 3: Create `js/tilt.js`**

```js
const DEG = Math.PI / 180;

// Gravity component along the screen normal, from deviceorientation angles.
// +1: screen faces the floor. -1: screen faces the ceiling. 0: screen vertical.
export function faceDown(beta, gamma) {
  return -Math.cos(beta * DEG) * Math.cos(gamma * DEG);
}

// Neutral-zone state machine: one nod = one word. After firing, the phone
// must return to the neutral band (|gz| < neutralAt) before it can fire again.
export class TiltDetector {
  constructor({ fireAt = 0.55, neutralAt = 0.3, minIntervalMs = 350 } = {}) {
    this.fireAt = fireAt;
    this.neutralAt = neutralAt;
    this.minIntervalMs = minIntervalMs;
    this.armed = true;
    this.lastFire = -Infinity;
  }
  update(beta, gamma, now) {
    const gz = faceDown(beta, gamma);
    if (!this.armed) {
      if (Math.abs(gz) < this.neutralAt) this.armed = true;
      return null;
    }
    if (now - this.lastFire < this.minIntervalMs) return null;
    if (gz > this.fireAt) return this._fire('correct', now);
    if (gz < -this.fireAt) return this._fire('pass', now);
    return null;
  }
  _fire(kind, now) {
    this.armed = false;
    this.lastFire = now;
    return kind;
  }
}

// iOS 13+ requires a user-gesture-triggered permission request; elsewhere the
// event just works (over HTTPS). Resolves true when tilt events are usable.
export async function requestTiltPermission() {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try { return (await DeviceOrientationEvent.requestPermission()) === 'granted'; }
    catch { return false; }
  }
  return 'DeviceOrientationEvent' in window;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Reload tests page. Expected: `ALL PASS (16 tests)`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: tilt detection via gravity z-component with neutral-zone state machine"
```

---

### Task 4: storage.js + i18n.js

**Files:**
- Create: `js/storage.js`, `js/i18n.js`
- Modify: `test/tests.html` (i18n parity + storage tests)

- [ ] **Step 1: Create `js/storage.js`**

```js
const PREFIX = 'arriba.';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch {}
}
```

- [ ] **Step 2: Create `js/i18n.js`** (complete string tables)

```js
export const STRINGS = {
  en: {
    tagline: 'The hold-it-up guessing game',
    play: 'Play',
    players: 'Players',
    scoreboard: 'Scoreboard',
    howto: 'How to play',
    addPlayer: 'Add',
    playerPlaceholder: 'Player name',
    continue: 'Continue',
    back: 'Back',
    categories: 'Categories',
    difficulty: 'Difficulty',
    dMixed: 'Mixed',
    dEasy: 'Easy',
    dMedium: 'Medium',
    dHard: 'Hard',
    roundLength: 'Round length',
    start: 'Start',
    passTo: 'Pass the phone to',
    holdUp: 'Hold the phone on your forehead, screen facing out',
    correct: 'CORRECT',
    pass: 'PASS',
    recap: 'Round recap',
    tapToFix: 'Tap a word to change it',
    points: 'points',
    confirm: 'Confirm',
    nextPlayer: 'Next player',
    newGame: 'New game',
    resetConfirm: 'Reset all scores?',
    tapHint: 'No motion sensor — tap the right side for CORRECT, the left side for PASS',
    needCategory: 'Pick at least one category',
    needPlayer: 'Add at least one player',
    howtoText: 'One player holds the phone on their forehead, screen facing the group.\nEveryone else shouts clues for the word on screen.\nGot it? The player tilts the phone DOWN (screen to the floor).\nToo hard? Tilt UP to pass.\nWhen the timer ends, review the round, fix any miscalls, and pass the phone on.\nHighest total wins!',
  },
  es: {
    tagline: 'El juego de adivinar con el teléfono en la frente',
    play: 'Jugar',
    players: 'Jugadores',
    scoreboard: 'Marcador',
    howto: 'Cómo jugar',
    addPlayer: 'Agregar',
    playerPlaceholder: 'Nombre',
    continue: 'Continuar',
    back: 'Volver',
    categories: 'Categorías',
    difficulty: 'Dificultad',
    dMixed: 'Mixta',
    dEasy: 'Fácil',
    dMedium: 'Media',
    dHard: 'Difícil',
    roundLength: 'Duración de la ronda',
    start: 'Empezar',
    passTo: 'Pásale el teléfono a',
    holdUp: 'Pon el teléfono en tu frente con la pantalla hacia afuera',
    correct: '¡BIEN!',
    pass: 'PASO',
    recap: 'Resumen de la ronda',
    tapToFix: 'Toca una palabra para corregirla',
    points: 'puntos',
    confirm: 'Confirmar',
    nextPlayer: 'Siguiente jugador',
    newGame: 'Nuevo juego',
    resetConfirm: '¿Borrar todos los puntajes?',
    tapHint: 'Sin sensor de movimiento: toca el lado derecho para ¡BIEN! y el izquierdo para PASO',
    needCategory: 'Elige al menos una categoría',
    needPlayer: 'Agrega al menos un jugador',
    howtoText: 'Un jugador sostiene el teléfono en su frente, con la pantalla hacia el grupo.\nLos demás gritan pistas sobre la palabra en pantalla.\n¿La adivinó? Inclina el teléfono hacia ABAJO (pantalla al piso).\n¿Muy difícil? Inclínalo hacia ARRIBA para pasar.\nCuando termina el tiempo, revisa la ronda, corrige errores y pasa el teléfono.\n¡Gana quien sume más puntos!',
  },
};

let lang = 'en';

export function initLang(saved) {
  if (saved && STRINGS[saved]) lang = saved;
  else lang = (navigator.language || '').startsWith('es') ? 'es' : 'en';
}
export function setLang(l) { if (STRINGS[l]) lang = l; }
export function getLang() { return lang; }

export function t(key, vars = {}) {
  let s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replace('{' + k + '}', v);
  return s;
}

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}
```

- [ ] **Step 3: Add tests to `test/tests.html`** (import + tests before the `failures` line)

```js
import { STRINGS } from '../js/i18n.js';
import { load, save } from '../js/storage.js';
```

```js
test('i18n: en and es have identical key sets', () => {
  eq(Object.keys(STRINGS.en).sort(), Object.keys(STRINGS.es).sort());
});
test('storage: round-trips JSON and falls back on garbage', () => {
  save('__test', { a: 1 });
  eq(load('__test', null), { a: 1 });
  localStorage.setItem('arriba.__test', '{not json');
  eq(load('__test', 'fb'), 'fb');
  localStorage.removeItem('arriba.__test');
});
```

- [ ] **Step 4: Run tests**

Reload tests page. Expected: `ALL PASS (18 tests)`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: storage wrapper and EN/ES i18n with parity test"
```

---

### Task 5: audio.js

**Files:**
- Create: `js/audio.js`

WebAudio is untestable headlessly in a meaningful way; verified manually in Task 7's browser pass.

- [ ] **Step 1: Create `js/audio.js`**

```js
let ctx = null;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, startDelay, dur, type = 'sine', gain = 0.25) {
  try {
    const a = ac();
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = a.currentTime + startDelay;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  } catch {}
}

// Must be called from a user gesture once, so iOS lets us play later.
export function unlock() { try { ac(); } catch {} }

export function ding()   { tone(660, 0, 0.15); tone(880, 0.12, 0.25); }
export function whoosh() { tone(440, 0, 0.15, 'triangle'); tone(280, 0.1, 0.3, 'triangle'); }
export function tick()   { tone(880, 0, 0.08, 'square', 0.12); }
export function buzzer() { tone(160, 0, 0.7, 'sawtooth', 0.35); tone(120, 0, 0.7, 'square', 0.2); }

export function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: WebAudio sound effects and vibration helper"
```

---

### Task 6: Word decks + deck validation tests

**Files:**
- Create: `decks/en.json`, `decks/es.json`
- Modify: `test/tests.html` (async deck validation)

**Schema (both files):**

```json
{
  "categories": [
    { "id": "animals", "name": "Animals", "emoji": "🐾",
      "words": [ { "w": "Dog", "d": 1 }, { "w": "Axolotl", "d": 3 } ] }
  ]
}
```

**Category ids (identical in both languages, names localized):**

| id | en name | es name | emoji |
|---|---|---|---|
| animals | Animals | Animales | 🐾 |
| movies | Movies & TV | Cine y TV | 🎬 |
| people | Famous People | Famosos | ⭐ |
| food | Food & Drink | Comida y bebida | 🌮 |
| sports | Sports & Games | Deportes y juegos | ⚽ |
| actions | Act It Out | Actúalo | 🤸 |
| places | Places | Lugares | 🌎 |
| music | Music | Música | 🎵 |

**Content requirements (enforced by the validation tests below — this is data authoring, the acceptance criteria are executable):**
- ≥90 words per category, ≥25 per difficulty level per category, `d` ∈ {1,2,3}.
- No duplicate words within a category (case-insensitive).
- `es.json` is LatAm-flavored original content (Cantinflas, pozole, Chapultepec, cumbia…), NOT a translation of `en.json`.
- Guessable-by-clues words only; keep words short enough to render big (≤ ~24 chars).
- Difficulty rubric: d1 = instantly known to everyone (Dog, Pizza, Soccer); d2 = common but needs a beat (Flamingo, Guacamole, Cricket); d3 = niche/tricky (Axolotl, Mole de olla, Biathlon).

- [ ] **Step 1: Add failing deck validation to `test/tests.html`** — wrap the trailing results-rendering lines in a function `render()`, then add:

```js
async function validateDecks() {
  for (const lang of ['en', 'es']) {
    const deck = await (await fetch(`../decks/${lang}.json`)).json();
    test(`deck ${lang}: 8 categories with required ids`, () => {
      eq(deck.categories.map(c => c.id).sort(),
         ['actions', 'animals', 'food', 'movies', 'music', 'people', 'places', 'sports']);
    });
    for (const cat of deck.categories) {
      test(`deck ${lang}/${cat.id}: ≥90 words, ≥25 per difficulty, no dups, valid entries`, () => {
        ok(cat.name && cat.emoji, 'name and emoji present');
        ok(cat.words.length >= 90, `only ${cat.words.length} words`);
        for (const d of [1, 2, 3]) {
          const n = cat.words.filter(e => e.d === d).length;
          ok(n >= 25, `difficulty ${d} has only ${n}`);
        }
        const seen = new Set();
        for (const e of cat.words) {
          ok(typeof e.w === 'string' && e.w.trim().length > 0 && e.w.length <= 30, `bad word ${JSON.stringify(e)}`);
          ok([1, 2, 3].includes(e.d), `bad difficulty ${JSON.stringify(e)}`);
          const k = e.w.toLowerCase();
          ok(!seen.has(k), `duplicate ${e.w}`);
          seen.add(k);
        }
      });
    }
  }
}
await validateDecks().catch((e) => { results.push('FAIL deck fetch — ' + e.message); });
render();
```

- [ ] **Step 2: Run tests to verify deck tests fail**

Reload tests page. Expected: `FAIL deck fetch — …` plus prior 18 passes.

- [ ] **Step 3: Author `decks/en.json`**

Full 8-category English deck meeting the requirements. ~95–100 words per category, mainstream international/US-centric content.

- [ ] **Step 4: Author `decks/es.json`**

Full 8-category Spanish deck, Latin American cultural content (Mexican/Colombian/Argentine/Caribbean celebrities, dishes, places, música latina), everyday LatAm Spanish vocabulary.

- [ ] **Step 5: Run tests to verify all pass**

Reload tests page. Expected: `ALL PASS (36 tests)` (18 prior + 2×(1+8) deck tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: EN and ES-LatAm word decks with executable content validation"
```

---

### Task 7: app.js — screens, game loop, wake lock

**Files:**
- Create: `js/app.js`

- [ ] **Step 1: Create `js/app.js`** (complete)

```js
import { buildQueue, Round } from './engine.js';
import { TiltDetector, requestTiltPermission } from './tilt.js';
import * as audio from './audio.js';
import { load, save } from './storage.js';
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
  roundCtl.detector = new TiltDetector();
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
```

- [ ] **Step 2: Verify the full loop in the Browser pane (tap mode)**

Navigate to `http://localhost:8613/`. Walk through: add 2 players → pick 2 categories, Medium, 30s → Start → countdown → click right/left halves to mark words → wait for time-up → recap shows list, click a row to flip it → Confirm → scoreboard shows updated totals → Next player loops to handoff. Switch language on Home and confirm all labels change.

- [ ] **Step 3: Verify tilt state machine end-to-end with synthetic events** (Browser console via `javascript_tool`)

```js
window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: 175, gamma: 20 }))
```

(Only meaningful if `state.tiltOk` — on desktop it will be tap-mode; the unit tests already cover the state machine, so this step is best-effort.)

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: full game flow — screens, round loop, recap, scoreboard"
```

---

### Task 8: PWA — icons, manifest, service worker

**Files:**
- Create: `tools/gen_icons.py`, `icons/icon.svg`, `manifest.webmanifest`, `sw.js`
- Generated: `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png`

- [ ] **Step 1: Create `tools/gen_icons.py`** (stdlib only)

```python
"""Generate PNG app icons: coral background, white up-arrow. Stdlib only."""
import os
import struct
import zlib


def chunk(tag, data):
    c = struct.pack('>I', len(data)) + tag + data
    return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path, size, pixel_fn):
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            rows.extend(pixel_fn(x, y))
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(bytes(rows)))
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)


BG = (255, 84, 112, 255)   # #ff5470
FG = (255, 255, 255, 255)


def make(size, path):
    apex_y, base_y = 0.24 * size, 0.60 * size
    half_max, stem_hw, stem_bot = 0.26 * size, 0.09 * size, 0.78 * size
    cx = size / 2

    def px(x, y):
        if apex_y <= y <= base_y:
            hw = (y - apex_y) / (base_y - apex_y) * half_max
            if abs(x - cx) <= hw:
                return FG
        elif base_y < y <= stem_bot and abs(x - cx) <= stem_hw:
            return FG
        return BG

    write_png(path, size, px)


os.makedirs('icons', exist_ok=True)
make(512, 'icons/icon-512.png')
make(192, 'icons/icon-192.png')
make(180, 'icons/apple-touch-icon.png')
print('icons written')
```

- [ ] **Step 2: Run it**

Run: `cd /Users/joseramirez/games/arriba && python3 tools/gen_icons.py`
Expected: `icons written`; three PNGs exist. Read one with the Read tool to eyeball it.

- [ ] **Step 3: Create `icons/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#ff5470"/>
  <path d="M50 24 L76 60 L59 60 L59 78 L41 78 L41 60 L24 60 Z" fill="#fff"/>
</svg>
```

- [ ] **Step 4: Create `manifest.webmanifest`**

```json
{
  "name": "Arriba",
  "short_name": "Arriba",
  "description": "Free offline heads-up party game — English y Español",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#12122b",
  "theme_color": "#12122b",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 5: Create `sw.js`**

```js
// Bump the version to ship updates: a new cache is installed, old ones purged.
const CACHE = 'arriba-v1';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/engine.js',
  './js/tilt.js',
  './js/audio.js',
  './js/storage.js',
  './js/i18n.js',
  './decks/en.json',
  './decks/es.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request))
  );
});
```

- [ ] **Step 6: Verify offline behavior in the Browser pane**

Reload `http://localhost:8613/` twice (first load installs SW). Check via `javascript_tool`:
`navigator.serviceWorker.controller !== null` → expect `true`, and
`caches.keys()` → expect `['arriba-v1']`.
Then stop the preview server (`preview_stop`), reload the page — the app must still load and play (decks cached). Restart the server afterward.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: PWA — generated icons, manifest, precache service worker"
```

---

### Task 9: Full manual pass + README

**Files:**
- Modify: `README.md` (complete)

- [ ] **Step 1: Full browser pass**

In the Browser pane, with a fresh profile state (clear `localStorage` via `javascript_tool`: `localStorage.clear(); location.reload()`):
1. Home renders in EN (or ES if browser is es-*); toggle both languages.
2. Play → add players "Ana", "Beto" → Continue.
3. Select Animales + Comida, Fácil, 30s → Continue → Start.
4. Round: words are Spanish easy words from the two categories only; tap both zones; verify flash overlays, timer ticks at 3-2-1, buzzer at 0.
5. Recap: flip one row; Confirm; scoreboard ordering correct.
6. Next player → full second round; scores accumulate.
7. Reload page: players, scores, language, settings all survive.
8. New game resets scores to 0, keeps players.
9. tests.html still `ALL PASS`.

- [ ] **Step 2: Complete `README.md`**

```markdown
# ¡Arriba! — free offline heads-up party game

Hold the phone on your forehead, friends shout clues, tilt down for CORRECT,
tilt up for PASS. English y Español (Latinoamérica). 100% free, 100% offline
after the first visit — no accounts, no ads, no tracking.

## Play it

1. Open the game URL once on your phone (needs internet just this once).
2. iPhone: Share → **Add to Home Screen**. Android: menu → **Install app**.
3. Launch from the icon — airplane mode works from now on.

Tilt controls need HTTPS + a real phone; on desktop or if you deny motion
access, tap the right half for CORRECT and the left half for PASS.

## Develop

No build step, no dependencies.

    python3 -m http.server 8613

- App: http://localhost:8613/
- Tests: http://localhost:8613/test/tests.html (expect “ALL PASS”)
- Icons are generated: `python3 tools/gen_icons.py`
- Shipping an update: bump `CACHE` in `sw.js`.

## Structure

Pure logic (`js/engine.js`, `js/tilt.js`) is DOM-free and covered by the test
page. `js/app.js` owns screens and the round loop. Decks live in
`decks/{en,es}.json` — schema and content rules are enforced by the deck
validation tests.
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "docs: complete README; full manual verification pass"
```

---

### Task 10: Deploy to GitHub Pages

The user approved GitHub Pages hosting in the design review. Requires a public repo (Pages is free only on public repos).

- [ ] **Step 1: Preflight**

Run: `gh auth status`
Expected: logged in. If not, stop and ask the user to run `gh auth login`.

- [ ] **Step 2: Create repo and push**

```bash
cd /Users/joseramirez/games/arriba
gh repo create arriba --public --source=. --remote=origin --push
```

- [ ] **Step 3: Enable Pages from main branch root**

```bash
gh api -X POST "repos/{owner}/arriba/pages" -f "source[branch]=main" -f "source[path]=/" \
  || gh api -X PUT "repos/{owner}/arriba/pages" -f "source[branch]=main" -f "source[path]=/"
```

(`{owner}` resolves automatically in `gh api` paths when run inside the repo.)

- [ ] **Step 4: Wait for the site to go live**

```bash
until curl -sfo /dev/null "https://$(gh api user -q .login).github.io/arriba/"; do sleep 15; done; echo LIVE
```

Expected: `LIVE` within ~2–5 minutes.

- [ ] **Step 5: Verify the live site**

Open the live URL in the Browser pane: home screen renders, tests page passes, no console errors, manifest + SW load (subpath-relative URLs must all resolve).

- [ ] **Step 6: Commit any fixes, push, and hand the URL to the user** with install instructions (Add to Home Screen → airplane mode).

---

## Self-review notes

- **Spec coverage:** categories/difficulty/round-length selection (Task 7 setup screen), tilt + tap controls (Tasks 3, 7), per-player scores with persistence (Tasks 4, 7), bilingual UI + decks (Tasks 4, 6), offline PWA (Task 8), free hosting (Task 10), no-repeat word queue (Task 2), recap with miscall fixing (Tasks 2, 7), wake lock + sounds + vibration (Tasks 5, 7), landscape rotation CSS (Task 1). Volume keys: impossible in browsers — covered by design decision, documented in README.
- **Type consistency check:** `buildQueue(deck, categoryIds, difficulty, usedWords, rng)` matches Tasks 2/7 usage; `TiltDetector.update(beta, gamma, now)` matches Tasks 3/7; `Round` API (`current/correct/pass/finish/toggleResult/score/results/queue/exhausted`) consistent across Tasks 2/7; i18n keys used in `index.html`/`app.js` all exist in both string tables; deck category ids in Task 6 table match the validation test list.
- **Deck content:** authored at execution time; acceptance is executable (validation tests), not subjective.
