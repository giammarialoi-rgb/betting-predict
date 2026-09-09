/**
 * Independence clustering — count clusters, not raw sources.
 */

import type { SourceIntelligence } from "./types";
import { buildSourceIntelligenceCatalog } from "./catalog";

export type IndependenceReport = {
  registered_sources: number;
  upstream_clusters: number;
  genuinely_independent_clusters: number;
  /** Clusters that are aggregators / bookmakers / exchanges (not independent info). */
  non_independent_clusters: number;
  cluster_sizes: Array<{ cluster: string; size: number; roles: string[] }>;
};

const NON_INDEPENDENT_ROLES = new Set([
  "AGGREGATOR",
  "BOOKMAKER",
  "EXCHANGE",
]);

/**
 * Upstream clusters = distinct independenceCluster values.
 * Genuinely independent = clusters whose members are not only aggregators/books/exchanges
 * and are not mere mirrors of a single upstream (size can be 1).
 */
export function computeIndependenceReport(
  catalog: readonly SourceIntelligence[] = buildSourceIntelligenceCatalog(),
): IndependenceReport {
  const byCluster = new Map<string, SourceIntelligence[]>();
  for (const s of catalog) {
    const key = s.independenceCluster ?? `singleton_${s.id}`;
    const arr = byCluster.get(key) ?? [];
    arr.push(s);
    byCluster.set(key, arr);
  }

  let genuinely = 0;
  let nonIndep = 0;
  const cluster_sizes: IndependenceReport["cluster_sizes"] = [];

  for (const [cluster, members] of byCluster) {
    const roles = [...new Set(members.map((m) => m.role))];
    cluster_sizes.push({ cluster, size: members.length, roles });
    const onlyMarketInfra = members.every((m) => NON_INDEPENDENT_ROLES.has(m.role));
    if (onlyMarketInfra) {
      nonIndep += 1;
      continue;
    }
    // If every member lists the same upstream parent cluster elsewhere, still count once.
    genuinely += 1;
  }

  cluster_sizes.sort((a, b) => b.size - a.size);

  return {
    registered_sources: catalog.length,
    upstream_clusters: byCluster.size,
    genuinely_independent_clusters: genuinely,
    non_independent_clusters: nonIndep,
    cluster_sizes,
  };
}
