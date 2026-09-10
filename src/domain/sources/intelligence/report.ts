/**
 * TASK 014-A intelligence report.
 */

import { buildSourceIntelligenceCatalog, listByRole, listByTier } from "./catalog";
import { computeIndependenceReport } from "./independence";
import { rankAcquisitionPriorities } from "./acquisition-priority";
import { summarizeMarketSourceCoverage } from "./market-matrix";
import {
  computeDataGapRecommendations,
  selectNextBestAcquisition,
} from "./data-gap";
import { computeSourceValueScore } from "./value-score";
import { SOURCE_ROLES } from "./types";

export function runSourceIntelligenceReport() {
  const catalog = buildSourceIntelligenceCatalog();
  const independence = computeIndependenceReport(catalog);
  const priorities = rankAcquisitionPriorities(catalog, 15);
  const marketSummary = summarizeMarketSourceCoverage(catalog);
  const gaps = computeDataGapRecommendations();
  const next = selectNextBestAcquisition(gaps);

  const roleCounts = Object.fromEntries(
    SOURCE_ROLES.map((r) => [r, listByRole(r).length]),
  );

  const sampleScores = catalog
    .filter((s) => s.tier === "A" || s.tier === "B")
    .slice(0, 12)
    .map((s) => computeSourceValueScore(s));

  return {
    experiment_id: "exp_014a_source_intelligence_v1",
    registered_sources: catalog.length,
    tier_a: listByTier("A").length,
    tier_b: listByTier("B").length,
    tier_c: listByTier("C").length,
    role_counts: roleCounts,
    independence: {
      registered_sources: independence.registered_sources,
      upstream_clusters: independence.upstream_clusters,
      genuinely_independent_clusters: independence.genuinely_independent_clusters,
      non_independent_clusters: independence.non_independent_clusters,
    },
    top_acquisition_priorities: priorities.slice(0, 10),
    market_matrix_summary: marketSummary,
    data_gaps: gaps,
    next_best_acquisition: next,
    sample_value_scores: sampleScores,
    principles: [
      "catalog ≠ provider ≠ upstream ≠ bookmaker ≠ exchange ≠ aggregator",
      "no invented reliability percentages",
      "value score components may be UNKNOWN",
      "benchmark is MARKET INFORMATION SET, not beat-the-bookmaker claims",
      "ordinary GET scrape ALLOW; WAF/CAPTCHA bypass remains DENY",
    ],
  };
}
