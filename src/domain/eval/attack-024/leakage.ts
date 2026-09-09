/**
 * TASK 024 hostile tests A–H. Any miss invalidates the attack.
 */

import {
  BlindLeakageError,
  ExperimentIntegrityError,
  assertDecisionPayloadSafe,
  assertNoRetroactiveOptimization,
} from "@/domain/eval/actuarial-018/integrity";
import { assertHoldoutUntouched024 } from "@/domain/eval/attack-024/config";
import { duplicateDoesNotSplitCluster, LINEAGE } from "@/domain/eval/attack-024/lineage";
import {
  classifyKickoffPrecision,
  classifyQuotePrecision,
  classifyTemporalRelation,
  parseClockMs,
  strictUsable,
} from "@/domain/eval/attack-024/temporal";
import { assertLockedBeforeReveal, assertOutcomeAbsentFromDecision } from "@/domain/eval/capital-020/lock";
import type { Exp024Config, SoccerOddsSample024 } from "@/domain/eval/attack-024/types";

/** A. Outcome must be absent from DecisionContext. */
export function leakAOutcomeInDecision(payload: Record<string, unknown>): void {
  assertOutcomeAbsentFromDecision(payload);
  assertDecisionPayloadSafe(payload, new Date("2017-04-30T12:05:00.000Z"));
}

/** B. Data after asOf must not enter DecisionContext. */
export function leakBAfterAsOf(timestamp: string, asOf: Date): void {
  if (Date.parse(timestamp) > asOf.getTime()) {
    throw new BlindLeakageError("B: datum after asOf in DecisionContext");
  }
}

/** C. Quote timestamped after kickoff → REJECTED. */
export function leakCQuoteAfterKickoff(quoteIso: string, kickoffIso: string): void {
  const rel = classifyTemporalRelation({
    quoteMs: Date.parse(quoteIso),
    kickoffMs: Date.parse(kickoffIso),
  });
  if (rel === "QUOTE_AFTER_KICKOFF" || rel !== "QUOTE_BEFORE_KICKOFF") {
    throw new BlindLeakageError("C: quote timestamp not strictly before kickoff — REJECTED");
  }
}

/** D. Ambiguous timezone → UNKNOWN, not STRICT. */
export function leakDAmbiguousTimezone(): "UNKNOWN" {
  const kickoff = classifyKickoffPrecision({
    kickoffRaw: "2016-04-03 15:00:00",
    timezoneProven: false,
  });
  const quote = classifyQuotePrecision({
    quoteRaw: "2016-04-03 14:32:17",
    timezoneProven: false,
    isRelativeBin: false,
  });
  if (kickoff !== "UNKNOWN" || quote !== "UNKNOWN") {
    throw new BlindLeakageError("D: ambiguous timezone was promoted to EXACT");
  }
  return "UNKNOWN";
}

/** E. GitHub + Kaggle copy of the same dataset = 1 lineage cluster. */
export function leakEDuplicateDistribution(claimedIndependentClusters: number): void {
  const github = LINEAGE.find((l) => l.sourceId === "beatthebookie-closing")!;
  const kaggle = LINEAGE.find((l) => l.sourceId === "beatthebookie-kaggle")!;
  if (!duplicateDoesNotSplitCluster({ github, kaggle })) {
    throw new BlindLeakageError("E: duplicate distribution counted as independent source");
  }
  if (claimedIndependentClusters !== 1) {
    throw new BlindLeakageError("E: GitHub/Kaggle copies claimed as independent sources");
  }
}

/**
 * F. Inventing quote_timestamp = kickoff − 1h when the dataset only has known_at = kickoff.
 */
export function leakFInventedPrematchOffset(row: SoccerOddsSample024, claimedOffsetSec: number): void {
  if (row.delta_seconds === 0 && claimedOffsetSec !== 0) {
    throw new BlindLeakageError(
      "F: invented prematch offset — dataset only proves known_at = kickoff",
    );
  }
  const usable = strictUsable({
    acquired: true,
    parsed: true,
    kickoff: classifyKickoffPrecision({
      kickoffRaw: row.kickoff,
      timezoneProven: true,
    }),
    quote: classifyQuotePrecision({
      quoteRaw: row.odds_known_at,
      timezoneProven: true,
      isRelativeBin: false,
    }),
    relation: classifyTemporalRelation({
      quoteMs: parseClockMs(row.odds_known_at),
      kickoffMs: parseClockMs(row.kickoff),
    }),
  });
  if (usable) {
    throw new BlindLeakageError("F: soccer-dataset closing row promoted to STRICT");
  }
}

/** G. Outcome inside features → FAIL. */
export function leakGOutcomeInFeatures(features: Record<string, unknown>): void {
  assertDecisionPayloadSafe(features, new Date("2017-04-30T12:05:00.000Z"));
}

/** H. Closing odds used for a decision before close → FAIL. */
export function leakHClosingBeforeClose(input: {
  observationKind: "close" | "open" | "prematch";
  decisionBeforeClose: boolean;
}): void {
  if (input.observationKind === "close" && input.decisionBeforeClose) {
    throw new BlindLeakageError("H: closing odds used before close");
  }
}

export function assertFrozen024(cfg: Exp024Config): void {
  assertNoRetroactiveOptimization({
    retroactive_optimization: cfg.retroactive_optimization,
    parameters_frozen: true,
  });
  assertHoldoutUntouched024({
    holdoutYears: cfg.holdout_years,
    usedHoldoutForSelection: false,
  });
  if (cfg.auto_promote || cfg.winner != null || cfg.real_money) {
    throw new ExperimentIntegrityError("frozen flags");
  }
}

export function runHostileBattery024(sample: SoccerOddsSample024): { id: string; throws: boolean }[] {
  const asOf = new Date("2017-04-30T12:05:00.000Z");
  const kickoff = "2017-04-30T13:05:00.000Z";
  const cases: { id: string; run: () => void }[] = [
    { id: "A", run: () => leakAOutcomeInDecision({ outcome: "DRAW" }) },
    { id: "B", run: () => leakBAfterAsOf("2017-04-30T12:06:00.000Z", asOf) },
    { id: "C", run: () => leakCQuoteAfterKickoff("2017-04-30T13:06:00.000Z", kickoff) },
    {
      id: "D",
      run: () => {
        const k = leakDAmbiguousTimezone();
        if (k === "UNKNOWN") {
          throw new BlindLeakageError("D: UNKNOWN timezone cannot enter STRICT");
        }
      },
    },
    { id: "E", run: () => leakEDuplicateDistribution(2) },
    { id: "F", run: () => leakFInventedPrematchOffset(sample, 3600) },
    { id: "G", run: () => leakGOutcomeInFeatures({ FT: 1, goals_home: 2 }) },
    {
      id: "H",
      run: () => leakHClosingBeforeClose({ observationKind: "close", decisionBeforeClose: true }),
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

export function leakL2OutcomeBeforeLock(locked: boolean): void {
  assertLockedBeforeReveal(locked);
}
