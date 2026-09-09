/**
 * TASK 021 leakage attacks L1–L10. Any hit invalidates the experiment.
 */

import {
  BlindLeakageError,
  ExperimentIntegrityError,
  assertDecisionPayloadSafe,
  assertNoRetroactiveOptimization,
} from "@/domain/eval/actuarial-018/integrity";
import { assertHoldoutUntouched } from "@/domain/eval/capital-020/config";
import { assertLockedBeforeReveal } from "@/domain/eval/capital-020/lock";
import { assertNoFutureQuote } from "@/domain/eval/capital-021/temporal";
import type { Exp021Config } from "@/domain/eval/capital-021/types";

export function leakL1QuoteAfterAsOf(availableAt: string, asOf: Date): void {
  assertNoFutureQuote(availableAt, asOf);
}

export function leakL2OutcomeBeforeLock(locked: boolean): void {
  assertLockedBeforeReveal(locked);
}

export function leakL3CloseUsedWhenUnavailable(input: {
  closeAvailableAt: string | null;
  asOf: Date;
  usedInDecision: boolean;
}): void {
  if (!input.usedInDecision) return;
  if (input.closeAvailableAt == null) {
    throw new BlindLeakageError("L3: closing odds used without available_at");
  }
  if (Date.parse(input.closeAvailableAt) > input.asOf.getTime()) {
    throw new BlindLeakageError("L3: closing odds used after asOf");
  }
}

export function leakL4NewsAfterAsOf(
  publishedAt: Date,
  asOf: Date,
  usedInDecision: boolean,
): "blocked" | "ok" {
  if (publishedAt.getTime() > asOf.getTime()) {
    if (usedInDecision) {
      throw new BlindLeakageError("L4: news published after asOf used in DecisionContext");
    }
    return "blocked";
  }
  return "ok";
}

export function leakL5PostMatchStats(kind: string): void {
  if (kind === "post_match" || kind === "FT" || kind === "FTHome") {
    throw new BlindLeakageError("L5: post-match statistics in DecisionContext");
  }
}

export function leakL6ParamChosenOnTest(usedTestForSelection: boolean): void {
  if (usedTestForSelection) {
    throw new ExperimentIntegrityError("L6: parameter chosen using TEST");
  }
}

export function leakL7ParamChosenOnHoldout(cfg: Exp021Config, usedHoldout: boolean): void {
  assertHoldoutUntouched({
    holdoutYears: cfg.holdout_years,
    usedHoldoutForSelection: usedHoldout,
  });
}

export function leakL8BankrollCarriedAcrossYears(input: {
  yearStart: number;
  previousYearEnd: number | null;
  initial: number;
}): void {
  if (input.yearStart !== input.initial) {
    throw new BlindLeakageError("L8: annual bankroll did not reset");
  }
  if (input.previousYearEnd != null && input.yearStart === input.previousYearEnd && input.previousYearEnd !== input.initial) {
    throw new BlindLeakageError("L8: previous-year bankroll transferred");
  }
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
    throw new ExperimentIntegrityError(
      "L10: strategy chosen because of historical yield",
    );
  }
}

export function assertFrozen021(cfg: Exp021Config): void {
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
