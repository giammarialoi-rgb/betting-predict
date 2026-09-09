import {
  computeOverround,
  decimalOddsToImpliedProbability,
  impliedProbabilityToDecimalOdds,
  marketMovement,
  normalizeMarketProbabilities,
  type MarketMovement,
  type SelectionSide,
} from "@/domain/odds/math";

export type OneXTwoOdds = {
  home: number;
  draw: number;
  away: number;
};

export type OneXTwoProbabilities = {
  home: number;
  draw: number;
  away: number;
};

export type BookmakerMarketView = {
  bookmakerSlug: string;
  odds: OneXTwoOdds;
  implied: OneXTwoProbabilities;
  overround: number;
  fair: OneXTwoProbabilities;
  fairOdds: OneXTwoOdds;
};

/**
 * MarketBaseline V1 — arithmetic transforms of quoted odds.
 * Not a prediction. Not a sharp-bookmaker consensus.
 * Consensus = simple arithmetic mean across bookmakers (equal weight).
 */
export type MarketBaseline = {
  bookmakers: BookmakerMarketView[];
  consensusImplied: OneXTwoProbabilities;
  consensusFair: OneXTwoProbabilities;
  disagreement: {
    home: { min: number; max: number; mean: number };
    draw: { min: number; max: number; mean: number };
    away: { min: number; max: number; mean: number };
  };
  method: "equal_weight_arithmetic_mean_v1";
};

export function buildBookmakerMarketView(
  bookmakerSlug: string,
  odds: OneXTwoOdds,
): BookmakerMarketView {
  const list = [odds.home, odds.draw, odds.away];
  const { rawImpliedProbabilities, overround } = computeOverround(list);
  const fairList = normalizeMarketProbabilities(list);
  const implied = {
    home: rawImpliedProbabilities[0]!,
    draw: rawImpliedProbabilities[1]!,
    away: rawImpliedProbabilities[2]!,
  };
  const fair = {
    home: fairList[0]!,
    draw: fairList[1]!,
    away: fairList[2]!,
  };
  return {
    bookmakerSlug,
    odds,
    implied,
    overround,
    fair,
    fairOdds: {
      home: impliedProbabilityToDecimalOdds(fair.home),
      draw: impliedProbabilityToDecimalOdds(fair.draw),
      away: impliedProbabilityToDecimalOdds(fair.away),
    },
  };
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function disagreementOn(
  values: number[],
): { min: number; max: number; mean: number } {
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    mean: mean(values),
  };
}

export function buildMarketBaseline(
  inputs: ReadonlyArray<{ bookmakerSlug: string; odds: OneXTwoOdds }>,
): MarketBaseline {
  if (inputs.length === 0) {
    throw new RangeError("MarketBaseline requires at least one bookmaker");
  }
  const bookmakers = inputs.map((item) =>
    buildBookmakerMarketView(item.bookmakerSlug, item.odds),
  );
  const consensusImplied = {
    home: mean(bookmakers.map((b) => b.implied.home)),
    draw: mean(bookmakers.map((b) => b.implied.draw)),
    away: mean(bookmakers.map((b) => b.implied.away)),
  };
  const consensusFair = {
    home: mean(bookmakers.map((b) => b.fair.home)),
    draw: mean(bookmakers.map((b) => b.fair.draw)),
    away: mean(bookmakers.map((b) => b.fair.away)),
  };
  return {
    bookmakers,
    consensusImplied,
    consensusFair,
    disagreement: {
      home: disagreementOn(bookmakers.map((b) => b.odds.home)),
      draw: disagreementOn(bookmakers.map((b) => b.odds.draw)),
      away: disagreementOn(bookmakers.map((b) => b.odds.away)),
    },
    method: "equal_weight_arithmetic_mean_v1",
  };
}

export type OpenCloseMovement = {
  selection: SelectionSide;
  fromOdds: number;
  toOdds: number;
  movement: MarketMovement;
  fairProbabilityDelta: number;
};

/**
 * OPEN → CLOSE mathematical movement. No causal interpretation.
 */
export function openCloseMovement(
  open: OneXTwoOdds,
  close: OneXTwoOdds,
): OpenCloseMovement[] {
  const pairs: Array<[SelectionSide, number, number]> = [
    ["HOME", open.home, close.home],
    ["DRAW", open.draw, close.draw],
    ["AWAY", open.away, close.away],
  ];
  const openFair = normalizeMarketProbabilities([open.home, open.draw, open.away]);
  const closeFair = normalizeMarketProbabilities([
    close.home,
    close.draw,
    close.away,
  ]);
  return pairs.map(([selection, fromOdds, toOdds], index) => ({
    selection,
    fromOdds,
    toOdds,
    movement: marketMovement(fromOdds, toOdds),
    fairProbabilityDelta: closeFair[index]! - openFair[index]!,
  }));
}

/**
 * CLV foundation only — price difference math.
 * No paper bets, settlement, or ROI.
 */
export function closingLineValueDelta(input: {
  betOdds: number;
  closingOdds: number;
}): {
  betImplied: number;
  closingImplied: number;
  impliedDelta: number;
  oddsDelta: number;
} {
  const betImplied = decimalOddsToImpliedProbability(input.betOdds);
  const closingImplied = decimalOddsToImpliedProbability(input.closingOdds);
  return {
    betImplied,
    closingImplied,
    impliedDelta: closingImplied - betImplied,
    oddsDelta: input.closingOdds - input.betOdds,
  };
}
