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

// "arriba-v3" → "v3". The newest wins when an update briefly leaves two
// caches installed. null when no app cache exists yet (first-ever load).
export function versionFromCacheNames(names) {
  const versions = names
    .filter((n) => n.startsWith('arriba-v'))
    .map((n) => Number(n.slice('arriba-v'.length)))
    .filter(Number.isFinite);
  return versions.length ? 'v' + Math.max(...versions) : null;
}
