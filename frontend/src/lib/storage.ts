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
