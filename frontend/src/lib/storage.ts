/**
 * Lightweight localStorage cache with per-entry TTL.
 * Entries older than ttlMs are silently dropped on read.
 */

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface Stamped<T> {
  data: T;
  savedAt: number;
}

export function readCache<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const stored = JSON.parse(raw) as Record<string, Stamped<T>>;
    const now = Date.now();
    const valid: Record<string, T> = {};
    for (const [k, v] of Object.entries(stored)) {
      if (now - v.savedAt < TTL_MS) valid[k] = v.data;
    }
    return valid;
  } catch {
    return {};
  }
}

export function writeEntry<T>(key: string, name: string, value: T): void {
  try {
    const raw = localStorage.getItem(key);
    const stored: Record<string, Stamped<T>> = raw ? JSON.parse(raw) : {};
    stored[name] = { data: value, savedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(stored));
  } catch {
    // Quota exceeded or private browsing — fail silently
  }
}

// ── Per-entry split cache ────────────────────────────────────────────────────
// Large values (e.g. hex GeoJSON) can exceed the per-key localStorage quota
// when all entries are packed into a single JSON blob. These helpers store each
// entry under its own key (<bucketKey>::<entryKey>) so quota is hit per-entry
// rather than all-or-nothing.

const SPLIT_SEP = "::";

/**
 * Read all non-expired entries whose localStorage key starts with
 * `<bucketKey>::`. Expired entries are pruned in place.
 */
export function readSplitCache<T>(bucketKey: string): Record<string, T> {
  const prefix = bucketKey + SPLIT_SEP;
  const result: Record<string, T> = {};
  const toRemove: string[] = [];
  const now = Date.now();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(prefix)) continue;
      const entryKey = k.slice(prefix.length);
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const stamped = JSON.parse(raw) as Stamped<T>;
        if (now - stamped.savedAt < TTL_MS) {
          result[entryKey] = stamped.data;
        } else {
          toRemove.push(k);
        }
      } catch {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch {
    return {};
  }
  return result;
}

/** Write a single entry under `<bucketKey>::<entryKey>`. */
export function writeSplitEntry<T>(bucketKey: string, entryKey: string, value: T): void {
  try {
    localStorage.setItem(
      `${bucketKey}${SPLIT_SEP}${entryKey}`,
      JSON.stringify({ data: value, savedAt: Date.now() } as Stamped<T>)
    );
  } catch {
    // Quota exceeded or private browsing — fail silently
  }
}

/**
 * Remove all split-cache entries for a given bucket key.
 * Call this during cache-version migrations.
 */
export function purgeSplitCache(bucketKey: string): void {
  const prefix = bucketKey + SPLIT_SEP;
  const toRemove: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) toRemove.push(k);
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}
