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
