/**
 * Merged Source Intelligence catalog (≥500 candidates).
 */

import { TIER_A_SEEDS, TIER_B_SEEDS } from "./seeds-ab";
import { expandTierCCandidates } from "./expand-tier-c";
import type { SourceIntelligence, SourceRole } from "./types";

let _cache: SourceIntelligence[] | null = null;

export function buildSourceIntelligenceCatalog(): SourceIntelligence[] {
  if (_cache) return _cache;
  const map = new Map<string, SourceIntelligence>();
  for (const row of [...TIER_A_SEEDS, ...TIER_B_SEEDS, ...expandTierCCandidates()]) {
    if (!map.has(row.id)) map.set(row.id, Object.freeze(row) as SourceIntelligence);
  }
  _cache = Object.freeze([...map.values()]) as SourceIntelligence[];
  return _cache;
}

export function getSourceIntelligence(id: string): SourceIntelligence | undefined {
  return buildSourceIntelligenceCatalog().find((s) => s.id === id);
}

export function listByRole(role: SourceRole): SourceIntelligence[] {
  return buildSourceIntelligenceCatalog().filter((s) => s.role === role);
}

export function listByTier(tier: "A" | "B" | "C"): SourceIntelligence[] {
  return buildSourceIntelligenceCatalog().filter((s) => s.tier === tier);
}

export function assertNoInventedReliability(
  catalog: readonly SourceIntelligence[] = buildSourceIntelligenceCatalog(),
): void {
  for (const s of catalog) {
    if (s.reliability === "verified" && s.implementation === "candidate") {
      throw new Error(
        `INVENTED_RELIABILITY: ${s.id} cannot be verified while only candidate`,
      );
    }
  }
}
