/**
 * Correlation-aware exposure for actuarial risk (simulation only).
 */

import { MARKET_CORRELATION_REGISTRY } from "@/domain/markets/correlation-registry";

export type ExposureSelection = {
  eventId: string;
  market: string;
  selection: string;
  stake: number;
};

export type CorrelationCluster = {
  cluster_id: string;
  selections: ExposureSelection[];
  total_exposure: number;
  note: string;
};

/**
 * Group selections that share known correlation families on the same event.
 */
export function buildCorrelationClusters(
  selections: readonly ExposureSelection[],
): CorrelationCluster[] {
  const byEvent = new Map<string, ExposureSelection[]>();
  for (const s of selections) {
    const arr = byEvent.get(s.eventId) ?? [];
    arr.push(s);
    byEvent.set(s.eventId, arr);
  }

  const clusters: CorrelationCluster[] = [];
  for (const [eventId, sels] of byEvent) {
    const markets = new Set(sels.map((s) => s.market));
    const related = MARKET_CORRELATION_REGISTRY.filter((p) => {
      const hit = p.markets.filter((m) => markets.has(m));
      return hit.length >= 2;
    });
    if (related.length === 0) {
      for (const s of sels) {
        clusters.push({
          cluster_id: `${eventId}|${s.market}|${s.selection}`,
          selections: [s],
          total_exposure: s.stake,
          note: "independent_or_unknown_correlation",
        });
      }
      continue;
    }
    clusters.push({
      cluster_id: `${eventId}|correlated`,
      selections: [...sels],
      total_exposure: sels.reduce((a, b) => a + b.stake, 0),
      note: related.map((r) => `${r.id}:${r.kind}`).join(";"),
    });
  }
  return clusters;
}

export function maxClusterExposure(
  clusters: readonly CorrelationCluster[],
): number {
  if (clusters.length === 0) return 0;
  return Math.max(...clusters.map((c) => c.total_exposure));
}
