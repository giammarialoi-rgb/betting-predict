/**
 * Bookmaker challenger signal levels — not betting recommendations.
 */

export const CHALLENGER_SIGNAL_LEVELS = [
  "NO_SIGNAL",
  "WEAK",
  "PROMISING",
  "STATISTICALLY_SUPPORTED",
  "ROBUST",
] as const;

export type ChallengerSignalLevel = (typeof CHALLENGER_SIGNAL_LEVELS)[number];

export function classifyChallengerSignal(input: {
  absGap: number;
  sampleSize: number;
  adjustedPValue: number | null;
  walkForwardPassed: boolean;
  holdoutPassed: boolean;
  calibrationOk: boolean;
  minSample?: number;
}): { level: ChallengerSignalLevel; reasons: string[] } {
  const minSample = input.minSample ?? 200;
  const reasons: string[] = [];

  if (input.sampleSize < 30 || input.absGap < 0.02) {
    return { level: "NO_SIGNAL", reasons: ["insufficient_gap_or_sample"] };
  }
  if (input.sampleSize < minSample) {
    reasons.push("sample_below_min");
    return { level: "WEAK", reasons };
  }
  if (!input.walkForwardPassed || !input.calibrationOk) {
    reasons.push("walk_forward_or_calibration_incomplete");
    return { level: "PROMISING", reasons };
  }
  if (
    input.adjustedPValue != null &&
    input.adjustedPValue < 0.05 &&
    input.holdoutPassed
  ) {
    reasons.push("adjusted_significance_and_holdout");
    // Still never ROBUST without explicit human review / longer stability.
    return { level: "STATISTICALLY_SUPPORTED", reasons };
  }
  if (input.holdoutPassed) {
    reasons.push("holdout_passed_without_adjusted_sig");
    return { level: "PROMISING", reasons };
  }
  return { level: "WEAK", reasons: ["gates_incomplete"] };
}
