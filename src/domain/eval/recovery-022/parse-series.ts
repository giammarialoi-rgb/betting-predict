/**
 * odds_series TXT format from generate_odds_series_csv.php (verified).
 *
 * 32 bookmaker rows × 216 columns = 72 hourly bins × 3 outcomes (1, X, 2).
 * Filename: match_{ID}_{Y_m_d_H_i_s}_{score1}_{score2}.txt
 * Timezone of matches.date / filename: UNDOCUMENTED.
 * bettype in generator: 1x2 only.
 */

import { createHash } from "node:crypto";
import { BTB_SERIES_BOOKMAKERS } from "@/domain/eval/recovery-022/bookmakers";
import { parseNumberOrNull } from "@/domain/eval/recovery-022/csv";
import {
  SERIES_BINS,
  seriesColumnRelativeSeconds,
  temporalModelKind,
} from "@/domain/eval/recovery-022/temporal";
import type { BeatTheBookieRecord } from "@/domain/eval/recovery-022/types";

export const SERIES_FILENAME_RE =
  /^match_(\d+)_(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d+)_(\d+)\.txt$/i;

export type SeriesFilenameMeta = {
  match_id: string;
  kickoff_naive: string;
  home_score: number;
  away_score: number;
  timezone: null;
};

export function parseSeriesFilename(name: string): SeriesFilenameMeta | null {
  const base = name.replace(/^.*[/\\]/, "");
  const m = SERIES_FILENAME_RE.exec(base);
  if (!m) return null;
  return {
    match_id: m[1]!,
    kickoff_naive: `${m[2]}-${m[3]}-${m[4]} ${m[5]}:${m[6]}:${m[7]}`,
    home_score: Number(m[8]),
    away_score: Number(m[9]),
    timezone: null,
  };
}

const OUTCOMES = ["HOME", "DRAW", "AWAY"] as const;

export type SeriesCell = {
  bookmaker: string;
  selection: (typeof OUTCOMES)[number];
  bin: number;
  relative_seconds: number;
  odds: number | null;
};

export function parseSeriesTxt(text: string, filename: string): {
  meta: SeriesFilenameMeta;
  cells: SeriesCell[];
  rows: number;
  cols: number;
} {
  const meta = parseSeriesFilename(filename);
  if (!meta) {
    throw new Error(`unrecognized series filename: ${filename}`);
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length !== BTB_SERIES_BOOKMAKERS.length) {
    throw new Error(
      `series row count ${lines.length} ≠ documented ${BTB_SERIES_BOOKMAKERS.length} bookmakers`,
    );
  }
  const cells: SeriesCell[] = [];
  let cols = 0;
  for (let r = 0; r < lines.length; r++) {
    const parts = lines[r]!.split(",");
    cols = Math.max(cols, parts.length);
    if (parts.length !== SERIES_BINS * 3) {
      throw new Error(
        `series col count ${parts.length} ≠ ${SERIES_BINS * 3} (72h × 1X2)`,
      );
    }
    const bookmaker = BTB_SERIES_BOOKMAKERS[r]!;
    for (let o = 0; o < 3; o++) {
      for (let b = 0; b < SERIES_BINS; b++) {
        const odds = parseNumberOrNull(parts[o * SERIES_BINS + b]!);
        cells.push({
          bookmaker,
          selection: OUTCOMES[o]!,
          bin: b,
          relative_seconds: seriesColumnRelativeSeconds(b),
          odds,
        });
      }
    }
  }
  return { meta, cells, rows: lines.length, cols };
}

export function seriesCellsToRecords(input: {
  cells: SeriesCell[];
  meta: SeriesFilenameMeta;
  dataset: "odds_series" | "odds_series_b" | "odds_series_fixture";
  league?: string;
  home?: string;
  away?: string;
  raw_hash: string;
}): BeatTheBookieRecord[] {
  const out: BeatTheBookieRecord[] = [];
  for (const c of input.cells) {
    if (c.odds == null) continue;
    out.push({
      source: "Lisandro79/BeatTheBookie",
      dataset: input.dataset,
      match_id: input.meta.match_id,
      league: input.league ?? "",
      home: input.home ?? "",
      away: input.away ?? "",
      kickoff: input.meta.kickoff_naive,
      kickoff_date: input.meta.kickoff_naive.slice(0, 10),
      bookmaker: c.bookmaker,
      market: "1X2",
      selection: c.selection,
      odds: c.odds,
      odds_timestamp: null,
      relative_seconds_to_kickoff: c.relative_seconds,
      temporal_precision: "RELATIVE_TO_KICKOFF_APPROX",
      temporal_model: temporalModelKind("RELATIVE_TO_KICKOFF_APPROX"),
      timezone: null,
      timezone_verified: false,
      available_at: null,
      lane: "STRICT_CANDIDATE",
      provenance: `hourly LOCF bin from ${input.dataset} TXT; TZ undocumented`,
      license: "Kaggle CC BY-SA 4.0 (dataset) / GitHub GPL-3.0 (code)",
      raw_hash: input.raw_hash,
      usable_strict_capital: false,
    });
  }
  return out;
}

export function hashSeriesText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function buildSeriesTxt(matrix: number[][]): string {
  return matrix.map((row) => row.map((v) => (Number.isFinite(v) ? String(v) : "nan")).join(",")).join("\n") + "\n";
}

/** Documented 32×216 fixture: odds only on selected hour bins. */
export function documentedSeriesFixtureMatrix(): number[][] {
  const rows: number[][] = [];
  for (let r = 0; r < BTB_SERIES_BOOKMAKERS.length; r++) {
    const row = Array.from({ length: SERIES_BINS * 3 }, () => Number.NaN);
    const set = (outcome: number, bin: number, price: number) => {
      row[outcome * SERIES_BINS + bin] = price;
    };
    if (r === 8) {
      set(0, 0, 1.9);
      set(0, 23, 1.91);
      set(0, 47, 1.92);
      set(0, 59, 1.93);
      set(0, 65, 1.94);
      set(0, 68, 1.95);
      set(0, 70, 1.96);
      set(0, 71, 1.97);
      set(1, 70, 3.5);
      set(2, 70, 4.0);
    }
    rows.push(row);
  }
  return rows;
}

export const SERIES_FIXTURE_FILENAME = "match_999001_2015_10_10_15_00_00_2_1.txt";
