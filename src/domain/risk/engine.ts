/**
 * Risk engine — hypothetical stakes only. Never real money.
 * Strategies: Flat, Fractional Kelly, Risk-Capped Kelly. Masaniello = challenger only.
 */

export type RiskDecisionInputV2 = {
  bankroll: number;
  estimated_probability: number;
  odds: number;
  edge: number;
  variance: number | null;
  correlation: number | null;
  max_exposure: number;
  max_drawdown: number | null;
  risk_of_ruin: number | null;
};

export type StakeStrategy =
  | "flat"
  | "fractional_kelly"
  | "risk_capped_kelly"
  | "masaniello_challenger";

export type HypotheticalStake = {
  strategy: StakeStrategy;
  stake: number;
  /** Explicit: simulation only. */
  real_money: false;
};

export function kellyFraction(p: number, odds: number): number {
  // f* = (bp - q) / b where b = odds-1, q = 1-p
  const b = odds - 1;
  if (b <= 0) return 0;
  const q = 1 - p;
  const f = (b * p - q) / b;
  return Math.max(0, f);
}

export function computeHypotheticalStake(input: {
  strategy: StakeStrategy;
  bankroll: number;
  probability: number;
  odds: number;
  flatUnit?: number;
  kellyFractionScale?: number;
  maxExposure?: number;
}): HypotheticalStake {
  const maxExp = input.maxExposure ?? 0.05;
  let stake = 0;
  if (input.strategy === "flat") {
    stake = Math.min(input.bankroll * (input.flatUnit ?? 0.01), input.bankroll * maxExp);
  } else if (input.strategy === "fractional_kelly") {
    const full = kellyFraction(input.probability, input.odds);
    const scale = input.kellyFractionScale ?? 0.25;
    stake = input.bankroll * Math.min(full * scale, maxExp);
  } else if (input.strategy === "risk_capped_kelly") {
    const full = kellyFraction(input.probability, input.odds);
    const scale = input.kellyFractionScale ?? 0.25;
    stake = input.bankroll * Math.min(full * scale, maxExp * 0.5);
  } else {
    // masaniello_challenger — not implemented as default; stake 0
    stake = 0;
  }
  return {
    strategy: input.strategy,
    stake: Math.max(0, Math.min(stake, input.bankroll)),
    real_money: false,
  };
}

export type BankrollReplayStep = {
  information_at: string;
  model_probability: number;
  market_odds: number;
  decision_selection: string;
  stake: HypotheticalStake;
  /** Filled only after lock. */
  outcome_revealed: boolean;
  won: boolean | null;
  bankroll_after: number | null;
};

export type BankrollReplayResult = {
  strategy: StakeStrategy;
  starting_bankroll: number;
  ending_bankroll: number;
  max_drawdown: number;
  volatility: number;
  risk_of_ruin_proxy: number;
  number_of_decisions: number;
  /** Never claim optimality. */
  declared_best: false;
};

/**
 * Blind bankroll replay: stakes computed before outcome reveal.
 */
export function runBankrollReplay(input: {
  strategy: StakeStrategy;
  startingBankroll: number;
  decisions: ReadonlyArray<{
    asOf: string;
    modelProbability: number;
    odds: number;
    selection: string;
    /** Outcome known only after stake — passed separately for evaluation. */
    won: boolean;
  }>;
  flatUnit?: number;
  kellyFractionScale?: number;
  maxExposure?: number;
}): BankrollReplayResult {
  let bankroll = input.startingBankroll;
  let peak = bankroll;
  let maxDd = 0;
  const returns: number[] = [];
  let ruinHits = 0;

  for (const d of input.decisions) {
    const stake = computeHypotheticalStake({
      strategy: input.strategy,
      bankroll,
      probability: d.modelProbability,
      odds: d.odds,
      flatUnit: input.flatUnit,
      kellyFractionScale: input.kellyFractionScale,
      maxExposure: input.maxExposure,
    });
    // Outcome reveal AFTER stake
    const before = bankroll;
    if (d.won) {
      bankroll += stake.stake * (d.odds - 1);
    } else {
      bankroll -= stake.stake;
    }
    if (bankroll < input.startingBankroll * 0.05) ruinHits += 1;
    peak = Math.max(peak, bankroll);
    maxDd = Math.max(maxDd, peak > 0 ? (peak - bankroll) / peak : 0);
    returns.push(before > 0 ? (bankroll - before) / before : 0);
  }

  const mean =
    returns.length === 0
      ? 0
      : returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.length === 0
      ? 0
      : returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;

  return {
    strategy: input.strategy,
    starting_bankroll: input.startingBankroll,
    ending_bankroll: bankroll,
    max_drawdown: maxDd,
    volatility: Math.sqrt(variance),
    risk_of_ruin_proxy: input.decisions.length
      ? ruinHits / input.decisions.length
      : 0,
    number_of_decisions: input.decisions.length,
    declared_best: false,
  };
}

export type ActuarialComparison = {
  strategies: BankrollReplayResult[];
  metrics: Array<{
    strategy: StakeStrategy;
    ending_bankroll: number;
    max_drawdown: number;
    volatility: number;
    risk_of_ruin_proxy: number;
  }>;
  /** Explicit: no winner declared. */
  winner: null;
};

export function compareBankrollStrategies(
  results: readonly BankrollReplayResult[],
): ActuarialComparison {
  return {
    strategies: [...results],
    metrics: results.map((r) => ({
      strategy: r.strategy,
      ending_bankroll: r.ending_bankroll,
      max_drawdown: r.max_drawdown,
      volatility: r.volatility,
      risk_of_ruin_proxy: r.risk_of_ruin_proxy,
    })),
    winner: null,
  };
}
