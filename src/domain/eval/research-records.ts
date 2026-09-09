/**
 * Research explanation + self-correction observation framework (no auto-mutate).
 */

export type ResearchExplanation = {
  supporting_features: string[];
  contradicting_features: string[];
  market_evidence: string[];
  historical_evidence: string[];
  data_quality: string[];
  temporal_quality: string[];
  uncertainty: string[];
  model_comparison: string[];
  reasoning_summary: string;
};

export function buildResearchExplanation(input: {
  supportingFeatures: string[];
  contradictingFeatures?: string[];
  marketEvidence?: string[];
  historicalEvidence?: string[];
  dataQualityNotes?: string[];
  temporalQualityNotes?: string[];
  uncertaintyNotes?: string[];
  modelComparison?: string[];
}): ResearchExplanation {
  const supporting = input.supportingFeatures;
  const contradicting = input.contradictingFeatures ?? [];
  const market = input.marketEvidence ?? [];
  const historical = input.historicalEvidence ?? [];
  const parts = [
    supporting.length ? `supporting=${supporting.join(",")}` : null,
    contradicting.length ? `contradicting=${contradicting.join(",")}` : null,
    market.length ? `market=${market.join(",")}` : null,
  ].filter(Boolean);
  return {
    supporting_features: supporting,
    contradicting_features: contradicting,
    market_evidence: market,
    historical_evidence: historical,
    data_quality: input.dataQualityNotes ?? [],
    temporal_quality: input.temporalQualityNotes ?? [],
    uncertainty: input.uncertaintyNotes ?? [],
    model_comparison: input.modelComparison ?? [],
    reasoning_summary: parts.join("; ") || "insufficient_evidence",
  };
}

export type PredictionRecord = {
  model_version: string;
  feature_version: string;
  experiment_version: string;
  prediction: Record<string, number>;
  market: string;
  timestamp: string;
  eventId: string;
};

export type EvaluationRecord = {
  model_version: string;
  feature_version: string;
  experiment_version: string;
  prediction: Record<string, number>;
  actual: string;
  market: string;
  timestamp: string;
  eventId: string;
  brier: number;
  log_loss: number;
};

export type ErrorRecord = {
  model_version: string;
  feature_version: string;
  experiment_version: string;
  prediction: Record<string, number>;
  actual: string;
  error: string;
  market: string;
  timestamp: string;
  eventId: string;
};

/** Framework only — does not mutate models. */
export function recordPrediction(input: PredictionRecord): PredictionRecord {
  return { ...input };
}

export function recordEvaluation(input: EvaluationRecord): EvaluationRecord {
  return { ...input };
}

export function recordError(input: ErrorRecord): ErrorRecord {
  return { ...input };
}

export function assertNoAutoModelMutation(action: string): void {
  if (action === "auto_update_model" || action === "auto_retrain") {
    throw new Error(
      "SELF_CORRECTION: auto model mutation forbidden — observe→evaluate→diagnose→propose→validate→approve",
    );
  }
}
