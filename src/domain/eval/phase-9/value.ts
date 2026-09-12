/**
 * Value backtest AFTER independent probabilities vs real historical open odds.
 * Threshold chosen on TRAIN/VAL only; verified on OOS.
 */
import { EDGE_THRESHOLDS, MIN_N_ROI, MIN_N_THRESHOLD_CHOICE } from "@/domain/eval/phase-9/config";
import { argmax3 } from "@/domain/eval/phase-9/metrics";
import type { Phase9PredRow, Phase9ValueSlice } from "@/domain/eval/phase-9/types";
import { PHASE9_NON_DETERMINABILE } from "@/domain/eval/phase-9/types";
import type { PiLabel } from "@/domain/eval/predictive-intelligence/types";

export function selectionOdds(
  odds: { home: number | null; draw: number | null; away: number | null } | null,
  sel: PiLabel,
): number | null {
  if (!odds) return null;
  const o = sel === "HOME" ? odds.home : sel === "DRAW" ? odds.draw : odds.away;
  return o != null && o > 1 ? o : null;
}

export function implied(odds: number): number {
  return 1 / odds;
}

/** Edge = model p(selection) − implied(open odds). Independent p first. */
export function edgeForRow(r: Phase9PredRow, sel: PiLabel): number | null {
  const o = selectionOdds(r.odds, sel);
  if (o == null) return null;
  return r.p[sel] - implied(o);
}

export function valueSlice(rows: Phase9PredRow[], threshold: number, chosen_on: Phase9ValueSlice["chosen_on"]): Phase9ValueSlice {
  const stake = 1;
  let profit = 0;
  let bets = 0;
  let hits = 0;
  let bank = 0;
  let peak = 0;
  let maxDd = 0;
  let lose = 0;
  let win = 0;
  let maxLose = 0;
  let maxWin = 0;
  for (const r of rows) {
    const sel = argmax3(r.p);
    const edge = edgeForRow(r, sel);
    const o = selectionOdds(r.odds, sel);
    if (edge == null || o == null || edge < threshold) continue;
    bets += 1;
    const won = sel === r.y;
    const pnl = won ? stake * (o - 1) : -stake;
    if (won) {
      hits += 1;
      win += 1;
      lose = 0;
      maxWin = Math.max(maxWin, win);
    } else {
      lose += 1;
      win = 0;
      maxLose = Math.max(maxLose, lose);
    }
    profit += pnl;
    bank += pnl;
    peak = Math.max(peak, bank);
    maxDd = Math.max(maxDd, peak - bank);
  }
  const insufficient = bets < MIN_N_ROI;
  return {
    edge_threshold: threshold,
    chosen_on,
    n_bets: bets,
    hit_rate: bets ? hits / bets : null,
    yield: bets ? profit / (bets * stake) : null,
    roi: bets ? profit / (bets * stake) : null,
    max_drawdown: bets ? maxDd / Math.max(1, bets * stake) : null,
    profit,
    longest_losing_streak: maxLose,
    longest_winning_streak: maxWin,
    insufficient,
    reason: insufficient
      ? bets === 0
        ? PHASE9_NON_DETERMINABILE
        : `INSUFFICIENT_EVIDENCE n_bets=${bets} < ${MIN_N_ROI}`
      : null,
  };
}

export function gridValue(rows: Phase9PredRow[], chosen_on: Phase9ValueSlice["chosen_on"]): Phase9ValueSlice[] {
  return EDGE_THRESHOLDS.map((t) => valueSlice(rows, t, chosen_on));
}

/**
 * Choose threshold on VAL only: highest yield among slices with enough bets.
 * No peeking at OOS.
 */
export function chooseThresholdOnVal(valRows: Phase9PredRow[]): {
  threshold: number | null;
  val_grid: Phase9ValueSlice[];
  reason: string;
} {
  const val_grid = gridValue(valRows, "VAL");
  const usable = val_grid.filter((s) => s.n_bets >= MIN_N_THRESHOLD_CHOICE && s.yield != null);
  if (!usable.length) {
    return {
      threshold: null,
      val_grid,
      reason: `INSUFFICIENT_EVIDENCE: no VAL slice with n_bets>=${MIN_N_THRESHOLD_CHOICE}`,
    };
  }
  usable.sort((a, b) => (b.yield ?? -Infinity) - (a.yield ?? -Infinity));
  return {
    threshold: usable[0]!.edge_threshold,
    val_grid,
    reason: `chosen_on_VAL yield=${usable[0]!.yield} n=${usable[0]!.n_bets}`,
  };
}

export function verifyThresholdOnOos(
  oosRows: Phase9PredRow[],
  threshold: number | null,
): { oos_grid: Phase9ValueSlice[]; chosen: Phase9ValueSlice | null } {
  const oos_grid = gridValue(oosRows, "GRID_REPORT_ONLY");
  if (threshold == null) return { oos_grid, chosen: null };
  return { oos_grid, chosen: valueSlice(oosRows, threshold, "VAL") };
}
