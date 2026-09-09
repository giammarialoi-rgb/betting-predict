/**
 * TASK 022 temporal model.
 *
 * Never invent timezone. Never auto-promote a relative offset to an absolute clock.
 * availableAt is derived only when event start + documented relative offset are
 * both present AND timezone is verified. BeatTheBookie does not verify timezone.
 */

import { BlindLeakageError } from "@/domain/eval/actuarial-018/integrity";
import type {
  ObservationTemporalClass022,
  TemporalModelKind022,
} from "@/domain/eval/recovery-022/types";

export const SERIES_INTERVAL_MINUTES = 60;
export const SERIES_WINDOW_HOURS = 72;
/** PHP samples i = 0..71 hours before kickoff → 72 bins spanning 71h + kickoff marker. */
export const SERIES_BINS = 72;

export function temporalModelKind(
  precision: ObservationTemporalClass022,
): TemporalModelKind022 {
  if (precision === "EXACT_TIMESTAMP") return "ABSOLUTE_TIMESTAMP";
  if (
    precision === "RELATIVE_TO_KICKOFF_EXACT" ||
    precision === "RELATIVE_TO_KICKOFF_APPROX"
  ) {
    return "RELATIVE_TO_EVENT_START";
  }
  if (precision === "DATE_ONLY") return "DATE_ONLY";
  return "UNKNOWN";
}

export function classifyMatchDateField(raw: string): ObservationTemporalClass022 {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return "DATE_ONLY";
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/.test(t)) {
    return "UNKNOWN";
  }
  return "UNKNOWN";
}

/**
 * Hourly series column → seconds before kickoff.
 * Column 0 = 71h before; column 71 = kickoff marker (0h).
 */
export function seriesColumnRelativeSeconds(columnInOutcomeBlock: number): number {
  if (columnInOutcomeBlock < 0 || columnInOutcomeBlock >= SERIES_BINS) {
    throw new Error(`series column out of range: ${columnInOutcomeBlock}`);
  }
  return (SERIES_BINS - 1 - columnInOutcomeBlock) * 60 * SERIES_INTERVAL_MINUTES;
}

export function deriveAvailableAt(input: {
  eventStartTimestamp: string | null;
  relativeSeconds: number | null;
  timezoneVerified: boolean;
  precision: ObservationTemporalClass022;
}): string | null {
  if (input.precision === "DATE_ONLY") return null;
  if (!input.timezoneVerified) return null;
  if (input.eventStartTimestamp == null || input.relativeSeconds == null) return null;
  if (input.precision === "RELATIVE_TO_KICKOFF_APPROX") return null;
  if (
    input.precision !== "RELATIVE_TO_KICKOFF_EXACT" &&
    input.precision !== "EXACT_TIMESTAMP"
  ) {
    return null;
  }
  const start = Date.parse(input.eventStartTimestamp);
  if (!Number.isFinite(start)) return null;
  return new Date(start - input.relativeSeconds * 1000).toISOString();
}

export function usableStrictCapital022(input: {
  precision: ObservationTemporalClass022;
  availableAt: string | null;
  timezoneVerified: boolean;
  aggregate: boolean;
}): false {
  void input;
  return false;
}

export function assertNotInventedTimezone(tz: string | null): void {
  if (tz != null && tz !== "") {
    throw new BlindLeakageError("invented_timezone: BeatTheBookie clock TZ is undocumented");
  }
}

export function assertNotRelativePromotedToAbsolute(input: {
  precision: ObservationTemporalClass022;
  availableAt: string | null;
  timezoneVerified: boolean;
}): void {
  if (
    (input.precision === "RELATIVE_TO_KICKOFF_APPROX" ||
      input.precision === "RELATIVE_TO_KICKOFF_EXACT" ||
      input.precision === "DATE_ONLY") &&
    input.availableAt != null &&
    !input.timezoneVerified
  ) {
    throw new BlindLeakageError(
      "invented_clock: relative/date field must not be stored as absolute available_at",
    );
  }
}

export function assertNoFutureQuote022(availableAt: string | null, asOf: Date): void {
  if (availableAt == null) return;
  if (Date.parse(availableAt) > asOf.getTime()) {
    throw new BlindLeakageError("L1: quote available_at > asOf");
  }
}
