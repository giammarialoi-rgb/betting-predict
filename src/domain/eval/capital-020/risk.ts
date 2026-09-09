/**
 * Actuarial allocation: signal strength ≠ capital size.
 */

import { computePolicyStake, type RiskPolicyId } from "@/domain/risk/bankroll/policies";
import type { Exp016Config } from "@/domain/eval/bankroll/exp016-config";
import { conservativeSameEventCap } from "@/domain/eval/capital-020/correlation";

export type SignalStrength = {
  edge: number | null;
  uncertainty: number;
  calibration_ok: boolean;
};

export function signalStrength(input: {
  p: number;
  odds: number;
  trainN: number;
  declaredEdge: boolean;
}): SignalStrength {
  const implied = 1 / input.odds;
  const edge = input.declaredEdge ? input.p - implied : null;
  const uncertainty = Math.min(1, input.trainN / 500);
  return {
    edge,
    uncertainty,
    calibration_ok: false,
  };
}

export function allocateCapital(input: {
  policy: RiskPolicyId;
  bankroll: number;
  p: number;
  odds: number;
  signal: SignalStrength;
  sizing: Exp016Config["sizing"];
  openSameEventExposure: number;
  forceNo: boolean;
}): { stake: number; reason: string; policy: RiskPolicyId } {
  if (input.forceNo || input.bankroll <= 0) {
    return { stake: 0, reason: "NO_POSITION", policy: input.policy };
  }
  if (input.signal.edge == null) {
    return { stake: 0, reason: "NO_BET_MODEL: declared_edge=false", policy: input.policy };
  }
  const actuarialMultiplier =
    input.signal.uncertainty * (input.signal.calibration_ok ? 1 : 0.25);
  const raw = computePolicyStake({
    policy: input.policy,
    probability: input.p,
    odds: input.odds,
    edge: input.signal.edge,
    state: {
      bankroll: input.bankroll,
      peak: input.bankroll,
      drawdown: 0,
      dayExposure: 0,
      matchExposure: input.openSameEventExposure,
      openClusterExposure: input.openSameEventExposure,
      masanielloWins: 0,
      masanielloBetsInCycle: 0,
      remainingEventsHint: 10,
    },
    sizing: input.sizing,
    actuarialMultiplier,
    forceNoPosition: input.forceNo,
  });
  const capped = conservativeSameEventCap({
    bankroll: input.bankroll,
    maxClusterFraction: input.sizing.max_correlated_exposure,
    openSameEventExposure: input.openSameEventExposure,
    proposed: raw.stake,
  });
  return {
    stake: Math.max(0, Math.min(capped.stake, input.bankroll)),
    reason: raw.noPosition ? raw.reason : capped.reason,
    policy: input.policy,
  };
}

export function settleBankroll(
  bankroll: number,
  stake: number,
  pnl: number,
): number {
  const next = bankroll + pnl;
  if (next < 0) return 0;
  return next;
}
