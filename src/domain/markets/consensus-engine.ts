/**
 * De-vig / consensus engine — market math, not truth.
 */

import {
  computeOverround,
  decimalOddsToImpliedProbability,
  normalizeMarketProbabilities,
} from "@/domain/odds/math";

export type DevigMethod = "proportional" | "shin" | "power" | "odds_ratio";

export type DevigResult = {
  method: DevigMethod;
  input_odds: number[];
  raw_implied: number[];
  overround: number;
  output_probabilities: number[];
  /** Non-proportional methods may be unimplemented. */
  status: "COMPUTED" | "NOT_IMPLEMENTED";
};

export function rawImpliedFromOdds(odds: number): number {
  return decimalOddsToImpliedProbability(odds);
}

export function deVigProportional(oddsList: readonly number[]): DevigResult {
  const { rawImpliedProbabilities, overround } = computeOverround(oddsList);
  return {
    method: "proportional",
    input_odds: [...oddsList],
    raw_implied: [...rawImpliedProbabilities],
    overround,
    output_probabilities: normalizeMarketProbabilities(oddsList),
    status: "COMPUTED",
  };
}

/**
 * Shin (1993) iterative z — returns COMPUTED only when probs sum to ~1.
 */
export function deVigShin(oddsList: readonly number[]): DevigResult {
  const { rawImpliedProbabilities, overround } = computeOverround(oddsList);
  const pi = [...rawImpliedProbabilities];
  if (pi.length < 2 || pi.some((p) => !(p > 0))) {
    return {
      method: "shin",
      input_odds: [...oddsList],
      raw_implied: pi,
      overround,
      output_probabilities: [],
      status: "NOT_IMPLEMENTED",
    };
  }

  const shinProb = (z: number, p: number): number => {
    if (z <= 1e-12) return p / pi.reduce((a, b) => a + b, 0);
    const denom = 2 * (1 - z);
    return (Math.sqrt(z * z + 4 * (1 - z) * p * p) - z) / denom;
  };

  const sumAt = (z: number) => pi.reduce((s, p) => s + shinProb(z, p), 0);

  let lo = 0;
  let hi = 1 - 1e-9;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (sumAt(mid) > 1) lo = mid;
    else hi = mid;
  }
  const z = (lo + hi) / 2;
  const output = pi.map((p) => shinProb(z, p));
  const sum = output.reduce((a, b) => a + b, 0);
  const ok =
    Number.isFinite(sum) &&
    Math.abs(sum - 1) < 1e-6 &&
    output.every((p) => p > 0 && p < 1);

  return {
    method: "shin",
    input_odds: [...oddsList],
    raw_implied: pi,
    overround,
    output_probabilities: ok ? output : [],
    status: ok ? "COMPUTED" : "NOT_IMPLEMENTED",
  };
}

/**
 * Power method: find τ such that Σ π_i^τ = 1, then p_i ∝ π_i^τ.
 * Returns COMPUTED only when normalized probs sum to ~1 and are positive.
 */
export function deVigPower(oddsList: readonly number[]): DevigResult {
  const { rawImpliedProbabilities, overround } = computeOverround(oddsList);
  const pi = [...rawImpliedProbabilities];
  if (pi.length < 2 || pi.some((p) => !(p > 0))) {
    return {
      method: "power",
      input_odds: [...oddsList],
      raw_implied: pi,
      overround,
      output_probabilities: [],
      status: "NOT_IMPLEMENTED",
    };
  }

  const sumPow = (tau: number) => pi.reduce((s, p) => s + p ** tau, 0);

  // At τ=1, sum = overround+1 typically > 1; increase τ until sum≈1.
  let lo = 1;
  let hi = 10;
  if (sumPow(1) <= 1) {
    // Already underround-ish — fall back to proportional
    return {
      ...deVigProportional(oddsList),
      method: "power",
    };
  }
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (sumPow(mid) > 1) lo = mid;
    else hi = mid;
  }
  const tau = (lo + hi) / 2;
  const powered = pi.map((p) => p ** tau);
  const s = powered.reduce((a, b) => a + b, 0);
  const output = powered.map((p) => p / s);
  const ok =
    Number.isFinite(s) &&
    Math.abs(output.reduce((a, b) => a + b, 0) - 1) < 1e-6 &&
    output.every((p) => p > 0 && p < 1);

  return {
    method: "power",
    input_odds: [...oddsList],
    raw_implied: pi,
    overround,
    output_probabilities: ok ? output : [],
    status: ok ? "COMPUTED" : "NOT_IMPLEMENTED",
  };
}

