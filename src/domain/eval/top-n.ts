/**
 * Top-N research queries — NOT "safe bets".
 */

import type { ObservedMarketCoverage } from "@/domain/markets/discovery-engine";
import type { ResearchExplanation } from "@/domain/eval/research-records";
import { buildResearchExplanation } from "@/domain/eval/research-records";

export type TopReliableMarket = {
  market: string;
  line: number | null;
  sample_size: number;
  bookmakers_count: number;
  temporal_precision: string;
  data_quality_note: string;
  model_ready: false;
  explanation: ResearchExplanation;
};

export type TopSupportedOpportunity = {
  market: string;
  event: string;
  odds: number | null;
  model_probability: number | null;
  market_probability: number | null;
  data_quality: string;
  temporal_precision: string;
  sample_size: number;
  calibration: number | null;
  uncertainty: number | null;
  explanation: ResearchExplanation;
  /** Never invent. */
  confidence: null;
};

export function findTopReliableMarkets(
  coverage: readonly ObservedMarketCoverage[],
  limit = 10,
): TopReliableMarket[] {
  return [...coverage]
    .filter((c) => c.sample_size > 0)
    .sort((a, b) => {
      if (b.sample_size !== a.sample_size) return b.sample_size - a.sample_size;
      return b.bookmakers_count - a.bookmakers_count;
    })
    .slice(0, limit)
    .map((c) => ({
      market: c.market_type,
      line: c.line,
      sample_size: c.sample_size,
      bookmakers_count: c.bookmakers_count,
      temporal_precision: c.temporal_precision,
      data_quality_note: `availability=${c.availability}; catalog=${c.catalog_status}`,
      model_ready: false as const,
      explanation: buildResearchExplanation({
        supportingFeatures: [`sample_size=${c.sample_size}`],
        marketEvidence: [`bookmakers=${c.bookmakers_count}`],
        temporalQualityNotes: [`precision=${c.temporal_precision}`],
        dataQualityNotes: [`NOT MODEL_READY`],
      }),
    }));
}

export function findTopSupportedOpportunities(
  candidates: readonly TopSupportedOpportunity[],
  limit = 10,
): TopSupportedOpportunity[] {
  return candidates
    .filter((c) => c.confidence === null)
    .filter((c) => c.temporal_precision !== "promoted_exact")
    .slice(0, limit);
}
