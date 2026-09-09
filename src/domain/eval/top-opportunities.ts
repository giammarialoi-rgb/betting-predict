/**
 * Top opportunities ranking — reliability ≠ edge.
 */

import type { EdgeLevel } from "@/domain/eval/edge-levels";
import type { WhyExplanation } from "@/domain/eval/why-explanation";
import type { ResearchExplanation } from "@/domain/eval/research-records";

export type OpportunityScores = {
  data_quality: number;
  model_confidence: number | null;
  market_agreement: number | null;
  uncertainty: number | null;
  edge_raw: number;
  edge_level: EdgeLevel;
};

export type RankedOpportunity = {
  eventId: string;
  sport: string;
  market: string;
  line: number | null;
  selection: string;
  odds: number | null;
  model_probability: number | null;
  market_probability: number | null;
  scores: OpportunityScores;
  why: WhyExplanation | null;
  explanation: ResearchExplanation | null;
  /** Never invent. */
  confidence: null;
  bet_recommendation: null;
};

export type FindTopOpportunitiesQuery = {
  sport?: string;
  date?: string;
  limit?: number;
  mode?:
    | "interesting"
    | "reliable"
    | "quality"
    | "edge_candidate"
    | "consensus"
    | "disagreement"
    | "data_quality"
    | "odds_band"
    | "doubtful";
  oddsMin?: number;
  oddsMax?: number;
};

function sortKey(
  mode: NonNullable<FindTopOpportunitiesQuery["mode"]>,
  o: RankedOpportunity,
): number {
  switch (mode) {
    case "reliable":
    case "quality":
      return o.scores.data_quality * 1000 + (o.scores.model_confidence ?? 0);
    case "edge_candidate":
      return Math.abs(o.scores.edge_raw);
    case "consensus":
      return o.scores.market_agreement ?? 0;
    case "disagreement":
      return Math.abs(o.scores.edge_raw) + (1 - (o.scores.market_agreement ?? 0));
    case "data_quality":
      return o.scores.data_quality;
    case "doubtful":
      return o.scores.uncertainty ?? 0;
    case "odds_band":
      return Math.abs(o.scores.edge_raw);
    case "interesting":
    default:
      return (
        Math.abs(o.scores.edge_raw) * 0.5 + o.scores.data_quality * 0.5
      );
  }
}

/**
 * Deterministic top-N. Does NOT recommend bets.
 */
export function findTopOpportunities(
  candidates: readonly RankedOpportunity[],
  query: FindTopOpportunitiesQuery = {},
): RankedOpportunity[] {
  const limit = query.limit ?? 10;
  const mode = query.mode ?? "interesting";
  let rows = [...candidates];
  if (query.sport) {
    rows = rows.filter((r) => r.sport === query.sport);
  }
  if (query.oddsMin != null || query.oddsMax != null) {
    rows = rows.filter((r) => {
      if (r.odds == null) return false;
      if (query.oddsMin != null && r.odds < query.oddsMin) return false;
      if (query.oddsMax != null && r.odds > query.oddsMax) return false;
      return true;
    });
  }
  rows.sort((a, b) => {
    const ka = sortKey(mode, a);
    const kb = sortKey(mode, b);
    if (kb !== ka) return kb - ka;
    // Deterministic tie-break
    return `${a.eventId}|${a.market}|${a.selection}`.localeCompare(
      `${b.eventId}|${b.market}|${b.selection}`,
    );
  });
  return rows.slice(0, limit).map((r) => ({
    ...r,
    confidence: null,
    bet_recommendation: null,
  }));
}
