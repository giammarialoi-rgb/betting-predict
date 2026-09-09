/**
 * Blind Research Engine V2 — lock before outcome reveal.
 */

import {
  buildRealHistoricalEvaluationSample,
  decisionAsOfForEvent,
} from "@/domain/eval/real-lab/truth-lab";
import type {
  RealHistoricalDataset,
  RealLabEvent,
} from "@/domain/eval/real-lab/load-pack";
import type { DecisionContext, OutcomeContext } from "@/domain/eval/contexts";
import { buildFeatureEngineV3 } from "@/domain/features/engine-v3";
import { quotesAsOf } from "@/domain/markets/discovery-engine";
import type { OutcomeProbabilities } from "@/domain/eval/baselines";

export type BlindResearchLockV2 = {
  lockedAt: string;
  eventId: string;
  asOf: string;
  decisionContext: DecisionContext;
  featureKeys: string[];
  marketKeys: string[];
  probabilities: OutcomeProbabilities;
  outcomeRevealed: false;
  outcomeContext: null;
};

export type BlindResearchRevealV2 = {
  lockedAt: string;
  revealedAt: string;
  eventId: string;
  asOf: string;
  decisionContext: DecisionContext;
  probabilities: OutcomeProbabilities;
  outcomeRevealed: true;
  outcomeContext: OutcomeContext;
  revealAfterDecision: true;
  error: {
    predicted: string;
    actual: string;
    correct: boolean;
  };
};

export function runBlindResearchV2(input: {
  event: RealLabEvent;
  dataset: RealHistoricalDataset;
  predict: (decision: DecisionContext) => OutcomeProbabilities;
  asOf?: Date;
}): BlindResearchLockV2 {
  const asOf = input.asOf ?? decisionAsOfForEvent(input.event);
  const sample = buildRealHistoricalEvaluationSample({
    eventId: input.event.eventId,
    asOf,
    dataset: input.dataset,
    includeOutcome: false,
    asOfPolicy: "STRICT_AS_OF",
  });
  if (sample.outcomeContext !== null) {
    throw new Error("BLIND_V2: outcome leaked into pre-lock sample");
  }

  const { accepted } = quotesAsOf(
    input.dataset.quotes,
    input.event.eventId,
    asOf,
    "STRICT_AS_OF",
  );
  const feat = buildFeatureEngineV3({
    event: input.event,
    asOf,
    dataset: input.dataset,
    marketQuotes: accepted,
  });

  const probabilities = input.predict(sample.decisionContext);
  return {
    lockedAt: new Date().toISOString(),
    eventId: input.event.eventId,
    asOf: asOf.toISOString(),
    decisionContext: sample.decisionContext,
    featureKeys: feat.features.map((f) => f.featureKey),
    marketKeys: sample.decisionContext.availableMarkets.map(
      (m) => `${m.marketType}:${m.selectionSide}`,
    ),
    probabilities,
    outcomeRevealed: false,
    outcomeContext: null,
  };
}

export function revealBlindResearchV2(input: {
  lock: BlindResearchLockV2;
  dataset: RealHistoricalDataset;
}): BlindResearchRevealV2 {
  if (input.lock.outcomeRevealed) {
    throw new Error("already revealed");
  }
  const sample = buildRealHistoricalEvaluationSample({
    eventId: input.lock.eventId,
    asOf: new Date(input.lock.asOf),
    dataset: input.dataset,
    includeOutcome: true,
    asOfPolicy: "STRICT_AS_OF",
  });
  if (!sample.outcomeContext) throw new Error("outcome missing");

  const probs = input.lock.probabilities.probabilities;
  let predicted = "HOME";
  let best = -1;
  for (const [k, v] of Object.entries(probs)) {
    if (v > best) {
      best = v;
      predicted = k;
    }
  }
  const actual = sample.outcomeContext.resultCode;
  return {
    lockedAt: input.lock.lockedAt,
    revealedAt: new Date().toISOString(),
    eventId: input.lock.eventId,
    asOf: input.lock.asOf,
    decisionContext: input.lock.decisionContext,
    probabilities: input.lock.probabilities,
    outcomeRevealed: true,
    outcomeContext: sample.outcomeContext,
    revealAfterDecision: true,
    error: {
      predicted,
      actual,
      correct: predicted === actual,
    },
  };
}
