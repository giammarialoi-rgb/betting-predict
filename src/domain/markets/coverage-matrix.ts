/**
 * Real market coverage matrix — catalogued ≠ observed ≠ MODEL_READY.
 */

export type CoverageStatus =
  | "CATALOGUED"
  | "DISCOVERED"
  | "OBSERVED"
  | "TEMPORALLY_VALIDATED"
  | "MODEL_READY"
  | "BLOCKED";

export type MarketCoverageRow = {
  sport: string;
  competition: string | null;
  event: string | null;
  market: string;
  line: number | null;
  selection: string | null;
  source: string;
  bookmaker: string | null;
  first_seen: string | null;
  last_seen: string | null;
  snapshot_count: number;
  temporal_precision: "exact" | "unknown" | "dataset_window" | "mixed" | "UNKNOWN";
  status: CoverageStatus;
};

export type BookmakerCoverageRow = {
  bookmaker: string;
  historical_odds: "VERIFIED" | "PARTIAL" | "UNKNOWN" | "BLOCKED";
  prematch: "VERIFIED" | "PARTIAL" | "UNKNOWN" | "BLOCKED";
  live: "VERIFIED" | "PARTIAL" | "UNKNOWN" | "BLOCKED";
  football: "VERIFIED" | "PARTIAL" | "UNKNOWN" | "BLOCKED";
  other_sports: "UNKNOWN";
  market_coverage: string[];
  temporal_precision: "exact" | "unknown" | "mixed" | "UNKNOWN";
  source: string;
  license: "UNKNOWN" | "PUBLIC_DATASET";
  status: "VERIFIED" | "CATALOGUED" | "UNKNOWN" | "BLOCKED";
};

/**
 * Build coverage rows from observed quotes (real lab pack / snapshots).
 * Never promotes Max/Avg aggregates to bookmaker.
 */
export function buildMarketCoverageMatrix(input: {
  quotes: ReadonlyArray<{
    eventId: string;
    marketType: string;
    line: number | null;
    selection: string;
    bookmakerSlug: string;
    sourceId: string;
    availableAt: Date;
    temporalPrecision: string;
  }>;
  competition?: string;
}): MarketCoverageRow[] {
  type Acc = {
    first: Date;
    last: Date;
    count: number;
    precisions: Set<string>;
    books: Set<string>;
    sources: Set<string>;
  };
  const map = new Map<string, Acc & { market: string; line: number | null; selection: string }>();

  for (const q of input.quotes) {
    if (
      q.bookmakerSlug.toLowerCase().startsWith("max") ||
      q.bookmakerSlug.toLowerCase().startsWith("avg")
    ) {
      continue;
    }
    const key = `${q.marketType}|${q.line ?? ""}|${q.selection}|${q.bookmakerSlug}`;
    let acc = map.get(key);
    if (!acc) {
      acc = {
        market: q.marketType,
        line: q.line,
        selection: q.selection,
        first: q.availableAt,
        last: q.availableAt,
        count: 0,
        precisions: new Set(),
        books: new Set(),
        sources: new Set(),
      };
      map.set(key, acc);
    }
    acc.count += 1;
    acc.books.add(q.bookmakerSlug);
    acc.sources.add(q.sourceId);
    acc.precisions.add(q.temporalPrecision);
    if (q.availableAt < acc.first) acc.first = q.availableAt;
    if (q.availableAt > acc.last) acc.last = q.availableAt;
  }

  const rows: MarketCoverageRow[] = [];
  for (const [key, acc] of map) {
    const book = [...acc.books][0] ?? null;
    const source = [...acc.sources][0] ?? "unknown";
    let temporal: MarketCoverageRow["temporal_precision"] = "mixed";
    if (acc.precisions.size === 1) {
      temporal = [...acc.precisions][0] as MarketCoverageRow["temporal_precision"];
    }
    // Observed with unknown precision → OBSERVED, not TEMPORALLY_VALIDATED / MODEL_READY
    const status: CoverageStatus =
      temporal === "exact"
        ? "TEMPORALLY_VALIDATED"
        : acc.count > 0
          ? "OBSERVED"
          : "DISCOVERED";
    rows.push({
      sport: "football",
      competition: input.competition ?? "E0",
      event: null,
      market: acc.market,
      line: acc.line,
      selection: acc.selection,
      source,
      bookmaker: book,
      first_seen: acc.first.toISOString(),
      last_seen: acc.last.toISOString(),
      snapshot_count: acc.count,
      temporal_precision: temporal,
      status: status === "TEMPORALLY_VALIDATED" ? status : "OBSERVED",
    });
    void key;
  }

  // Catalogued-only tier markets (not observed)
  for (const market of [
    "double_chance",
    "both_teams_to_score",
    "team_total_goals",
    "ht_result",
    "asian_handicap",
    "corners",
    "cards",
    "player_goals",
  ]) {
    if (!rows.some((r) => r.market === market)) {
      rows.push({
        sport: "football",
        competition: input.competition ?? null,
        event: null,
        market,
        line: null,
        selection: null,
        source: "catalog",
        bookmaker: null,
        first_seen: null,
        last_seen: null,
        snapshot_count: 0,
        temporal_precision: "UNKNOWN",
        status: "CATALOGUED",
      });
    }
  }

  return rows;
}

