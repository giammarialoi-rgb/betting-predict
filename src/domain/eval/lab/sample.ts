import type {
  DecisionContext,
  OutcomeContext,
} from "@/domain/eval/contexts";

/**
 * Single historical observation for the evaluation lab.
 * DecisionContext MUST NOT contain the event outcome.
 */
export type HistoricalEvaluationSample = {
  eventId: string;
  asOf: Date;
  market: string;
  featurePolicy: string;
  decisionContext: DecisionContext;
  marketContext: {
    marketType: string;
    snapshots: DecisionContext["availableMarkets"];
    opening: DecisionContext["availableMarkets"][number] | null;
    latestAvailable: DecisionContext["availableMarkets"][number] | null;
    closing: DecisionContext["availableMarkets"][number] | null;
    impliedNormalized: Record<string, number> | null;
    overround: number | null;
    disagreement: number | null;
  };
  featureContext: {
    features: DecisionContext["availableFeatures"];
    usedKeys: string[];
    excludedKeys: string[];
  };
  /** Attached only after lock / for evaluation — never into decision. */
  outcomeContext: OutcomeContext | null;
  dataQuality: {
    eventsTotal: number;
    eventsEvaluated: number;
    eventsRejected: number;
    featuresAvailable: number;
    featuresMissing: number;
    featuresForbidden: number;
    marketsAvailable: number;
    marketsRejected: number;
    temporalViolations: number;
    entityResolutionFailures: number;
  };
};

export function assertDecisionOutcomeIsolation(
  sample: HistoricalEvaluationSample,
): void {
  if (sample.decisionContext.kind !== "decision") {
    throw new Error("decisionContext.kind must be decision");
  }
  const keys = sample.decisionContext.availableFeatures.map((f) => f.featureKey);
  for (const banned of ["ft_result", "home_score", "away_score", "result_code"]) {
    if (keys.includes(banned)) {
      throw new Error(`OUTCOME_LEAK into DecisionContext: ${banned}`);
    }
  }
  if (
    "homeScore" in sample.decisionContext ||
    "awayScore" in sample.decisionContext ||
    "resultCode" in sample.decisionContext
  ) {
    throw new Error("OUTCOME_LEAK: outcome fields on DecisionContext");
  }
}
