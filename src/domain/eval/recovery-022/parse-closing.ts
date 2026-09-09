/**
 * closing_odds.csv — paper/Kaggle redistribution of BeatTheBookie closing 1X2 aggregates.
 *
 * Empirically (TilenKopac GitHub copy, sha256 a2f4083aea15ca7cfcc6abb6db9849108a1974fb0b4145171033e4e51d469fc4):
 * 479,440 rows, 2005-01-01 → 2015-06-30, 818 leagues, DATE_ONLY, no t_* seconds, no median.
 * Avg/max are research features. top_bookie_* labels who offered the max — not a full book.
 */

import { createHash } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import { splitCsvLine, parseNumberOrNull } from "@/domain/eval/recovery-022/csv";
import { classifyMatchDateField } from "@/domain/eval/recovery-022/temporal";
import { DATASET_ID_022 } from "@/domain/eval/recovery-022/types";
import type { ResearchAggregate022 } from "@/domain/eval/recovery-022/types";

export const CLOSING_ODDS_HEADER = [
  "match_id",
  "league",
  "match_date",
  "home_team",
  "home_score",
  "away_team",
  "away_score",
  "avg_odds_home_win",
  "avg_odds_draw",
  "avg_odds_away_win",
  "max_odds_home_win",
  "max_odds_draw",
  "max_odds_away_win",
  "top_bookie_home_win",
  "top_bookie_draw",
  "top_bookie_away_win",
  "n_odds_home_win",
  "n_odds_draw",
  "n_odds_away_win",
] as const;

export type ClosingOddsRow = {
  match_id: string;
  league: string;
  match_date: string;
  home_team: string;
  home_score: number | null;
  away_team: string;
  away_score: number | null;
  avg_home: number | null;
  avg_draw: number | null;
  avg_away: number | null;
  max_home: number | null;
  max_draw: number | null;
  max_away: number | null;
  top_home: string;
  top_draw: string;
  top_away: string;
  n_home: number;
  n_draw: number;
  n_away: number;
  temporal_precision: ReturnType<typeof classifyMatchDateField>;
  has_median: false;
  has_relative_seconds: false;
};

export type ClosingInspect = {
  bytes: number;
  sha256: string;
  header: string[];
  rows: number;
  dateMin: string | null;
  dateMax: string | null;
  timed: number;
  dateOnly: number;
  leagues: Set<string>;
  topBookies: Set<string>;
  years: Map<number, number>;
  hasMedian: boolean;
  hasRelativeSeconds: boolean;
};

export function parseClosingOddsLine(line: string): ClosingOddsRow | null {
  const p = splitCsvLine(line);
  if (p.length < 19) return null;
  if (p[0] === "match_id") return null;
  const match_date = p[2]!.trim();
  return {
    match_id: p[0]!.trim(),
    league: p[1]!.trim(),
    match_date,
    home_team: p[3]!.trim(),
    home_score: parseNumberOrNull(p[4]!),
    away_team: p[5]!.trim(),
    away_score: parseNumberOrNull(p[6]!),
    avg_home: parseNumberOrNull(p[7]!),
    avg_draw: parseNumberOrNull(p[8]!),
    avg_away: parseNumberOrNull(p[9]!),
    max_home: parseNumberOrNull(p[10]!),
    max_draw: parseNumberOrNull(p[11]!),
    max_away: parseNumberOrNull(p[12]!),
    top_home: p[13]!.trim(),
    top_draw: p[14]!.trim(),
    top_away: p[15]!.trim(),
    n_home: parseNumberOrNull(p[16]!) ?? 0,
    n_draw: parseNumberOrNull(p[17]!) ?? 0,
    n_away: parseNumberOrNull(p[18]!) ?? 0,
    temporal_precision: classifyMatchDateField(match_date),
    has_median: false,
    has_relative_seconds: false,
  };
}

export function closingRowToResearchAggregates(row: ClosingOddsRow): ResearchAggregate022[] {
  const out: ResearchAggregate022[] = [];
  const push = (
    selection: ResearchAggregate022["selection"],
    kind: "avg" | "max",
    odds: number | null,
    n: number,
    top: string,
  ) => {
    if (odds == null) return;
    out.push({
      match_id: row.match_id,
      kickoff_date: row.match_date,
      league: row.league,
      home: row.home_team,
      away: row.away_team,
      selection,
      kind,
      odds,
      n_odds: n,
      top_bookie_label: kind === "max" && top ? top : null,
      lane: "RESEARCH_ONLY",
    });
  };
  push("HOME", "avg", row.avg_home, row.n_home, row.top_home);
  push("DRAW", "avg", row.avg_draw, row.n_draw, row.top_draw);
  push("AWAY", "avg", row.avg_away, row.n_away, row.top_away);
  push("HOME", "max", row.max_home, row.n_home, row.top_home);
  push("DRAW", "max", row.max_draw, row.n_draw, row.top_draw);
  push("AWAY", "max", row.max_away, row.n_away, row.top_away);
  return out;
}

export async function inspectClosingOddsCsv(path: string): Promise<ClosingInspect> {
  if (!existsSync(path)) {
    throw new Error(`closing_odds.csv missing: ${path}`);
  }
  const hash = createHash("sha256");
  const stream = createReadStream(path);
  stream.on("data", (d) => hash.update(d));
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let header: string[] = [];
  let rows = 0;
  let dateMin: string | null = null;
  let dateMax: string | null = null;
  let timed = 0;
  let dateOnly = 0;
  const leagues = new Set<string>();
  const topBookies = new Set<string>();
  const years = new Map<number, number>();
  let hasMedian = false;
  let hasRelativeSeconds = false;

  for await (const line of rl) {
    if (header.length === 0) {
      header = splitCsvLine(line);
      hasMedian = header.some((h) => /median/i.test(h));
      hasRelativeSeconds = header.some(
        (h) => /^t_/.test(h) || /seconds/i.test(h) || /timestamp/i.test(h),
      );
      continue;
    }
    const row = parseClosingOddsLine(line);
    if (!row) continue;
    rows += 1;
    if (row.temporal_precision === "DATE_ONLY") dateOnly += 1;
    else timed += 1;
    if (!dateMin || row.match_date < dateMin) dateMin = row.match_date;
    if (!dateMax || row.match_date > dateMax) dateMax = row.match_date;
    leagues.add(row.league);
    if (row.top_home) topBookies.add(row.top_home);
    if (row.top_draw) topBookies.add(row.top_draw);
    if (row.top_away) topBookies.add(row.top_away);
    const y = Number(row.match_date.slice(0, 4));
    if (Number.isFinite(y)) years.set(y, (years.get(y) ?? 0) + 1);
  }

  return {
    bytes: statSync(path).size,
    sha256: hash.digest("hex"),
    header,
    rows,
    dateMin,
    dateMax,
    timed,
    dateOnly,
    leagues,
    topBookies,
    years,
    hasMedian,
    hasRelativeSeconds,
  };
}

export function datasetLabelClosing(): string {
  return `${DATASET_ID_022}/closing_odds DATE_ONLY (research)`;
}
