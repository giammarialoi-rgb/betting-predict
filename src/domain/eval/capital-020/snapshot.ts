/**
 * Universal market snapshot — sport-agnostic information unit.
 */

import type { MarketObservation019 } from "@/domain/eval/acquisition-019/types";
import { map019ToTemporalClass } from "@/domain/eval/capital-020/temporal-gate";
import { lineageFor019Source } from "@/domain/eval/capital-020/lineage";
import type { MarketSnapshot, SportId020 } from "@/domain/eval/capital-020/types";
import { assertNotAggregateAsBookmaker } from "@/domain/markets/canonical";

export function canonicalMarketType(raw: string): string {
  if (raw === "1X2" || raw === "result") return "1X2";
  if (raw === "OU25" || raw === "total_goals") return "TOTAL_GOALS";
  if (raw === "AH" || raw === "asian_handicap") return "ASIAN_HANDICAP";
  return raw;
}

export function observation019ToSnapshot(
  obs: MarketObservation019,
  sport: SportId020 = "football",
): MarketSnapshot {
  assertNotAggregateAsBookmaker(obs.bookmakerId);
  const lineage = lineageFor019Source(obs.sourceId, obs.observedAt);
  const kind =
    obs.observationKind === "dataset_open"
      ? "open"
      : obs.observationKind === "dataset_close"
        ? "close"
        : "unknown";
  return {
    sport,
    eventId: obs.eventId,
    marketType: canonicalMarketType(obs.marketType),
    line: obs.line,
    selection: obs.selectionSide,
    bookmaker: obs.bookmakerId,
    odds: obs.odds,
    observedAt: obs.observedAt,
    availableAt: obs.availableAt,
    temporalClass: map019ToTemporalClass(obs),
    temporalBasis: obs.temporalBasis,
    sourceId: obs.sourceId,
    upstreamCluster: lineage.upstreamCluster,
    observationKind: kind,
  };
}

export function snapshotIdentity(s: MarketSnapshot): string {
  return [
    s.sport,
    s.eventId,
    s.marketType,
    s.line ?? "",
    s.selection,
    s.bookmaker,
    s.observedAt,
    s.odds.toFixed(4),
  ].join("|");
}

export function dedupeSnapshots(rows: readonly MarketSnapshot[]): MarketSnapshot[] {
  const seen = new Set<string>();
  const out: MarketSnapshot[] = [];
  for (const s of rows) {
    const k = snapshotIdentity(s);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

/** Adapter registry — sports without acquired odds stay EMPTY. */
export const SPORT_ADAPTER_STATUS: Record<SportId020, "OBSERVED" | "EMPTY"> = {
  football: "OBSERVED",
  basketball: "EMPTY",
  tennis: "EMPTY",
  baseball: "EMPTY",
  ice_hockey: "EMPTY",
  american_football: "EMPTY",
  rugby: "EMPTY",
  volleyball: "EMPTY",
  handball: "EMPTY",
  cricket: "EMPTY",
  motor_sports: "EMPTY",
  combat_sports: "EMPTY",
  other: "EMPTY",
};
