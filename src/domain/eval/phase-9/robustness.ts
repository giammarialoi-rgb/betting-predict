import { EDGE_THRESHOLDS, MIN_N_QUALITY, MIN_N_ROI, PHASE9_RANDOM_SEED } from "@/domain/eval/phase-9/config";
import { logLossOne, brierOne } from "@/domain/eval/predictive-intelligence/validation/metrics";
import { valueSlice } from "@/domain/eval/phase-9/value";
import { argmax3 } from "@/domain/eval/phase-9/metrics";
import { selectionOdds } from "@/domain/eval/phase-9/value";
import type { Phase9PredRow, Phase9Robustness } from "@/domain/eval/phase-9/types";
import { PHASE9_NON_DETERMINABILE } from "@/domain/eval/phase-9/types";

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
}

function se(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v / xs.length);
}

function ci95(xs: number[]): [number, number] | null {
  if (xs.length < 20) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const lo = sorted[Math.floor(0.025 * (sorted.length - 1))]!;
  const hi = sorted[Math.floor(0.975 * (sorted.length - 1))]!;
  return [lo, hi];
}

export function robustnessReport(input: {
  rows: Phase9PredRow[];
  threshold: number | null;
  bootstrapN?: number;
}): Phase9Robustness {
  const n = input.rows.length;
  const bootstrap_n = input.bootstrapN ?? 200;
  if (n < MIN_N_QUALITY) {
    return {
      n,
      bootstrap_n: 0,
      log_loss_mean: null,
      log_loss_se: null,
      log_loss_ci95: null,
      brier_mean: null,
      brier_se: null,
      brier_ci95: null,
      yield_mean: null,
      yield_se: null,
      yield_ci95: null,
      pnl_concentration_top10pct: null,
      max_single_bet_share: null,
      snooping_thresholds_tested: EDGE_THRESHOLDS.length,
      insufficient: true,
      reason: `INSUFFICIENT_EVIDENCE n=${n} < ${MIN_N_QUALITY}`,
    };
  }
  const rand = mulberry32(PHASE9_RANDOM_SEED);
  const ll: number[] = [];
  const br: number[] = [];
  const yd: number[] = [];
  for (let b = 0; b < bootstrap_n; b += 1) {
    const sample: Phase9PredRow[] = [];
    for (let i = 0; i < n; i += 1) sample.push(input.rows[Math.floor(rand() * n)]!);
    ll.push(sample.reduce((s, r) => s + logLossOne(r.p, r.y), 0) / n);
    br.push(sample.reduce((s, r) => s + brierOne(r.p, r.y), 0) / n);
    if (input.threshold != null) {
      const sl = valueSlice(sample, input.threshold, "GRID_REPORT_ONLY");
      if (sl.yield != null) yd.push(sl.yield);
    }
  }

  const pnls: number[] = [];
  if (input.threshold != null) {
    for (const r of input.rows) {
      const sel = argmax3(r.p);
      const o = selectionOdds(r.odds, sel);
      const edge = o != null ? r.p[sel] - 1 / o : null;
      if (edge == null || o == null || edge < input.threshold) continue;
      pnls.push(sel === r.y ? o - 1 : -1);
    }
  }
  const abs = pnls.map((x) => Math.abs(x));
  const absSum = abs.reduce((a, b) => a + b, 0);
  const sortedAbs = [...abs].sort((a, b) => b - a);
  const topK = Math.max(1, Math.ceil(sortedAbs.length * 0.1));
  const topShare =
    absSum > 0 && sortedAbs.length ? sortedAbs.slice(0, topK).reduce((a, b) => a + b, 0) / absSum : null;
  const maxShare = absSum > 0 && sortedAbs[0] != null ? sortedAbs[0] / absSum : null;

  return {
    n,
    bootstrap_n,
    log_loss_mean: mean(ll),
    log_loss_se: se(ll),
    log_loss_ci95: ci95(ll),
    brier_mean: mean(br),
    brier_se: se(br),
    brier_ci95: ci95(br),
    yield_mean: yd.length ? mean(yd) : null,
    yield_se: yd.length ? se(yd) : null,
    yield_ci95: yd.length >= 20 ? ci95(yd) : null,
    pnl_concentration_top10pct: topShare,
    max_single_bet_share: maxShare,
    snooping_thresholds_tested: EDGE_THRESHOLDS.length,
    insufficient: pnls.length > 0 && pnls.length < MIN_N_ROI,
    reason:
      pnls.length > 0 && pnls.length < MIN_N_ROI
        ? `INSUFFICIENT_EVIDENCE value n=${pnls.length}`
        : pnls.length === 0 && input.threshold != null
          ? PHASE9_NON_DETERMINABILE
          : null,
  };
}
