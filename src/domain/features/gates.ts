import { assertAsOf, AsOfLeakageError } from "@/lib/as-of";
import { assertTemporalPrecision } from "@/domain/odds/temporal";
import type { FeatureCell } from "@/domain/features/types";
import { listForbiddenFeatures } from "@/domain/features/registry";

export class FeatureGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeatureGateError";
  }
}

export function assertFeatureAvailableAsOf(
  asOf: Date,
  cell: FeatureCell,
): void {
  if (cell.status === "MISSING") return;
  if (cell.availableAt === null) {
    throw new FeatureGateError(
      `Feature ${cell.featureId} has status ${cell.status} but null availableAt`,
    );
  }
  assertAsOf(asOf, cell.availableAt);
}

export function assertNotForbiddenFeature(featureId: string): void {
  const forbidden = listForbiddenFeatures().some((f) => f.id === featureId);
  if (forbidden) {
    throw new FeatureGateError(`Feature ${featureId} is FORBIDDEN`);
  }
}

export function assertPrecisionNotInflated(
  actual: "exact" | "dataset_window" | "unknown",
  required: "exact" | "any",
): void {
  assertTemporalPrecision(actual === "dataset_window" ? "unknown" : actual, required);
}

export function assertMissingNotZero(cell: FeatureCell<number>): void {
  if (cell.status === "MISSING" && cell.value === 0) {
    throw new FeatureGateError(
      `Feature ${cell.featureId}: missing must not be coerced to 0`,
    );
  }
}

export function rejectPostEventStatAsPrematch(input: {
  decisionTime: Date;
  eventKickoff: Date;
  usedPostMatchStat: boolean;
}): void {
  if (
    input.usedPostMatchStat &&
    input.decisionTime.getTime() <= input.eventKickoff.getTime()
  ) {
    throw new FeatureGateError(
      "LEAKAGE: post-match statistics cannot be used prematch",
    );
  }
}

export { AsOfLeakageError };
