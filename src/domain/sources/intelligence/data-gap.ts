/**
 * DATA_GAP_VALUE — next best acquisition recommendations.
 */

import type { DataGapRecommendation } from "./types";
import { summarizeMarketSourceCoverage } from "./market-matrix";
import { buildSourceIntelligenceCatalog } from "./catalog";

/**
 * Rank gaps by research value given current lab state (MODEL_READY=0, corners missing, etc.).
 */
export function computeDataGapRecommendations(): DataGapRecommendation[] {
  const catalog = buildSourceIntelligenceCatalog();
  const markets = summarizeMarketSourceCoverage(catalog);

  const gaps: DataGapRecommendation[] = [];

  const corners = markets.find((m) => m.market === "corners");
  gaps.push({
    gap_id: "gap_historical_corners",
    missing: "historical corners + bookmaker lines",
    why: "corners catalogued but DATA_MISSING / not observed; high information gap vs 1X2 saturation",
    candidate_sources: catalog
      .filter((s) => s.marketsSupported.includes("corners") || s.capabilities.includes("corners"))
      .map((s) => s.id)
      .slice(0, 8),
    expected_research_value: "HIGH",
    implementation_cost: "UNKNOWN",
    temporal_precision: "unknown",
    next_best_acquisition: "Historical corners + bookmaker closing lines",
  });
  void corners;

  gaps.push({
    gap_id: "gap_cards",
    missing: "historical cards totals / team cards",
    why: "cards markets catalogued with no verified primary historical source",
    candidate_sources: catalog
      .filter((s) => s.marketsSupported.includes("cards") || s.capabilities.includes("cards"))
      .map((s) => s.id)
      .slice(0, 8),
    expected_research_value: "HIGH",
    implementation_cost: "UNKNOWN",
    temporal_precision: "unknown",
    next_best_acquisition: "Cards event data with available_at timestamps",
  });

  gaps.push({
    gap_id: "gap_exact_odds_timestamps",
    missing: "exact temporal precision on odds snapshots",
    why: "current football-data.co.uk pack is dataset_window/unknown — blocks MODEL_READY",
    candidate_sources: ["football-data-co-uk", "pinnacle", "betfair-exchange", "the-odds-api"],
    expected_research_value: "HIGH",
    implementation_cost: "MEDIUM",
    temporal_precision: "unknown",
    next_best_acquisition: "Odds feed with exact snapshot timestamps (exchange or documented API)",
  });

  gaps.push({
    gap_id: "gap_lineups_injuries",
    missing: "lineups + injuries with available_at ≤ asOf",
    why: "player props and team strength shifts require pre-decision availability",
    candidate_sources: catalog
      .filter((s) => s.injuries || s.lineups)
      .map((s) => s.id)
      .slice(0, 10),
    expected_research_value: "MEDIUM",
    implementation_cost: "HIGH",
    temporal_precision: "unknown",
    next_best_acquisition: "Injury/lineup feed with publication timestamps (no scraping)",
  });

  gaps.push({
    gap_id: "gap_multi_division_results",
    missing: "multi-division historical results (E0–E3, I1, SP1, …)",
    why: "offline pack N≈61 < 200; live football-data.co.uk BLOCKED HTTP_503",
    candidate_sources: ["football-data-co-uk", "football-data-org", "openligadb"],
    expected_research_value: "HIGH",
    implementation_cost: "LOW",
    temporal_precision: "dataset_window",
    next_best_acquisition: "Retry football-data.co.uk multi-division CSV when HTTP 200; expand offline archives",
  });

  return gaps;
}

export function selectNextBestAcquisition(
  gaps: readonly DataGapRecommendation[] = computeDataGapRecommendations(),
): DataGapRecommendation {
  const high = gaps.filter((g) => g.expected_research_value === "HIGH");
  const lowCost = high.find((g) => g.implementation_cost === "LOW");
  return lowCost ?? high[0] ?? gaps[0]!;
}
