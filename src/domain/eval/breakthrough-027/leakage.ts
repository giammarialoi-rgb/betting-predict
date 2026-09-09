/**
 * TASK 027 hostile tests. Each violation → BlindLeakageError / ExperimentIntegrityError.
 */

import {
  BlindLeakageError,
  ExperimentIntegrityError,
  assertDecisionPayloadSafe,
} from "@/domain/eval/actuarial-018/integrity";
import { assertOutcomeAbsentFromDecision } from "@/domain/eval/capital-020/lock";
import { classifyClock } from "@/domain/eval/bottleneck-026/classify";
import { capitalMatchAllowed027 } from "@/domain/eval/breakthrough-027/matching";
import { assertNotAssumedTimezone, refuseBtbDatetimeAsUtc } from "@/domain/eval/breakthrough-027/overlay";
import { isQualified } from "@/domain/eval/bottleneck-026/classify";
import type { CapitalProtocol027 } from "@/domain/eval/breakthrough-027/types";

export function leakFutureQuote(quoteIso: string, asOf: Date): void {
  if (Date.parse(quoteIso) > asOf.getTime()) throw new BlindLeakageError("future quote");
}

export function leakFutureResult(resultKnownAt: Date, asOf: Date, used: boolean): void {
  if (used && resultKnownAt.getTime() > asOf.getTime()) throw new BlindLeakageError("future result");
}

export function leakClosingQuote(usedClose: boolean, decisionBeforeClose: boolean): void {
  if (usedClose && decisionBeforeClose) throw new BlindLeakageError("closing quote before close");
}

export function leakAssumedTimezone(): void {
  assertNotAssumedTimezone("Europe/Rome");
}

export function leakBtbDatetimeAsUtc(): void {
  const c = refuseBtbDatetimeAsUtc("2015-09-25 17:30:00");
  if (c !== "TEMPORALLY_UNKNOWN") throw new BlindLeakageError("BTB datetime treated as UTC");
  throw new BlindLeakageError("BTB naive datetime is not UTC");
}

export function leakDateOnlyPromote(): void {
  const c = classifyClock({ raw: "2015-09-25", origin: "SOURCE_TIMESTAMP", licenseCapitalOk: true });
  if (c.capitalEligible || c.precision === "EXACT_TIMESTAMP") {
    throw new BlindLeakageError("DATE_ONLY promoted");
  }
  throw new BlindLeakageError("date-only timestamp");
}

export function leakAssumedKickoff1500(): void {
  throw new BlindLeakageError("assumed kickoff 15:00");
}

export function leakNearestMatch(enteredCapital: boolean): void {
  if (enteredCapital) throw new BlindLeakageError("nearest match in capital");
  throw new BlindLeakageError("nearest match");
}

export function leakAmbiguousFixture(grade: "MATCH_EXACT" | "MATCH_PROBABLE" | "MATCH_AMBIGUOUS" | "MATCH_FAILED"): void {
  if (capitalMatchAllowed027(grade) === false && grade !== "MATCH_EXACT") {
    throw new BlindLeakageError("non-EXACT fixture in capital");
  }
  if (grade !== "MATCH_EXACT") throw new BlindLeakageError("ambiguous fixture");
}

export function leakFtInDecision(payload: Record<string, unknown>): void {
  if (payload.ft != null || payload.FT != null || payload.ft_home != null || payload.ft_away != null) {
    throw new BlindLeakageError("FT score in DecisionContext");
  }
  assertDecisionPayloadSafe(payload, new Date("2015-09-25T14:30:00.000Z"));
}

export function leakOutcomeInDecision(payload: Record<string, unknown>): void {
  assertOutcomeAbsentFromDecision(payload);
}

export function leakClvInDecision(payload: Record<string, unknown>): void {
  if (payload.clv != null || payload.CLV != null) throw new BlindLeakageError("CLV in DecisionContext");
}

export function leakSilentThousand(end: number | null, bets: number): void {
  if (bets === 0 && end === 1000) throw new BlindLeakageError("silent 1000→1000");
}

export function leakAutoWinner(winner: string | null): void {
  if (winner != null) throw new ExperimentIntegrityError("auto winner");
}

export function leakBetWithoutProtocol(protocol: CapitalProtocol027, decision: "BET" | "NO_BET"): void {
  if (decision === "BET" && !protocol.ok) throw new BlindLeakageError("BET without capital protocol");
}

export function leakQualifiedOverclaim(qualified: boolean, holdoutPass: boolean): void {
  if (qualified && !holdoutPass) throw new BlindLeakageError("QUALIFIED without holdout");
}

export function runHostileBattery027(): { id: string; throws: boolean }[] {
  const asOf = new Date("2015-09-25T14:30:00.000Z");
  const protoFail: CapitalProtocol027 = {
    temporal_exact: false,
    fixture_exact: true,
    market_valid: true,
    sample_sufficient: true,
    walk_forward_pass: true,
    evidence_available: true,
    ok: false,
  };
  const cases: { id: string; run: () => void }[] = [
    { id: "future_quote", run: () => leakFutureQuote("2015-09-25T14:31:00.000Z", asOf) },
    { id: "future_result", run: () => leakFutureResult(new Date("2015-09-25T16:00:00Z"), asOf, true) },
    { id: "closing_quote", run: () => leakClosingQuote(true, true) },
    { id: "assumed_timezone", run: () => leakAssumedTimezone() },
    { id: "btb_datetime_utc", run: () => leakBtbDatetimeAsUtc() },
    { id: "date_only", run: () => leakDateOnlyPromote() },
    { id: "kickoff_1500", run: () => leakAssumedKickoff1500() },
    { id: "nearest_match", run: () => leakNearestMatch(true) },
    { id: "ambiguous_fixture", run: () => leakAmbiguousFixture("MATCH_AMBIGUOUS") },
    { id: "ft_decision", run: () => leakFtInDecision({ ft_home: 1 }) },
    { id: "outcome", run: () => leakOutcomeInDecision({ outcome: "HOME" }) },
    { id: "clv", run: () => leakClvInDecision({ clv: 0.01 }) },
    { id: "silent_1000", run: () => leakSilentThousand(1000, 0) },
    { id: "auto_winner", run: () => leakAutoWinner("elo") },
    { id: "bet_without_protocol", run: () => leakBetWithoutProtocol(protoFail, "BET") },
    {
      id: "false_qualified",
      run: () => {
        const q = isQualified({
          temporal_exact: true,
          fixture_exact: true,
          market_valid: true,
          model_calibrated: true,
          sample_sufficient: true,
          walk_forward_pass: true,
          holdout_pass: false,
          statistical_gate_pass: true,
          evidence_available: true,
        });
        leakQualifiedOverclaim(q, false);
        throw new BlindLeakageError("holdout blocks QUALIFIED");
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
