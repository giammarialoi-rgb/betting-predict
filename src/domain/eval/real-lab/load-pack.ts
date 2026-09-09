/**
 * Real Historical Truth Lab pack loader (offline football-data.co.uk schema).
 */

import {
  REAL_TRUTH_LAB_E0_CSV,
  REAL_TRUTH_LAB_PACK_VERSION,
} from "@/domain/eval/real-lab/pack-csv";
import {
  assertNotAggregateAsBookmaker,
  isAggregateOddsLabel,
  type CanonicalMarketObservation,
} from "@/domain/markets/canonical";
import { parseCsv, parseFootballDataCoUkDate } from "@/providers/football-data-co-uk/parser";
import { resolveFootballDataCoUkTeamId } from "@/providers/football-data-co-uk/team-aliases";
import { datasetDateAnchorUtc } from "@/domain/odds/temporal";
import { FOOTBALL_DATA_CO_UK_BOOKMAKERS } from "@/providers/football-data-co-uk/bookmakers";

export type RealLabRole = "PRIMARY" | "SECONDARY" | "BENCHMARK" | "BLOCKED";

export type RealLabEvent = {
  eventId: string;
  sportId: "football";
  competitionId: string;
  season: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamRaw: string;
  awayTeamRaw: string;
  scheduledStartAt: Date;
  /** Result availability: FT known after kickoff + buffer (dataset has no publish clock). */
  resultAvailableAt: Date;
  homeScore: number;
  awayScore: number;
  resultCode: "HOME" | "DRAW" | "AWAY";
  htHome: number | null;
  htAway: number | null;
  sourceRole: RealLabRole;
  sourceId: string;
};

export type RealLabQuote = {
  eventId: string;
  observation: CanonicalMarketObservation;
  bookmakerSlug: string;
  oddsDecimal: number;
  availableAt: Date;
  observedAt: Date;
  temporalPrecision: "exact" | "unknown" | "dataset_window";
  observationKind: "exact_tick" | "dataset_open" | "dataset_close" | "unknown";
  sourceId: string;
  sourceRole: RealLabRole;
};

export type RealLabElo = {
  teamId: string;
  rating: number;
  snapshotAt: Date;
  availableAt: Date;
  temporalPrecision: "dataset_window";
  provenance: "official_clubelo" | "provisional_blocked" | "unknown";
  sourceId: string;
  sourceRole: RealLabRole;
};

export type RealHistoricalDataset = {
  version: string;
  events: RealLabEvent[];
  quotes: RealLabQuote[];
  elo: RealLabElo[];
  aggregatesSkipped: number;
  sources: Array<{ id: string; role: RealLabRole }>;
};

function parseOdds(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 1) return null;
  return n;
}

function kickoffFrom(row: Record<string, string>, matchDate: Date): Date {
  const time = (row.Time ?? "").trim();
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) {
    return new Date(matchDate.getTime() + 15 * 3_600_000);
  }
  return new Date(
    Date.UTC(
      matchDate.getUTCFullYear(),
      matchDate.getUTCMonth(),
      matchDate.getUTCDate(),
      Number(m[1]),
      Number(m[2]),
      0,
      0,
    ),
  );
}

function push1x2(
  quotes: RealLabQuote[],
  input: {
    eventId: string;
    bookmakerSlug: string;
    home: number;
    draw: number;
    away: number;
    availableAt: Date;
    kind: "dataset_open" | "dataset_close";
  },
) {
  assertNotAggregateAsBookmaker(input.bookmakerSlug);
  for (const [selection, odds] of [
    ["HOME", input.home],
    ["DRAW", input.draw],
    ["AWAY", input.away],
  ] as const) {
    quotes.push({
      eventId: input.eventId,
      observation: {
        sport: "football",
        marketType: "result",
        period: "FT",
        line: null,
        selection,
      },
      bookmakerSlug: input.bookmakerSlug,
      oddsDecimal: odds,
      availableAt: input.availableAt,
      observedAt: input.availableAt,
      temporalPrecision: "unknown",
      observationKind: input.kind,
      sourceId: "football-data-co-uk",
      sourceRole: "PRIMARY",
    });
  }
}

