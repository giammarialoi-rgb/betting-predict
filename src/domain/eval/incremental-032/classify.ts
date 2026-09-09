import type { IncrementalClass032, Score032 } from "@/domain/eval/incremental-032/types";

export function incrementalClass032(input: {
  id: string;
  test: Score032;
  holmRejected: boolean;
  ci: { low: number; high: number } | null;
}): IncrementalClass032 {
  if (input.id === "market_only") return "INCONCLUSIVE";
  const db = input.test.delta_brier;
  const dl = input.test.delta_logloss;
  if (db == null || dl == null) return "INCONCLUSIVE";
  const ci = input.ci;
  const beats =
    db < 0 && dl <= 0 && input.holmRejected === true && ci != null && ci.high < 0;
  if (beats) return "BEATS_MARKET";
  if (ci != null && ci.low > 0 && db > 0) return "HARMFUL";
  if (ci != null && ci.low <= 0 && ci.high >= 0) return "NON_INFERIOR";
  return "INCONCLUSIVE";
}
