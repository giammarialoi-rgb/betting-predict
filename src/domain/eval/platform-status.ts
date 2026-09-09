/**
 * TASK 011 status helpers for UI.
 */

import { listSports } from "@/domain/sports/catalog";
import { listMarkets, listMarketsByReadiness } from "@/domain/markets/catalog";
import { listSources } from "@/domain/sources/catalog";
import { BOOKMAKER_REGISTRY, listVerifiedBookmakers } from "@/domain/markets/bookmaker-registry";
import { listMarketCoverage } from "@/domain/markets/coverage-registry";
import { IMPLEMENTED_PROVIDER_IDS } from "@/domain/alignment-ids";
import { getRealTruthLabStatus } from "@/domain/eval/real-lab/status";

export function getMultiMarketPlatformStatus() {
  const real = getRealTruthLabStatus();
  const coverage = listMarketCoverage("football");
  return {
    sports: listSports().length,
    providersImplemented: IMPLEMENTED_PROVIDER_IDS.length,
    providersCatalogued: listSources().length,
    marketsCatalogued: listMarkets().length,
    marketsObserved: coverage.filter((c) => c.observed).length,
    marketsModelReady: listMarketsByReadiness("MODEL_READY").length,
    events: real.events,
    oddsSnapshots: real.quotes,
    bookmakers: BOOKMAKER_REGISTRY.length,
    bookmakersVerified: listVerifiedBookmakers().length,
    strictData: "READY" as const,
    modelReady: real.modelReadyMarkets === 0 ? ("NOT READY" as const) : ("READY" as const),
    blindLab: real.blindReplay,
    topOpportunities: "FOUNDATION ONLY" as const,
  };
}
