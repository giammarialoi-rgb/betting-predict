/**
 * Market movement. CLOSE never enters DecisionContext.
 * CLOSE may be used after LOCK for evaluation only.
 */

import { marketMovement } from "@/domain/odds/math";
import type { MarketSnapshot } from "@/domain/eval/capital-020/types";

export type Movement020 = {
  opening: number | null;
  latest_available: number | null;
  closing: number | null;
  absolute: number | null;
  relative: number | null;
  implied_delta: number | null;
  close_used_in_decision: false;
};

export function marketPath(
  snaps: readonly MarketSnapshot[],
  asOf: Date,
  afterLock = false,
): Movement020 {
  const open = snaps.filter((s) => s.observationKind === "open");
  const close = snaps.filter((s) => s.observationKind === "close");
  const latest = open
    .filter((s) => Date.parse(s.observedAt) <= asOf.getTime())
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
    .at(-1);
  const first = open[0];
  const closeSnap = afterLock ? close[0] : undefined;
  const from = first?.odds ?? null;
  const to = latest?.odds ?? null;
  let absolute: number | null = null;
  let relative: number | null = null;
  let implied: number | null = null;
  if (from != null && to != null && from > 1 && to > 1) {
    const mv = marketMovement(from, to);
    absolute = mv.oddsChange.oddsDelta;
    relative = mv.oddsChange.oddsRelativeChange;
    implied = mv.impliedProbabilityChange.impliedProbabilityDelta;
  }
  return {
    opening: from,
    latest_available: to,
    closing: closeSnap?.odds ?? null,
    absolute,
    relative,
    implied_delta: implied,
    close_used_in_decision: false,
  };
}
