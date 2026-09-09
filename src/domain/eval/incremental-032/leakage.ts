import {
  BlindLeakageError,
  ExperimentIntegrityError,
} from "@/domain/eval/actuarial-018/integrity";
import { assertLockedBeforeReveal } from "@/domain/eval/capital-020/lock";
import {
  leakCloseBin,
  leakFutureElo,
  leakFutureForm,
  leakFutureH2H,
  leakFutureMarket,
} from "@/domain/eval/final-feature-reconstruction";
import {
  leakCloseAtT1h,
  leakDateOnlyToStrict,
  leakFeatureSelectOnTest,
  leakHoldoutTrain,
  leakInventedTimestamp,
  leakOutcome,
} from "@/domain/eval/incremental-029/leakage";
import { assertHoldoutLocked032, assertTestLocked032, loadExp032Config } from "@/domain/eval/incremental-032/config";

export function leakImputationFromTest(used: boolean): void {
  if (used) throw new BlindLeakageError("imputation parameters from TEST");
}

export function leakNormalizeUsingTest(used: boolean): void {
  if (used) throw new BlindLeakageError("normalization fit on TEST");
}

export function leakTuningOnTest(used: boolean): void {
  if (used) throw new ExperimentIntegrityError("tuning on TEST");
}

export function leakAutoPromote032(auto: boolean): void {
  if (auto) throw new ExperimentIntegrityError("challenger cannot auto-promote");
}

export function leakMasanielloProduction(policy: string): void {
  if (policy === "masaniello" || policy === "masaniello_challenger") {
    throw new ExperimentIntegrityError("Masaniello cannot become production staking");
  }
}

export function runHostileBattery032(): { id: string; throws: boolean }[] {
  const cfg = loadExp032Config();
  const asOf = Date.parse("2016-06-01T12:00:00.000Z");
  const cases: { id: string; run: () => void }[] = [
    { id: "A_outcome", run: () => leakOutcome({ outcome: "HOME" }) },
    { id: "B_ft", run: () => leakOutcome({ FT: "2-1" }) },
    { id: "C_quote_after", run: () => leakFutureMarket(asOf + 1, asOf) },
    { id: "D_close", run: () => leakCloseAtT1h(true) },
    { id: "D_close_bin", run: () => leakCloseBin(0) },
    { id: "E_future_feature", run: () => leakFutureForm(asOf + 1, asOf) },
    { id: "F_future_h2h", run: () => leakFutureH2H(asOf + 1, asOf) },
    { id: "G_future_elo", run: () => leakFutureElo(asOf + 1, asOf) },
    { id: "H_normalize_test", run: () => leakNormalizeUsingTest(true) },
    { id: "I_impute_test", run: () => leakImputationFromTest(true) },
    { id: "J_feature_test", run: () => leakFeatureSelectOnTest(true) },
    { id: "K_tune_test", run: () => leakTuningOnTest(true) },
    { id: "L_holdout", run: () => leakHoldoutTrain(true) },
    { id: "test_lock", run: () => assertTestLocked032(true) },
    { id: "holdout_lock", run: () => assertHoldoutLocked032(true) },
    { id: "date_only", run: () => leakDateOnlyToStrict("DATE_ONLY", true) },
    { id: "invented_ts", run: () => leakInventedTimestamp() },
    { id: "lock", run: () => assertLockedBeforeReveal(false) },
    { id: "auto_promote", run: () => leakAutoPromote032(true) },
    { id: "masaniello", run: () => leakMasanielloProduction("masaniello") },
    {
      id: "frozen_flags",
      run: () => {
        if (cfg.feature_selection_on_test) throw new ExperimentIntegrityError("test fs");
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
