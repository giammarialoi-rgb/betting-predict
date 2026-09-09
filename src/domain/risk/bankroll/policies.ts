/**
 * Risk policies — Flat, Fractional Kelly, Risk-Capped Kelly, Masaniello challenger.
 * Reuses kellyFraction from risk/engine.ts.
 */

import { kellyFraction } from "@/domain/risk/engine";
import type { Exp016Config } from "@/domain/eval/bankroll/exp016-config";

export type RiskPolicyId =
  | "flat"
  | "fractional_kelly"
  | "risk_capped_kelly"
  | "actuarial_v1"
  | "masaniello_challenger";

export type BankrollState = {
  bankroll: number;
  peak: number;
  drawdown: number;
  dayExposure: number;
  matchExposure: number;
  openClusterExposure: number;
  masanielloWins: number;
  masanielloBetsInCycle: number;
  remainingEventsHint: number;
};

export type PolicyStakeInput = {
  policy: RiskPolicyId;
  probability: number;
  odds: number;
  edge: number | null;
  state: BankrollState;
  sizing: Exp016Config["sizing"];
  /** Extra actuarial multiplier in [0,1]; 1 = no penalty. */
  actuarialMultiplier?: number;
  forceNoPosition?: boolean;
};

export type PolicyStakeResult = {
  policy: RiskPolicyId;
  rawKelly: number;
  fractionalKelly: number;
  stake: number;
  noPosition: boolean;
  reason: string;
};

function floorOk(state: BankrollState, sizing: Exp016Config["sizing"]): boolean {
  return state.bankroll >= sizing.bankroll_floor_fraction * 1000;
}

function drawdownScale(state: BankrollState, sizing: Exp016Config["sizing"]): number {
  if (state.drawdown >= sizing.drawdown_reduction_start) {
    return sizing.drawdown_reduction_factor;
  }
  return 1;
}

export function computePolicyStake(input: PolicyStakeInput): PolicyStakeResult {
  const { policy, probability, odds, state, sizing } = input;
  const rawKelly = kellyFraction(probability, odds);
  const fractionalKelly = rawKelly * sizing.kelly_fractional_factor;
  const dd = drawdownScale(state, sizing);

  if (input.forceNoPosition || !floorOk(state, sizing) || state.bankroll <= 0) {
    return {
      policy,
      rawKelly,
      fractionalKelly,
      stake: 0,
      noPosition: true,
      reason: "NO_POSITION: bankroll_floor_or_forced",
    };
  }

  if (policy === "flat") {
    const stake =
      Math.min(state.bankroll * sizing.flat_unit, state.bankroll * sizing.max_stake_fraction_event) *
      dd;
    return {
      policy,
      rawKelly,
      fractionalKelly,
      stake: Math.max(0, Math.min(stake, state.bankroll)),
      noPosition: stake <= 0,
      reason: stake <= 0 ? "NO_POSITION" : "flat_unit",
    };
  }

  if (policy === "fractional_kelly") {
    const frac = Math.min(fractionalKelly, sizing.max_stake_fraction_event);
    const stake = state.bankroll * frac * dd;
    return {
      policy,
      rawKelly,
      fractionalKelly,
      stake: Math.max(0, Math.min(stake, state.bankroll)),
      noPosition: stake <= 1e-12,
      reason: stake <= 1e-12 ? "NO_POSITION: zero_kelly" : "fractional_kelly",
    };
  }

  if (policy === "risk_capped_kelly" || policy === "actuarial_v1") {
    const kellyStake = state.bankroll * fractionalKelly;
    const eventCap = state.bankroll * sizing.max_stake_fraction_event;
    const marketCap = state.bankroll * sizing.max_stake_fraction_market;
    const matchRoom = Math.max(
      0,
      state.bankroll * sizing.max_exposure_per_match - state.matchExposure,
    );
    const corrRoom = Math.max(
      0,
      state.bankroll * sizing.max_correlated_exposure - state.openClusterExposure,
    );
    const dayRoom = Math.max(
      0,
      state.bankroll * sizing.max_daily_exposure - state.dayExposure,
    );
    let stake = Math.min(kellyStake, eventCap, marketCap, matchRoom, corrRoom, dayRoom);
    stake *= dd;
    if (policy === "actuarial_v1") {
      stake *= input.actuarialMultiplier ?? 1;
    }
    stake = Math.max(0, Math.min(stake, state.bankroll));
    return {
      policy,
      rawKelly,
      fractionalKelly,
      stake,
      noPosition: stake <= 1e-12,
      reason:
        stake <= 1e-12
          ? "NO_POSITION: caps_or_kelly_zero"
          : policy === "actuarial_v1"
            ? "actuarial_capped_kelly"
            : "risk_capped_kelly",
    };
  }

  // Masaniello challenger — simplified cycle, NOT declared optimal
  const cycle = sizing.masaniello_cycle_length;
  const targetHits = sizing.masaniello_target_hits_per_cycle;
  const betsLeft = Math.max(1, cycle - state.masanielloBetsInCycle);
  const hitsNeeded = Math.max(0, targetHits - state.masanielloWins);
  if (hitsNeeded === 0 || odds <= 1) {
    return {
      policy,
      rawKelly,
      fractionalKelly,
      stake: 0,
      noPosition: true,
      reason: "NO_POSITION: masaniello_cycle_complete_or_bad_odds",
    };
  }
  // Simplified: allocate so that hitsNeeded wins at these odds approach a modest target increment
  const unit = (state.bankroll * sizing.masaniello_safety * hitsNeeded) / (betsLeft * (odds - 1));
  const stake = Math.min(
    unit,
    state.bankroll * sizing.max_stake_fraction_event,
    state.bankroll,
  ) * dd;
  return {
    policy,
    rawKelly,
    fractionalKelly,
    stake: Math.max(0, stake),
    noPosition: stake <= 1e-12,
    reason: "masaniello_challenger_simplified",
  };
}
