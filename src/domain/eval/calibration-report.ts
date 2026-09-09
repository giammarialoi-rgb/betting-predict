import {
  brierScore,
  calibrationBins,
  logLoss,
  meanMetric,
  type CalibrationBin,
} from "@/domain/eval/metrics";

export type ProbTruthPair = { yTrue: number; yPred: number };

export type ReliabilityBucket = {
  label: string;
  lower: number;
  upper: number;
  predictions: number;
  expected: number | null;
  actual: number | null;
};

export type CalibrationReport = {
  sampleSize: number;
  meanBrier: number;
  meanLogLoss: number;
  /** Mean absolute |avgPred - avgTrue| over non-empty bins. */
  calibrationError: number;
  bins: CalibrationBin[];
  reliability: ReliabilityBucket[];
};

export function buildCalibrationReport(
  pairs: readonly ProbTruthPair[],
  binCount = 10,
): CalibrationReport {
  if (pairs.length === 0) {
    return {
      sampleSize: 0,
      meanBrier: NaN,
      meanLogLoss: NaN,
      calibrationError: NaN,
      bins: [],
      reliability: [],
    };
  }
  const meanBrier = meanMetric(pairs.map((p) => brierScore(p.yTrue, p.yPred)));
  const meanLogLoss = meanMetric(pairs.map((p) => logLoss(p.yTrue, p.yPred)));
  const bins = calibrationBins([...pairs], binCount);
  const nonEmpty = bins.filter((b) => b.count > 0);
  const calibrationError =
    nonEmpty.length === 0
      ? NaN
      : meanMetric(
          nonEmpty.map((b) => Math.abs((b.avgPred ?? 0) - (b.avgTrue ?? 0))),
        );
  const reliability: ReliabilityBucket[] = bins.map((b) => ({
    label: `${Math.round(b.lower * 100)}–${Math.round(b.upper * 100)}%`,
    lower: b.lower,
    upper: b.upper,
    predictions: b.count,
    expected: b.avgPred,
    actual: b.avgTrue,
  }));
  return {
    sampleSize: pairs.length,
    meanBrier,
    meanLogLoss,
    calibrationError,
    bins,
    reliability,
  };
}

/** Multi-class 1X2 Brier (mean squared error over 3 outcomes). */
export function multiclassBrier(
  probs: Record<string, number>,
  resultCode: string,
): number {
  let sum = 0;
  for (const [k, p] of Object.entries(probs)) {
    const y = k === resultCode ? 1 : 0;
    sum += (p - y) ** 2;
  }
  return sum / Object.keys(probs).length;
}

export function multiclassLogLoss(
  probs: Record<string, number>,
  resultCode: string,
  eps = 1e-15,
): number {
  const p = Math.min(1 - eps, Math.max(eps, probs[resultCode] ?? 0));
  return -Math.log(p);
}
