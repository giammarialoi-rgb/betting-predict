import { assertNoRandomSplit } from "@/domain/eval/phase-9/firewall";
import type { Phase9Match, Phase9Window } from "@/domain/eval/phase-9/types";

function seasonsInOrder(matches: readonly Phase9Match[]): string[] {
  return [...new Set(matches.map((m) => m.season))].sort();
}

function dateRange(rows: readonly Phase9Match[]): { start: string; end: string } {
  if (!rows.length) return { start: "", end: "" };
  const dates = rows.map((m) => m.match_date).sort();
  return { start: dates[0]!, end: dates[dates.length - 1]! };
}

/**
 * Expanding chronological windows only.
 * Train = earlier seasons; VAL = next season; OOS = season after VAL.
 * Last season is never used to choose thresholds.
 */
export function buildWalkForwardWindows(
  matches: readonly Phase9Match[],
  method: string = "walk_forward",
): Phase9Window[] {
  assertNoRandomSplit(method);
  const seasons = seasonsInOrder(matches);
  const windows: Phase9Window[] = [];
  for (let i = 0; i < seasons.length - 2; i += 1) {
    const train_seasons = seasons.slice(0, i + 1);
    const val_seasons = [seasons[i + 1]!];
    const oos_seasons = [seasons[i + 2]!];
    const train = matches.filter((m) => train_seasons.includes(m.season));
    const val = matches.filter((m) => val_seasons.includes(m.season));
    const oos = matches.filter((m) => oos_seasons.includes(m.season));
    if (!train.length || !val.length || !oos.length) continue;
    const tr = dateRange(train);
    const vr = dateRange(val);
    const or = dateRange(oos);
    windows.push({
      window_id: `wf_train_${train_seasons.join("+")}_val_${val_seasons[0]}_oos_${oos_seasons[0]}`,
      kind: "walk_forward",
      train_seasons,
      val_seasons,
      oos_seasons,
      train_start: tr.start,
      train_end: tr.end,
      val_start: vr.start,
      val_end: vr.end,
      oos_start: or.start,
      oos_end: or.end,
      train_n: train.length,
      val_n: val.length,
      oos_n: oos.length,
    });
  }
  return windows;
}

export function rowsForSeasons(matches: readonly Phase9Match[], seasons: readonly string[]): Phase9Match[] {
  const set = new Set(seasons);
  return matches.filter((m) => set.has(m.season));
}

export function assertWindowsTemporal(windows: readonly Phase9Window[]): void {
  for (const w of windows) {
    if (w.train_end && w.val_start && w.train_end > w.val_start) {
      throw new Error(`SPLIT_LEAKAGE: train_end ${w.train_end} > val_start ${w.val_start}`);
    }
    if (w.val_end && w.oos_start && w.val_end > w.oos_start) {
      throw new Error(`SPLIT_LEAKAGE: val_end ${w.val_end} > oos_start ${w.oos_start}`);
    }
    for (const s of w.train_seasons) {
      if (w.val_seasons.includes(s) || w.oos_seasons.includes(s)) {
        throw new Error(`SPLIT_LEAKAGE: season ${s} in more than one partition`);
      }
    }
    for (const s of w.val_seasons) {
      if (w.oos_seasons.includes(s)) {
        throw new Error(`SPLIT_LEAKAGE: val season ${s} also OOS`);
      }
    }
  }
}
