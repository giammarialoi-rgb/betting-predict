import type { SportRow045 } from "@/domain/eval/factory-045/pull";
import { ODDS_MARKETS_DEFAULT_049 } from "@/domain/eval/factory-049/config";

/**
 * Extensible sport family adapters.
 * New sports = add a family entry (prefix match on provider keys). No engine rewrite.
 */
export type SportFamilyAdapter049 = {
  family: string;
  /** Match Odds API sport keys, e.g. soccer_ → soccer_epl */
  keyPrefixes: string[];
  /** Optional group name hints from /v4/sports */
  groupHints: string[];
  marketsRequest: string;
  priority: number;
};

export const SPORT_FAMILY_ADAPTERS_049: SportFamilyAdapter049[] = [
  {
    family: "soccer",
    keyPrefixes: ["soccer_"],
    groupHints: ["Soccer"],
    marketsRequest: ODDS_MARKETS_DEFAULT_049,
    priority: 1,
  },
  {
    family: "tennis",
    keyPrefixes: ["tennis_"],
    groupHints: ["Tennis"],
    marketsRequest: ODDS_MARKETS_DEFAULT_049,
    priority: 2,
  },
  {
    family: "basketball",
    keyPrefixes: ["basketball_"],
    groupHints: ["Basketball"],
    marketsRequest: ODDS_MARKETS_DEFAULT_049,
    priority: 3,
  },
  {
    family: "volleyball",
    keyPrefixes: ["volleyball_"],
    groupHints: ["Volleyball"],
    marketsRequest: ODDS_MARKETS_DEFAULT_049,
    priority: 4,
  },
  {
    family: "hockey",
    keyPrefixes: ["icehockey_", "hockey_"],
    groupHints: ["Ice Hockey", "Hockey"],
    marketsRequest: ODDS_MARKETS_DEFAULT_049,
    priority: 5,
  },
];

export function resolveFamilyForKey049(sportKey: string): SportFamilyAdapter049 | null {
  for (const a of SPORT_FAMILY_ADAPTERS_049) {
    if (a.keyPrefixes.some((p) => sportKey.startsWith(p))) return a;
  }
  return null;
}

export function marketsForSportKey049(sportKey: string): string {
  return resolveFamilyForKey049(sportKey)?.marketsRequest ?? ODDS_MARKETS_DEFAULT_049;
}

export type FamilySelection049 = {
  family: string;
  keys: string[];
  status: "AVAILABLE" | "PROVIDER_UNAVAILABLE";
  note: string | null;
};

/** Partition active catalog keys by family adapters — never invent keys. */
export function selectSportsByFamily049(catalog: SportRow045[]): {
  families: FamilySelection049[];
  /** Flat pull queue ordered by family priority then key */
  pullQueue: { family: string; key: string; markets: string }[];
  other_active_keys: string[];
} {
  const active = catalog.filter((s) => s.active && !s.has_outrights);
  const families: FamilySelection049[] = [];
  const assigned = new Set<string>();

  const adapters = [...SPORT_FAMILY_ADAPTERS_049].sort((a, b) => a.priority - b.priority);
  for (const a of adapters) {
    const keys = active
      .filter((s) => a.keyPrefixes.some((p) => s.key.startsWith(p)))
      .map((s) => s.key)
      .sort();
    for (const k of keys) assigned.add(k);
    families.push({
      family: a.family,
      keys,
      status: keys.length ? "AVAILABLE" : "PROVIDER_UNAVAILABLE",
      note: keys.length ? null : `${a.family.toUpperCase()}_PROVIDER_UNAVAILABLE`,
    });
  }

  const other_active_keys = active.map((s) => s.key).filter((k) => !assigned.has(k));

  const pullQueue: { family: string; key: string; markets: string }[] = [];
  for (const f of families) {
    const adapter = adapters.find((x) => x.family === f.family)!;
    for (const key of f.keys) {
      pullQueue.push({ family: f.family, key, markets: adapter.marketsRequest });
    }
  }
  // Universal: every other ACTIVE non-outright key enters the queue (no artificial sport exclusion).
  for (const key of other_active_keys.sort()) {
    pullQueue.push({ family: "other", key, markets: ODDS_MARKETS_DEFAULT_049 });
  }
  if (other_active_keys.length) {
    families.push({
      family: "other",
      keys: other_active_keys,
      status: "AVAILABLE",
      note: null,
    });
  }

  return { families, pullQueue, other_active_keys };
}
