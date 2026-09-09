/**
 * Acquisition quality matrix — source × bookmaker × market × competition.
 * No single score that hides holes.
 */

import type { MarketObservation } from "@/domain/markets/market-observation";

export type QualityMatrixRow = {
  source: string;
  bookmaker: string;
  market: string;
  competition: string | null;
  events: number;
  observations: number;
  non_null_odds: number;
  missing_rate: number;
  temporal_precision: string;
  duplicates: number;
  invalid_odds: number;
  coverage_start: string | null;
  coverage_end: string | null;
};

export function buildQualityMatrix(input: {
  observations: readonly MarketObservation[];
  competition?: string | null;
}): QualityMatrixRow[] {
  type Acc = {
    eventIds: Set<string>;
    obs: number;
    nonNull: number;
    invalid: number;
    keys: Set<string>;
    duplicates: number;
    precisions: Set<string>;
    first: Date | null;
    last: Date | null;
  };
  const map = new Map<string, Acc>();

  for (const o of input.observations) {
    const key = `${o.sourceId}|${o.bookmakerId}|${o.marketType}`;
    let acc = map.get(key);
    if (!acc) {
      acc = {
        eventIds: new Set(),
        obs: 0,
        nonNull: 0,
        invalid: 0,
        keys: new Set(),
        duplicates: 0,
        precisions: new Set(),
        first: null,
        last: null,
      };
      map.set(key, acc);
    }
    const dedupe = `${o.eventId}|${o.selectionSide}|${o.line}|${o.observationKind}`;
    if (acc.keys.has(dedupe)) acc.duplicates += 1;
    else acc.keys.add(dedupe);
    acc.obs += 1;
    acc.eventIds.add(o.eventId);
    acc.precisions.add(o.temporalPrecision);
    if (Number.isFinite(o.odds) && o.odds > 1) acc.nonNull += 1;
    else acc.invalid += 1;
    if (!acc.first || o.availableAt < acc.first) acc.first = o.availableAt;
    if (!acc.last || o.availableAt > acc.last) acc.last = o.availableAt;
  }

  const rows: QualityMatrixRow[] = [];
  for (const [key, acc] of map) {
    const [source, bookmaker, market] = key.split("|") as [string, string, string];
    const temporal =
      acc.precisions.size === 1 ? [...acc.precisions][0]! : "mixed";
    rows.push({
      source,
      bookmaker,
      market,
      competition: input.competition ?? null,
      events: acc.eventIds.size,
      observations: acc.obs,
      non_null_odds: acc.nonNull,
      missing_rate: acc.obs === 0 ? 1 : 1 - acc.nonNull / acc.obs,
      temporal_precision: temporal,
      duplicates: acc.duplicates,
      invalid_odds: acc.invalid,
      coverage_start: acc.first?.toISOString() ?? null,
      coverage_end: acc.last?.toISOString() ?? null,
    });
  }
  return rows.sort((a, b) =>
    `${a.source}|${a.market}|${a.bookmaker}`.localeCompare(
      `${b.source}|${b.market}|${b.bookmaker}`,
    ),
  );
}
