/**
 * MarketMicrostructureEngine — descriptive only; respects temporal precision.
 */

import { computeMarketMicrostructure } from "@/domain/markets/microstructure-math";
import { marketMovement } from "@/domain/odds/math";
import type { TemporalPrecision } from "@/domain/odds/temporal";

export type MicroObservation = {
  bookmakerSlug: string;
  oddsDecimal: number;
  availableAt: Date;
  temporalPrecision: TemporalPrecision;
  observationKind: string;
};

export type MicrostructureReport = {
  opening: MicroObservation | null;
  latest: MicroObservation | null;
  closing: MicroObservation | null;
  delta_odds: number | null;
  delta_implied: number | null;
  consensus_movement: number | null;
  bookmaker_divergence: number | null;
  velocity: number | null;
  acceleration: null;
  dispersion_change: number | null;
  overround_movement: number | null;
  temporal_blocked: boolean;
  notes: string[];
};

export class MarketMicrostructureEngine {
  /**
   * Closing only when asOf >= scheduledStart and precision allows.
   * Unknown precision → report without inventing clocks.
   */
  analyze(input: {
    observations: readonly MicroObservation[];
    asOf: Date;
    scheduledStartAt: Date;
    requireExactPrecision?: boolean;
  }): MicrostructureReport {
    const notes: string[] = [];
    const requireExact = input.requireExactPrecision ?? false;
    let rows = input.observations.filter(
      (o) => o.availableAt.getTime() <= input.asOf.getTime(),
    );
    if (requireExact) {
      const before = rows.length;
      rows = rows.filter((o) => o.temporalPrecision === "exact");
      if (rows.length < before) {
        notes.push("unknown/dataset precision excluded under requireExact");
      }
    }

    rows = [...rows].sort(
      (a, b) => a.availableAt.getTime() - b.availableAt.getTime(),
    );
    const opening = rows[0] ?? null;
    const latest = rows.length ? rows[rows.length - 1]! : null;

    let closing: MicroObservation | null = null;
    if (input.asOf.getTime() >= input.scheduledStartAt.getTime()) {
      const pre = rows.filter(
        (o) => o.availableAt.getTime() <= input.scheduledStartAt.getTime(),
      );
      closing = pre.length ? pre[pre.length - 1]! : null;
    } else {
      notes.push("closing withheld: asOf before scheduled_start");
    }

    let delta_odds: number | null = null;
    let delta_implied: number | null = null;
    let velocity: number | null = null;
    if (opening && latest && opening !== latest) {
      const mv = marketMovement(opening.oddsDecimal, latest.oddsDecimal);
      delta_odds = mv.oddsChange.oddsDelta;
      delta_implied = mv.impliedProbabilityChange.impliedProbabilityDelta;
      const hours =
        (latest.availableAt.getTime() - opening.availableAt.getTime()) /
        3_600_000;
      if (hours > 0) velocity = delta_odds / hours;
    }

    const prices = rows.map((r) => r.oddsDecimal);
    const micro = computeMarketMicrostructure({
      prices,
      openingOdds: opening?.oddsDecimal ?? null,
      closingOdds: closing?.oddsDecimal ?? null,
    });

    const temporal_blocked =
      requireExact &&
      input.observations.some((o) => o.temporalPrecision !== "exact");

    return {
      opening,
      latest,
      closing,
      delta_odds,
      delta_implied,
      consensus_movement: delta_odds,
      bookmaker_divergence: micro.bookmaker_disagreement,
      velocity,
      acceleration: null,
      dispersion_change: null,
      overround_movement: micro.overround_change,
      temporal_blocked,
      notes,
    };
  }
}
