import { createHash } from "node:crypto";
import { kellyFraction } from "@/domain/risk/engine";
import type { StakeStrategy053 } from "@/domain/eval/bankroll-053/config";
import { VIRTUAL_BANKROLL_INITIAL_053 } from "@/domain/eval/bankroll-053/config";

export type StakeSizing053 = {
  strategy: StakeStrategy053;
  stake: number;
  reason: string;
  /** Kelly full fraction before scale (0 if N/A). */
  kelly_full: number;
  real_money: false;
  simulation_only: true;
};

/** Virtual stakes only — never real money. Kelly unused for qualification claims. */
export function computeStake053(input: {
  strategy: StakeStrategy053;
  bankroll: number;
  probability: number | null;
  odds: number | null;
  flat_unit?: number;
  percent?: number;
  kelly_fraction?: number;
  max_fraction?: number;
}): StakeSizing053 {
  const bankroll = Math.max(0, input.bankroll);
  const maxF = input.max_fraction ?? 0.05;
  const odds = input.odds != null && input.odds > 1 ? input.odds : null;
  const p = input.probability != null && input.probability > 0 && input.probability < 1 ? input.probability : null;
  const kellyFull = odds != null && p != null ? kellyFraction(p, odds) : 0;

  if (bankroll <= 0) {
    return {
      strategy: input.strategy,
      stake: 0,
      reason: "NO_BANKROLL",
      kelly_full: kellyFull,
      real_money: false,
      simulation_only: true,
    };
  }

  let stake = 0;
  let reason = "";

  if (input.strategy === "FLAT") {
    const unit = input.flat_unit ?? 0.01;
    stake = Math.min(VIRTUAL_BANKROLL_INITIAL_053 * unit, bankroll * maxF, bankroll);
    reason = `flat_unit=${unit}`;
  } else if (input.strategy === "PERCENT_BANKROLL") {
    const pct = input.percent ?? 0.01;
    stake = Math.min(bankroll * pct, bankroll * maxF, bankroll);
    reason = `percent=${pct}`;
  } else {
    // KELLY_FRACTIONAL — simulation only; not a scientific qualification claim
    const scale = input.kelly_fraction ?? 0.25;
    if (odds == null || p == null) {
      stake = 0;
      reason = "KELLY_NEEDS_P_AND_ODDS";
    } else {
      stake = Math.min(bankroll * Math.min(kellyFull * scale, maxF), bankroll);
      reason = stake <= 0 ? "KELLY_ZERO" : `kelly_frac=${scale}`;
    }
  }

  stake = Number(Math.max(0, stake).toFixed(4));
  return {
    strategy: input.strategy,
    stake,
    reason,
    kelly_full: kellyFull,
    real_money: false,
    simulation_only: true,
  };
}

export function settlePnL053(input: {
  stake: number;
  odds: number | null;
  outcome: "won" | "lost" | "push" | "void" | "UNSETTLED";
}): { pnl: number; result: "WON" | "LOST" | "PUSH" | "VOID" | "OPEN" } {
  if (input.outcome === "UNSETTLED") return { pnl: 0, result: "OPEN" };
  if (input.outcome === "void" || input.outcome === "push") {
    return { pnl: 0, result: input.outcome === "void" ? "VOID" : "PUSH" };
  }
  if (input.outcome === "lost") return { pnl: -input.stake, result: "LOST" };
  const odds = input.odds != null && input.odds > 1 ? input.odds : 1;
  return { pnl: Number((input.stake * (odds - 1)).toFixed(4)), result: "WON" };
}

export function ledgerId053(...parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 28);
}
