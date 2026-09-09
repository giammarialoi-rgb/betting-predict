import type { FeatureEventContext, HistoricalMatch, EloSnapshot } from "@/domain/features/types";
import type { AsOfBookQuote } from "@/domain/features/market";
import {
  buildFeatureSnapshot,
  type FeatureSnapshot,
} from "@/domain/features/matrix";

/**
 * Sport-agnostic feature provider interface.
 * Football is the first concrete implementation.
 */
export type SportFeatureProvider = {
  readonly sportId: string;
  buildSnapshot(input: {
    event: FeatureEventContext;
    asOf: Date;
    marketId?: string;
    history: readonly HistoricalMatch[];
    eloSnapshots?: readonly EloSnapshot[];
    homeClubKey?: string;
    awayClubKey?: string;
    quotes?: readonly AsOfBookQuote[];
    allowClosing?: boolean;
  }): FeatureSnapshot;
};

export const footballFeatureProvider: SportFeatureProvider = {
  sportId: "football",
  buildSnapshot: buildFeatureSnapshot,
};

export function getSportFeatureProvider(
  sportId: string,
): SportFeatureProvider | undefined {
  if (sportId === "football") return footballFeatureProvider;
  return undefined;
}
