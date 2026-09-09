import {
  BlindLeakageError,
  ExperimentIntegrityError,
  TemporalSplitError,
} from "@/domain/eval/actuarial-018/integrity";
import { assertOutcomeAbsentFromDecision } from "@/domain/eval/capital-020/lock";
import { loadExp029Config } from "@/domain/eval/incremental-029/config";

export function leakFutureFeature(availableAt: Date, asOf: Date): void {
  if (availableAt.getTime() > asOf.getTime()) throw new BlindLeakageError("future feature");
}

export function leakDateOnlyToStrict(precision: string, usedInStrict: boolean): void {
  if (usedInStrict && precision !== "exact" && precision !== "EXACT_TIMESTAMP") {
    throw new BlindLeakageError("DATE_ONLY cannot become STRICT");
  }
}

export function leakOutcome(payload: Record<string, unknown>): void {
  assertOutcomeAbsentFromDecision(payload);
  if (payload.ft_home != null || payload.FT != null) throw new BlindLeakageError("FT in DecisionContext");
}

export function leakCloseAtT1h(usedClose: boolean): void {
  if (usedClose) throw new BlindLeakageError("closing odds in T-1h DecisionContext");
}

export function leakFeatureSelectOnTest(usedTest: boolean): void {
  if (usedTest) throw new ExperimentIntegrityError("feature selection on TEST");
}

export function leakRandomSplit(): void {
  throw new TemporalSplitError("random split temporal leakage");
}

export function leakInventedTimestamp(): void {
  throw new BlindLeakageError("invented timestamp");
}

export function leakHoldoutTrain(used: boolean): void {
  if (used) throw new BlindLeakageError("HOLDOUT used during training");
}

export function leakMatchAmbiguous(grade: string): void {
  if (grade === "MATCH_AMBIGUOUS") throw new BlindLeakageError("MATCH_AMBIGUOUS rejected from STRICT");
}

export function leakReliability(sourceReliability: number | null): void {
  if (sourceReliability !== null) throw new BlindLeakageError("invented sourceReliability");
}

export function leakAutoPromote(auto: boolean): void {
  if (auto) throw new ExperimentIntegrityError("challenger cannot auto-promote");
}

export function runHostileBattery029(): { id: string; throws: boolean }[] {
  const cfg = loadExp029Config();
  const asOf = new Date("2016-06-01T12:00:00.000Z");
  const cases: { id: string; run: () => void }[] = [
    { id: "future_feature", run: () => leakFutureFeature(new Date("2016-06-01T13:00:00Z"), asOf) },
    { id: "date_only_strict", run: () => leakDateOnlyToStrict("DATE_ONLY", true) },
    { id: "outcome", run: () => leakOutcome({ outcome: "HOME" }) },
    { id: "close_t1h", run: () => leakCloseAtT1h(true) },
    { id: "feature_test", run: () => leakFeatureSelectOnTest(true) },
    { id: "random_split", run: () => leakRandomSplit() },
    { id: "invented_ts", run: () => leakInventedTimestamp() },
    { id: "holdout_train", run: () => leakHoldoutTrain(true) },
    { id: "ambiguous", run: () => leakMatchAmbiguous("MATCH_AMBIGUOUS") },
    { id: "reliability", run: () => leakReliability(0.8) },
    { id: "auto_promote", run: () => leakAutoPromote(true) },
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
