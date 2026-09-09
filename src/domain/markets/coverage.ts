/**
 * Observable dataset quality metrics — NOT bet reliability / win probability.
 */

export type MarketCoverageScore = {
  marketId: string;
  marketDataCompleteness: number | null;
  bookmakerCount: number;
  historicalSampleSize: number;
  temporalPrecisionShareExact: number | null;
  featureCompleteness: number | null;
  outcomeAvailability: number | null;
};

export function computeMarketCoverageScore(input: {
  marketId: string;
  expectedFields: number;
  presentFields: number;
  bookmakerCount: number;
  historicalSampleSize: number;
  exactPrecisionCount: number;
  precisionSampleSize: number;
  featureExpected: number;
  featurePresent: number;
  outcomesKnown: number;
  outcomesTotal: number;
}): MarketCoverageScore {
  const ratio = (n: number, d: number) => (d <= 0 ? null : n / d);
  return {
    marketId: input.marketId,
    marketDataCompleteness: ratio(input.presentFields, input.expectedFields),
    bookmakerCount: input.bookmakerCount,
    historicalSampleSize: input.historicalSampleSize,
    temporalPrecisionShareExact: ratio(
      input.exactPrecisionCount,
      input.precisionSampleSize,
    ),
    featureCompleteness: ratio(input.featurePresent, input.featureExpected),
    outcomeAvailability: ratio(input.outcomesKnown, input.outcomesTotal),
  };
}
