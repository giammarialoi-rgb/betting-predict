/**
 * Actuarial diagnostic metrics — not guarantees of future performance.
 */

export type YearPathPoint = {
  bankroll: number;
};

export type ActuarialMetrics = {
  method_notes: string;
  cagr: number | null;
  volatility: number;
  sharpe_like: number | null;
  sortino_like: number | null;
  max_drawdown: number;
  calmar_like: number | null;
  var_95_historical: number | null;
  cvar_95_historical: number | null;
  downside_deviation: number;
  risk_of_ruin: number;
};

/** Historical simulation VaR/CVaR on per-decision return series. */
export function computeActuarialMetrics(input: {
  initialBankroll: number;
  finalBankroll: number;
  years: number;
  decisionReturns: number[];
  bankrollPath: number[];
  ruinHits: number;
  decisions: number;
}): ActuarialMetrics {
  const rets = input.decisionReturns;
  const mean = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const variance = rets.length
    ? rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length
    : 0;
  const vol = Math.sqrt(variance);
  const downside = rets.filter((r) => r < 0);
  const downDev = downside.length
    ? Math.sqrt(downside.reduce((a, b) => a + b * b, 0) / downside.length)
    : 0;

  let peak = input.bankrollPath[0] ?? input.initialBankroll;
  let maxDd = 0;
  for (const b of input.bankrollPath) {
    peak = Math.max(peak, b);
    maxDd = Math.max(maxDd, peak > 0 ? (peak - b) / peak : 0);
  }

  const sorted = [...rets].sort((a, b) => a - b);
  let var95: number | null = null;
  let cvar95: number | null = null;
  if (sorted.length >= 5) {
    const idx = Math.floor(0.05 * sorted.length);
    var95 = sorted[Math.max(0, idx)]!;
    const tail = sorted.slice(0, Math.max(1, idx + 1));
    cvar95 = tail.reduce((a, b) => a + b, 0) / tail.length;
  }

  const years = Math.max(input.years, 1e-9);
  const cagr =
    input.initialBankroll > 0
      ? Math.pow(input.finalBankroll / input.initialBankroll, 1 / years) - 1
      : null;

  return {
    method_notes:
      "VaR/CVaR = historical simulation on per-decision returns (5% tail). Sharpe/Sortino/Calmar are diagnostic ratios on the same series — not investment advice.",
    cagr,
    volatility: vol,
    sharpe_like: vol > 0 ? mean / vol : null,
    sortino_like: downDev > 0 ? mean / downDev : null,
    max_drawdown: maxDd,
    calmar_like:
      maxDd > 0 && cagr != null ? cagr / maxDd : null,
    var_95_historical: var95,
    cvar_95_historical: cvar95,
    downside_deviation: downDev,
    risk_of_ruin: input.decisions ? input.ruinHits / input.decisions : 0,
  };
}

export function aggregateYearStats(finals: number[], initial: number) {
  if (finals.length === 0) {
    return {
      mean_final: null as number | null,
      median_final: null as number | null,
      geometric_return: null as number | null,
      annual_volatility: null as number | null,
      p_ruin: null as number | null,
      p_finish_above_initial: null as number | null,
      best_year: null as number | null,
      worst_year: null as number | null,
    };
  }
  const sorted = [...finals].sort((a, b) => a - b);
  const mean = finals.reduce((a, b) => a + b, 0) / finals.length;
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2
      ? sorted[mid]!
      : (sorted[mid - 1]! + sorted[mid]!) / 2;
  const logs = finals.map((f) => Math.log(Math.max(f, 1e-9) / initial));
  const geo =
    Math.exp(logs.reduce((a, b) => a + b, 0) / logs.length) - 1;
  const meanLog = logs.reduce((a, b) => a + b, 0) / logs.length;
  const vol = Math.sqrt(
    logs.reduce((a, b) => a + (b - meanLog) ** 2, 0) / logs.length,
  );
  const ruinFloor = initial * 0.05;
  return {
    mean_final: mean,
    median_final: median,
    geometric_return: geo,
    annual_volatility: vol,
    p_ruin: finals.filter((f) => f <= ruinFloor).length / finals.length,
    p_finish_above_initial:
      finals.filter((f) => f > initial).length / finals.length,
    best_year: sorted[sorted.length - 1]!,
    worst_year: sorted[0]!,
  };
}
