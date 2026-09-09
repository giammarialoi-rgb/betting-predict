/**
 * Blind leakage errors for actuarial bankroll lab.
 */

export class BlindLeakageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlindLeakageError";
  }
}

export class BankrollAccountingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BankrollAccountingError";
  }
}

const FORBIDDEN_OUTCOME_KEYS = [
  "final_score",
  "home_score",
  "away_score",
  "result_code",
  "ft_result",
  "half_time_score",
  "ht_home",
  "ht_away",
  "post_match_stats",
  "outcomeContext",
  "outcome_context",
] as const;

export function assertNoOutcomeFieldsInDecisionPayload(
  payload: Record<string, unknown>,
  asOf: Date,
): void {
  for (const key of FORBIDDEN_OUTCOME_KEYS) {
    if (key in payload && payload[key] != null) {
      throw new BlindLeakageError(
        `OUTCOME_LEAK: forbidden field ${key} present before LOCK`,
      );
    }
  }
  const availableAt = payload.availableAt;
  if (availableAt instanceof Date && availableAt.getTime() > asOf.getTime()) {
    throw new BlindLeakageError(
      `TEMPORAL_LEAK: availableAt ${availableAt.toISOString()} > asOf ${asOf.toISOString()}`,
    );
  }
}

export function assertAsOfNotAfter(
  availableAt: Date,
  asOf: Date,
  label: string,
): void {
  if (availableAt.getTime() > asOf.getTime()) {
    throw new BlindLeakageError(
      `TEMPORAL_LEAK: ${label} available_at ${availableAt.toISOString()} > asOf ${asOf.toISOString()}`,
    );
  }
}
