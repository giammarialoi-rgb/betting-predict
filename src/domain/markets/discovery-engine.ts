/**
 * MarketDiscoveryEngine — observed coverage ≠ catalog ≠ MODEL_READY.
 */

import { getMarket } from "@/domain/markets/catalog";
import { canonicalMarketKey } from "@/domain/markets/canonical";
import type { RealHistoricalDataset, RealLabQuote } from "@/domain/eval/real-lab/load-pack";
import type { MarketReadiness } from "@/domain/markets/types";

export type ObservedMarketCoverage = {
  sport: string;
  competition: string | null;
  market_type: string;
  period: string;
  line: number | null;
  selection: string;
  bookmakers_count: number;
  sources_count: number;
  historical_depth_days: number | null;
  temporal_precision: "exact" | "unknown" | "dataset_window" | "mixed";
  sample_size: number;
  availability: "PRESENT" | "SPARSE" | "ABSENT";
  catalog_status: MarketReadiness | "NOT_IN_CATALOG";
  /** Never auto-promoted. */
  model_ready: false;
};

export class MarketDiscoveryEngine {
  discoverCoverage(dataset: RealHistoricalDataset): ObservedMarketCoverage[] {
    type Acc = {
      bookmakers: Set<string>;
      sources: Set<string>;
      precisions: Set<string>;
      times: number[];
      sample_size: number;
      sport: string;
      market_type: string;
      period: string;
      line: number | null;
      selection: string;
      competition: string | null;
    };
    const map = new Map<string, Acc>();

    const eventComp = new Map(
      dataset.events.map((e) => [e.eventId, e.competitionId]),
    );

    for (const q of dataset.quotes) {
      const key = canonicalMarketKey(q.observation);
      let acc = map.get(key);
      if (!acc) {
        acc = {
          bookmakers: new Set(),
          sources: new Set(),
          precisions: new Set(),
          times: [],
          sample_size: 0,
          sport: q.observation.sport,
          market_type: q.observation.marketType,
          period: q.observation.period,
          line: q.observation.line,
          selection: q.observation.selection,
          competition: eventComp.get(q.eventId) ?? null,
        };
        map.set(key, acc);
      }
      acc.bookmakers.add(q.bookmakerSlug);
      acc.sources.add(q.sourceId);
      acc.precisions.add(q.temporalPrecision);
      acc.times.push(q.availableAt.getTime());
      acc.sample_size += 1;
    }

    const out: ObservedMarketCoverage[] = [];
    for (const acc of map.values()) {
      const catalog = getMarket(acc.market_type);
      let temporal: ObservedMarketCoverage["temporal_precision"] = "mixed";
      if (acc.precisions.size === 1) {
        temporal = [...acc.precisions][0] as ObservedMarketCoverage["temporal_precision"];
      }
      const minT = Math.min(...acc.times);
      const maxT = Math.max(...acc.times);
      const depthDays =
        Number.isFinite(minT) && Number.isFinite(maxT)
          ? Math.floor((maxT - minT) / 86_400_000)
          : null;
      out.push({
        sport: acc.sport,
        competition: acc.competition,
        market_type: acc.market_type,
        period: acc.period,
        line: acc.line,
        selection: acc.selection,
        bookmakers_count: acc.bookmakers.size,
        sources_count: acc.sources.size,
        historical_depth_days: depthDays,
        temporal_precision: temporal,
        sample_size: acc.sample_size,
        availability:
          acc.sample_size >= 50
            ? "PRESENT"
            : acc.sample_size > 0
              ? "SPARSE"
              : "ABSENT",
        catalog_status: catalog ? catalog.readiness : "NOT_IN_CATALOG",
        model_ready: false,
      });
    }
    return out;
  }
}

export function quotesAsOf(
  quotes: readonly RealLabQuote[],
  eventId: string,
  asOf: Date,
  policy: "STRICT_AS_OF" | "RESEARCH" | "ANY",
): { accepted: RealLabQuote[]; rejected: RealLabQuote[] } {
  const accepted: RealLabQuote[] = [];
  const rejected: RealLabQuote[] = [];
  for (const q of quotes) {
    if (q.eventId !== eventId) continue;
    if (q.availableAt.getTime() > asOf.getTime()) {
      rejected.push(q);
      continue;
    }
    if (policy === "STRICT_AS_OF" && q.temporalPrecision === "unknown") {
      rejected.push(q);
      continue;
    }
    accepted.push(q);
  }
  return { accepted, rejected };
}
