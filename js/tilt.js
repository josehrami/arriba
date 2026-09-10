const DEG = Math.PI / 180;

// Gravity component along the screen normal, from deviceorientation angles.
// +1: screen faces the floor. -1: screen faces the ceiling. 0: screen vertical.
// Working in this projection instead of raw beta/gamma keeps the value
// continuous through the Euler-angle flip at the vertical forehead pose.
export function faceDown(beta, gamma) {
  return -Math.cos(beta * DEG) * Math.cos(gamma * DEG);
}

// Trigger thresholds by sensitivity level: high fires on a slight tilt,
// low demands a deliberate one. Values are |gz| a tilt must exceed.
export const SENSITIVITY = { high: 0.45, medium: 0.55, low: 0.75 };

// Neutral-zone state machine: one nod = one word. After firing, the phone
// must return to the neutral band (|gz| < neutralAt) before it can fire again.
// Thresholds are per-direction: PASS defaults stricter than CORRECT because
// players naturally drift the phone upward while thinking.
export class TiltDetector {
  constructor({ fireDownAt = SENSITIVITY.medium, fireUpAt = SENSITIVITY.low,
                neutralAt = 0.3, minIntervalMs = 350 } = {}) {
    this.fireDownAt = fireDownAt;
    this.fireUpAt = fireUpAt;
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
    if (gz > this.fireDownAt) return this._fire('correct', now);
    if (gz < -this.fireUpAt) return this._fire('pass', now);
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
