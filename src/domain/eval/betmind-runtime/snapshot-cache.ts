/** In-process snapshot cache for /api/betmind/snapshot. */
type CacheEntry = { at: number; body: Record<string, unknown> };

let cache: CacheEntry | null = null;
const CACHE_MS = 3500;

export function readSnapshotCache(now = Date.now()): Record<string, unknown> | null {
  if (cache && now - cache.at < CACHE_MS) return cache.body;
  return null;
}

export function writeSnapshotCache(body: Record<string, unknown>, now = Date.now()): void {
  cache = { at: now, body };
}

export function invalidateBetMindSnapshotCache(): void {
  cache = null;
}
