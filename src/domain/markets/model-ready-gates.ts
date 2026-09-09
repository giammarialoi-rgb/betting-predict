/**
 * MODEL_READY gate evaluator — may correctly return 0 markets.
 */

export type ModelReadyGateInput = {
  market: string;
  line: number | null;
  sampleSize: number;
  dataCompleteness: number;
  temporalIntegrity: boolean;
  /** Share of quotes with exact precision (0–1). */
  exactPrecisionShare: number;
  bookmakerCoverage: number;
  outcomeCompleteness: number;
  featureAvailability: number;
  calibrationOk: boolean | null;
  walkForwardStable: boolean | null;
  holdoutPerformanceOk: boolean | null;
  minSample?: number;
};

export type ModelReadyGateResult = {
  market: string;
  line: number | null;
  status: "MODEL_READY" | "NOT_READY";
  failedGates: string[];
  passedGates: string[];
};

export function evaluateModelReadyGates(
  input: ModelReadyGateInput,
): ModelReadyGateResult {
  const minSample = input.minSample ?? 200;
  const failed: string[] = [];
  const passed: string[] = [];

  const check = (ok: boolean, name: string) => {
    if (ok) passed.push(name);
    else failed.push(name);
  };

  check(input.sampleSize >= minSample, "sample_size");
  check(input.dataCompleteness >= 0.8, "data_completeness");
  check(input.temporalIntegrity, "temporal_integrity");
  check(input.exactPrecisionShare >= 0.5, "exact_precision_share");
  check(input.bookmakerCoverage >= 2, "bookmaker_coverage");
  check(input.outcomeCompleteness >= 0.95, "outcome_completeness");
  check(input.featureAvailability >= 0.7, "feature_availability");
  check(input.calibrationOk === true, "calibration");
  check(input.walkForwardStable === true, "walk_forward_stability");
  check(input.holdoutPerformanceOk === true, "holdout_performance");

  return {
    market: input.market,
    line: input.line,
    status: failed.length === 0 ? "MODEL_READY" : "NOT_READY",
    failedGates: failed,
    passedGates: passed,
  };
}

export function selectFirstModelReady(
  candidates: readonly ModelReadyGateResult[],
): ModelReadyGateResult | null {
  return candidates.find((c) => c.status === "MODEL_READY") ?? null;
}
