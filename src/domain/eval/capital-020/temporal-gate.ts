/**
 * Extended temporal classes. STRICT capital requires a demonstrable clock.
 */

import { BlindLeakageError } from "@/domain/eval/actuarial-018/integrity";
import {
  STRICT_CAPITAL_CLASSES,
  type MarketSnapshot,
  type TemporalClass020,
} from "@/domain/eval/capital-020/types";
import type { MarketObservation019 } from "@/domain/eval/acquisition-019/types";

export function isStrictCapitalClass(c: TemporalClass020): boolean {
  return (STRICT_CAPITAL_CLASSES as readonly string[]).includes(c);
}

export function snapshotEligibleForStrictCapital(
  snap: MarketSnapshot,
  asOf: Date,
): boolean {
  if (!isStrictCapitalClass(snap.temporalClass)) return false;
  if (snap.observationKind === "close") return false;
  if (snap.availableAt == null) return false;
  return Date.parse(snap.availableAt) <= asOf.getTime();
}

export function assertNoFutureSnapshot(snap: MarketSnapshot, asOf: Date): void {
  if (snap.availableAt == null) return;
  if (Date.parse(snap.availableAt) > asOf.getTime()) {
    throw new BlindLeakageError("TEMPORAL_LEAK: snapshot availableAt > asOf");
  }
}

export function map019ToTemporalClass(
  obs: MarketObservation019,
): TemporalClass020 {
  if (obs.observationKind === "dataset_close") {
    return obs.temporalPrecision === "exact" ? "CLOSE_TIME_EXACT" : "UNKNOWN";
  }
  if (obs.temporalPrecision === "exact") {
    return "EXACT_OBSERVATION_TIME";
  }
  if (obs.temporalPrecision === "date") return "DATE_ONLY";
  if (obs.temporalPrecision === "dataset_window") return "DATASET_WINDOW";
  return "UNKNOWN";
}

export function dateOnlyNotStrict(c: TemporalClass020): boolean {
  return c === "DATE_ONLY" || c === "DATASET_WINDOW" || c === "UNKNOWN";
}

export const DECISION_HORIZONS_MS = [
  24 * 3600_000,
  12 * 3600_000,
  6 * 3600_000,
  3 * 3600_000,
  3600_000,
  30 * 60_000,
  15 * 60_000,
] as const;

/**
 * Decision asOf candidates from a known scheduled start.
 * Only useful when snapshots have exact clocks. Kickoff is NOT quote availability.
 */
export function decisionAsOfCandidates(scheduledStart: Date): Date[] {
  return DECISION_HORIZONS_MS.map(
    (ms) => new Date(scheduledStart.getTime() - ms),
  );
}
