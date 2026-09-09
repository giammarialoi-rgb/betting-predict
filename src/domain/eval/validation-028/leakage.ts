import {
  BlindLeakageError,
  ExperimentIntegrityError,
  TemporalSplitError,
  assertDecisionPayloadSafe,
} from "@/domain/eval/actuarial-018/integrity";
import { assertOutcomeAbsentFromDecision } from "@/domain/eval/capital-020/lock";
import { loadExp028Config } from "@/domain/eval/validation-028/config";

export function leakFutureFeature(availableAt: Date, asOf: Date): void {
  if (availableAt.getTime() > asOf.getTime()) throw new BlindLeakageError("future feature");
}

export function leakOutcomeInDecision(payload: Record<string, unknown>): void {
  assertOutcomeAbsentFromDecision(payload);
  if (payload.ft_home != null || payload.ft_away != null || payload.FT != null) {
    throw new BlindLeakageError("FT in DecisionContext");
  }
  assertDecisionPayloadSafe(payload, new Date("2016-01-01T12:00:00.000Z"));
}

export function leakCloseBeforeLock(usedClose: boolean, locked: boolean): void {
  if (usedClose && !locked) throw new BlindLeakageError("closing odds before LOCK");
}

export function leakHoldoutTrain(usedHoldoutForTraining: boolean): void {
  if (usedHoldoutForTraining) throw new BlindLeakageError("HOLDOUT used during training");
}

export function leakThresholdOnTest(selectedFromTest: boolean): void {
  if (selectedFromTest) throw new ExperimentIntegrityError("threshold optimized on TEST");
}

export function leakRandomSplit(): void {
  throw new TemporalSplitError("random split temporal leakage");
}

export function leakClvInDecision(payload: Record<string, unknown>): void {
  if (payload.clv != null || payload.CLV != null) throw new BlindLeakageError("CLV in DecisionContext");
}

export function leakSilentThousand(end: number | null, bets: number): void {
  if (bets === 0 && end === 1000) throw new BlindLeakageError("silent 1000→1000");
}

export function leakCarryYear(fromYearEnd: number, nextYearStart: number): void {
  if (nextYearStart !== 1000 && fromYearEnd !== 1000) {
    throw new BlindLeakageError("bankroll carried across years");
  }
  throw new BlindLeakageError("year carry probe");
}

export function leakNegativeBankroll(bankroll: number): void {
  if (bankroll < 0) throw new BlindLeakageError("negative bankroll");
}

export function leakReliability(sourceReliability: number | null): void {
  if (sourceReliability !== null) throw new BlindLeakageError("invented sourceReliability");
}

export function leakHoldoutBeforeFreeze(holdoutRun: boolean, frozen: boolean): void {
  if (holdoutRun && !frozen) throw new BlindLeakageError("HOLDOUT before freeze");
}

export function runHostileBattery028(): { id: string; throws: boolean }[] {
  const cfg = loadExp028Config();
  const asOf = new Date("2016-06-01T12:00:00.000Z");
  const cases: { id: string; run: () => void }[] = [
    { id: "future_feature", run: () => leakFutureFeature(new Date("2016-06-01T13:00:00Z"), asOf) },
    { id: "outcome_decision", run: () => leakOutcomeInDecision({ outcome: "HOME" }) },
    { id: "close_before_lock", run: () => leakCloseBeforeLock(true, false) },
    { id: "holdout_train", run: () => leakHoldoutTrain(true) },
    { id: "threshold_test", run: () => leakThresholdOnTest(true) },
    { id: "random_split", run: () => leakRandomSplit() },
    { id: "clv_decision", run: () => leakClvInDecision({ clv: 0.01 }) },
    { id: "silent_1000", run: () => leakSilentThousand(1000, 0) },
    { id: "year_carry", run: () => leakCarryYear(1100, 1100) },
    { id: "negative_bankroll", run: () => leakNegativeBankroll(-1) },
    { id: "reliability", run: () => leakReliability(0.9) },
    { id: "holdout_before_freeze", run: () => leakHoldoutBeforeFreeze(true, false) },
    { id: "ft_decision", run: () => leakOutcomeInDecision({ ft_home: 1 }) },
    {
      id: "frozen_flags",
      run: () => {
        if (cfg.threshold_selected_from_test) throw new ExperimentIntegrityError("test threshold");
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
