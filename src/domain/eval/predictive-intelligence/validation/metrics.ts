import type { PiLabel, PiMetricsBundle, PiProb3 } from "@/domain/eval/predictive-intelligence/types";

export function logLossOne(p: PiProb3, y: PiLabel): number {
  return -Math.log(Math.max(1e-12, p[y]));
}

export function brierOne(p: PiProb3, y: PiLabel): number {
  let s = 0;
  for (const k of ["HOME", "DRAW", "AWAY"] as const) {
    const t = k === y ? 1 : 0;
    s += (p[k] - t) ** 2;
  }
  return s / 3;
}

/** Expected Calibration Error (3-bin on max-prob). */
export function calibrationError(
  rows: { p: PiProb3; y: PiLabel }[],
  bins = 10,
): number {
  if (!rows.length) return 1;
  type Bin = { n: number; conf: number; acc: number };
  const B: Bin[] = Array.from({ length: bins }, () => ({ n: 0, conf: 0, acc: 0 }));
  for (const r of rows) {
    const conf = Math.max(r.p.HOME, r.p.DRAW, r.p.AWAY);
    const pred =
      r.p.HOME >= r.p.DRAW && r.p.HOME >= r.p.AWAY
        ? "HOME"
        : r.p.DRAW >= r.p.AWAY
          ? "DRAW"
          : "AWAY";
    const ix = Math.min(bins - 1, Math.floor(conf * bins));
    B[ix]!.n += 1;
    B[ix]!.conf += conf;
    B[ix]!.acc += pred === r.y ? 1 : 0;
  }
  let ece = 0;
  for (const b of B) {
    if (!b.n) continue;
    ece += (b.n / rows.length) * Math.abs(b.acc / b.n - b.conf / b.n);
  }
  return ece;
}

function argmax(p: PiProb3): PiLabel {
  if (p.HOME >= p.DRAW && p.HOME >= p.AWAY) return "HOME";
  if (p.DRAW >= p.AWAY) return "DRAW";
  return "AWAY";
}

/** Simple one-vs-rest AUC average (HOME/DRAW/AWAY). */
export function rocAucOvr(rows: { p: PiProb3; y: PiLabel }[]): number | null {
  if (rows.length < 20) return null;
  const labels: PiLabel[] = ["HOME", "DRAW", "AWAY"];
  const aucs: number[] = [];
  for (const lab of labels) {
    const scores = rows.map((r) => ({ s: r.p[lab], pos: r.y === lab ? 1 : 0 }));
    const pos = scores.filter((x) => x.pos === 1);
    const neg = scores.filter((x) => x.pos === 0);
    if (!pos.length || !neg.length) continue;
    let correct = 0;
    for (const p of pos) {
      for (const n of neg) {
        if (p.s > n.s) correct += 1;
        else if (p.s === n.s) correct += 0.5;
      }
    }
    aucs.push(correct / (pos.length * neg.length));
  }
  if (!aucs.length) return null;
  return aucs.reduce((a, b) => a + b, 0) / aucs.length;
}

export function computeMetrics(rows: { p: PiProb3; y: PiLabel }[]): PiMetricsBundle {
  if (!rows.length) {
    return {
      log_loss: 999,
      brier: 999,
      calibration_error: 1,
      accuracy: 0,
      balanced_accuracy: 0,
      roc_auc_ovr: null,
      n: 0,
    };
  }
  let ll = 0;
  let br = 0;
  let hit = 0;
  const cm: Record<PiLabel, { tp: number; n: number }> = {
    HOME: { tp: 0, n: 0 },
    DRAW: { tp: 0, n: 0 },
    AWAY: { tp: 0, n: 0 },
  };
  for (const r of rows) {
    ll += logLossOne(r.p, r.y);
    br += brierOne(r.p, r.y);
    const pred = argmax(r.p);
    if (pred === r.y) hit += 1;
    cm[r.y].n += 1;
    if (pred === r.y) cm[r.y].tp += 1;
  }
  const recalls = (Object.keys(cm) as PiLabel[]).map((k) => (cm[k].n ? cm[k].tp / cm[k].n : 0));
  return {
    log_loss: ll / rows.length,
    brier: br / rows.length,
    calibration_error: calibrationError(rows),
    accuracy: hit / rows.length,
    balanced_accuracy: recalls.reduce((a, b) => a + b, 0) / 3,
    roc_auc_ovr: rocAucOvr(rows),
    n: rows.length,
  };
}

/** Paper ROI helper on flat unit stakes using open odds for selected side. */
export function paperRoiFromPreds(
  rows: {
    p: PiProb3;
    y: PiLabel;
    odds: { home: number | null; draw: number | null; away: number | null } | null;
    bet: boolean;
  }[],
): { n_bets: number; hit_rate: number; roi: number; yield: number; max_drawdown: number } {
  let bank = 1000;
  let peak = 1000;
  let maxDd = 0;
  let profit = 0;
  let bets = 0;
  let hits = 0;
  const stake = 10;
  for (const r of rows) {
    if (!r.bet || !r.odds) continue;
    const sel = argmax(r.p);
    const o =
      sel === "HOME" ? r.odds.home : sel === "DRAW" ? r.odds.draw : r.odds.away;
    if (o == null || o <= 1) continue;
    bets += 1;
    const won = sel === r.y;
    const pnl = won ? stake * (o - 1) : -stake;
    if (won) hits += 1;
    profit += pnl;
    bank += pnl;
    peak = Math.max(peak, bank);
    maxDd = Math.max(maxDd, peak > 0 ? (peak - bank) / peak : 0);
  }
  return {
    n_bets: bets,
    hit_rate: bets ? hits / bets : 0,
    roi: profit / 1000,
    yield: bets ? profit / (bets * stake) : 0,
    max_drawdown: maxDd,
  };
}
