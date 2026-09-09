import type { Window039 } from "@/domain/eval/live-039/types";
import { observationWindow039 } from "@/domain/eval/live-039/asof";
import type { PermanentEvent044, PermanentQuote044 } from "@/domain/eval/permanent-044/types";

export const COVERAGE_BIN_LABELS_047 = [
  "T72",
  "T48",
  "T24",
  "T12",
  "T6",
  "T3",
  "T1H",
  "T30M",
  "T15M",
  "T5M",
  "T1M",
] as const;

export type CoverageBinLabel047 = (typeof COVERAGE_BIN_LABELS_047)[number];

const WINDOW_TO_LABEL: Record<Window039, CoverageBinLabel047> = {
  "T-72h": "T72",
  "T-48h": "T48",
  "T-24h": "T24",
  "T-12h": "T12",
  "T-6h": "T6",
  "T-3h": "T3",
  "T-1h": "T1H",
  "T-30m": "T30M",
  "T-15m": "T15M",
  "T-5m": "T5M",
  "T-1m": "T1M",
};

/** TRUE only when a real available_at quote falls in the bin. Never use collected_at. */
export function coverageBinsForEvent047(
  event: PermanentEvent044,
  quotes: PermanentQuote044[],
): Record<CoverageBinLabel047, boolean> {
  const out = Object.fromEntries(COVERAGE_BIN_LABELS_047.map((k) => [k, false])) as Record<
    CoverageBinLabel047,
    boolean
  >;
  if (!event.kickoff_utc) return out;
  for (const q of quotes) {
    if (q.event_id !== event.event_id || !q.available_at_utc) continue;
    const w = observationWindow039(q.available_at_utc, event.kickoff_utc);
    if (w) out[WINDOW_TO_LABEL[w]] = true;
  }
  return out;
}

export function neverSubstituteCollectedAt047(
  available_at: string | null,
  collected_at: string,
): { available_at: string | null; collected_at: string; substituted: false } {
  // Explicit contract: callers must not pass collected_at as available_at.
  void collected_at;
  return { available_at, collected_at, substituted: false };
}
