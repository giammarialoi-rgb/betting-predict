import { parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import { WINDOWS_038, type Coverage038, type Window038 } from "@/domain/eval/datalake-038/types";

export const ASOF_OFFSET_SECONDS_038: Record<Window038, number> = {
  "T-72h": 72 * 3600,
  "T-48h": 48 * 3600,
  "T-24h": 24 * 3600,
  "T-12h": 12 * 3600,
  "T-6h": 6 * 3600,
  "T-3h": 3 * 3600,
  "T-1h": 3600,
  "T-30m": 30 * 60,
  "T-15m": 15 * 60,
  "T-5m": 5 * 60,
  "T-1m": 60,
};

export function asOfUtcMs038(kickoffUtc: string, window: Window038): number | null {
  const kick = parseExactUtcMs(kickoffUtc);
  if (kick == null) return null;
  return kick - ASOF_OFFSET_SECONDS_038[window] * 1000;
}

export function lastObservationAtOrBeforeAsOf<T extends { observedAtMs: number }>(
  quotes: readonly T[],
  asOfMs: number,
): T | null {
  const eligible = quotes.filter((q) => q.observedAtMs <= asOfMs);
  if (!eligible.length) return null;
  return eligible.reduce((a, b) => (a.observedAtMs >= b.observedAtMs ? a : b));
}

export function snapshotForWindow038<T extends { observedAtMs: number; bookmaker: string; market: string; selection: string }>(
  quotes: readonly T[],
  kickoffUtc: string,
  window: Window038,
): T | null {
  const asOf = asOfUtcMs038(kickoffUtc, window);
  if (asOf == null) return null;
  return lastObservationAtOrBeforeAsOf(quotes, asOf);
}

export function emptyCoverage038(): Coverage038 {
  return Object.fromEntries(WINDOWS_038.map((w) => [w, 0])) as Coverage038;
}

export function coverageFromObservations038(
  quotes: readonly { observedAtMs: number; bookmaker: string; market: string; selection: string }[],
  kickoffUtc: string,
): Coverage038 {
  const cov = emptyCoverage038();
  for (const w of WINDOWS_038) {
    cov[w] = snapshotForWindow038(quotes, kickoffUtc, w) ? 1 : 0;
  }
  return cov;
}

export function lastObservationAtOrBeforeT1h038<T extends { observedAtMs: number; kickoffMs: number }>(
  quotes: readonly T[],
): T | null {
  const eligible = quotes.filter((q) => q.observedAtMs <= q.kickoffMs - 3_600_000 && q.observedAtMs < q.kickoffMs);
  if (!eligible.length) return null;
  return eligible.reduce((a, b) => (a.observedAtMs >= b.observedAtMs ? a : b));
}
