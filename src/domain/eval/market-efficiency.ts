/**
 * Market efficiency diagnostics — NOT betting signals.
 */

export type MarketEfficiencyDelta = {
  probability_gap: number;
  calibration_difference: number | null;
  log_loss_difference: number | null;
  brier_difference: number | null;
  /** Explicit: diagnostic only. */
  claim: "diagnostic_only";
};

/**
 * model_probability - market_probability as probability_gap.
 * Never label as profit / value bet / guaranteed edge.
 */
export function computeProbabilityGap(input: {
  modelProbability: number;
  marketProbability: number;
}): number {
  return input.modelProbability - input.marketProbability;
}

export function buildMarketEfficiencyDelta(input: {
  modelProbability: number;
  marketProbability: number;
  modelBrier?: number;
  marketBrier?: number;
  modelLogLoss?: number;
  marketLogLoss?: number;
  modelCalibrationError?: number;
  marketCalibrationError?: number;
}): MarketEfficiencyDelta {
  return {
    probability_gap: computeProbabilityGap({
      modelProbability: input.modelProbability,
      marketProbability: input.marketProbability,
    }),
    calibration_difference:
      input.modelCalibrationError !== undefined &&
      input.marketCalibrationError !== undefined
        ? input.modelCalibrationError - input.marketCalibrationError
        : null,
    log_loss_difference:
      input.modelLogLoss !== undefined && input.marketLogLoss !== undefined
        ? input.modelLogLoss - input.marketLogLoss
        : null,
    brier_difference:
      input.modelBrier !== undefined && input.marketBrier !== undefined
        ? input.modelBrier - input.marketBrier
        : null,
    claim: "diagnostic_only",
  };
}

export function assertNoBookmakerBeatingClaim(text: string): void {
  const banned = [
    "abbiamo battuto il bookmaker",
    "beat the bookmaker",
    "guaranteed edge",
    "value bet",
  ];
  const lower = text.toLowerCase();
  for (const b of banned) {
    if (lower.includes(b)) {
      throw new Error(`FORBIDDEN_CLAIM: ${b}`);
    }
  }
}