export function deVig(
  oddsList: readonly number[],
  method: DevigMethod = "proportional",
): DevigResult {
  if (method === "proportional") return deVigProportional(oddsList);
  if (method === "shin") return deVigShin(oddsList);
  if (method === "power") return deVigPower(oddsList);
  const { rawImpliedProbabilities, overround } = computeOverround(oddsList);
  return {
    method,
    input_odds: [...oddsList],
    raw_implied: [...rawImpliedProbabilities],
    overround,
    output_probabilities: [],
    status: "NOT_IMPLEMENTED",
  };
}

/** Compare methods — disagreement is diagnostic, not truth. */
export function deVigMethodDisagreement(oddsList: readonly number[]): {
  methods: DevigResult[];
  max_abs_diff: number | null;
  label: "MARKET_ESTIMATE";
} {
  const methods = [
    deVigProportional(oddsList),
    deVigShin(oddsList),
    deVigPower(oddsList),
  ].filter((m) => m.status === "COMPUTED");
  let maxDiff: number | null = null;
  if (methods.length >= 2) {
    maxDiff = 0;
    const base = methods[0]!.output_probabilities;
    for (const m of methods.slice(1)) {
      for (let i = 0; i < base.length; i++) {
        const d = Math.abs(base[i]! - (m.output_probabilities[i] ?? 0));
        maxDiff = Math.max(maxDiff, d);
      }
    }
  }
  return { methods, max_abs_diff: maxDiff, label: "MARKET_ESTIMATE" };
}

export type CrossBookAnalysis = {
  marketType: string;
  line: number | null;
  selection: string;
  min_odds: number | null;
  max_odds: number | null;
  mean: number | null;
  median: number | null;
  stddev: number | null;
  range: number | null;
  consensus_probability: number | null;
  disagreement: number | null;
  number_of_bookmakers: number;
  outlier_bookmakers: string[];
};

function median(sorted: number[]): number | null {
  if (!sorted.length) return null;
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[m - 1]! + sorted[m]!) / 2
    : sorted[m]!;
}

export function analyzeCrossBookmaker(input: {
  marketType: string;
  line: number | null;
  selection: string;
  quotes: ReadonlyArray<{ bookmakerSlug: string; oddsDecimal: number }>;
}): CrossBookAnalysis {
  const prices = input.quotes
    .map((q) => q.oddsDecimal)
    .filter((o) => Number.isFinite(o) && o > 1)
    .sort((a, b) => a - b);
  const n = prices.length;
  if (n === 0) {
    return {
      marketType: input.marketType,
      line: input.line,
      selection: input.selection,
      min_odds: null,
      max_odds: null,
      mean: null,
      median: null,
      stddev: null,
      range: null,
      consensus_probability: null,
      disagreement: null,
      number_of_bookmakers: 0,
      outlier_bookmakers: [],
    };
  }
  const mean = prices.reduce((a, b) => a + b, 0) / n;
  const stddev = Math.sqrt(
    prices.reduce((a, b) => a + (b - mean) ** 2, 0) / n,
  );
  const min = prices[0]!;
  const max = prices[n - 1]!;
  const consensus_probability =
    prices
      .map((o) => decimalOddsToImpliedProbability(o))
      .reduce((a, b) => a + b, 0) / n;

  const outliers: string[] = [];
  if (n >= 3 && stddev > 0) {
    for (const q of input.quotes) {
      if (Math.abs(q.oddsDecimal - mean) > 2 * stddev) {
        outliers.push(q.bookmakerSlug);
      }
    }
  }

  return {
    marketType: input.marketType,
    line: input.line,
    selection: input.selection,
    min_odds: min,
    max_odds: max,
    mean,
    median: median(prices),
    stddev,
    range: max - min,
    consensus_probability,
    disagreement: max - min,
    number_of_bookmakers: new Set(input.quotes.map((q) => q.bookmakerSlug)).size,
    outlier_bookmakers: outliers,
  };
}

export type MarketConsensusSnapshot = {
  bookmakerSlug: string;
  selections: string[];
  odds: number[];
  overround: number;
  deVig: DevigResult;
};

export function buildBookConsensus(input: {
  bookmakerSlug: string;
  selections: string[];
  odds: number[];
  method?: DevigMethod;
}): MarketConsensusSnapshot {
  return {
    bookmakerSlug: input.bookmakerSlug,
    selections: input.selections,
    odds: input.odds,
    overround: computeOverround(input.odds).overround,
    deVig: deVig(input.odds, input.method ?? "proportional"),
  };
}
