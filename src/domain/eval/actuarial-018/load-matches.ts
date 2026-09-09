/**
 * Stream-load Club-Football Matches.csv into compact chronological events.
 * Does NOT load Form*, C_*, or odds columns into STRICT feature paths.
 */

import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { CLUB_FOOTBALL_MATCHES_CSV } from "@/audit/club-football-match-data/paths";
import { parseMatchDate } from "@/audit/club-football-match-data/classifiers";

export type ClubMatchLite = {
  eventId: string;
  division: string;
  matchDate: Date;
  year: number;
  home: string;
  away: string;
  ftHome: number | null;
  ftAway: number | null;
  result: "HOME" | "DRAW" | "AWAY" | null;
  /** RESEARCH_ONLY — not STRICT odds. */
  oddHome: number | null;
  oddDraw: number | null;
  oddAway: number | null;
  /** RESEARCH_ONLY / CONDITIONAL Elo on row. */
  homeElo: number | null;
  awayElo: number | null;
};

function parseNum(s: string | undefined): number | null {
  if (s == null || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function resultFrom(ftH: number | null, ftA: number | null): ClubMatchLite["result"] {
  if (ftH == null || ftA == null) return null;
  if (ftH > ftA) return "HOME";
  if (ftH < ftA) return "AWAY";
  return "DRAW";
}

export async function loadClubMatchesLite(): Promise<{
  present: boolean;
  path: string;
  matches: ClubMatchLite[];
  rows_read: number;
  rows_skipped_bad_date: number;
  rows_missing_ft: number;
}> {
  const path = CLUB_FOOTBALL_MATCHES_CSV;
  if (!existsSync(path)) {
    return {
      present: false,
      path,
      matches: [],
      rows_read: 0,
      rows_skipped_bad_date: 0,
      rows_missing_ft: 0,
    };
  }

  const rl = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let header: string[] | null = null;
  const idx: Record<string, number> = {};
  const matches: ClubMatchLite[] = [];
  let rows_read = 0;
  let rows_skipped_bad_date = 0;
  let rows_missing_ft = 0;

  for await (const line of rl) {
    if (!header) {
      header = line.split(",");
      header.forEach((h, i) => {
        idx[h.trim()] = i;
      });
      continue;
    }
    rows_read += 1;
    // Fast split — dataset has no quoted commas in practice for these fields
    const cols = line.split(",");
    const dateStr = cols[idx.MatchDate] ?? "";
    const d = parseMatchDate(dateStr);
    if (!d) {
      rows_skipped_bad_date += 1;
      continue;
    }
    const ftH = parseNum(cols[idx.FTHome]);
    const ftA = parseNum(cols[idx.FTAway]);
    if (ftH == null || ftA == null) rows_missing_ft += 1;
    const home = (cols[idx.HomeTeam] ?? "").trim();
    const away = (cols[idx.AwayTeam] ?? "").trim();
    const division = (cols[idx.Division] ?? "").trim();
    const day = d.toISOString().slice(0, 10);
    matches.push({
      eventId: `cfm|${division}|${day}|${home}|${away}`,
      division,
      matchDate: d,
      year: d.getUTCFullYear(),
      home,
      away,
      ftHome: ftH,
      ftAway: ftA,
      result: resultFrom(ftH, ftA),
      oddHome: parseNum(cols[idx.OddHome]),
      oddDraw: parseNum(cols[idx.OddDraw]),
      oddAway: parseNum(cols[idx.OddAway]),
      homeElo: parseNum(cols[idx.HomeElo]),
      awayElo: parseNum(cols[idx.AwayElo]),
    });
  }

  matches.sort((a, b) => {
    const t = a.matchDate.getTime() - b.matchDate.getTime();
    if (t !== 0) return t;
    return a.eventId.localeCompare(b.eventId);
  });

  return {
    present: true,
    path,
    matches,
    rows_read,
    rows_skipped_bad_date,
    rows_missing_ft,
  };
}
