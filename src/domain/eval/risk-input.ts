/**
 * Future Actuarial Risk Engine input shape — risk_decision/stake always null in TASK 009.
 */

export type RiskDecisionInput = {
  event: string;
  market: string;
  selection: string;
  odds: number | null;
  model_probability: number | null;
  market_probability: number | null;
  probability_gap: number | null;
  uncertainty: number | null;
  sample_size: number | null;
  calibration: number | null;
  correlation_group: string | null;
  data_quality: Record<string, number | string> | null;
  risk_decision: null;
  stake: null;
};

export function buildRiskDecisionInputStub(input: {
  eventId: string;
  market: string;
  selection: string;
  odds?: number | null;
  modelProbability?: number | null;
  marketProbability?: number | null;
  probabilityGap?: number | null;
  sampleSize?: number | null;
  calibration?: number | null;
  correlationGroup?: string | null;
  dataQuality?: Record<string, number | string> | null;
}): RiskDecisionInput {
  return {
    event: input.eventId,
    market: input.market,
    selection: input.selection,
    odds: input.odds ?? null,
    model_probability: input.modelProbability ?? null,
    market_probability: input.marketProbability ?? null,
    probability_gap: input.probabilityGap ?? null,
    uncertainty: null,
    sample_size: input.sampleSize ?? null,
    calibration: input.calibration ?? null,
    correlation_group: input.correlationGroup ?? null,
    data_quality: input.dataQuality ?? null,
    risk_decision: null,
    stake: null,
  };
}
