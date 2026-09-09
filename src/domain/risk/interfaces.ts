/**
 * Actuarial risk / bankroll interfaces — NO real staking in TASK 011.
 */

export type RiskEngine = {
  readonly kind: "RiskEngine";
  evaluate(input: unknown): { risk_decision: null; notes: string };
};

export type BankrollPolicy = {
  readonly kind: "BankrollPolicy";
  name: string;
};

export type StakeCalculator = {
  readonly kind: "StakeCalculator";
  /** Always null until TASK with approved staking. */
  calculate(): null;
};

export type ExposureCalculator = {
  readonly kind: "ExposureCalculator";
  calculate(): null;
};

export type CorrelationExposure = {
  readonly kind: "CorrelationExposure";
  group: string;
  estimated: null;
};

export type DrawdownCalculator = {
  readonly kind: "DrawdownCalculator";
  calculate(): null;
};

export function createRiskEngineStub(): RiskEngine {
  return {
    kind: "RiskEngine",
    evaluate: () => ({
      risk_decision: null,
      notes: "actuarial risk engine not implemented — foundation only",
    }),
  };
}

export function createStakeCalculatorStub(): StakeCalculator {
  return {
    kind: "StakeCalculator",
    calculate: () => null,
  };
}

/** Blind backtest contract for a future risk engine. */
export type BlindBankrollStep = {
  information_at: string;
  decision: unknown;
  hypothetical_stake: null;
  outcome_revealed_after_decision: true;
  bankroll_update: null;
};

export function assertStakeUnknownAtDecision(stake: null): void {
  if (stake !== null) {
    throw new Error("BANKROLL_BLIND: stake must be null until risk engine task");
  }
}

export const FORBIDDEN_STAKING_ALGORITHMS = [
  "martingale",
  "masaniello",
  "all-in",
] as const;

export function assertNotDefinitiveStaking(algo: string): void {
  if (
    (FORBIDDEN_STAKING_ALGORITHMS as readonly string[]).includes(algo) ||
    algo === "optimal_staking_declared"
  ) {
    throw new Error(
      `STAKING_GUARD: cannot declare ${algo} as definitive in TASK 011`,
    );
  }
}
