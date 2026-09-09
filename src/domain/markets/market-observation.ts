/**
 * Generic market observation — sport-agnostic quote atom.
 */

import type { TemporalPrecision } from "@/domain/odds/temporal";
import {
  assertNotAggregateAsBookmaker,
  type CanonicalMarketObservation,
} from "@/domain/markets/canonical";

export type MarketObservation = {
  eventId: string;
  bookmakerId: string;
  marketType: string;
  line: number | null;
  selectionSide: string;
  selectionRef: string | null;
  odds: number;
  observedAt: Date;
  availableAt: Date;
  temporalPrecision: TemporalPrecision | "unknown";
  observationKind:
    | "dataset_open"
    | "dataset_close"
    | "snapshot"
    | "unknown";
  sourceId: string;
  rawPayloadId: string | null;
};

export function toCanonical(
  obs: MarketObservation,
  sport = "football",
): CanonicalMarketObservation {
  return {
    sport,
    marketType: obs.marketType,
    period: "FT",
    line: obs.line,
    selection: obs.selectionSide,
    selectionRef: obs.selectionRef,
  };
}

export function assertMarketObservationBookmaker(obs: MarketObservation): void {
  assertNotAggregateAsBookmaker(obs.bookmakerId);
}
