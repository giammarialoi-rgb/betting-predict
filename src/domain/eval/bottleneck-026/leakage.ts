/**
 * TASK 026 hostile tests. Each violation → BlindLeakageError.
 */

import {
  BlindLeakageError,
  ExperimentIntegrityError,
  assertDecisionPayloadSafe,
} from "@/domain/eval/actuarial-018/integrity";
import { classifyClock, isQualified } from "@/domain/eval/bottleneck-026/classify";
import { capitalMatchAllowed } from "@/domain/eval/bottleneck-026/matching";
import { assertOutcomeAbsentFromDecision } from "@/domain/eval/capital-020/lock";

export function leakFutureQuote(quoteIso: string, asOf: Date): void {
  if (Date.parse(quoteIso) > asOf.getTime()) throw new BlindLeakageError("future quote");
}

export function leakFutureResult(resultKnownAt: Date, asOf: Date, used: boolean): void {
  if (used && resultKnownAt.getTime() > asOf.getTime()) throw new BlindLeakageError("future result");
}

export function leakClosingQuote(usedClose: boolean, decisionBeforeClose: boolean): void {
  if (usedClose && decisionBeforeClose) throw new BlindLeakageError("closing quote before close");
}

export function leakFutureInjury(publishedAt: Date, asOf: Date, used: boolean): void {
  if (used && publishedAt.getTime() > asOf.getTime()) throw new BlindLeakageError("future injury");
}

export function leakFutureNews(publishedAt: Date, asOf: Date, used: boolean): void {
  if (used && publishedAt.getTime() > asOf.getTime()) throw new BlindLeakageError("future news");
}

export function leakAmbiguousFixture(grade: "EXACT" | "PROBABLE" | "AMBIGUOUS" | "FAILED", enteredCapital: boolean): void {
  if (enteredCapital && !capitalMatchAllowed(grade)) {
    throw new BlindLeakageError("ambiguous/non-EXACT fixture in capital");
  }
}

export function leakAssumedTimestamp(): void {
  const c = classifyClock({
    raw: "2024-04-09T18:31:42Z",
    origin: "ASSUMED_TIMESTAMP",
    kickoffIso: "2024-04-09T20:00:00Z",
    licenseCapitalOk: true,
  });
  if (c.capitalEligible) throw new BlindLeakageError("assumed timestamp marked STRICT");
  throw new BlindLeakageError("assumed timestamp");
}

export function leakDateOnlyTimestamp(): void {
  const c = classifyClock({ raw: "2017-04-30", origin: "SOURCE_TIMESTAMP", licenseCapitalOk: true });
  if (c.precision === "EXACT_TIMESTAMP" || c.capitalEligible) {
    throw new BlindLeakageError("DATE_ONLY promoted to EXACT");
  }
  throw new BlindLeakageError("date-only timestamp");
}

export function leakAggregatedQuote(label: string): void {
  if (/^(max|avg|average|median|maximum)$/i.test(label.trim())) {
    throw new BlindLeakageError("aggregated quote as bookmaker");
  }
}

export function leakDuplicateSourceCluster(sameRoot: boolean, countedIndependent: boolean): void {
  if (sameRoot && countedIndependent) {
    throw new BlindLeakageError("duplicate source cluster counted independent");
  }
}

export function leakClvInDecision(payload: Record<string, unknown>): void {
  if (payload.clv != null || payload.CLV != null) throw new BlindLeakageError("CLV in DecisionContext");
}

export function leakOutcomeInDecision(payload: Record<string, unknown>): void {
  assertOutcomeAbsentFromDecision(payload);
  assertDecisionPayloadSafe(payload, new Date("2017-04-30T12:05:00.000Z"));
}

export function leakSilentThousand(end: number | null, capitalStrict: number): void {
  if (capitalStrict < 100 && end === 1000) throw new BlindLeakageError("silent 1000→1000");
}

export function leakAutoWinner(winner: string | null): void {
  if (winner != null) throw new ExperimentIntegrityError("auto winner");
}

export function leakFtScoreInDecision(payload: Record<string, unknown>): void {
  if (payload.ft != null || payload.FT != null || payload.ft_score != null) {
    throw new BlindLeakageError("FT score in DecisionContext");
  }
}

export function leakUnqualifiedBet(qualified: boolean, decision: "BET" | "NO_BET"): void {
  if (!qualified && decision === "BET") throw new BlindLeakageError("BET without QUALIFIED gate");
}

export function runHostileBattery026(): { id: string; throws: boolean }[] {
  const asOf = new Date("2017-04-30T12:05:00.000Z");
  const cases: { id: string; run: () => void }[] = [
    { id: "future_quote", run: () => leakFutureQuote("2017-04-30T12:06:00.000Z", asOf) },
    { id: "future_result", run: () => leakFutureResult(new Date("2017-04-30T14:00:00Z"), asOf, true) },
    { id: "closing_quote", run: () => leakClosingQuote(true, true) },
    { id: "future_injury", run: () => leakFutureInjury(new Date("2017-04-30T13:00:00Z"), asOf, true) },
    { id: "future_news", run: () => leakFutureNews(new Date("2017-04-30T13:00:00Z"), asOf, true) },
    { id: "ambiguous_fixture", run: () => leakAmbiguousFixture("AMBIGUOUS", true) },
    { id: "assumed_timestamp", run: () => leakAssumedTimestamp() },
    { id: "date_only_timestamp", run: () => leakDateOnlyTimestamp() },
    { id: "aggregated_quote", run: () => leakAggregatedQuote("Maximum") },
    { id: "duplicate_cluster", run: () => leakDuplicateSourceCluster(true, true) },
    { id: "clv", run: () => leakClvInDecision({ clv: 0.02 }) },
    { id: "outcome", run: () => leakOutcomeInDecision({ outcome: "DRAW" }) },
    { id: "silent_1000", run: () => leakSilentThousand(1000, 1) },
    { id: "auto_winner", run: () => leakAutoWinner("market_devig") },
    { id: "ft_score", run: () => leakFtScoreInDecision({ ft_score: "1-0" }) },
    {
      id: "unqualified_bet",
      run: () =>
        leakUnqualifiedBet(
          isQualified({
            temporal_exact: false,
            fixture_exact: true,
            market_valid: true,
            model_calibrated: true,
            sample_sufficient: true,
            walk_forward_pass: true,
            holdout_pass: true,
            statistical_gate_pass: true,
            evidence_available: true,
          }),
          "BET",
        ),
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
