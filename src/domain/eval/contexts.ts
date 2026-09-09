/**
 * Decision vs Outcome separation — never pass both into a prediction engine.
 */

export type DecisionFeatureEntry = {
  featureKey: string;
  value: number | string | object | null;
  availableAt: Date | null;
  temporalPrecision: string;
  featureStatus: string;
  source?: string | null;
};

export type DecisionMarketEntry = {
  marketType: string;
  selectionSide: string;
  line: string | null;
  bookmakerSlug?: string;
  oddsDecimal: number;
  availableAt: Date;
  temporalPrecision: string;
  observationKind: string;
};

/**
 * Everything knowable at asOf — MUST NOT include the event outcome.
 */
export type DecisionContext = {
  kind: "decision";
  eventId: string;
  sportId: string;
  asOf: Date;
  asOfPolicy: "STRICT_AS_OF" | "RESEARCH" | "ANY";
  availableFeatures: DecisionFeatureEntry[];
  featureStatuses: Record<string, string>;
  availableMarkets: DecisionMarketEntry[];
  marketSnapshots: DecisionMarketEntry[];
  dataQuality: {
    featurePresent: number;
    featureMissing: number;
    featureForbidden: number;
    marketCount: number;
  };
  temporalWarnings: string[];
  /** Reserved for future model outputs — always null in TASK 008. */
  modelProbability: null;
  uncertainty: null;
  edge: null;
  confidence: null;
  riskState: null;
};

/**
 * Outcome only — for evaluation after a decision is frozen.
 */
export type OutcomeContext = {
  kind: "outcome";
  eventId: string;
  homeScore: number;
  awayScore: number;
  resultCode: "HOME" | "DRAW" | "AWAY";
  availableAt: Date;
  observedAt: Date;
};

export type EvaluationSample = {
  decision: DecisionContext;
  /** Attached only in evaluation phase — never into decision/model input. */
  outcome: OutcomeContext | null;
};

export function buildEvaluationSample(
  decision: DecisionContext,
  outcome: OutcomeContext | null,
): EvaluationSample {
  if (decision.kind !== "decision") {
    throw new Error("EvaluationSample.decision must be DecisionContext");
  }
  if (outcome && outcome.kind !== "outcome") {
    throw new Error("EvaluationSample.outcome must be OutcomeContext");
  }
  return { decision, outcome };
}

/** Fail if outcome fields leaked into decision features. */
export function assertNoOutcomeLeakIntoDecision(decision: DecisionContext): void {
  for (const f of decision.availableFeatures) {
    if (
      f.featureKey === "ft_result" ||
      f.featureKey === "home_score" ||
      f.featureKey === "away_score" ||
      f.featureKey === "result_code"
    ) {
      throw new Error(
        `OUTCOME_LEAK: decision feature ${f.featureKey} must not carry event outcome`,
      );
    }
  }
}
