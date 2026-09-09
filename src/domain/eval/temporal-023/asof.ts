/**
 * AS_OF snapshots: last PREMATCH tick with timestamp <= asOf.
 * No interpolation. No future tick. No forward-fill past asOf.
 */

import { canonicalSelection } from "@/domain/eval/temporal-023/classify";
import type {
  AsOfWindowId,
  CanonicalSnapshot023,
  PriceTick023,
  WindowSnapshot023,
} from "@/domain/eval/temporal-023/types";
import { AS_OF_WINDOWS } from "@/domain/eval/temporal-023/types";

export const NO_DATA_AT_ASOF = "NO_DATA_AT_ASOF" as const;

export function asOfFromKickoff(kickoffIso: string, requestedSec: number): Date {
  return new Date(Date.parse(kickoffIso) - requestedSec * 1000);
}

export function lastTickAtOrBefore(input: {
  ticks: readonly PriceTick023[];
  asOfMs: number;
  selection?: string;
  prematchOnly?: boolean;
}): PriceTick023 | null {
  let best: PriceTick023 | null = null;
  for (const t of input.ticks) {
    if (t.publishTimeMs > input.asOfMs) continue;
    if (input.prematchOnly !== false && t.phase !== "PREMATCH") continue;
    if (input.selection) {
      const mapped = canonicalSelection({
        selectionName: t.selectionName,
        sortPriority: null,
      });
      if (input.selection !== t.selectionName && input.selection !== mapped) continue;
    }
    if (!best || t.publishTimeMs > best.publishTimeMs) best = t;
  }
  return best;
}

export function lastTickForSelectionAtOrBefore(input: {
  ticks: readonly PriceTick023[];
  asOfMs: number;
  selectionId: number;
  prematchOnly?: boolean;
}): PriceTick023 | null {
  let best: PriceTick023 | null = null;
  for (const t of input.ticks) {
    if (t.selectionId !== input.selectionId) continue;
    if (t.publishTimeMs > input.asOfMs) continue;
    if (input.prematchOnly !== false && t.phase !== "PREMATCH") continue;
    if (!best || t.publishTimeMs > best.publishTimeMs) best = t;
  }
  return best;
}

export function canonicalSnapshotAt(input: {
  eventId: string;
  kickoff: string;
  asOf: Date;
  market: string;
  selection: string;
  ticks: readonly PriceTick023[];
  selectionId?: number;
  source: string;
}): CanonicalSnapshot023 {
  const asOfMs = input.asOf.getTime();
  const tick =
    input.selectionId != null
      ? lastTickForSelectionAtOrBefore({
          ticks: input.ticks,
          asOfMs,
          selectionId: input.selectionId,
        })
      : lastTickAtOrBefore({
          ticks: input.ticks,
          asOfMs,
          selection: input.selection,
        });
  if (!tick) {
    return {
      eventId: input.eventId,
      kickoff: input.kickoff,
      asOf: input.asOf.toISOString(),
      market: input.market,
      selection: input.selection,
      price: null,
      timestamp: null,
      secondsToKickoff: null,
      source: input.source,
      temporalPrecision: "exact",
      status: NO_DATA_AT_ASOF,
    };
  }
  return {
    eventId: input.eventId,
    kickoff: input.kickoff,
    asOf: input.asOf.toISOString(),
    market: input.market,
    selection: input.selection,
    price: tick.lastPriceTraded,
    timestamp: tick.publishTimeIso,
    secondsToKickoff: tick.secondsToKickoff,
    source: input.source,
    temporalPrecision: tick.temporalPrecision,
    status: "OK",
  };
}

export function windowSnapshotsForSelection(input: {
  kickoff: string;
  ticks: readonly PriceTick023[];
  selectionId: number;
}): WindowSnapshot023[] {
  const kick = Date.parse(input.kickoff);
  return AS_OF_WINDOWS.map((w) => {
    const asOf = asOfFromKickoff(input.kickoff, w.requestedSec);
    const tick = lastTickForSelectionAtOrBefore({
      ticks: input.ticks,
      asOfMs: asOf.getTime(),
      selectionId: input.selectionId,
    });
    if (!tick) {
      return {
        window: w.window,
        requestedSec: w.requestedSec,
        snapshot_exists: false,
        actual_timestamp: null,
        seconds_before_kickoff: null,
        delta_sec: null,
        price_available: false,
        bookmaker: "betfair-exchange",
        market_depth: null,
        asOf: asOf.toISOString(),
      };
    }
    const secondsBefore = (kick - tick.publishTimeMs) / 1000;
    return {
      window: w.window as AsOfWindowId,
      requestedSec: w.requestedSec,
      snapshot_exists: true,
      actual_timestamp: tick.publishTimeIso,
      seconds_before_kickoff: secondsBefore,
      delta_sec: secondsBefore - w.requestedSec,
      price_available: true,
      bookmaker: "betfair-exchange",
      market_depth: tick.ladderDepth,
      asOf: asOf.toISOString(),
    };
  });
}

/** Coverage: a window is available if every requested selection has a PREMATCH tick <= asOf. */
export function windowCoverage(input: {
  kickoff: string;
  ticks: readonly PriceTick023[];
  selectionIds: readonly number[];
}): {
  window: AsOfWindowId;
  requested: number;
  available: number;
  coverage: number;
}[] {
  const n = input.selectionIds.length;
  return AS_OF_WINDOWS.map((w) => {
    const asOf = asOfFromKickoff(input.kickoff, w.requestedSec);
    let available = 0;
    for (const id of input.selectionIds) {
      const tick = lastTickForSelectionAtOrBefore({
        ticks: input.ticks,
        asOfMs: asOf.getTime(),
        selectionId: id,
      });
      if (tick) available += 1;
    }
    return {
      window: w.window,
      requested: n,
      available,
      coverage: n === 0 ? 0 : available / n,
    };
  });
}
