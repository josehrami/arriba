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
