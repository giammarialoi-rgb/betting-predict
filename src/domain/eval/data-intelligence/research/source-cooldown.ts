/**
 * Source cooldown after repeated 403/429. Other sources keep running.
 */
const blockedUntil = new Map<string, number>();

export function markSourceBlocked(sourceId: string, httpStatus: number, nowMs = Date.now()): void {
  const wait =
    httpStatus === 429 ? 30 * 60 * 1000 : httpStatus === 403 ? 6 * 60 * 60 * 1000 : 10 * 60 * 1000;
  const until = nowMs + wait;
  const prev = blockedUntil.get(sourceId) ?? 0;
  blockedUntil.set(sourceId, Math.max(prev, until));
}

export function sourceOnCooldown(sourceId: string, nowMs = Date.now()): boolean {
  const until = blockedUntil.get(sourceId);
  return until != null && until > nowMs;
}

export function clearSourceCooldown(sourceId?: string): void {
  if (sourceId) blockedUntil.delete(sourceId);
  else blockedUntil.clear();
}
