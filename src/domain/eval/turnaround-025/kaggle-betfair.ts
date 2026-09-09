/**
 * zygmunt/betfair-sports weekly CSV parser.
 * One week of trades — not a multi-year history. License on Kaggle is "Other".
 */

import type { WeeklyBetfairRow025 } from "@/domain/eval/turnaround-025/types";

export const KAGGLE_BETFAIR_SPORTS = {
  url: "https://www.kaggle.com/datasets/zygmunt/betfair-sports",
  rows_declared: 1_306_731,
  bytes_uncompressed_declared: 321_000_000,
  zip_bytes_declared: 85_387_576,
  requiresSubscription: true,
  isAccessibleForFree: true,
  license: "Other (specified in description)",
  soccer_sports_id: "1",
  note: "One week of Betfair exchange trades across 23 sports. Not a multi-year history.",
} as const;

export const WEEKLY_COLUMNS = [
  "EVENT_ID",
  "FULL_DESCRIPTION",
  "SCHEDULED_OFF",
  "EVENT",
  "ACTUAL_OFF",
  "SELECTION",
  "SETTLED_DATE",
  "ODDS",
  "LATEST_TAKEN",
  "FIRST_TAKEN",
  "IN_PLAY",
  "NUMBER_BETS",
  "VOLUME_MATCHED",
  "SPORTS_ID",
  "SELECTION_ID",
  "WIN_FLAG",
] as const;

export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      q = !q;
      continue;
    }
    if (c === "," && !q) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

export function parseWeeklyBetfairLine(header: string[], line: string): WeeklyBetfairRow025 | null {
  const p = splitCsvLine(line);
  const idx = (name: string) => header.indexOf(name);
  const iEvent = idx("EVENT_ID");
  const iSports = idx("SPORTS_ID");
  const iSched = idx("SCHEDULED_OFF");
  const iActual = idx("ACTUAL_OFF");
  const iFirst = idx("FIRST_TAKEN");
  const iLatest = idx("LATEST_TAKEN");
  const iInPlay = idx("IN_PLAY");
  const iSel = idx("SELECTION");
  const iSelId = idx("SELECTION_ID");
  const iOdds = idx("ODDS");
  const iBets = idx("NUMBER_BETS");
  const iVol = idx("VOLUME_MATCHED");
  const iWin = idx("WIN_FLAG");
  const iDesc = idx("FULL_DESCRIPTION");
  if (iEvent < 0 || iSched < 0 || iOdds < 0) return null;
  const odds = Number(p[iOdds]);
  return {
    event_id: p[iEvent] ?? "",
    sports_id: iSports >= 0 ? (p[iSports] ?? "") : "",
    scheduled_off: p[iSched] ?? "",
    actual_off: iActual >= 0 ? p[iActual] || null : null,
    first_taken: iFirst >= 0 ? p[iFirst] || null : null,
    latest_taken: iLatest >= 0 ? p[iLatest] || null : null,
    in_play: iInPlay >= 0 ? (p[iInPlay] ?? "") : "",
    selection: iSel >= 0 ? (p[iSel] ?? "") : "",
    selection_id: iSelId >= 0 ? (p[iSelId] ?? "") : "",
    odds: Number.isFinite(odds) ? odds : 0,
    number_bets: iBets >= 0 && p[iBets] ? Number(p[iBets]) : null,
    volume_matched: iVol >= 0 && p[iVol] ? Number(p[iVol]) : null,
    win_flag: iWin >= 0 && p[iWin] !== "" ? Number(p[iWin]) : null,
    full_description: iDesc >= 0 ? (p[iDesc] ?? "") : "",
  };
}

export function parseWeeklyBetfairCsv(text: string): WeeklyBetfairRow025[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]!).map((h) => h.trim().toUpperCase());
  const rows: WeeklyBetfairRow025[] = [];
  for (let n = 1; n < lines.length; n++) {
    const row = parseWeeklyBetfairLine(header, lines[n]!);
    if (row) rows.push(row);
  }
  return rows;
}
