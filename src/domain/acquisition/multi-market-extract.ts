/**
 * Discover & extract all odds columns present in a football-data.co.uk row.
 * Aggregates (Max/Avg/BbMx/BbAv) are skipped — never bookmakers.
 */

import { isAggregateOddsLabel } from "@/domain/markets/canonical";
import type { MarketObservation } from "@/domain/markets/market-observation";
import { FOOTBALL_DATA_CO_UK_BOOKMAKERS } from "@/providers/football-data-co-uk/bookmakers";
import { FOOTBALL_DATA_CO_UK_SOURCE_ID } from "@/providers/football-data-co-uk/bookmakers";

function parseOdds(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 1) return null;
  return n;
}

type ColMap = {
  bookmakerId: string;
  marketType: string;
  line: number | null;
  selectionSide: string;
  column: string;
};

function buildKnownColumnMaps(): ColMap[] {
  const maps: ColMap[] = [];
  for (const b of FOOTBALL_DATA_CO_UK_BOOKMAKERS) {
    maps.push(
      {
        bookmakerId: b.slug,
        marketType: "result",
        line: null,
        selectionSide: "HOME",
        column: b.open.home,
      },
      {
        bookmakerId: b.slug,
        marketType: "result",
        line: null,
        selectionSide: "DRAW",
        column: b.open.draw,
      },
      {
        bookmakerId: b.slug,
        marketType: "result",
        line: null,
        selectionSide: "AWAY",
        column: b.open.away,
      },
      {
        bookmakerId: b.slug,
        marketType: "result",
        line: null,
        selectionSide: "HOME",
        column: b.close.home,
      },
      {
        bookmakerId: b.slug,
        marketType: "result",
        line: null,
        selectionSide: "DRAW",
        column: b.close.draw,
      },
      {
        bookmakerId: b.slug,
        marketType: "result",
        line: null,
        selectionSide: "AWAY",
        column: b.close.away,
      },
    );
  }
  // Totals — only bookmaker columns (not Max/Avg)
  maps.push(
    {
      bookmakerId: "bet365",
      marketType: "total_goals",
      line: 2.5,
      selectionSide: "OVER",
      column: "B365>2.5",
    },
    {
      bookmakerId: "bet365",
      marketType: "total_goals",
      line: 2.5,
      selectionSide: "UNDER",
      column: "B365<2.5",
    },
    {
      bookmakerId: "pinnacle",
      marketType: "total_goals",
      line: 2.5,
      selectionSide: "OVER",
      column: "P>2.5",
    },
    {
      bookmakerId: "pinnacle",
      marketType: "total_goals",
      line: 2.5,
      selectionSide: "UNDER",
      column: "P<2.5",
    },
  );
  // Asian handicap when columns exist
  maps.push(
    {
      bookmakerId: "bet365",
      marketType: "asian_handicap",
      line: null, // line from AHh
      selectionSide: "HOME",
      column: "B365AHH",
    },
    {
      bookmakerId: "bet365",
      marketType: "asian_handicap",
      line: null,
      selectionSide: "AWAY",
      column: "B365AHA",
    },
  );
  return maps;
}

const KNOWN = buildKnownColumnMaps();

/**
 * Extract MarketObservations for columns that exist AND parse as valid odds.
 * Never invents missing markets. Skips aggregate labels.
 */
export function extractMarketObservationsFromRow(input: {
  eventId: string;
  row: Record<string, string>;
  availableAt: Date;
  rawPayloadId?: string | null;
  kind?: MarketObservation["observationKind"];
}): {
  observations: MarketObservation[];
  aggregatesSkipped: string[];
  marketsFound: string[];
} {
  const observations: MarketObservation[] = [];
  const aggregatesSkipped: string[] = [];
  const markets = new Set<string>();

  for (const key of Object.keys(input.row)) {
    if (isAggregateOddsLabel(key)) {
      aggregatesSkipped.push(key);
    }
  }

  const ahLine = parseOdds(input.row.AHh) != null ? Number(input.row.AHh) : null;

  for (const m of KNOWN) {
    if (!(m.column in input.row)) continue;
    if (isAggregateOddsLabel(m.column)) continue;
    const odds = parseOdds(input.row[m.column]);
    if (odds == null) continue;
    let line = m.line;
    if (m.marketType === "asian_handicap") {
      if (ahLine == null || !Number.isFinite(ahLine)) continue;
      line = m.selectionSide === "HOME" ? ahLine : -ahLine;
    }
    observations.push({
      eventId: input.eventId,
      bookmakerId: m.bookmakerId,
      marketType: m.marketType,
      line,
      selectionSide: m.selectionSide,
      selectionRef: null,
      odds,
      observedAt: input.availableAt,
      availableAt: input.availableAt,
      temporalPrecision: "unknown",
      observationKind: input.kind ?? "dataset_open",
      sourceId: FOOTBALL_DATA_CO_UK_SOURCE_ID,
      rawPayloadId: input.rawPayloadId ?? null,
    });
    markets.add(m.marketType);
  }

  return {
    observations,
    aggregatesSkipped: [...new Set(aggregatesSkipped)],
    marketsFound: [...markets].sort(),
  };
}
