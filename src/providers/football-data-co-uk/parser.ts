import {
  FOOTBALL_DATA_CO_UK_BOOKMAKERS,
  FOOTBALL_DATA_CO_UK_DIVISIONS,
  type FootballDataCoUkDivisionCode,
} from "./bookmakers";
import { resolveFootballDataCoUkTeamId } from "./team-aliases";
import { datasetDateAnchorUtc } from "@/domain/odds/temporal";
import type { HistoricalOddsSnapshot } from "@/providers/odds/types";

export type ParsedCsvTable = {
  headers: string[];
  rows: Record<string, string>[];
};

export type FootballDataCoUkParseStats = {
  rowsRead: number;
  validMatchRows: number;
  rejectedRows: number;
  rejectionReasons: Record<string, number>;
};

export type FootballDataCoUkParsedMatch = {
  division: string;
  matchDate: Date;
  kickoffTime: string | null;
  homeTeamRaw: string;
  awayTeamRaw: string;
  homeTeamId: string;
  awayTeamId: string;
  providerEventId: string;
  snapshots: HistoricalOddsSnapshot[];
};

function bump(reasons: Record<string, number>, reason: string) {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

/** Minimal RFC4180-ish CSV parse (comma, quoted fields). */
export function parseCsv(text: string): ParsedCsvTable {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") {
        rows.push(row);
      }
      row = [];
      continue;
    }
    if (ch === "\r") {
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = rows[0]!.map((h) => h.trim());
  const body = rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    for (let i = 0; i < headers.length; i += 1) {
      record[headers[i]!] = (cells[i] ?? "").trim();
    }
    return record;
  });
  return { headers, rows: body };
}

/**
 * Parse dd/mm/yy or dd/mm/yyyy using season code to resolve century.
 * Season 2425 => Aug 2024–May 2025 style windows.
 */
export function parseFootballDataCoUkDate(
  raw: string,
  seasonCode: string,
): Date | null {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) {
    return null;
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (match[3]!.length === 2) {
    const startYY = Number(seasonCode.slice(0, 2));
    const endYY = Number(seasonCode.slice(2, 4));
    const startCentury = 2000 + startYY;
    const endCentury = 2000 + endYY;
    // Jul–Dec -> season start year; Jan–Jun -> season end year
    year = month >= 7 ? startCentury : endCentury;
    if (startYY > endYY) {
      // e.g. 9900 crossing century — rare; keep simple mapping
      year = month >= 7 ? 1900 + startYY : 2000 + endYY;
    }
  }
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function parseOddsCell(raw: string | undefined): number | null {
  if (raw == null || raw === "") {
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 1) {
    return null;
  }
  return value;
}

function buildProviderEventId(input: {
  division: string;
  matchDate: Date;
  homeTeamId: string;
  awayTeamId: string;
}): string {
  const day = input.matchDate.toISOString().slice(0, 10);
  return `${input.division}|${day}|${input.homeTeamId}|${input.awayTeamId}`;
}

export function parseFootballDataCoUkMatches(input: {
  csvText: string;
  seasonCode: string;
  division: FootballDataCoUkDivisionCode;
}): {
  matches: FootballDataCoUkParsedMatch[];
  stats: FootballDataCoUkParseStats;
} {
  const table = parseCsv(input.csvText);
  const reasons: Record<string, number> = {};
  const matches: FootballDataCoUkParsedMatch[] = [];
  let valid = 0;
  let rejected = 0;

  const expectedDiv = FOOTBALL_DATA_CO_UK_DIVISIONS[input.division].competitionKey;

  for (const row of table.rows) {
    if (!row.Div && !row.Date && !row.HomeTeam) {
      continue;
    }

    const div = row.Div || input.division;
    if (div !== expectedDiv && div !== input.division) {
      rejected += 1;
      bump(reasons, "unrecognized_competition");
      continue;
    }

    const matchDate = parseFootballDataCoUkDate(row.Date ?? "", input.seasonCode);
    if (!matchDate) {
      rejected += 1;
      bump(reasons, "invalid_date");
      continue;
    }

    const homeRaw = row.HomeTeam ?? "";
    const awayRaw = row.AwayTeam ?? "";
    if (!homeRaw || !awayRaw) {
      rejected += 1;
      bump(reasons, "missing_team");
      continue;
    }
    if (homeRaw === awayRaw) {
      rejected += 1;
      bump(reasons, "home_equals_away");
      continue;
    }

    const homeTeamId = resolveFootballDataCoUkTeamId(homeRaw);
    const awayTeamId = resolveFootballDataCoUkTeamId(awayRaw);
    if (!homeTeamId || !awayTeamId) {
      rejected += 1;
      bump(reasons, "unmapped_team");
      continue;
    }

    const providerEventId = buildProviderEventId({
      division: expectedDiv,
      matchDate,
      homeTeamId,
      awayTeamId,
    });
    const anchor = datasetDateAnchorUtc(matchDate);
    const snapshots: HistoricalOddsSnapshot[] = [];

    for (const book of FOOTBALL_DATA_CO_UK_BOOKMAKERS) {
      const openHome = parseOddsCell(row[book.open.home]);
      const openDraw = parseOddsCell(row[book.open.draw]);
      const openAway = parseOddsCell(row[book.open.away]);
      if (openHome != null && openDraw != null && openAway != null) {
        snapshots.push({
          providerEventId,
          bookmakerSlug: book.slug,
          bookmakerName: book.name,
          marketType: "winner",
          observationKind: "dataset_open",
          temporalPrecision: "unknown",
          observedAt: anchor,
          sourcePublishedAt: null,
          selections: [
            { side: "HOME", oddsDecimal: openHome },
            { side: "DRAW", oddsDecimal: openDraw },
            { side: "AWAY", oddsDecimal: openAway },
          ],
        });
      }

      const closeHome = parseOddsCell(row[book.close.home]);
      const closeDraw = parseOddsCell(row[book.close.draw]);
      const closeAway = parseOddsCell(row[book.close.away]);
      if (closeHome != null && closeDraw != null && closeAway != null) {
        snapshots.push({
          providerEventId,
          bookmakerSlug: book.slug,
          bookmakerName: book.name,
          marketType: "winner",
          observationKind: "dataset_close",
          temporalPrecision: "unknown",
          observedAt: anchor,
          sourcePublishedAt: null,
          selections: [
            { side: "HOME", oddsDecimal: closeHome },
            { side: "DRAW", oddsDecimal: closeDraw },
            { side: "AWAY", oddsDecimal: closeAway },
          ],
        });
      }
    }

    if (snapshots.length === 0) {
      rejected += 1;
      bump(reasons, "missing_odds");
      continue;
    }

    valid += 1;
    matches.push({
      division: expectedDiv,
      matchDate,
      kickoffTime: row.Time || null,
      homeTeamRaw: homeRaw,
      awayTeamRaw: awayRaw,
      homeTeamId,
      awayTeamId,
      providerEventId,
      snapshots,
    });
  }

  return {
    matches,
    stats: {
      rowsRead: table.rows.length,
      validMatchRows: valid,
      rejectedRows: rejected,
      rejectionReasons: reasons,
    },
  };
}
