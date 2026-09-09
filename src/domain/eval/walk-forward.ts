/**
 * Walk-forward / rolling-origin evaluation — temporal splits only.
 */

export type TemporalFold = {
  foldIndex: number;
  trainEnd: Date;
  validationEnd: Date;
  testEnd: Date;
};

export function buildWalkForwardFolds(input: {
  timelineStart: Date;
  timelineEnd: Date;
  trainDays: number;
  validationDays: number;
  testDays: number;
  stepDays: number;
}): TemporalFold[] {
  const folds: TemporalFold[] = [];
  let trainEnd = new Date(
    input.timelineStart.getTime() + input.trainDays * 86_400_000,
  );
  let foldIndex = 0;
  while (true) {
    const validationEnd = new Date(
      trainEnd.getTime() + input.validationDays * 86_400_000,
    );
    const testEnd = new Date(
      validationEnd.getTime() + input.testDays * 86_400_000,
    );
    if (testEnd.getTime() > input.timelineEnd.getTime()) break;
    folds.push({
      foldIndex,
      trainEnd: new Date(trainEnd),
      validationEnd,
      testEnd,
    });
    foldIndex++;
    trainEnd = new Date(trainEnd.getTime() + input.stepDays * 86_400_000);
  }
  return folds;
}

export function assertNoFutureInTrain(input: {
  sampleAvailableAt: Date;
  trainEnd: Date;
}): void {
  if (input.sampleAvailableAt.getTime() > input.trainEnd.getTime()) {
    throw new Error("LEAKAGE: train fold contains future sample");
  }
}

/** Random temporal split is forbidden without explicit justification. */
export function assertNotRandomTemporalSplit(method: string): void {
  if (method === "random") {
    throw new Error(
      "Random split forbidden for temporal sports data without explicit justification",
    );
  }
}
