/**
 * RiskInput — actuarial risk engine prep (no staking).
 */

import type { RiskDecisionInput } from "@/domain/eval/risk-input";

export type RiskInput = {
  event: string;
  market: string;
  selection: string;
  odds: number | null;
  model_probability: number | null;
  market_probability: number | null;
  calibration: number | null;
  sample_size: number | null;
  uncertainty: number | null;
  correlation_group: string | null;
  temporal_quality: string | null;
  model_version: string | null;
  experiment_version: string | null;
  /** Always null in TASK 010. */
  risk_decision: null;
  stake: null;
};

export function buildRiskInput(input: {
  eventId: string;
  market: string;
  selection: string;
  odds?: number | null;
  modelProbability?: number | null;
  marketProbability?: number | null;
  calibration?: number | null;
  sampleSize?: number | null;
  uncertainty?: number | null;
  correlationGroup?: string | null;
  temporalQuality?: string | null;
  modelVersion?: string | null;
  experimentVersion?: string | null;
}): RiskInput {
  return {
    event: input.eventId,
    market: input.market,
    selection: input.selection,
    odds: input.odds ?? null,
    model_probability: input.modelProbability ?? null,
    market_probability: input.marketProbability ?? null,
    calibration: input.calibration ?? null,
    sample_size: input.sampleSize ?? null,
    uncertainty: input.uncertainty ?? null,
    correlation_group: input.correlationGroup ?? null,
    temporal_quality: input.temporalQuality ?? null,
    model_version: input.modelVersion ?? null,
    experiment_version: input.experimentVersion ?? null,
    risk_decision: null,
    stake: null,
  };
}

export function toRiskDecisionInputStub(risk: RiskInput): RiskDecisionInput {
  return {
    event: risk.event,
    market: risk.market,
    selection: risk.selection,
    odds: risk.odds,
    model_probability: risk.model_probability,
    market_probability: risk.market_probability,
    probability_gap:
      risk.model_probability != null && risk.market_probability != null
        ? risk.model_probability - risk.market_probability
        : null,
    uncertainty: risk.uncertainty,
    sample_size: risk.sample_size,
    calibration: risk.calibration,
    correlation_group: risk.correlation_group,
    data_quality: risk.temporal_quality
      ? { temporal_quality: risk.temporal_quality }
      : null,
    risk_decision: null,
    stake: null,
  };
}
