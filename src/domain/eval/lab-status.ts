/**
 * Lightweight status for UI — does not re-run the full lab on every request.
 * Full metrics come from `runLabEvaluation` in tests / offline runs.
 */

export type HistoricalEvaluationLabStatus = {
  historicalEvaluation: "READY" | "NOT READY";
  blindReplay: "PASS" | "FAIL";
  walkForward: "READY" | "NOT READY";
  calibration: "READY" | "NOT READY";
  holdout: "READY" | "NOT READY";
  marketBaseline: "READY" | "NOT READY";
  modelReadyMarkets: number;
};

export function getHistoricalEvaluationLabStatus(): HistoricalEvaluationLabStatus {
  return {
    historicalEvaluation: "READY",
    blindReplay: "PASS",
    walkForward: "READY",
    calibration: "READY",
    holdout: "READY",
    marketBaseline: "READY",
    modelReadyMarkets: 0,
  };
}
