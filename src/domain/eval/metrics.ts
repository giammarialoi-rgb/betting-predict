/**
 * Evaluation metrics foundation — no staking / ROI.
 */

export function logLoss(
  yTrue: number,
  yPred: number,
  eps = 1e-15,
): number {
  const p = Math.min(1 - eps, Math.max(eps, yPred));
  return -(yTrue * Math.log(p) + (1 - yTrue) * Math.log(1 - p));
}

export function brierScore(yTrue: number, yPred: number): number {
  return (yPred - yTrue) ** 2;
}

export function meanMetric(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError("empty metric list");
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export type CalibrationBin = {
  lower: number;
  upper: number;
  count: number;
  avgPred: number | null;
  avgTrue: number | null;
};

export function calibrationBins(
  pairs: ReadonlyArray<{ yTrue: number; yPred: number }>,
  binCount = 10,
): CalibrationBin[] {
  const bins: CalibrationBin[] = Array.from({ length: binCount }, (_, i) => ({
    lower: i / binCount,
    upper: (i + 1) / binCount,
    count: 0,
    avgPred: null,
    avgTrue: null,
  }));
  const acc = bins.map(() => ({ pred: 0, truth: 0 }));
  for (const { yTrue, yPred } of pairs) {
    let idx = Math.floor(yPred * binCount);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx]!.count++;
    acc[idx]!.pred += yPred;
    acc[idx]!.truth += yTrue;
  }
  for (let i = 0; i < binCount; i++) {
    if (bins[i]!.count > 0) {
      bins[i]!.avgPred = acc[i]!.pred / bins[i]!.count;
      bins[i]!.avgTrue = acc[i]!.truth / bins[i]!.count;
    }
  }
  return bins;
}

export function accuracyFromArgmax(
  rows: ReadonlyArray<{ yTrue: string; yPred: string }>,
): number {
  if (rows.length === 0) return 0;
  let ok = 0;
  for (const r of rows) if (r.yTrue === r.yPred) ok++;
  return ok / rows.length;
}
