/**
 * TASK 021 temporal gate: only EXACT_TIMESTAMP may enter STRICT capital.
 * Never promote a calendar date to noon. Kickoff is not quote availability.
 */

import { BlindLeakageError } from "@/domain/eval/actuarial-018/integrity";
import type { MarketSnapshot, TemporalClass020 } from "@/domain/eval/capital-020/types";
import type {
  MarketObservationLedger,
  TemporalClass021,
} from "@/domain/eval/capital-021/types";

export function map020ClassTo021(c: TemporalClass020): TemporalClass021 {
  if (
    c === "EXACT_DECISION_TIME" ||
    c === "EXACT_OBSERVATION_TIME" ||
    c === "OPEN_TIME_EXACT" ||
    c === "CLOSE_TIME_EXACT"
  ) {
    return "EXACT_TIMESTAMP";
  }
  if (c === "DATE_ONLY") return "DATE_ONLY";
  if (c === "DATASET_WINDOW") return "DATASET_WINDOW";
  return "UNKNOWN";
}

export function isExactTimestamp(c: TemporalClass021): boolean {
  return c === "EXACT_TIMESTAMP";
}

export function ledgerEligibleForStrictCapital(
  row: MarketObservationLedger,
  asOf: Date,
): boolean {
  if (!row.usable_strict_capital) return false;
  if (!isExactTimestamp(row.temporal_precision)) return false;
  if (row.observationKind === "close") return false;
  if (row.available_at == null) return false;
  return Date.parse(row.available_at) <= asOf.getTime();
}

export function assertNoFutureQuote(
  availableAt: string | null,
  asOf: Date,
): void {
  if (availableAt == null) return;
  if (Date.parse(availableAt) > asOf.getTime()) {
    throw new BlindLeakageError("L1: quote available_at > asOf");
  }
}

/**
 * Reject invented clocks such as DATE_ONLY promoted to 12:00:00.
 */
export function assertNotInventedClock(input: {
  raw?: string;
  availableAt: string | null;
  precision: TemporalClass021;
}): void {
  if (input.precision !== "EXACT_TIMESTAMP" && input.availableAt != null) {
    throw new BlindLeakageError(
      "invented_clock: non-exact precision must not carry available_at",
    );
  }
  if (input.raw && /^\d{4}-\d{2}-\d{2}$/.test(input.raw)) {
    throw new BlindLeakageError(
      "invented_clock: calendar date must not be coerced to a time of day",
    );
  }
}

export function snapshotToLedger(snap: MarketSnapshot): MarketObservationLedger {
  const precision = map020ClassTo021(snap.temporalClass);
  const exact = isExactTimestamp(precision);
  const close = snap.observationKind === "close";
  return {
    sport: snap.sport,
    event: snap.eventId,
    market: snap.marketType,
    line: snap.line,
    selection: snap.selection,
    bookmaker: snap.bookmaker,
    price: snap.odds,
    timestamp: exact ? snap.availableAt : null,
    temporal_precision: precision,
    source: snap.sourceId,
    source_url: null,
    observed_at: snap.observedAt,
    available_at: exact ? snap.availableAt : null,
    usable_strict_capital: exact && !close && snap.availableAt != null,
    observationKind: snap.observationKind,
    upstreamCluster: snap.upstreamCluster,
  };
}
