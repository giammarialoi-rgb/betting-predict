/**
 * Error taxonomy for self-learning foundation.
 */

export const ERROR_CLASSES = [
  "MODEL_ERROR",
  "DATA_ERROR",
  "MARKET_ERROR",
  "TEMPORAL_ERROR",
  "CALIBRATION_ERROR",
  "OUTLIER",
  "MISSING_INFORMATION",
] as const;

export type ErrorClass = (typeof ERROR_CLASSES)[number];

export type ClassifiedError = {
  prediction: Record<string, number>;
  actual: string;
  error_class: ErrorClass;
  notes: string[];
};

export function classifyPredictionError(input: {
  prediction: Record<string, number>;
  actual: string;
  temporalViolation?: boolean;
  missingFeatures?: boolean;
  calibrationDrift?: boolean;
  marketShock?: boolean;
  outlierOdds?: boolean;
}): ClassifiedError {
  const notes: string[] = [];
  if (input.temporalViolation) {
    return {
      prediction: input.prediction,
      actual: input.actual,
      error_class: "TEMPORAL_ERROR",
      notes: ["temporal_violation"],
    };
  }
  if (input.missingFeatures) {
    return {
      prediction: input.prediction,
      actual: input.actual,
      error_class: "MISSING_INFORMATION",
      notes: ["missing_features"],
    };
  }
  if (input.calibrationDrift) {
    return {
      prediction: input.prediction,
      actual: input.actual,
      error_class: "CALIBRATION_ERROR",
      notes: ["calibration_drift"],
    };
  }
  if (input.marketShock) {
    return {
      prediction: input.prediction,
      actual: input.actual,
      error_class: "MARKET_ERROR",
      notes: ["market_shock"],
    };
  }
  if (input.outlierOdds) {
    return {
      prediction: input.prediction,
      actual: input.actual,
      error_class: "OUTLIER",
      notes: ["outlier_odds"],
    };
  }
  const predicted = Object.entries(input.prediction).sort(
    (a, b) => b[1]! - a[1]!,
  )[0]?.[0];
  if (predicted !== input.actual) {
    notes.push("argmax_mismatch");
  }
  return {
    prediction: input.prediction,
    actual: input.actual,
    error_class: "MODEL_ERROR",
    notes,
  };
}
