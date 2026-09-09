/**
 * Market Observation Matrix: source × competition × season × book × market × precision.
 */

import { evaluateModelReadyGates } from "@/domain/markets/model-ready-gates";
import { CATALOGUED_MARKETS } from "@/domain/eval/acquisition-019/columns";
import { seasonLabelFromCode } from "@/domain/eval/acquisition-019/event-matching";
import type {
  MarketCoverageRow019,
  MarketLifecycle,
  MarketObservation019,
  MatrixRow,
  NormalizedEvent,
} from "@/domain/eval/acquisition-019/types";

export function buildObservationMatrix(
  observations: readonly MarketObservation019[],
  events: readonly NormalizedEvent[],
): MatrixRow[] {
  const eventById = new Map(events.map((e) => [e.canonicalEventId, e]));
  const acc = new Map<string, MatrixRow>();
  for (const o of observations) {
    const ev = eventById.get(o.eventId);
    const competition = ev?.competition ?? "unknown";
    const season = ev ? seasonLabelFromCode(ev.season) : "unknown";
    const key = [
      o.sourceId,
      competition,
      season,
      o.bookmakerId,
      o.marketType,
      o.temporalPrecision,
    ].join("|");
    const cur = acc.get(key);
    if (cur) {
      cur.n += 1;
      continue;
    }
    const status =
      o.temporalPrecision === "exact"
        ? "VALID_EXACT"
        : o.temporalPrecision === "date" && o.observationKind === "dataset_open"
          ? "VALID_DATE"
          : o.observationKind === "dataset_close"
            ? "RESEARCH_ONLY"
            : "BLOCKED";
    acc.set(key, {
      source: o.sourceId,
      competition,
      season,
      bookmaker: o.bookmakerId,
      market: o.marketType,
      n: 1,
      precision: o.temporalPrecision,
      status,
      oddsLevel: o.oddsLevel,
    });
  }
  return [...acc.values()].sort((a, b) => b.n - a.n);
}

export function buildMarketCoverage(
  observations: readonly MarketObservation019[],
  events: readonly NormalizedEvent[],
): MarketCoverageRow019[] {
  const byMarket = new Map<
    string,
    {
      events: Set<string>;
      date: number;
      strict: number;
      books: Set<string>;
      years: Set<number>;
      observed: boolean;
      discovered: boolean;
    }
  >();
  const ensure = (m: string) => {
    let row = byMarket.get(m);
    if (!row) {
      row = {
        events: new Set(),
        date: 0,
        strict: 0,
        books: new Set(),
        years: new Set(),
        observed: false,
        discovered: false,
      };
      byMarket.set(m, row);
    }
    return row;
  };
  for (const m of CATALOGUED_MARKETS) ensure(m);
  const eventYear = new Map(events.map((e) => [e.canonicalEventId, e.year]));

  for (const o of observations) {
    const row = ensure(o.marketType);
    row.discovered = true;
    row.observed = true;
    row.events.add(o.eventId);
    row.books.add(o.bookmakerId);
    const y = eventYear.get(o.eventId);
    if (y) row.years.add(y);
    if (o.temporalPrecision === "exact") row.strict += 1;
    if (o.temporalPrecision === "date" && o.observationKind === "dataset_open") {
      row.date += 1;
    }
  }

  return [...byMarket.entries()].map(([market, r]) => {
    const gate = evaluateModelReadyGates({
      market,
      line: market === "OU25" ? 2.5 : null,
      sampleSize: r.events.size,
      dataCompleteness: r.observed ? 1 : 0,
      temporalIntegrity: r.strict > 0,
      exactPrecisionShare: r.events.size ? r.strict / Math.max(1, r.date + r.strict) : 0,
      bookmakerCoverage: r.books.size,
      outcomeCompleteness: 1,
      featureAvailability: r.observed ? 0.8 : 0,
      calibrationOk: null,
      walkForwardStable: null,
      holdoutPerformanceOk: null,
    });
    let lifecycle: MarketLifecycle = "CATALOGUED";
    if (r.discovered) lifecycle = "DISCOVERED";
    if (r.observed) lifecycle = "OBSERVED";
    if (r.date > 0) lifecycle = "TEMPORALLY_VALID";
    if (gate.status === "MODEL_READY") lifecycle = "MODEL_READY";
    // Date-valid is not MODEL_READY — gates still require exact + holdout.
    if (lifecycle === "TEMPORALLY_VALID" && gate.status !== "MODEL_READY") {
      lifecycle = r.date > 0 ? "TEMPORALLY_VALID" : lifecycle;
    }
    return {
      market,
      events: r.events.size,
      valid_observations_date: r.date,
      valid_observations_strict: r.strict,
      books: r.books.size,
      years: [...r.years].sort((a, b) => a - b).join(","),
      discovered: r.discovered,
      observed: r.observed,
      temporally_valid_date: r.date > 0,
      temporally_valid_strict: r.strict > 0,
      model_ready: gate.status === "MODEL_READY",
      lifecycle: r.strict > 0 && gate.status === "MODEL_READY" ? "MODEL_READY" : r.date > 0 ? "TEMPORALLY_VALID" : r.observed ? "OBSERVED" : r.discovered ? "DISCOVERED" : "CATALOGUED",
    };
  });
}
