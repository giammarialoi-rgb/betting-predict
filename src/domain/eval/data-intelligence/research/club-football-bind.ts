/**
 * Bind Club-Football-Match-Data rows to an event.
 * Directory presence is not SUCCESS. Odds columns never become MODEL features.
 * DATE_ONLY: available_at stays null. Target kickoff row is excluded.
 */
import { existsSync, readFileSync } from "node:fs";
import { CLUB_FOOTBALL_MATCHES_CSV } from "@/audit/club-football-match-data/paths";
import { namesEqual } from "@/domain/eval/data-intelligence/research/identity-normalize";

const ODDS_COLS = new Set([
  "OddHome",
  "OddDraw",
  "OddAway",
  "MaxHome",
  "MaxDraw",
  "MaxAway",
  "Over25",
  "Under25",
  "MaxOver25",
  "MaxUnder25",
  "HandiSize",
  "HandiHome",
  "HandiAway",
]);

export type ClubFootballBind = {
  status: "SUCCESS" | "PARTIAL" | "NO_EVENT" | "MISSING_FILE";
  file_present: boolean;
  prior_n: number;
  fields_extracted: string[];
  home_gf_l5: number | null;
  away_gf_l5: number | null;
  reason: string;
  odds_columns_ignored: string[];
};

function parseDate(raw: string): number {
  const t = raw.trim();
  const iso = Date.parse(t);
  if (Number.isFinite(iso)) return iso;
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return NaN;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  return Date.UTC(y, mo - 1, d);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') {
      q = !q;
      continue;
    }
    if (ch === "," && !q) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function bindClubFootballEvent(input: {
  home: string;
  away: string;
  kickoffIso: string;
  csvPath?: string;
  csvText?: string;
}): ClubFootballBind {
  const path = input.csvPath ?? CLUB_FOOTBALL_MATCHES_CSV;
  const file_present = input.csvText != null || existsSync(path);
  if (!file_present) {
    return {
      status: "MISSING_FILE",
      file_present: false,
      prior_n: 0,
      fields_extracted: [],
      home_gf_l5: null,
      away_gf_l5: null,
      reason: "Club-Football-Match-Data Matches.csv assente — non usato come SUCCESS.",
      odds_columns_ignored: [],
    };
  }
  const text = input.csvText ?? readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      status: "NO_EVENT",
      file_present: true,
      prior_n: 0,
      fields_extracted: [],
      home_gf_l5: null,
      away_gf_l5: null,
      reason: "CSV presente ma vuoto. Nessuna riga abbinata.",
      odds_columns_ignored: [...ODDS_COLS],
    };
  }
  const header = parseCsvLine(lines[0]!);
  const idx = (name: string) => header.findIndex((h) => h.trim() === name);
  const iHome = idx("HomeTeam");
  const iAway = idx("AwayTeam");
  const iDate = idx("MatchDate");
  const iFth = idx("FTHome");
  const iFta = idx("FTAway");
  if (iHome < 0 || iAway < 0 || iDate < 0) {
    return {
      status: "NO_EVENT",
      file_present: true,
      prior_n: 0,
      fields_extracted: [],
      home_gf_l5: null,
      away_gf_l5: null,
      reason: "CSV header missing HomeTeam/AwayTeam/MatchDate. No invented bind.",
      odds_columns_ignored: header.filter((h) => ODDS_COLS.has(h.trim())),
    };
  }
  const kickoff = Date.parse(input.kickoffIso);
  const cutoff = Number.isFinite(kickoff) ? kickoff : Date.now();
  const ko = new Date(cutoff);
  const cutoffDay = Date.UTC(ko.getUTCFullYear(), ko.getUTCMonth(), ko.getUTCDate());
  const homePriors: number[] = [];
  const awayPriors: number[] = [];
  let prior_n = 0;
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const home = cols[iHome] ?? "";
    const away = cols[iAway] ?? "";
    const dt = parseDate(cols[iDate] ?? "");
    if (!Number.isFinite(dt) || dt >= cutoffDay) continue;
    const homeHit = namesEqual(home, input.home) || namesEqual(away, input.home);
    const awayHit = namesEqual(home, input.away) || namesEqual(away, input.away);
    if (!homeHit && !awayHit) continue;
    prior_n += 1;
    const fth = iFth >= 0 ? Number(cols[iFth]) : NaN;
    const fta = iFta >= 0 ? Number(cols[iFta]) : NaN;
    if (!Number.isFinite(fth) || !Number.isFinite(fta)) continue;
    if (namesEqual(home, input.home)) homePriors.push(fth);
    if (namesEqual(away, input.home)) homePriors.push(fta);
    if (namesEqual(home, input.away)) awayPriors.push(fth);
    if (namesEqual(away, input.away)) awayPriors.push(fta);
  }
  const last5 = (xs: number[]) => {
    if (xs.length === 0) return null;
    const slice = xs.slice(-5);
    return Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 1000) / 1000;
  };
  const home_gf_l5 = last5(homePriors);
  const away_gf_l5 = last5(awayPriors);
  const fields: string[] = [];
  if (home_gf_l5 != null) fields.push("home_gf_l5");
  if (away_gf_l5 != null) fields.push("away_gf_l5");
  if (prior_n === 0) {
    return {
      status: "NO_EVENT",
      file_present: true,
      prior_n: 0,
      fields_extracted: [],
      home_gf_l5: null,
      away_gf_l5: null,
      reason:
        "Club-Football-Match-Data file present but this event is not bound to parsed prior rows (no invented team match).",
      odds_columns_ignored: header.filter((h) => ODDS_COLS.has(h.trim())),
    };
  }
  return {
    status: fields.length === 2 ? "SUCCESS" : "PARTIAL",
    file_present: true,
    prior_n,
    fields_extracted: fields,
    home_gf_l5,
    away_gf_l5,
    reason: `Bound ${prior_n} prior rows (MatchDate < kickoff). Odds columns ignored. DATE_ONLY — available_at null.`,
    odds_columns_ignored: header.filter((h) => ODDS_COLS.has(h.trim())),
  };
}
