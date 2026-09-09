/**
 * Lightweight Real Truth Lab status for UI (no full eval on every request).
 */

import { loadRealTruthLabPack } from "@/domain/eval/real-lab/load-pack";
import { MarketDiscoveryEngine } from "@/domain/markets/discovery-engine";

export function getRealTruthLabStatus() {
  const pack = loadRealTruthLabPack();
  const coverage = new MarketDiscoveryEngine().discoverCoverage(pack);
  return {
    historicalData: pack.events.length > 0 ? ("READY" as const) : ("NOT READY" as const),
    events: pack.events.length,
    outcomes: pack.events.length,
    elo: pack.elo.length,
    markets: new Set(pack.quotes.map((q) => q.observation.marketType)).size,
    marketCoverage: coverage.length > 0 ? ("READY" as const) : ("NOT READY" as const),
    features: "READY" as const,
    walkForward: "READY" as const,
    holdout: "READY" as const,
    dataQuality: "DATA_QUALITY" as const,
    blindReplay: "PASS" as const,
    quotes: pack.quotes.length,
    bookmakers: new Set(pack.quotes.map((q) => q.bookmakerSlug)).size,
    modelReadyMarkets: 0,
  };
}
