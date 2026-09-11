/**
 * Load historical finished matches from disk caches we actually have.
 * Odds columns are ignored. Identity matching is fail-closed.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CLUB_FOOTBALL_MATCHES_CSV } from "@/audit/club-football-match-data/paths";
import { parseCsv } from "@/providers/football-data-co-uk/parser";
import { parseFdoukDate } from "@/domain/eval/acquisition-engine/sources/football-data-co-uk";
import type { HistoricalMatchRow } from "@/domain/eval/light-analysis/types";

const ODDS_HINT = /^(odd|over25|under25|handi|b365|ps|wh|bw|iw|vc|avg|max|bb|bfd)/i;

function num(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function pick(row: Record<string, string>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    if (row[k] != null && row[k] !== "") return row[k];
    const found = Object.keys(row).find((h) => h.trim().toLowerCase() === k.toLowerCase());
    if (found && row[found]) return row[found];
  }
  return undefined;
}

export function parseClubFootballHistory(csvText: string): HistoricalMatchRow[] {
  const table = parseCsv(csvText);
  const out: HistoricalMatchRow[] = [];
  for (const row of table.rows) {
    const home = pick(row, "HomeTeam") ?? "";
    const away = pick(row, "AwayTeam") ?? "";
    const dateRaw = pick(row, "MatchDate", "Date") ?? "";
    if (!home || !away || !dateRaw) continue;
    const iso = /^\d{4}-\d{2}-\d{2}/.test(dateRaw) ? dateRaw.slice(0, 10) : parseFdoukDate(dateRaw);
    if (!iso) continue;
    const home_goals = num(pick(row, "FTHome", "FTHG"));
    const away_goals = num(pick(row, "FTAway", "FTAG"));
    if (home_goals == null || away_goals == null) continue;
    out.push({
      home,
      away,
      date: iso,
      home_goals,
      away_goals,
      home_corners: num(pick(row, "HomeCorners", "HC")),
      away_corners: num(pick(row, "AwayCorners", "AC")),
      league: pick(row, "Division", "Div") ?? null,
      source_id: "club-football-match-data",
    });
  }
  return out;
}

export function parseFootballDataCoUkHistory(csvText: string, divisionHint = ""): HistoricalMatchRow[] {
  const table = parseCsv(csvText);
  const out: HistoricalMatchRow[] = [];
  for (const row of table.rows) {
    const home = pick(row, "HomeTeam") ?? "";
    const away = pick(row, "AwayTeam") ?? "";
    const date = parseFdoukDate(pick(row, "Date"));
    if (!home || !away || !date) continue;
    const home_goals = num(pick(row, "FTHG"));
    const away_goals = num(pick(row, "FTAG"));
    if (home_goals == null || away_goals == null) continue;
    out.push({
      home,
      away,
      date,
      home_goals,
      away_goals,
      home_corners: num(pick(row, "HC")),
      away_corners: num(pick(row, "AC")),
      league: pick(row, "Div") ?? (divisionHint || null),
      source_id: "football-data-co-uk",
    });
  }
  return out;
}

/** Exposed for tests — odds-looking headers must never become goal/corner values. */
export function oddsLikeHeaders(headers: readonly string[]): string[] {
  return headers.filter((h) => ODDS_HINT.test(h.trim()));
}

let cached: { cwd: string; rows: HistoricalMatchRow[]; at: number } | null = null;
const CACHE_MS = 60_000;

export function loadHistoricalMatches(cwd = process.cwd(), force = false): HistoricalMatchRow[] {
  const now = Date.now();
  if (!force && cached && cached.cwd === cwd && now - cached.at < CACHE_MS) {
    return cached.rows;
  }
  const rows: HistoricalMatchRow[] = [];

  const clubPath = join(cwd, "audit", "external", "Club-Football-Match-Data", "data", "Matches.csv");
  const clubAlt = CLUB_FOOTBALL_MATCHES_CSV;
  const clubFile = existsSync(clubPath) ? clubPath : existsSync(clubAlt) ? clubAlt : null;
  if (clubFile) {
    try {
      rows.push(...parseClubFootballHistory(readFileSync(clubFile, "utf8")));
    } catch {
      /* missing or unreadable — do not invent */
    }
  }

  const fdoukDir = join(cwd, "data", "acquisition", "football-data-co-uk");
  if (existsSync(fdoukDir)) {
    try {
      for (const name of readdirSync(fdoukDir)) {
        if (!name.toLowerCase().endsWith(".csv")) continue;
        const text = readFileSync(join(fdoukDir, name), "utf8");
        rows.push(...parseFootballDataCoUkHistory(text, name.replace(/\.csv$/i, "")));
      }
    } catch {
      /* skip */
    }
  }

  cached = { cwd, rows, at: now };
  return rows;
}

export function historySourceIds(rows: readonly HistoricalMatchRow[]): string[] {
  return [...new Set(rows.map((r) => r.source_id))];
}
