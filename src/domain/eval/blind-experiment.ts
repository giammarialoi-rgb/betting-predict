/**
 * Blind experiment protocol: decide → lock → reveal → evaluate.
 */

import type { DecisionContext, OutcomeContext } from "@/domain/eval/contexts";
import type { OutcomeProbabilities } from "@/domain/eval/baselines";
import { buildHistoricalEvaluationSample } from "@/domain/eval/historical-replay";
import type { LabDataset } from "@/domain/eval/lab/dataset";

export type BlindLockRecord = {
  lockedAt: string;
  eventId: string;
  asOf: string;
  decisionContext: DecisionContext;
  probabilities: OutcomeProbabilities;
  outcomeRevealed: false;
  outcomeContext: null;
};

export type BlindRevealRecord = {
  lockedAt: string;
  revealedAt: string;
  eventId: string;
  asOf: string;
  decisionContext: DecisionContext;
  probabilities: OutcomeProbabilities;
  outcomeRevealed: true;
  outcomeContext: OutcomeContext;
  /** Explicit audit: outcome was not available at lock time. */
  revealAfterDecision: true;
};

export function runBlindDecideAndLock(input: {
  eventId: string;
  asOf: Date;
  dataset: LabDataset;
  predict: (decision: DecisionContext) => OutcomeProbabilities;
}): BlindLockRecord {
  const sample = buildHistoricalEvaluationSample({
    eventId: input.eventId,
    asOf: input.asOf,
    dataset: input.dataset,
    includeOutcome: false,
    asOfPolicy: "STRICT_AS_OF",
  });
  if (sample.outcomeContext !== null) {
    throw new Error("BLIND_VIOLATION: outcome present before lock");
  }
  const probabilities = input.predict(sample.decisionContext);
  return {
    lockedAt: new Date().toISOString(),
    eventId: input.eventId,
    asOf: input.asOf.toISOString(),
    decisionContext: sample.decisionContext,
    probabilities,
    outcomeRevealed: false,
    outcomeContext: null,
  };
}

export function revealOutcomeAfterLock(input: {
  lock: BlindLockRecord;
  dataset: LabDataset;
}): BlindRevealRecord {
  if (input.lock.outcomeRevealed) {
    throw new Error("outcome already revealed");
  }
  const withOutcome = buildHistoricalEvaluationSample({
    eventId: input.lock.eventId,
    asOf: new Date(input.lock.asOf),
    dataset: input.dataset,
    includeOutcome: true,
    asOfPolicy: "STRICT_AS_OF",
  });
  if (!withOutcome.outcomeContext) {
    throw new Error("outcome missing at reveal");
  }
  return {
    lockedAt: input.lock.lockedAt,
    revealedAt: new Date().toISOString(),
    eventId: input.lock.eventId,
    asOf: input.lock.asOf,
    decisionContext: input.lock.decisionContext,
    probabilities: input.lock.probabilities,
    outcomeRevealed: true,
    outcomeContext: withOutcome.outcomeContext,
    revealAfterDecision: true,
  };
}
