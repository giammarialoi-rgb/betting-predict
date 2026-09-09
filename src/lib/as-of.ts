export class AsOfLeakageError extends Error {
  readonly asOf: Date;
  readonly availableAt: Date;

  constructor(asOf: Date, availableAt: Date) {
    super(
      `Data leakage: available_at ${availableAt.toISOString()} is after as_of ${asOf.toISOString()}`,
    );
    this.name = "AsOfLeakageError";
    this.asOf = asOf;
    this.availableAt = availableAt;
  }
}

function assertValidDate(value: Date, label: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(`${label} must be a valid Date`);
  }
}

/** True when the record was knowable at asOf (available_at <= as_of). */
export function isAvailableAsOf(asOf: Date, availableAt: Date): boolean {
  assertValidDate(asOf, "asOf");
  assertValidDate(availableAt, "availableAt");
  return availableAt.getTime() <= asOf.getTime();
}

/**
 * Guard for anti-data-leakage queries.
 * Rejects any fact that became available after the decision timestamp.
 */
export function assertAsOf(asOf: Date, availableAt: Date): void {
  if (!isAvailableAsOf(asOf, availableAt)) {
    throw new AsOfLeakageError(asOf, availableAt);
  }
}
