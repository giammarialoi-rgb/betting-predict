/**
 * Market microstructure math — descriptive, not betting signals.
 */

import {
  computeOverround,
  decimalOddsToImpliedProbability,
} from "@/domain/odds/math";

export type MarketMicrostructureSnapshot = {
  bookmaker_disagreement: number | null;
  best_price: number | null;
  worst_price: number | null;
  median_price: number | null;
  mean_price: number | null;
  dispersion: number | null;
  overround: number | null;
  line_movement: number | null;
  bookmaker_agreement: number | null;
  bookmaker_divergence: number | null;
  opening_odds: number | null;
  closing_odds: number | null;
  movement: number | null;
  absolute_change: number | null;
  relative_change: number | null;
  implied_probability_change: number | null;
  overround_change: number | null;
};

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function computeMarketMicrostructure(input: {
  prices: readonly number[];
  openingOdds?: number | null;
  closingOdds?: number | null;
  openingOverround?: number | null;
  closingOverround?: number | null;
  /** Ternary/binary odds lists for overround when available. */
  marketOddsList?: readonly number[];
}): MarketMicrostructureSnapshot {
  const prices = [...input.prices].filter((p) => Number.isFinite(p) && p > 1);
  prices.sort((a, b) => a - b);
  const mean =
    prices.length === 0
      ? null
      : prices.reduce((a, b) => a + b, 0) / prices.length;
  let dispersion: number | null = null;
  if (mean !== null && prices.length >= 2) {
    const v =
      prices.reduce((a, b) => a + (b - mean) ** 2, 0) / prices.length;
    dispersion = Math.sqrt(v);
  }
  const best = prices.length ? prices[prices.length - 1]! : null;
  const worst = prices.length ? prices[0]! : null;
  const disagreement =
    best !== null && worst !== null ? best - worst : null;
  const agreement =
    mean !== null && dispersion !== null && mean > 0
      ? 1 - Math.min(1, dispersion / mean)
      : null;

  const opening = input.openingOdds ?? null;
  const closing = input.closingOdds ?? null;
  const movement =
    opening !== null && closing !== null ? closing - opening : null;
  const relative =
    opening !== null && closing !== null && opening !== 0
      ? (closing - opening) / opening
      : null;
  let impliedChange: number | null = null;
  if (opening !== null && closing !== null) {
    impliedChange =
      decimalOddsToImpliedProbability(closing) -
      decimalOddsToImpliedProbability(opening);
  }

  return {
    bookmaker_disagreement: disagreement,
    best_price: best,
    worst_price: worst,
    median_price: median(prices),
    mean_price: mean,
    dispersion,
    overround: input.marketOddsList
      ? computeOverround([...input.marketOddsList]).overround
      : null,
    line_movement: null,
    bookmaker_agreement: agreement,
    bookmaker_divergence: disagreement,
    opening_odds: opening,
    closing_odds: closing,
    movement,
    absolute_change: movement,
    relative_change: relative,
    implied_probability_change: impliedChange,
    overround_change:
      input.openingOverround != null && input.closingOverround != null
        ? input.closingOverround - input.openingOverround
        : null,
  };
}
