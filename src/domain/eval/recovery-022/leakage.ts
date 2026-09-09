/**
 * TASK 022 leakage: 021 L1–L10 plus BeatTheBookie-specific attacks.
 */

import {
  BlindLeakageError,
  ExperimentIntegrityError,
  assertDecisionPayloadSafe,
  assertNoRetroactiveOptimization,
} from "@/domain/eval/actuarial-018/integrity";
import { assertLockedBeforeReveal, assertOutcomeAbsentFromDecision } from "@/domain/eval/capital-020/lock";
import { leakL8BankrollCarriedAcrossYears as leakL8_021 } from "@/domain/eval/capital-021/leakage";
import { assertHoldoutUntouched022 } from "@/domain/eval/recovery-022/config";
import { isAggregateBookmakerLabel } from "@/domain/eval/recovery-022/bookmakers";
import { assertNotRelativePromotedToAbsolute, assertNoFutureQuote022 } from "@/domain/eval/recovery-022/temporal";
import { strictMatchingAllowed } from "@/domain/eval/recovery-022/matching";
import type { Exp022Config, MatchGrade022 } from "@/domain/eval/recovery-022/types";

export function leakL1QuoteAfterAsOf(availableAt: string, asOf: Date): void {
  assertNoFutureQuote022(availableAt, asOf);
}

export function leakL2OutcomeBeforeLock(locked: boolean): void {
  assertLockedBeforeReveal(locked);
}

export function leakL3CloseInDecision(usedClose: boolean): void {
  if (usedClose) throw new BlindLeakageError("L3: closing odds in DecisionContext");
}

export function leakL4NewsAfterAsOf(publishedAt: Date, asOf: Date, used: boolean): "blocked" | "ok" {
  if (publishedAt.getTime() > asOf.getTime()) {
    if (used) throw new BlindLeakageError("L4: news after asOf in DecisionContext");
    return "blocked";
  }
  return "ok";
}

export function leakL5PostMatchStats(kind: string): void {
  if (kind === "post_match" || kind === "FT" || kind === "FTHome" || kind === "home_score") {
    throw new BlindLeakageError("L5: post-match statistics in DecisionContext");
  }
}

export function leakL6ParamChosenOnTest(usedTest: boolean): void {
  if (usedTest) throw new ExperimentIntegrityError("L6: parameter chosen using TEST");
}

export function leakL7ParamChosenOnHoldout(cfg: Exp022Config, usedHoldout: boolean): void {
  assertHoldoutUntouched022({
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
    throw new ExperimentIntegrityError("L10: strategy chosen because of historical yield");
  }
}

export function leakL11RelativePromotedToUtc(input: {
  precision: "RELATIVE_TO_KICKOFF_APPROX" | "DATE_ONLY";
  availableAt: string | null;
}): void {
  assertNotRelativePromotedToAbsolute({
    precision: input.precision,
    availableAt: input.availableAt,
    timezoneVerified: false,
  });
}

export function leakL12AggregateAsBookmaker(bookmaker: string): void {
  if (isAggregateBookmakerLabel(bookmaker)) {
    throw new BlindLeakageError(`L12: aggregate ${bookmaker} stored as bookmaker`);
  }
}

export function leakL13TrustPhpSizeofAsSeconds(trustTField: boolean): void {
  if (trustTField) {
    throw new BlindLeakageError(
      "L13: PHP sizeof($diff_win_*) bug — t_* must not be treated as exact seconds",
    );
  }
}

export function leakL14FutureFeature(featureTs: Date, asOf: Date): void {
  if (featureTs.getTime() > asOf.getTime()) {
    throw new BlindLeakageError("L14: future feature in DecisionContext");
  }
}

export function leakL15AmbiguousMatchInStrict(grade: MatchGrade022): void {
  if (!strictMatchingAllowed(grade)) {
    throw new BlindLeakageError(`L15: STRICT used ${grade}`);
  }
}

export function leakL16OutcomeInjection(payload: Record<string, unknown>): void {
  assertOutcomeAbsentFromDecision(payload);
}

export function leakL17ClosingOddsAsDecision(observationKind: string, inDecision: boolean): void {
  if (inDecision && observationKind === "close") {
    throw new BlindLeakageError("L17: closing odds used as decision quote");
  }
}

export function assertFrozen022(cfg: Exp022Config): void {
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
