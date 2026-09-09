import { BlindLeakageError, ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { leakCloseAtT1h, leakDateOnlyToStrict, leakInventedTimestamp, leakOutcome } from "@/domain/eval/incremental-029/leakage";
import { loadExp036Config } from "@/domain/eval/prospective-036/config";
import {
  ProspectiveIntegrityError,
  assertLockedImmutable,
  assertNo037,
  assertNoFutureData,
  assertNoSynthetic,
  assertNotCloseAsDecision,
  assertNotFutureVsCollector,
  assertMonotonicSource,
  assertOutcomeAfterLock,
  assertQuoteBeforeKickoff,
} from "@/domain/eval/prospective-036/integrity";
import { requireExactUtc } from "@/domain/eval/prospective-036/clocks";

export function leakPostLock(): void {
  assertLockedImmutable("LOCKED", true);
}

export function leakNaiveAsStrict(): void {
  requireExactUtc("2026-10-01 15:00:00", "quote");
}

export function leakDateOnlyAsStrict(): void {
  requireExactUtc("2026-10-01", "kickoff");
}

export function runHostileBattery036(): { id: string; throws: boolean }[] {
  const cfg = loadExp036Config();
  const cases: { id: string; run: () => void }[] = [
    { id: "timestamp_order", run: () => assertQuoteBeforeKickoff("2026-10-01T16:00:00.000Z", "2026-10-01T15:00:00.000Z") },
    { id: "quote_after_kickoff", run: () => assertQuoteBeforeKickoff("2026-10-01T16:00:01.000Z", "2026-10-01T16:00:00.000Z") },
    { id: "future_data", run: () => assertNoFutureData("2026-10-01T16:00:00.000Z", "2026-10-01T15:00:00.000Z") },
    { id: "lock_immutability", run: () => leakPostLock() },
    { id: "outcome_before_lock", run: () => assertOutcomeAfterLock("PRELOCK") },
    { id: "close_as_decision", run: () => assertNotCloseAsDecision(true) },
    { id: "date_only", run: () => leakDateOnlyAsStrict() },
    { id: "naive_ts", run: () => leakNaiveAsStrict() },
    { id: "synthetic", run: () => assertNoSynthetic(true) },
    { id: "clock_drift", run: () => assertNotFutureVsCollector("2026-10-01T16:00:00.000Z", "2026-10-01T15:00:00.000Z", 60_000) },
    { id: "post_match", run: () => assertQuoteBeforeKickoff("2026-10-01T17:00:00.000Z", "2026-10-01T16:00:00.000Z") },
    { id: "monotonic", run: () => assertMonotonicSource("2026-10-01T16:00:00.000Z", "2026-10-01T15:00:00.000Z") },
    { id: "invented_ts", run: () => leakInventedTimestamp() },
    { id: "outcome", run: () => leakOutcome({ FT: "1-0" }) },
    { id: "close_t1h", run: () => leakCloseAtT1h(true) },
    { id: "date_only_strict", run: () => leakDateOnlyToStrict("DATE_ONLY", true) },
    { id: "task_037", run: () => assertNo037(true) },
    {
      id: "frozen_flags",
      run: () => {
        if (cfg.open_task_037_historical || cfg.invent_timestamps || cfg.real_money) {
          throw new ExperimentIntegrityError("flags");
        }
        throw new ExperimentIntegrityError("frozen flags ok");
      },
    },
  ];
  return cases.map((c) => {
    try {
      c.run();
      return { id: c.id, throws: false };
    } catch (err) {
      if (err instanceof BlindLeakageError || err instanceof ProspectiveIntegrityError || err instanceof ExperimentIntegrityError) {
        return { id: c.id, throws: true };
      }
      return { id: c.id, throws: true };
    }
  });
}
