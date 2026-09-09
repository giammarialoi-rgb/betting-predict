/**
 * Integrity / leakage attack errors for TASK 018.
 */

export class BlindLeakageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlindLeakageError";
  }
}

export class TemporalSplitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemporalSplitError";
  }
}

export class ExperimentIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExperimentIntegrityError";
  }
}

const FORBIDDEN_DECISION_KEYS = [
  "FT",
  "FTHome",
  "FTAway",
  "FTResult",
  "HT",
  "HTHome",
  "HTAway",
  "home_score",
  "away_score",
  "result_code",
  "outcome",
  "settlement",
] as const;

export function assertDecisionPayloadSafe(
  payload: Record<string, unknown>,
  asOf: Date,
): void {
  for (const k of FORBIDDEN_DECISION_KEYS) {
    if (k in payload && payload[k] != null) {
      throw new BlindLeakageError(
        `OUTCOME_LEAK: forbidden field ${k} in DecisionContext`,
      );
    }
  }
  const eloDate = payload.elo_rating_date;
  if (eloDate instanceof Date && eloDate.getTime() > asOf.getTime()) {
    throw new BlindLeakageError("ELO_LEAK: rating_date after asOf");
  }
  const oddsAt = payload.odds_available_at;
  if (oddsAt instanceof Date && oddsAt.getTime() > asOf.getTime()) {
    throw new BlindLeakageError("ODDS_LEAK: available_at after asOf");
  }
  if (payload.uses_repo_form_column === true) {
    throw new BlindLeakageError(
      "FORM_LEAK: raw Form* column forbidden — reconstruct lagged only",
    );
  }
  if (payload.stake_uses_outcome === true) {
    throw new BlindLeakageError("STAKE_LEAK: stake must not use outcome");
  }
}

export function assertExpandingWindowTrain(
  trainMaxTs: number,
  decisionTs: number,
): void {
  // Date-only datasets may share midnight timestamps on the same day.
  // Forbid only strict future training (train after decision).
  if (trainMaxTs > decisionTs) {
    throw new TemporalSplitError(
      `LOOKAHEAD: trainMaxTs ${trainMaxTs} > decisionTs ${decisionTs}`,
    );
  }
}

export function assertNoRetroactiveOptimization(flags: {
  retroactive_optimization: boolean;
  parameters_frozen: boolean;
}): void {
  if (flags.retroactive_optimization || !flags.parameters_frozen) {
    throw new ExperimentIntegrityError(
      "RETRO_OPT: parameters must be frozen before replay; no post-test tuning",
    );
  }
}

export function assertNotRandomSplit(mode: string): void {
  if (mode === "random" || mode === "shuffle") {
    throw new TemporalSplitError("Random train/test split forbidden");
  }
}
