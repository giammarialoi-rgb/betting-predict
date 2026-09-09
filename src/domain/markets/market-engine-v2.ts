/**
 * Market Engine V2 — consensus, movement, cross-book, model vs market.
 */

import {
  analyzeCrossBookmaker,
  deVig,
  deVigProportional,
  type DevigMethod,
} from "@/domain/markets/consensus-engine";
import { MarketMicrostructureEngine } from "@/domain/markets/microstructure-engine";
import { decimalOddsToImpliedProbability } from "@/domain/odds/math";

export type ModelVsMarket = {
  P_model: number;
  P_market: number;
  P_market_devig: number | null;
  difference: number;
  edge_candidate: number;
  /** Always blocked from VALIDATED without gates. */
  validated_edge: false;
};

export function compareModelVsMarket(input: {
  modelProbability: number;
  marketOdds: number;
  marketOddsList?: readonly number[];
  selectionIndex?: number;
  devigMethod?: DevigMethod;
}): ModelVsMarket {
  const P_market = decimalOddsToImpliedProbability(input.marketOdds);
  let P_market_devig: number | null = null;
  if (input.marketOddsList && input.marketOddsList.length >= 2) {
    const d = deVig(input.marketOddsList, input.devigMethod ?? "proportional");
    if (d.status === "COMPUTED") {
      const idx = input.selectionIndex ?? 0;
      P_market_devig = d.output_probabilities[idx] ?? null;
    }
  }
  const difference = input.modelProbability - P_market;
  return {
    P_model: input.modelProbability,
    P_market,
    P_market_devig,
    difference,
    edge_candidate: difference,
    validated_edge: false,
  };
}

export class MarketEngineV2 {
  consensus(quotes: ReadonlyArray<{ bookmakerSlug: string; oddsDecimal: number }>) {
    const analysis = analyzeCrossBookmaker({
      marketType: "generic",
      line: null,
      selection: "SEL",
      quotes,
    });
    const prices = quotes.map((q) => q.oddsDecimal).sort((a, b) => a - b);
    const mean = analysis.mean;
    // Equal-weight consensus; no invented reliability weights.
    const weighted_consensus = mean;
    return {
      mean: analysis.mean,
      median: analysis.median,
      weighted_consensus,
      dispersion: analysis.stddev,
      disagreement: analysis.disagreement,
      number_of_bookmakers: analysis.number_of_bookmakers,
      outlier_bookmakers: analysis.outlier_bookmakers,
      prices,
    };
  }

  movement(input: {
    observations: Parameters<MarketMicrostructureEngine["analyze"]>[0]["observations"];
    asOf: Date;
    scheduledStartAt: Date;
  }) {
    return new MarketMicrostructureEngine().analyze({
      ...input,
      requireExactPrecision: false,
    });
  }

  deVigProportional(odds: readonly number[]) {
    return deVigProportional(odds);
  }

  compare = compareModelVsMarket;
}
