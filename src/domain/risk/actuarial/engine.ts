/**
 * Actuarial Risk Engine V1 — stake from risk factors, never from future outcomes.
 */

import type { AssessmentReport } from "@/domain/evidence/types";
import {
  computePolicyStake,
  type BankrollState,
  type PolicyStakeResult,
} from "@/domain/risk/bankroll/policies";
import type { Exp016Config } from "@/domain/eval/bankroll/exp016-config";

export type ActuarialRiskInputs = {
  assessment: AssessmentReport;
  probability: number;
  odds: number;
  edge: number | null;
  bankrollState: BankrollState;
  sizing: Exp016Config["sizing"];
  dataQuality: {
    featurePresent: number;
    featureMissing: number;
    marketCount: number;
    temporalUnknown: boolean;
  };
  marketDisagreement: number | null;
  sampleSize: number;
  sourceReliability: null;
};

export type RiskAssessment = {
  riskClass: "low" | "moderate" | "high" | "extreme";
  rawKelly: number;
  fractionalKelly: number;
  cappedKelly: number;
  maximumAllowedStake: number;
  recommendedExposure: number;
  ruinRisk: number;
  drawdownRisk: number;
  correlationRisk: number;
  uncertaintyPenalty: number;
  finalStake: number;
  noPosition: boolean;
  reason: string;
  policyResult: PolicyStakeResult;
};

function uncertaintyPenalty(input: ActuarialRiskInputs): number {
  let p = 1;
  if (input.dataQuality.temporalUnknown) p *= 0.7;
  if (input.dataQuality.featureMissing > input.dataQuality.featurePresent) p *= 0.8;
  if (input.dataQuality.marketCount < 3) p *= 0.85;
  if ((input.marketDisagreement ?? 0) > 0.08) p *= 0.75;
  if (input.sampleSize < 30) p *= 0.7;
  if (input.assessment.evidenceStrength === "weak") p *= 0.8;
  if (input.assessment.evidenceStrength === "insufficient") p *= 0.2;
  if (input.assessment.evidenceGraph.contradicting.length >
    input.assessment.evidenceGraph.supporting.length) {
    p *= 0.7;
  }
  // sourceReliability always null — no invented boost
  void input.sourceReliability;
  return Math.max(0, Math.min(1, p));
}

function riskClassFrom(penalty: number, dd: number, ruin: number): RiskAssessment["riskClass"] {
  if (ruin > 0.5 || dd > 0.4 || penalty < 0.35) return "extreme";
  if (ruin > 0.25 || dd > 0.25 || penalty < 0.55) return "high";
  if (penalty < 0.8 || dd > 0.1) return "moderate";
  return "low";
}

export function evaluateActuarialRisk(input: ActuarialRiskInputs): RiskAssessment {
  const penalty = uncertaintyPenalty(input);
  const ruinRisk = Math.min(
    1,
    input.bankrollState.drawdown * 0.5 +
      (1 - penalty) * 0.4 +
      (input.bankrollState.bankroll < 200 ? 0.3 : 0),
  );
  const drawdownRisk = input.bankrollState.drawdown;
  const correlationRisk = Math.min(
    1,
    input.bankrollState.openClusterExposure /
      Math.max(1, input.bankrollState.bankroll * input.sizing.max_correlated_exposure),
  );

  const forceNo =
    ruinRisk > 0.85 ||
    input.assessment.evidenceStrength === "insufficient" ||
    penalty < 0.25;

  const policyResult = computePolicyStake({
    policy: "actuarial_v1",
    probability: input.probability,
    odds: input.odds,
    edge: input.edge,
    state: input.bankrollState,
    sizing: input.sizing,
    actuarialMultiplier: penalty,
    forceNoPosition: forceNo,
  });

  const capped = computePolicyStake({
    policy: "risk_capped_kelly",
    probability: input.probability,
    odds: input.odds,
    edge: input.edge,
    state: input.bankrollState,
    sizing: input.sizing,
  });

  return {
    riskClass: riskClassFrom(penalty, drawdownRisk, ruinRisk),
    rawKelly: policyResult.rawKelly,
    fractionalKelly: policyResult.fractionalKelly,
    cappedKelly: capped.stake,
    maximumAllowedStake:
      input.bankrollState.bankroll * input.sizing.max_stake_fraction_event,
    recommendedExposure: policyResult.stake,
    ruinRisk,
    drawdownRisk,
    correlationRisk,
    uncertaintyPenalty: penalty,
    finalStake: policyResult.stake,
    noPosition: policyResult.noPosition,
    reason: policyResult.reason,
    policyResult,
  };
}
