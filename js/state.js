// Availability cache layered over api.js. Caches per-collection date sets in
// localStorage with a 6-hour TTL so calendar navigation feels instant.

import { getAvailableDates } from "./api.js";

const TTL_MS = 6 * 60 * 60 * 1000;
const KEY_PREFIX = "nasa-eyes:avail:";
const memoryCache = new Map(); // collection → Set<"YYYY-MM-DD">

function loadFromStorage(collection) {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + collection);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.fetchedAt || Date.now() - parsed.fetchedAt > TTL_MS) return null;
    return new Set(parsed.dates);
  } catch {
    return null;
  }
}

function saveToStorage(collection, dateSet) {
  try {
    localStorage.setItem(
      KEY_PREFIX + collection,
      JSON.stringify({ fetchedAt: Date.now(), dates: [...dateSet] }),
    );
  } catch {
    // Quota exceeded or storage disabled — fine, memory cache still works.
  }
}

export async function ensureAvailability(collection) {
  if (memoryCache.has(collection)) return memoryCache.get(collection);

  const fromStorage = loadFromStorage(collection);
  if (fromStorage) {
    memoryCache.set(collection, fromStorage);
    return fromStorage;
  }

  const records = await getAvailableDates(collection);
  const dateSet = new Set(records.map((r) => r.date));
  memoryCache.set(collection, dateSet);
  saveToStorage(collection, dateSet);
  return dateSet;
}

export function isAvailableSync(collection, isoDate) {
  const set = memoryCache.get(collection);
  return set ? set.has(isoDate) : false;
}

export function clearAvailabilityCache(collection) {
  if (collection) {
    memoryCache.delete(collection);
    try { localStorage.removeItem(KEY_PREFIX + collection); } catch {}
  } else {
    memoryCache.clear();
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(KEY_PREFIX)) localStorage.removeItem(key);
      }
    } catch {}
  }
}

// Convenience: nearest available date to a target, or null if set is empty.
export function findNearestAvailable(dateSet, target /* "YYYY-MM-DD" */) {
  if (!dateSet || dateSet.size === 0) return null;
  if (dateSet.has(target)) return target;

  const t = new Date(target + "T00:00:00Z").getTime();
  let best = null;
  let bestDist = Infinity;
  for (const d of dateSet) {
    const cur = new Date(d + "T00:00:00Z").getTime();
    const dist = Math.abs(cur - t);
    if (dist < bestDist || (dist === bestDist && d < best)) {
      best = d;
      bestDist = dist;
    }
  }
  return best;
}
