/**
 * Temporal holdout policy — HOLDOUT is sacred.
 */

export type TemporalPartition = {
  name: "TRAIN" | "VALIDATION" | "TEST" | "HOLDOUT";
  start: Date;
  end: Date;
};

export type HoldoutSplit = {
  train: TemporalPartition;
  validation: TemporalPartition;
  test: TemporalPartition;
  holdout: TemporalPartition;
};

/**
 * Fixed chronological split for lab seasons 2019–2024:
 * TRAIN 2019–2021, VAL 2022, TEST 2023, HOLDOUT 2024.
 */
export function buildLabHoldoutSplit(): HoldoutSplit {
  return {
    train: {
      name: "TRAIN",
      start: new Date("2019-01-01T00:00:00.000Z"),
      end: new Date("2021-12-31T23:59:59.999Z"),
    },
    validation: {
      name: "VALIDATION",
      start: new Date("2022-01-01T00:00:00.000Z"),
      end: new Date("2022-12-31T23:59:59.999Z"),
    },
    test: {
      name: "TEST",
      start: new Date("2023-01-01T00:00:00.000Z"),
      end: new Date("2023-12-31T23:59:59.999Z"),
    },
    holdout: {
      name: "HOLDOUT",
      start: new Date("2024-01-01T00:00:00.000Z"),
      end: new Date("2024-12-31T23:59:59.999Z"),
    },
  };
}

export function partitionNameForDate(
  split: HoldoutSplit,
  at: Date,
): TemporalPartition["name"] | null {
  const t = at.getTime();
  for (const p of [
    split.train,
    split.validation,
    split.test,
    split.holdout,
  ]) {
    if (t >= p.start.getTime() && t <= p.end.getTime()) return p.name;
  }
  return null;
}

/**
 * HOLDOUT must not be used for model/feature/threshold selection.
 */
export function assertHoldoutSacred(input: {
  purpose:
    | "feature_selection"
    | "model_selection"
    | "threshold_tuning"
    | "hyperparameter_tuning"
    | "strategy_optimization"
    | "final_evaluation";
  partition: TemporalPartition["name"];
}): void {
  if (
    input.partition === "HOLDOUT" &&
    input.purpose !== "final_evaluation"
  ) {
    throw new Error(
      `HOLDOUT_SACRED: cannot use HOLDOUT for ${input.purpose}`,
    );
  }
}
