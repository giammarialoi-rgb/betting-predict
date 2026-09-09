import { parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import { secondsToKickoff, windowOf } from "@/domain/eval/prospective-036/windows";
import { WINDOWS_039, type Window039 } from "@/domain/eval/live-039/types";

export function asOfCutoffMs039(commenceTime: string, offsetSeconds: number): number | null {
  const kick = parseExactUtcMs(commenceTime);
  if (kick == null) return null;
  return kick - offsetSeconds * 1000;
}

export function lastAtOrBeforeCutoff039<T extends { sourceMs: number }>(
  quotes: readonly T[],
  cutoffMs: number,
): T | null {
  const eligible = quotes.filter((q) => q.sourceMs <= cutoffMs);
  if (!eligible.length) return null;
  return eligible.reduce((a, b) => (a.sourceMs >= b.sourceMs ? a : b));
}

export function t1hCutoffMs039(commenceTime: string): number | null {
  return asOfCutoffMs039(commenceTime, 3600);
}

export function observationWindow039(sourceQuoteUtc: string, commenceTime: string): Window039 | null {
  const q = parseExactUtcMs(sourceQuoteUtc);
  const k = parseExactUtcMs(commenceTime);
  if (q == null || k == null) return null;
  const sec = secondsToKickoff(q, k);
  const w = windowOf(sec);
  return w && (WINDOWS_039 as readonly string[]).includes(w) ? (w as Window039) : null;
}

export function binCoverage039(
  quotes: readonly { sourceQuoteUtc: string }[],
  commenceTime: string,
): Record<Window039, 0 | 1> {
  const cov = Object.fromEntries(WINDOWS_039.map((w) => [w, 0])) as Record<Window039, 0 | 1>;
  for (const q of quotes) {
    const w = observationWindow039(q.sourceQuoteUtc, commenceTime);
    if (w) cov[w] = 1;
  }
  return cov;
}

export function eventCoverageRate039(
  events: readonly { event_id: string; commence_time: string | null }[],
  quotes: readonly { event_id: string; source_quote_timestamp: string | null; temporal_class: string }[],
  window: Window039,
): number {
  const eligible = events.filter((e) => e.commence_time);
  if (!eligible.length) return 0;
  let hit = 0;
  for (const ev of eligible) {
    const qs = quotes.filter(
      (q) => q.event_id === ev.event_id && q.temporal_class === "STRICT" && q.source_quote_timestamp,
    );
    const cov = binCoverage039(
      qs.map((q) => ({ sourceQuoteUtc: q.source_quote_timestamp! })),
      ev.commence_time!,
    );
    if (cov[window] === 1) hit += 1;
  }
  return hit / eligible.length;
}
