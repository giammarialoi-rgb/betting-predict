/**
 * Betfair historic stream format adapter.
 * Level A when `pt` (publishTime epoch ms) is present.
 * Bulk historic files are paid / ToS-restricted — not ingested here.
 */

import type { MarketSnapshot } from "@/domain/eval/capital-020/types";

export function parseBetfairPublishTime(pt: number): Date {
  if (!Number.isFinite(pt) || pt <= 0) {
    throw new TypeError("invalid Betfair publishTime");
  }
  return new Date(pt);
}

/**
 * Parse a documented BASIC-style tick list.
 * Each line: JSON with pt + optional ltp + runner selection.
 */
export function parseBetfairBasicFixture(lines: readonly string[]): MarketSnapshot[] {
  const out: MarketSnapshot[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as {
      pt?: number;
      eventId?: string;
      selection?: string;
      ltp?: number;
      marketType?: string;
      sport?: MarketSnapshot["sport"];
    };
    if (row.pt == null || row.ltp == null || row.ltp <= 1) continue;
    const at = parseBetfairPublishTime(row.pt).toISOString();
    out.push({
      sport: row.sport ?? "tennis",
      eventId: row.eventId ?? "bf-unknown",
      marketType: row.marketType ?? "1X2",
      line: null,
      selection: row.selection ?? "HOME",
      bookmaker: "betfair-exchange",
      odds: row.ltp,
      observedAt: at,
      availableAt: at,
      temporalClass: "EXACT_OBSERVATION_TIME",
      temporalBasis: "explicit Betfair stream publishTime (pt) epoch milliseconds UTC",
      sourceId: "betfair-historic-format-fixture",
      upstreamCluster: "betfair-historicdata",
      observationKind: "intermediate",
    });
  }
  return out;
}
