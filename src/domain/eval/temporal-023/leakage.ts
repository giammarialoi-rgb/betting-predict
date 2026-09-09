/**
 * TASK 023 hostile leakage A–H. Any hit invalidates STRICT.
 */

import {
  BlindLeakageError,
  ExperimentIntegrityError,
  assertDecisionPayloadSafe,
  assertNoRetroactiveOptimization,
} from "@/domain/eval/actuarial-018/integrity";
import { assertLockedBeforeReveal, assertOutcomeAbsentFromDecision } from "@/domain/eval/capital-020/lock";
import { leakL8BankrollCarriedAcrossYears as leakL8_021 } from "@/domain/eval/capital-021/leakage";
import { assertHoldoutUntouched023 } from "@/domain/eval/temporal-023/config";
import type { Exp023Config, Phase023, TemporalPrecision023 } from "@/domain/eval/temporal-023/types";

/** A. FT in DecisionContext → HARD FAIL */
export function leakAFtInDecision(payload: Record<string, unknown>): void {
  assertDecisionPayloadSafe(payload, new Date());
}

/** B. future snapshot → HARD FAIL */
export function leakBFutureSnapshot(timestamp: string, asOf: Date): void {
  if (Date.parse(timestamp) > asOf.getTime()) {
    throw new BlindLeakageError("B: future snapshot in DecisionContext");
  }
}

/** C. closing price before LOCK → HARD FAIL */
export function leakCCloseBeforeLock(input: { locked: boolean; usedClose: boolean }): void {
  if (input.usedClose && !input.locked) {
    throw new BlindLeakageError("C: closing_price used before LOCK");
  }
}

/** D. post-match statistic → HARD FAIL */
export function leakDPostMatchStat(kind: string): void {
  if (
    kind === "post_match" ||
    kind === "FT" ||
    kind === "FTHome" ||
    kind === "settlement" ||
    kind === "WINNER"
  ) {
    throw new BlindLeakageError("D: post-match statistic in DecisionContext");
  }
}

/** E. outcome in Evidence → HARD FAIL */
export function leakEOutcomeInEvidence(payload: Record<string, unknown>): void {
  assertOutcomeAbsentFromDecision(payload);
  if (payload.outcome != null || payload.FT != null || payload.settlement != null) {
    throw new BlindLeakageError("E: outcome in Evidence");
  }
}

/** F. snapshot timestamp > asOf → HARD FAIL */
export function leakFTimestampAfterAsOf(timestamp: string, asOf: Date): void {
  if (Date.parse(timestamp) > asOf.getTime()) {
    throw new BlindLeakageError("F: snapshot timestamp > asOf");
  }
}

/** G. MATCH_PROBABLE in STRICT → HARD FAIL */
export function leakGMatchProbable(grade: string): void {
  if (grade === "MATCH_PROBABLE") {
    throw new BlindLeakageError("G: MATCH_PROBABLE used in STRICT");
  }
}

/** H. UNKNOWN in STRICT → HARD FAIL */
export function leakHUnknownInStrict(input: {
  precision: TemporalPrecision023;
  phase: Phase023;
}): void {
  if (input.precision === "unknown" || input.phase === "UNKNOWN") {
    throw new BlindLeakageError("H: UNKNOWN datum used in STRICT");
  }
}

export function leakL2OutcomeBeforeLock(locked: boolean): void {
  assertLockedBeforeReveal(locked);
}

export function leakL6ParamChosenOnTest(usedTest: boolean): void {
  if (usedTest) throw new ExperimentIntegrityError("parameter chosen using TEST");
}

export function leakL7ParamChosenOnHoldout(cfg: Exp023Config, usedHoldout: boolean): void {
  assertHoldoutUntouched023({
    holdoutYears: cfg.holdout_years,
    usedHoldoutForSelection: usedHoldout,
  });
}

export function leakL8BankrollCarriedAcrossYears(input: {
  yearStart: number;
  previousYearEnd: number | null;
  initial: number;
}): void {
  leakL8_021(input);
}

export function leakL9StakeUsesResult(): void {
  assertDecisionPayloadSafe({ stake_uses_outcome: true }, new Date());
}

export function leakL10StrategyChosenFromPnl(input: {
  selectedFromPnl: boolean;
  autoPromote: boolean;
  best: string | null;
}): void {
  if (input.selectedFromPnl || input.autoPromote || input.best != null) {
    throw new ExperimentIntegrityError("strategy chosen because of historical yield");
  }
}

export function assertFrozen023(cfg: Exp023Config): void {
  assertNoRetroactiveOptimization({
    retroactive_optimization: cfg.retroactive_optimization,
    parameters_frozen: true,
  });
  leakL7ParamChosenOnHoldout(cfg, false);
  leakL10StrategyChosenFromPnl({
    selectedFromPnl: cfg.strategy_selected_from_pnl,
    autoPromote: cfg.auto_promote,
    best: cfg.winner,
  });
}

export function runHostileBattery(): { id: string; throws: boolean }[] {
  const asOf = new Date("2017-04-30T12:05:00.000Z");
  const cases: { id: string; run: () => void }[] = [
    { id: "A", run: () => leakAFtInDecision({ FT: 1 }) },
    { id: "B", run: () => leakBFutureSnapshot("2017-04-30T12:06:00.000Z", asOf) },
    { id: "C", run: () => leakCCloseBeforeLock({ locked: false, usedClose: true }) },
    { id: "D", run: () => leakDPostMatchStat("FT") },
    { id: "E", run: () => leakEOutcomeInEvidence({ outcome: "DRAW" }) },
    { id: "F", run: () => leakFTimestampAfterAsOf("2017-04-30T13:00:00.000Z", asOf) },
    { id: "G", run: () => leakGMatchProbable("MATCH_PROBABLE") },
    { id: "H", run: () => leakHUnknownInStrict({ precision: "unknown", phase: "UNKNOWN" }) },
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
