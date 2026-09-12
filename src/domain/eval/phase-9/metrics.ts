import { calibrationError, computeMetrics, rocAucOvr } from "@/domain/eval/predictive-intelligence/validation/metrics";
import type { PiLabel, PiProb3 } from "@/domain/eval/predictive-intelligence/types";
import { MIN_N_AUC, MIN_N_QUALITY } from "@/domain/eval/phase-9/config";
import type { BinaryMetrics, Confusion3, GoalMetrics, Phase9QualityMetrics } from "@/domain/eval/phase-9/types";

export function emptyConfusion(): Confusion3 {
  return {
    HOME: { HOME: 0, DRAW: 0, AWAY: 0 },
    DRAW: { HOME: 0, DRAW: 0, AWAY: 0 },
    AWAY: { HOME: 0, DRAW: 0, AWAY: 0 },
  };
}

export function argmax3(p: PiProb3): PiLabel {
  if (p.HOME >= p.DRAW && p.HOME >= p.AWAY) return "HOME";
  if (p.DRAW >= p.AWAY) return "DRAW";
  return "AWAY";
}

function binaryAuc(scores: { s: number; pos: number }[]): number | null {
  const pos = scores.filter((x) => x.pos === 1);
  const neg = scores.filter((x) => x.pos === 0);
  if (!pos.length || !neg.length || scores.length < MIN_N_AUC) return null;
  let correct = 0;
  for (const p of pos) {
    for (const n of neg) {
      if (p.s > n.s) correct += 1;
      else if (p.s === n.s) correct += 0.5;
    }
  }
  return correct / (pos.length * neg.length);
}

export function binaryMetrics(rows: { p: number; y: 0 | 1 }[]): BinaryMetrics {
  if (!rows.length) {
    return {
      n: 0,
      precision: null,
      recall: null,
      accuracy: 0,
      brier: 999,
      log_loss: 999,
      auc: null,
    };
  }
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let hit = 0;
  let brier = 0;
  let ll = 0;
  for (const r of rows) {
    const pred = r.p >= 0.5 ? 1 : 0;
    if (pred === r.y) hit += 1;
    if (pred === 1 && r.y === 1) tp += 1;
    if (pred === 1 && r.y === 0) fp += 1;
    if (pred === 0 && r.y === 1) fn += 1;
    brier += (r.p - r.y) ** 2;
    const q = Math.min(1 - 1e-12, Math.max(1e-12, r.p));
    ll += -(r.y * Math.log(q) + (1 - r.y) * Math.log(1 - q));
  }
  return {
    n: rows.length,
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null,
    accuracy: hit / rows.length,
    brier: brier / rows.length,
    log_loss: ll / rows.length,
    auc: binaryAuc(rows.map((r) => ({ s: r.p, pos: r.y }))),
  };
}

export function goalMetrics(
  rows: { lambda_home: number | null; lambda_away: number | null; fthg: number; ftag: number }[],
): GoalMetrics | null {
  const usable = rows.filter((r) => r.lambda_home != null && r.lambda_away != null);
  if (!usable.length) return null;
  let maeH = 0;
  let maeA = 0;
  let seH = 0;
  let seA = 0;
  let dev = 0;
  for (const r of usable) {
    const lh = r.lambda_home!;
    const la = r.lambda_away!;
    maeH += Math.abs(lh - r.fthg);
    maeA += Math.abs(la - r.ftag);
    seH += (lh - r.fthg) ** 2;
    seA += (la - r.ftag) ** 2;
    const term = (y: number, lam: number) => {
      const l = Math.max(1e-9, lam);
      return y === 0 ? 2 * l : 2 * (l - y + y * Math.log(y / l));
    };
    dev += term(r.fthg, lh) + term(r.ftag, la);
  }
  const n = usable.length;
  return {
    n,
    mae_home: maeH / n,
    mae_away: maeA / n,
    rmse_home: Math.sqrt(seH / n),
    rmse_away: Math.sqrt(seA / n),
    poisson_deviance: dev / n,
  };
}

export function qualityMetrics1x2(
  rows: {
    p: PiProb3;
    y: PiLabel;
    lambda_home?: number | null;
    lambda_away?: number | null;
    fthg?: number;
    ftag?: number;
  }[],
): Phase9QualityMetrics {
  const base = computeMetrics(rows.map((r) => ({ p: r.p, y: r.y })));
  const confusion = emptyConfusion();
  const labels: PiLabel[] = ["HOME", "DRAW", "AWAY"];
  const ovr: Record<PiLabel, BinaryMetrics> = {
    HOME: binaryMetrics([]),
    DRAW: binaryMetrics([]),
    AWAY: binaryMetrics([]),
  };
  if (rows.length) {
    for (const r of rows) {
      const pred = argmax3(r.p);
      confusion[r.y][pred] += 1;
    }
    for (const lab of labels) {
      ovr[lab] = binaryMetrics(rows.map((r) => ({ p: r.p[lab], y: r.y === lab ? 1 : 0 })));
    }
  }
  const goals = goalMetrics(
    rows
      .filter((r) => r.fthg != null && r.ftag != null)
      .map((r) => ({
        lambda_home: r.lambda_home ?? null,
        lambda_away: r.lambda_away ?? null,
        fthg: r.fthg!,
        ftag: r.ftag!,
      })),
  );
  const insufficient = rows.length < MIN_N_QUALITY;
  return {
    n: base.n,
    log_loss: base.log_loss,
    brier: base.brier,
    accuracy: base.accuracy,
    balanced_accuracy: base.balanced_accuracy,
    calibration_error: rows.length ? calibrationError(rows) : 1,
    roc_auc_ovr: rows.length >= MIN_N_AUC ? rocAucOvr(rows) : null,
    confusion,
    binary_one_vs_rest: ovr,
    goals,
    insufficient,
    insufficient_reason: insufficient ? `n=${rows.length} < ${MIN_N_QUALITY}` : null,
  };
}
