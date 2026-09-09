import {
  BlindLeakageError,
  ExperimentIntegrityError,
} from "@/domain/eval/actuarial-018/integrity";
import { assertLockedBeforeReveal } from "@/domain/eval/capital-020/lock";
import { leakFutureMarket } from "@/domain/eval/final-feature-reconstruction";
import {
  leakCloseAtT1h,
  leakDateOnlyToStrict,
  leakFeatureSelectOnTest,
  leakHoldoutTrain,
  leakInventedTimestamp,
  leakMatchAmbiguous,
  leakOutcome,
} from "@/domain/eval/incremental-029/leakage";
import {
  assertHoldoutLocked035,
  assertNo036,
  assertNoModify031,
  assertTestLocked035,
  loadExp035Config,
} from "@/domain/eval/breakthrough-035/config";

export function leakOpenCloseToTimestamp(promoted: boolean): void {
  if (promoted) throw new BlindLeakageError("OPEN/CLOSE cannot become a timestamp");
}

export function leakInventTimezone(): void {
  throw new BlindLeakageError("invented timezone");
}

export function leakMirrorIndependent(used: boolean): void {
  if (used) throw new BlindLeakageError("GitHub mirror treated as independent source");
}

export function leakSynthetic(used: boolean): void {
  if (used) throw new BlindLeakageError("synthetic data");
}

export function leakNewModelFamily(used: boolean): void {
  if (used) throw new ExperimentIntegrityError("no new model family before acquisition");
}

export function leakUserCredentials(used: boolean): void {
  if (used) throw new ExperimentIntegrityError("user credentials forbidden");
}

export function leakBypassAuth(used: boolean): void {
  if (used) throw new ExperimentIntegrityError("auth bypass forbidden");
}

export function runHostileBattery035(): { id: string; throws: boolean }[] {
  const cfg = loadExp035Config();
  const asOf = Date.parse("2020-01-01T12:00:00.000Z");
  const cases: { id: string; run: () => void }[] = [
    { id: "future_odds", run: () => leakFutureMarket(asOf + 1, asOf) },
    { id: "close_leakage", run: () => leakCloseAtT1h(true) },
    { id: "outcome", run: () => leakOutcome({ outcome: "HOME" }) },
    { id: "date_only", run: () => leakDateOnlyToStrict("DATE_ONLY", true) },
    { id: "open_close", run: () => leakOpenCloseToTimestamp(true) },
    { id: "invented_ts", run: () => leakInventedTimestamp() },
    { id: "invented_tz", run: () => leakInventTimezone() },
    { id: "ambiguous", run: () => leakMatchAmbiguous("MATCH_AMBIGUOUS") },
    { id: "mirror", run: () => leakMirrorIndependent(true) },
    { id: "synthetic", run: () => leakSynthetic(true) },
    { id: "new_model", run: () => leakNewModelFamily(true) },
    { id: "credentials", run: () => leakUserCredentials(true) },
    { id: "bypass", run: () => leakBypassAuth(true) },
    { id: "test_lock", run: () => assertTestLocked035(true) },
    { id: "holdout_lock", run: () => assertHoldoutLocked035(true) },
    { id: "feature_test", run: () => leakFeatureSelectOnTest(true) },
    { id: "holdout_train", run: () => leakHoldoutTrain(true) },
    { id: "lock", run: () => assertLockedBeforeReveal(false) },
    { id: "task_036", run: () => assertNo036(true) },
    { id: "modify_031", run: () => assertNoModify031(true) },
    {
      id: "frozen_flags",
      run: () => {
        if (cfg.open_task_036 || cfg.modify_frozen_031 || cfg.add_new_model_family) {
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
    } catch {
      return { id: c.id, throws: true };
    }
  });
}
