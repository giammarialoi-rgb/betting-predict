const lastCallAt = new Map<string, number>();

export function getMinIntervalMs(
  envValue: string | undefined,
  fallback = 700,
): number {
  const parsed = Number(envValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

export async function waitForProviderSlot(
  providerId: string,
  minIntervalMs: number,
  now: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = delay,
): Promise<void> {
  const previous = lastCallAt.get(providerId) ?? 0;
  const elapsed = now() - previous;
  if (elapsed < minIntervalMs) {
    await sleep(minIntervalMs - elapsed);
  }
  lastCallAt.set(providerId, now());
}

export function resetRateLimiter(): void {
  lastCallAt.clear();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