export function summarizeCoverage(rows: readonly MarketCoverageRow[]): {
  catalogued: number;
  discovered: number;
  observed: number;
  temporally_validated: number;
  model_ready: number;
  blocked: number;
} {
  const count = (s: CoverageStatus) => rows.filter((r) => r.status === s).length;
  return {
    catalogued: count("CATALOGUED"),
    discovered: count("DISCOVERED"),
    observed: count("OBSERVED"),
    temporally_validated: count("TEMPORALLY_VALIDATED"),
    model_ready: count("MODEL_READY"),
    blocked: count("BLOCKED"),
  };
}

export function buildBookmakerCoverageFromQuotes(input: {
  quotes: ReadonlyArray<{ bookmakerSlug: string; marketType: string; temporalPrecision: string }>;
  registrySlugs: readonly string[];
}): BookmakerCoverageRow[] {
  const byBook = new Map<string, { markets: Set<string>; precisions: Set<string> }>();
  for (const q of input.quotes) {
    const slug = q.bookmakerSlug;
    if (slug.startsWith("max") || slug.startsWith("avg")) continue;
    let acc = byBook.get(slug);
    if (!acc) {
      acc = { markets: new Set(), precisions: new Set() };
      byBook.set(slug, acc);
    }
    acc.markets.add(q.marketType);
    acc.precisions.add(q.temporalPrecision);
  }

  return input.registrySlugs.map((slug) => {
    const obs = byBook.get(slug);
    if (!obs) {
      return {
        bookmaker: slug,
        historical_odds: "UNKNOWN",
        prematch: "UNKNOWN",
        live: "UNKNOWN",
        football: "UNKNOWN",
        other_sports: "UNKNOWN",
        market_coverage: [],
        temporal_precision: "UNKNOWN",
        source: "registry",
        license: "UNKNOWN",
        status: "UNKNOWN",
      };
    }
    const temporal =
      obs.precisions.size === 1
        ? ([...obs.precisions][0] as BookmakerCoverageRow["temporal_precision"])
        : "mixed";
    return {
      bookmaker: slug,
      historical_odds: "VERIFIED",
      prematch: "VERIFIED",
      live: "BLOCKED",
      football: "VERIFIED",
      other_sports: "UNKNOWN",
      market_coverage: [...obs.markets].sort(),
      temporal_precision: temporal === "exact" || temporal === "unknown" ? temporal : "mixed",
      source: "football-data-co-uk",
      license: "PUBLIC_DATASET",
      status: "VERIFIED",
    };
  });
}
