/**
 * Source × market matrix — catalogued markets only; no invention of observed data.
 */

import type { SourceIntelligence } from "./types";
import { buildSourceIntelligenceCatalog } from "./catalog";
import { FOOTBALL_ACQUISITION_MARKET_CATALOG } from "@/domain/markets/acquisition-catalog";

export type SourceMarketCell = {
  source: string;
  market: string;
  sport: string;
  status: "catalogued_claim" | "none";
  implementation: SourceIntelligence["implementation"];
};

export type MarketSourceSummary = {
  market: string;
  sources_claiming: number;
  implemented_sources: number;
  catalog_status: "catalogued";
  observed: false;
  model_ready: false;
  reason: string;
};

const FOOTBALL_MARKETS = FOOTBALL_ACQUISITION_MARKET_CATALOG.map((m) => m.market_type);

/**
 * Build source×market cells from marketsSupported claims (not observed facts).
 */
export function buildSourceMarketMatrix(
  catalog: readonly SourceIntelligence[] = buildSourceIntelligenceCatalog(),
  sport = "football",
): SourceMarketCell[] {
  const cells: SourceMarketCell[] = [];
  for (const s of catalog) {
    if (!s.sports.includes(sport as never) && !s.sports.includes("multi")) continue;
    for (const market of FOOTBALL_MARKETS) {
      const claims = s.marketsSupported.includes(market);
      cells.push({
        source: s.id,
        market,
        sport,
        status: claims ? "catalogued_claim" : "none",
        implementation: s.implementation,
      });
    }
  }
  return cells;
}

export function summarizeMarketSourceCoverage(
  catalog: readonly SourceIntelligence[] = buildSourceIntelligenceCatalog(),
): MarketSourceSummary[] {
  return FOOTBALL_MARKETS.map((market) => {
    const claiming = catalog.filter((s) => s.marketsSupported.includes(market));
    const implemented = claiming.filter(
      (s) => s.implementation === "implemented" || s.implementation === "blocked",
    );
    const observed = false; // TASK 014-A: intelligence only — do not promote to OBSERVED
    return {
      market,
      sources_claiming: claiming.length,
      implemented_sources: implemented.length,
      catalog_status: "catalogued" as const,
      observed,
      model_ready: false as const,
      reason:
        implemented.length === 0
          ? "no_verified_primary_historical_source"
          : "claims_exist_but_not_temporally_validated",
    };
  });
}
