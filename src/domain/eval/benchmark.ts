/**
 * Bookmaker / market baseline comparison foundation.
 * No predictions table, no bets, no ROI.
 */

export type MarketBaselineComparison = {
  eventId: string;
  marketId: string;
  line: number | null;
  selection: string;
  modelProbability: number | null;
  marketImpliedProbability: number | null;
  differencePp: number | null;
  closingImpliedProbability: number | null;
  outcome: string | null;
  hypothesisFrame: "H0_no_incremental_info" | "H1_incremental_info" | "unevaluated";
};

export function buildBaselineComparison(input: {
  eventId: string;
  marketId: string;
  line?: number | null;
  selection: string;
  modelProbability: number | null;
  marketImpliedProbability: number | null;
  closingImpliedProbability?: number | null;
  outcome?: string | null;
}): MarketBaselineComparison {
  const differencePp =
    input.modelProbability !== null &&
    input.marketImpliedProbability !== null
      ? (input.modelProbability - input.marketImpliedProbability) * 100
      : null;
  return {
    eventId: input.eventId,
    marketId: input.marketId,
    line: input.line ?? null,
    selection: input.selection,
    modelProbability: input.modelProbability,
    marketImpliedProbability: input.marketImpliedProbability,
    differencePp,
    closingImpliedProbability: input.closingImpliedProbability ?? null,
    outcome: input.outcome ?? null,
    hypothesisFrame: "unevaluated",
  };
}

export type MultiMarketBacktestBucket = {
  marketId: string;
  sampleSize: number;
  meanBrier: number | null;
  meanLogLoss: number | null;
  marketBaselineBrier: number | null;
  modelBaselineBrier: number | null;
};

export function emptyMultiMarketBuckets(
  marketIds: readonly string[],
): MultiMarketBacktestBucket[] {
  return marketIds.map((marketId) => ({
    marketId,
    sampleSize: 0,
    meanBrier: null,
    meanLogLoss: null,
    marketBaselineBrier: null,
    modelBaselineBrier: null,
  }));
}
