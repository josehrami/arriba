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
