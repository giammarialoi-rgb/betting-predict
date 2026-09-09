export const OBSERVATION_KINDS = [
  "exact_tick",
  "dataset_open",
  "dataset_close",
] as const;

export type ObservationKind = (typeof OBSERVATION_KINDS)[number];

export const TEMPORAL_PRECISIONS = [
  "exact",
  "dataset_window",
  "unknown",
] as const;

export type TemporalPrecision = (typeof TEMPORAL_PRECISIONS)[number];

export function isObservationKind(value: string): value is ObservationKind {
  return (OBSERVATION_KINDS as readonly string[]).includes(value);
}

export function isTemporalPrecision(value: string): value is TemporalPrecision {
  return (TEMPORAL_PRECISIONS as readonly string[]).includes(value);
}

/**
 * Calendar-date anchor at 00:00:00.000Z for dataset rows without a quote clock.
 * This is NOT exact quote availability. Document as dataset_date_anchor.
 */
export function datasetDateAnchorUtc(matchDate: Date): Date {
  if (!(matchDate instanceof Date) || Number.isNaN(matchDate.getTime())) {
    throw new TypeError("matchDate must be a valid Date");
  }
  return new Date(
    Date.UTC(
      matchDate.getUTCFullYear(),
      matchDate.getUTCMonth(),
      matchDate.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

export class TemporalPrecisionError extends Error {
  readonly required: TemporalPrecision;
  readonly actual: TemporalPrecision;

  constructor(required: TemporalPrecision, actual: TemporalPrecision) {
    super(
      `Temporal precision "${actual}" cannot satisfy requirePrecision="${required}"`,
    );
    this.name = "TemporalPrecisionError";
    this.required = required;
    this.actual = actual;
  }
}

/**
 * P0: unknown rows must never satisfy requirePrecision=exact.
 * No silent fallback.
 */
export function assertTemporalPrecision(
  actual: TemporalPrecision,
  required: "exact" | "any",
): void {
  if (required === "any") {
    return;
  }
  if (actual !== "exact") {
    throw new TemporalPrecisionError("exact", actual);
  }
}

export function canSatisfyPrecision(
  actual: TemporalPrecision,
  required: "exact" | "any",
): boolean {
  if (required === "any") {
    return true;
  }
  return actual === "exact";
}
