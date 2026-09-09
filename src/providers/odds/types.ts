import type { MarketType } from "@/domain/markets/types";
import type { SelectionSide } from "@/domain/odds/math";
import type {
  ObservationKind,
  TemporalPrecision,
} from "@/domain/odds/temporal";

export type HistoricalOddsSelection = {
  side: SelectionSide;
  selectionRef?: string | null;
  line?: string | null;
  oddsDecimal: number;
};

/**
 * One market photograph at a single observation instant.
 * For dataset_open/close, observedAt is a calendar-date anchor only
 * when temporalPrecision is unknown — not an exact quote clock.
 */
export type HistoricalOddsSnapshot = {
  providerEventId: string;
  bookmakerSlug: string;
  bookmakerName: string;
  marketType: MarketType;
  observationKind: ObservationKind;
  temporalPrecision: TemporalPrecision;
  observedAt: Date;
  /** When the source published the quote; null if unknown (do not invent). */
  sourcePublishedAt: Date | null;
  selections: HistoricalOddsSelection[];
};

export type HistoricalOddsFetchResult = {
  fetchedAt: Date;
  sourcePublishedAt: Date | null;
  payload: unknown;
  snapshots: HistoricalOddsSnapshot[];
};

export type HistoricalOddsProviderHealth = {
  ok: boolean;
  message: string;
};

export interface HistoricalOddsProvider {
  id: string;
  name: string;
  healthCheck(): Promise<HistoricalOddsProviderHealth>;
  fetchOdds(params?: Record<string, string>): Promise<HistoricalOddsFetchResult>;
}
