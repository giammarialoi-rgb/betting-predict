/**
 * Top-10 V2 — may return fewer than requested with insufficient evidence.
 */

import {
  findTopOpportunities,
  type FindTopOpportunitiesQuery,
  type RankedOpportunity,
} from "@/domain/eval/top-opportunities";

export type Top10V2Result = {
  mode: string;
  requested: number;
  qualified: RankedOpportunity[];
  insufficient_evidence: number;
  message:
    | "OK"
    | "NO_QUALIFIED_OPPORTUNITY"
    | "PARTIAL_QUALIFIED";
};

function qualifies(o: RankedOpportunity, minQuality = 0.4): boolean {
  if (o.scores.data_quality < minQuality) return false;
  if (o.model_probability == null || o.market_probability == null) return false;
  if (o.scores.edge_level === "NO_SIGNAL" && o.scores.data_quality < 0.7) {
    return false;
  }
  return true;
}

/**
 * Never pad the list to fill `limit`. Prefer honesty over 10 fake rows.
 */
export function findTop10V2(
  candidates: readonly RankedOpportunity[],
  query: FindTopOpportunitiesQuery & {
    minQuality?: number;
  } = {},
): Top10V2Result {
  const limit = query.limit ?? 10;
  const minQuality = query.minQuality ?? 0.4;
  const eligible = candidates.filter((c) => qualifies(c, minQuality));
  const ranked = findTopOpportunities(eligible, { ...query, limit });
  const insufficient = Math.max(0, limit - ranked.length);

  let message: Top10V2Result["message"] = "OK";
  if (ranked.length === 0) message = "NO_QUALIFIED_OPPORTUNITY";
  else if (ranked.length < limit) message = "PARTIAL_QUALIFIED";

  return {
    mode: query.mode ?? "interesting",
    requested: limit,
    qualified: ranked,
    insufficient_evidence: insufficient,
    message,
  };
}