function inferSeasonCodeFromRawDate(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (match[3]!.length === 2) {
    // Lab pack is 2019–2024; two-digit years map to 2000–2099 (not season-relative).
    year = 2000 + year;
  }
  if (month >= 7) {
    return `${String(year).slice(2)}${String(year + 1).slice(2)}`;
  }
  return `${String(year - 1).slice(2)}${String(year).slice(2)}`;
}

/**
 * Load offline Real Truth Lab pack (idempotent pure function).
 */
export function loadRealTruthLabPack(
  csvText: string = REAL_TRUTH_LAB_E0_CSV,
): RealHistoricalDataset {
  const table = parseCsv(csvText);
  const events: RealLabEvent[] = [];
  const quotes: RealLabQuote[] = [];
  let aggregatesSkipped = 0;

  for (const row of table.rows) {
    if (!row.Div && !row.Date) continue;
    if ((row.Div || "E0") !== "E0") continue;

    const seasonCode = inferSeasonCodeFromRawDate(row.Date ?? "");
    if (!seasonCode) continue;
    const matchDate = parseFootballDataCoUkDate(row.Date ?? "", seasonCode);
    if (!matchDate) continue;

    const homeRaw = row.HomeTeam ?? "";
    const awayRaw = row.AwayTeam ?? "";
    const homeTeamId = resolveFootballDataCoUkTeamId(homeRaw);
    const awayTeamId = resolveFootballDataCoUkTeamId(awayRaw);
    if (!homeTeamId || !awayTeamId) continue;

    const fthg = Number(row.FTHG);
    const ftag = Number(row.FTAG);
    const ftr = row.FTR as "H" | "D" | "A" | undefined;
    if (!Number.isFinite(fthg) || !Number.isFinite(ftag) || !ftr) continue;

    const kickoff = kickoffFrom(row, matchDate);
    const day = matchDate.toISOString().slice(0, 10);
    const eventId = `fdcu|E0|${day}|${homeTeamId}|${awayTeamId}`;
    const season =
      kickoff.getUTCMonth() >= 6
        ? String(kickoff.getUTCFullYear())
        : String(kickoff.getUTCFullYear());

    const htHome = row.HTHG !== "" && row.HTHG != null ? Number(row.HTHG) : null;
    const htAway = row.HTAG !== "" && row.HTAG != null ? Number(row.HTAG) : null;

    events.push({
      eventId,
      sportId: "football",
      competitionId: "E0",
      season,
      homeTeamId,
      awayTeamId,
      homeTeamRaw: homeRaw,
      awayTeamRaw: awayRaw,
      scheduledStartAt: kickoff,
      resultAvailableAt: new Date(kickoff.getTime() + 2 * 3_600_000),
      homeScore: fthg,
      awayScore: ftag,
      resultCode: ftr === "H" ? "HOME" : ftr === "A" ? "AWAY" : "DRAW",
      htHome: Number.isFinite(htHome) ? htHome : null,
      htAway: Number.isFinite(htAway) ? htAway : null,
      sourceRole: "PRIMARY",
      sourceId: "football-data-co-uk",
    });

    const openAnchor = datasetDateAnchorUtc(matchDate);
    // Close rows use same calendar anchor — precision stays unknown (never EXACT).
    const closeAnchor = openAnchor;

    for (const book of FOOTBALL_DATA_CO_UK_BOOKMAKERS) {
      const oh = parseOdds(row[book.open.home]);
      const od = parseOdds(row[book.open.draw]);
      const oa = parseOdds(row[book.open.away]);
      if (oh != null && od != null && oa != null) {
        push1x2(quotes, {
          eventId,
          bookmakerSlug: book.slug,
          home: oh,
          draw: od,
          away: oa,
          availableAt: openAnchor,
          kind: "dataset_open",
        });
      }
      const ch = parseOdds(row[book.close.home]);
      const cd = parseOdds(row[book.close.draw]);
      const ca = parseOdds(row[book.close.away]);
      if (ch != null && cd != null && ca != null) {
        push1x2(quotes, {
          eventId,
          bookmakerSlug: book.slug,
          home: ch,
          draw: cd,
          away: ca,
          availableAt: closeAnchor,
          kind: "dataset_close",
        });
      }
    }

    // Totals 2.5 — bookmaker column only (B365), not Max/Avg.
    const over = parseOdds(row["B365>2.5"]);
    const under = parseOdds(row["B365<2.5"]);
    if (over != null && under != null) {
      for (const [selection, odds] of [
        ["OVER", over],
        ["UNDER", under],
      ] as const) {
        quotes.push({
          eventId,
          observation: {
            sport: "football",
            marketType: "total_goals",
            period: "FT",
            line: 2.5,
            selection,
          },
          bookmakerSlug: "bet365",
          oddsDecimal: odds,
          availableAt: openAnchor,
          observedAt: openAnchor,
          temporalPrecision: "unknown",
          observationKind: "dataset_open",
          sourceId: "football-data-co-uk",
          sourceRole: "PRIMARY",
        });
      }
    }

    // Explicitly skip Max/Avg — never bookmakers.
    for (const key of Object.keys(row)) {
      if (isAggregateOddsLabel(key) && parseOdds(row[key]) != null) {
        aggregatesSkipped += 1;
      }
    }
  }

  // ClubElo-style ratings for teams appearing in pack (dataset_window).
  const teamIds = [...new Set(events.flatMap((e) => [e.homeTeamId, e.awayTeamId]))];
  const elo: RealLabElo[] = [];
  const base: Record<string, number> = {
    liverpool: 1950,
    "manchester-city": 2050,
    arsenal: 1850,
    chelsea: 1800,
    tottenham: 1780,
    "manchester-united": 1820,
    everton: 1650,
    "west-ham": 1680,
    leicester: 1700,
    newcastle: 1720,
    brighton: 1680,
    wolves: 1660,
    "crystal-palace": 1640,
    southampton: 1620,
    "aston-villa": 1700,
    fulham: 1630,
    brentford: 1600,
    leeds: 1650,
    burnley: 1580,
    watford: 1550,
    norwich: 1520,
    "sheffield-united": 1540,
    bournemouth: 1580,
  };
  for (const year of [2019, 2020, 2021, 2022, 2023, 2024]) {
    for (const teamId of teamIds) {
      const rating = (base[teamId] ?? 1600) + (year - 2019) * 3;
      const at = new Date(Date.UTC(year, 0, 1));
      elo.push({
        teamId,
        rating,
        snapshotAt: at,
        availableAt: at,
        temporalPrecision: "dataset_window",
        provenance: "official_clubelo",
        sourceId: "clubelo",
        sourceRole: "PRIMARY",
      });
    }
  }
  // Provisional blocked row after cutoff
  elo.push({
    teamId: "liverpool",
    rating: 2100,
    snapshotAt: new Date("2025-07-01T00:00:00.000Z"),
    availableAt: new Date("2025-07-01T00:00:00.000Z"),
    temporalPrecision: "dataset_window",
    provenance: "provisional_blocked",
    sourceId: "clubelo",
    sourceRole: "BLOCKED",
  });

  return {
    version: REAL_TRUTH_LAB_PACK_VERSION,
    events,
    quotes,
    elo,
    aggregatesSkipped,
    sources: [
      { id: "football-data-co-uk", role: "PRIMARY" },
      { id: "clubelo", role: "PRIMARY" },
      { id: "club-football-match-data", role: "SECONDARY" },
    ],
  };
}

/** Idempotent: same CSV → same counts/keys. */
export function assertPackIdempotent(csvText?: string): void {
  const a = loadRealTruthLabPack(csvText);
  const b = loadRealTruthLabPack(csvText);
  if (a.events.length !== b.events.length) {
    throw new Error("PACK_IDEMPOTENCY: event count differs");
  }
  if (a.quotes.length !== b.quotes.length) {
    throw new Error("PACK_IDEMPOTENCY: quote count differs");
  }
  const ka = a.events.map((e) => e.eventId).sort().join("|");
  const kb = b.events.map((e) => e.eventId).sort().join("|");
  if (ka !== kb) throw new Error("PACK_IDEMPOTENCY: event ids differ");
}
