import type { ChangeClass048 } from "@/domain/eval/factory-048/config";
import type { PermanentQuote044 } from "@/domain/eval/permanent-044/types";

export type ChangeRecord048 = {
  event_id: string;
  from_available_at: string | null;
  to_available_at: string | null;
  odds_change: number | null;
  probability_change: number | null;
  edge_change: number | null;
  market_consensus_change: null;
  rank_change: null;
  confidence_change: null;
  change_class: ChangeClass048;
  relative_to_lock: "PRE_LOCK" | "POST_LOCK";
  note: string;
};

export function classifyChange048(absOddsDelta: number): ChangeClass048 {
  if (absOddsDelta < 0.02) return "NO_CHANGE";
  if (absOddsDelta < 0.08) return "MINOR_CHANGE";
  if (absOddsDelta < 0.2) return "MATERIAL_CHANGE";
  return "CRITICAL_CHANGE";
}

/** Compare two quote prices for same market/selection/book. */
export function detectQuoteChange048(input: {
  eventId: string;
  pre: PermanentQuote044;
  post: PermanentQuote044;
  lockMs: number | null;
}): ChangeRecord048 {
  const change = input.post.price - input.pre.price;
  const postMs = input.post.available_at_utc ? Date.parse(input.post.available_at_utc) : NaN;
  const relative: "PRE_LOCK" | "POST_LOCK" =
    input.lockMs != null && Number.isFinite(postMs) && postMs > input.lockMs ? "POST_LOCK" : "PRE_LOCK";
  return {
    event_id: input.eventId,
    from_available_at: input.pre.available_at_utc,
    to_available_at: input.post.available_at_utc,
    odds_change: change,
    probability_change: null,
    edge_change: null,
    market_consensus_change: null,
    rank_change: null,
    confidence_change: null,
    change_class: classifyChange048(Math.abs(change)),
    relative_to_lock: relative,
    note:
      relative === "POST_LOCK"
        ? "POST_LOCK change recorded — does NOT mutate LOCK decision"
        : "PRE_LOCK change within decision window",
  };
}
