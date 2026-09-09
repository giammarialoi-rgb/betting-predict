/**
 * Explicit temporal research windows — never random.
 */

export type TemporalResearchConfig = {
  train_start: Date;
  train_end: Date;
  validation_start: Date;
  validation_end: Date;
  test_start: Date;
  test_end: Date;
  holdout_start: Date;
  holdout_end: Date;
};

export function buildRealLabTemporalConfig(): TemporalResearchConfig {
  return {
    train_start: new Date("2019-08-01T00:00:00.000Z"),
    train_end: new Date("2021-12-31T23:59:59.999Z"),
    validation_start: new Date("2022-01-01T00:00:00.000Z"),
    validation_end: new Date("2022-12-31T23:59:59.999Z"),
    test_start: new Date("2023-01-01T00:00:00.000Z"),
    test_end: new Date("2023-12-31T23:59:59.999Z"),
    holdout_start: new Date("2024-01-01T00:00:00.000Z"),
    holdout_end: new Date("2024-12-31T23:59:59.999Z"),
  };
}

export function partitionForConfig(
  cfg: TemporalResearchConfig,
  at: Date,
): "TRAIN" | "VALIDATION" | "TEST" | "HOLDOUT" | null {
  const t = at.getTime();
  if (t >= cfg.train_start.getTime() && t <= cfg.train_end.getTime()) {
    return "TRAIN";
  }
  if (
    t >= cfg.validation_start.getTime() &&
    t <= cfg.validation_end.getTime()
  ) {
    return "VALIDATION";
  }
  if (t >= cfg.test_start.getTime() && t <= cfg.test_end.getTime()) {
    return "TEST";
  }
  if (t >= cfg.holdout_start.getTime() && t <= cfg.holdout_end.getTime()) {
    return "HOLDOUT";
  }
  return null;
}
