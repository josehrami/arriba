# Arriba — Offline HeadsUp-Style Party Game (Design Spec)

Date: 2026-08-10
Status: Approved by user

## Purpose

A free, fully offline HeadsUp-style party game playable on any phone. One
player holds the phone to their forehead; teammates give clues; the player
tilts the phone to mark words correct or passed before the timer runs out.
Scores accumulate per player across rounds.

## Constraints (user requirements)

- Free to play; no accounts, no purchases, no ads.
- Works with **zero network connection** after first install.
- Category selection (one or more) and difficulty selection per round.
- Gyroscope tilt to advance words (volume keys are impossible in mobile
  browsers, so tilt is primary with a tap fallback).
- Per-player score tracking.
- Language configurable: **English** and **Spanish (Latin America)** — both
  UI strings and word decks.

## Platform decision

Static **PWA** (no build step, no framework, no dependencies):

- Hosted on GitHub Pages for HTTPS (required by iOS for the
  `DeviceOrientationEvent.requestPermission()` API and for service workers).
- Service worker precaches every file on first visit; a `manifest.webmanifest`
  makes it installable to the home screen, full-screen, offline forever.
- No external requests at all: system font stack, inline SVG icons,
  WebAudio-generated sounds (no audio files).

Rejected alternatives: single self-contained HTML file (iOS denies gyroscope
permission on `file://`, and a 3k-line file is unmaintainable); framework
build (adds a toolchain for no benefit).

## Game flow

1. **Home** — title, language toggle (EN / ES-LatAm), Play, Scoreboard,
   How-to-play.
2. **Players** — add/remove player names (persisted in `localStorage`).
   Minimum 1 player.
3. **Round setup** — pick categories (multi-select, at least one),
   difficulty (Easy / Medium / Hard / Mixed), round length
   (30 / 60 / 90 / 120 s, default 60). Choices persist as defaults.
4. **Hand-off** — screen shows whose turn it is; current player taps
   Start (this tap also requests gyroscope permission on iOS).
5. **Countdown** — "place on forehead" prompt, 3-2-1 with beeps, landscape
   orientation expected.
6. **Round** — word full-screen; timer visible; **tilt down = correct**
   (green flash + ding + vibration), **tilt up = pass** (orange flash +
   whoosh). Tap fallback: right half = correct, left half = pass. Buzzer
   at 0:00. Screen wake-lock held for the duration.
7. **Recap** — every word listed as got/missed; each row tappable to flip
   a miscall. Confirm adds the round score to the player's total.
8. **Scoreboard** — running totals per player, sorted; Next Player or
   New Game (resets scores, keeps players).

Scores and players persist in `localStorage` (session survives page reloads);
"New Game" resets scores only.

## Tilt detection

- `deviceorientation` events; a **neutral-zone state machine**: from NEUTRAL,
  crossing the down-threshold fires CORRECT, crossing the up-threshold fires
  PASS; the phone must return to the neutral band before another event can
  fire (one nod = one word). Thresholds tuned for a phone held landscape
  against the forehead, screen facing out.
- Debounce window after each trigger to absorb wobble.
- If permission is denied or no sensor exists, the round silently uses
  tap-only mode (an unobtrusive hint shows the tap zones).

## Word decks

- `decks/en.json` and `decks/es.json`, same schema:
  `{ categories: [{ id, name, emoji, words: [{ w, d }] }] }` where `d` is
  1 (easy) / 2 (medium) / 3 (hard).
- 8 categories per language: Animals, Movies & TV, Famous People, Food,
  Sports, Actions (charades-style), Places, Music.
- ~90–120 words per category, spread across difficulties.
- The Spanish deck is **Latin-America-flavored** (its own celebrities,
  foods, music, places), not a translation of the English deck.
- Round word queue: union of selected categories, filtered by difficulty
  (Mixed = all), shuffled (Fisher–Yates); words are not repeated within a
  session until the filtered pool is exhausted, then it reshuffles.

## Architecture

```
index.html            app shell, screen containers
styles.css            all styling, landscape + portrait layouts
js/engine.js          pure logic: deck filtering, shuffle, queue, scoring,
                      round state — no DOM (unit-testable)
js/tilt.js            orientation permission + neutral-zone state machine
js/audio.js           WebAudio beeps: ding, whoosh, countdown, buzzer
js/storage.js         localStorage wrapper: players, scores, settings
js/i18n.js            UI strings EN/ES + language switching
js/app.js             screens, event wiring, game loop, wake lock
decks/en.json         English deck
decks/es.json         Spanish (LatAm) deck
sw.js                 precache-all service worker, cache-first
manifest.webmanifest  installable PWA metadata + inline-SVG icons
test/engine.test.html tests for engine.js run in browser (no toolchain)
```

Each `js/` module has one purpose and communicates through small explicit
interfaces; `engine.js` never touches the DOM.

## Error handling

- Gyro permission denied / unsupported → tap mode, no error dialog.
- Wake lock unsupported → ignore (screen may dim; not fatal).
- Corrupt `localStorage` → reset to defaults silently.
- Deck fetch fails on first-ever load (no cache yet, no network) → visible
  "connect once to install" message; never happens after install.

## Testing

- `engine.js` covered by browser-run unit tests (queue no-repeat, difficulty
  filtering, scoring, miscall flips).
- Tilt state machine tested with synthetic orientation values.
- Manual verification in the in-app browser: full game loop via tap
  controls, offline reload with service worker, both languages.

## How the user plays it (after deploy)

Open the GitHub Pages URL once on the phone → Share → Add to Home Screen →
launch from the icon; airplane mode works from then on.
