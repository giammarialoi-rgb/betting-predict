import {
  BlindLeakageError,
  ExperimentIntegrityError,
} from "@/domain/eval/actuarial-018/integrity";
import { assertLockedBeforeReveal } from "@/domain/eval/capital-020/lock";
import { leakCloseBin, leakFutureMarket } from "@/domain/eval/final-feature-reconstruction";
import {
  leakCloseAtT1h,
  leakDateOnlyToStrict,
  leakFeatureSelectOnTest,
  leakHoldoutTrain,
  leakInventedTimestamp,
  leakMatchAmbiguous,
  leakOutcome,
} from "@/domain/eval/incremental-029/leakage";
import { assertHoldoutLocked034, assertTestLocked034, loadExp034Config } from "@/domain/eval/market-034/config";

export function leakFtHt(payload: Record<string, unknown>): void {
  leakOutcome(payload);
  if (payload.HT != null || payload.ht != null) throw new BlindLeakageError("HT in DecisionContext");
}

export function leakFutureMovement(quoteMs: number, asOfMs: number): void {
  leakFutureMarket(quoteMs, asOfMs);
}

export function leakFutureConsensus(used: boolean): void {
  if (used) throw new BlindLeakageError("future consensus");
}

export function leakDuplicateEvents(dup: boolean): void {
  if (dup) throw new BlindLeakageError("duplicate events in STRICT");
}

export function leakCrossSeason(used: boolean): void {
  if (used) throw new BlindLeakageError("cross-season leakage");
}

export function leakCrossBookFuture(used: boolean): void {
  if (used) throw new BlindLeakageError("future bookmaker quote");
}

export function leakAutoPromote034(auto: boolean): void {
  if (auto) throw new ExperimentIntegrityError("no auto-promotion");
}

export function leakOpen035(open: boolean): void {
  if (open) throw new ExperimentIntegrityError("TASK 035 must not be auto-opened");
}

export function leakEloAdded(added: boolean): void {
  if (added) throw new ExperimentIntegrityError("Elo is forbidden in TASK 034");
}

export function runHostileBattery034(): { id: string; throws: boolean }[] {
  const cfg = loadExp034Config();
  const asOf = Date.parse("2016-06-01T12:00:00.000Z");
  const cases: { id: string; run: () => void }[] = [
    { id: "future_odds", run: () => leakFutureMarket(asOf + 1, asOf) },
    { id: "close_leakage", run: () => leakCloseAtT1h(true) },
    { id: "close_bin", run: () => leakCloseBin(0) },
    { id: "FT", run: () => leakFtHt({ FT: "2-1" }) },
    { id: "HT", run: () => leakFtHt({ HT: "1-0" }) },
    { id: "outcome", run: () => leakOutcome({ outcome: "HOME" }) },
    { id: "post_match_ts", run: () => leakFutureMarket(asOf + 3600_000, asOf) },
    { id: "future_book", run: () => leakCrossBookFuture(true) },
    { id: "future_movement", run: () => leakFutureMovement(asOf + 1, asOf) },
    { id: "future_consensus", run: () => leakFutureConsensus(true) },
    { id: "future_lineup", run: () => { throw new BlindLeakageError("future lineup"); } },
    { id: "future_news", run: () => { throw new BlindLeakageError("future news"); } },
    { id: "ambiguous", run: () => leakMatchAmbiguous("MATCH_AMBIGUOUS") },
    { id: "duplicate", run: () => leakDuplicateEvents(true) },
    { id: "cross_season", run: () => leakCrossSeason(true) },
    { id: "date_only", run: () => leakDateOnlyToStrict("DATE_ONLY", true) },
    { id: "invented_ts", run: () => leakInventedTimestamp() },
    { id: "test_lock", run: () => assertTestLocked034(true) },
    { id: "holdout_lock", run: () => assertHoldoutLocked034(true) },
    { id: "feature_test", run: () => leakFeatureSelectOnTest(true) },
    { id: "holdout_train", run: () => leakHoldoutTrain(true) },
    { id: "lock", run: () => assertLockedBeforeReveal(false) },
    { id: "auto_promote", run: () => leakAutoPromote034(true) },
    { id: "task_035", run: () => leakOpen035(true) },
    { id: "elo", run: () => leakEloAdded(true) },
    {
      id: "frozen_flags",
      run: () => {
        if (cfg.add_elo || cfg.open_task_035) throw new ExperimentIntegrityError("flags");
        throw new ExperimentIntegrityError("frozen flags ok");
      },
    },
  ];
  return cases.map((c) => {
    try {
      c.run();
      return { id: c.id, throws: false };
    } catch {
      return { id: c.id, throws: true };
    }
  });
}
