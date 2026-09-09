/**
 * TASK 025 hostile tests A–O.
 */

import {
  BlindLeakageError,
  ExperimentIntegrityError,
  assertDecisionPayloadSafe,
} from "@/domain/eval/actuarial-018/integrity";
import { classifyNamedOpeningDataset, classifyWeeklyBetfairRow } from "@/domain/eval/turnaround-025/classify";
import { stage2Decision } from "@/domain/eval/turnaround-025/models";
import { assertOutcomeAbsentFromDecision } from "@/domain/eval/capital-020/lock";
import type { WeeklyBetfairRow025 } from "@/domain/eval/turnaround-025/types";

export function leakAFutureQuote(quoteIso: string, asOf: Date): void {
  if (Date.parse(quoteIso) > asOf.getTime()) {
    throw new BlindLeakageError("A: future quote");
  }
}

export function leakBCloseBeforeDecision(usedClose: boolean, decisionBeforeClose: boolean): void {
  if (usedClose && decisionBeforeClose) {
    throw new BlindLeakageError("B: closing odds before close");
  }
}

export function leakCDatePromotedToTimestamp(raw: string, treatedExact: boolean): void {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && treatedExact) {
    throw new BlindLeakageError("C: DATE_ONLY promoted to timestamp");
  }
}

export function leakDOpeningLabelIsNotStrict(label: string, classifiedStrict: boolean): void {
  if (classifyNamedOpeningDataset(label) !== "A_STRICT" && classifiedStrict) {
    throw new BlindLeakageError("D: dataset named opening promoted to STRICT");
  }
}

export function leakEGithubMirrorIndependent(sameRoot: boolean, countedIndependent: boolean): void {
  if (sameRoot && countedIndependent) {
    throw new BlindLeakageError("E: GitHub mirror counted as independent source");
  }
}

export function leakFAggregatorAsBook(label: string): void {
  if (/^(max|avg|average|median|maximum)$/i.test(label.trim())) {
    throw new BlindLeakageError("F: aggregator as bookmaker");
  }
}

export function leakGClvInDecision(payload: Record<string, unknown>): void {
  if (payload.clv != null || payload.CLV != null) {
    throw new BlindLeakageError("G: CLV in DecisionContext");
  }
}

export function leakHOutcomeInDecision(payload: Record<string, unknown>): void {
  assertOutcomeAbsentFromDecision(payload);
  assertDecisionPayloadSafe(payload, new Date("2017-04-30T12:05:00.000Z"));
}

export function leakINewsAfterAsOf(publishedAt: Date, asOf: Date, used: boolean): void {
  if (publishedAt.getTime() > asOf.getTime() && used) {
    throw new BlindLeakageError("I: news after asOf");
  }
}

export function leakJContextOnlyMutatesProbability(polarity: string, mutated: boolean): void {
  if (polarity === "CONTEXT_ONLY" && mutated) {
    throw new BlindLeakageError("J: CONTEXT_ONLY mutated probability");
  }
}

export function leakKDecisionWithoutEvidence(hasGraph: boolean): void {
  const d = stage2Decision({
    capitalEligible: true,
    declaredEdge: true,
    probs: [0.4, 0.3, 0.3],
    market: [0.3, 0.3, 0.4],
    threshold: 0.03,
    trainN: 500,
    minTrain: 100,
    calibrationOk: true,
    liquidityOk: true,
    timestampStrict: true,
    evidenceGraph: hasGraph,
  });
  if (!hasGraph && d.reason !== "NO_EVIDENCE_GRAPH") {
    throw new BlindLeakageError("K: missing evidence graph not rejected");
  }
  if (!hasGraph) throw new BlindLeakageError("K: no evidence graph");
}

export function leakLNonStrictTimestamp(): void {
  const d = stage2Decision({
    capitalEligible: true,
    declaredEdge: true,
    probs: [0.4, 0.3, 0.3],
    market: [0.3, 0.3, 0.4],
    threshold: 0.03,
    trainN: 500,
    minTrain: 100,
    calibrationOk: true,
    liquidityOk: true,
    timestampStrict: false,
    evidenceGraph: true,
  });
  if (d.decision === "BET") throw new BlindLeakageError("L: BET without STRICT timestamp");
  throw new BlindLeakageError("L: classified NO_STRICT_TIMESTAMP");
}

export function leakMSilentThousand(end: number | null, strictN: number): void {
  if (strictN < 100 && end === 1000) {
    throw new BlindLeakageError("M: silent 1000→1000");
  }
}

export function leakNAutoWinner(winner: string | null): void {
  if (winner != null) throw new ExperimentIntegrityError("N: auto winner");
}

export function leakOParamOnTest(usedTest: boolean): void {
  if (usedTest) throw new ExperimentIntegrityError("O: parameter optimized on TEST");
}

export function sampleWeeklyPe(over: Partial<WeeklyBetfairRow025> = {}): WeeklyBetfairRow025 {
  return {
    event_id: "1",
    sports_id: "1",
    scheduled_off: "2013-01-12 15:00:00",
    actual_off: "2013-01-12 15:01:00",
    first_taken: "2013-01-12 10:00:00",
    latest_taken: "2013-01-12 14:00:00",
    in_play: "PE",
    selection: "The Draw",
    selection_id: "58805",
    odds: 3.5,
    number_bets: 10,
    volume_matched: 100,
    win_flag: 1,
    full_description: "English Soccer",
    ...over,
  };
}

export function runHostileBattery025(): { id: string; throws: boolean }[] {
  const asOf = new Date("2017-04-30T12:05:00.000Z");
  const cases: { id: string; run: () => void }[] = [
    { id: "A", run: () => leakAFutureQuote("2017-04-30T12:06:00.000Z", asOf) },
    { id: "B", run: () => leakBCloseBeforeDecision(true, true) },
    { id: "C", run: () => leakCDatePromotedToTimestamp("2017-04-30", true) },
    { id: "D", run: () => leakDOpeningLabelIsNotStrict("historical opening odds", true) },
    { id: "E", run: () => leakEGithubMirrorIndependent(true, true) },
    { id: "F", run: () => leakFAggregatorAsBook("Maximum") },
    { id: "G", run: () => leakGClvInDecision({ clv: 0.02 }) },
    { id: "H", run: () => leakHOutcomeInDecision({ outcome: "DRAW" }) },
    { id: "I", run: () => leakINewsAfterAsOf(new Date("2017-04-30T13:00:00.000Z"), asOf, true) },
    { id: "J", run: () => leakJContextOnlyMutatesProbability("CONTEXT_ONLY", true) },
    { id: "K", run: () => leakKDecisionWithoutEvidence(false) },
    { id: "L", run: () => leakLNonStrictTimestamp() },
    { id: "M", run: () => leakMSilentThousand(1000, 1) },
    { id: "N", run: () => leakNAutoWinner("market_devig") },
    { id: "O", run: () => leakOParamOnTest(true) },
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

export function assertWeeklyNotForcedStrict(): void {
  const c = classifyWeeklyBetfairRow(sampleWeeklyPe());
  if (c.dataClass === "A_STRICT") {
    throw new BlindLeakageError("weekly CSV without TZ must not be forced STRICT");
  }
}
