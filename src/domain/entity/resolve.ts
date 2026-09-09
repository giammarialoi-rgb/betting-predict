import { findAliasPartners } from "@/domain/cross-source/aliases";

export type ResolveStatus = "resolved" | "unresolved" | "ambiguous";

export type ResolveResult = {
  status: ResolveStatus;
  canonicalId: string | null;
  candidates: string[];
  reason?: string;
};

/**
 * Exact / map / declarative alias only. No fuzzy matching.
 * Never silently creates entities.
 */
export function resolveTeam(input: {
  providerSource: string;
  providerEntityId: string;
  /** canonicalId by exact provider key */
  entityMap: ReadonlyMap<string, string>;
  /** optional exact display-name → canonicalId (declarative only) */
  declarativeAliases?: ReadonlyMap<string, string>;
}): ResolveResult {
  const mapKey = `${input.providerSource}|team|${input.providerEntityId}`;
  const direct = input.entityMap.get(mapKey);
  if (direct) {
    return { status: "resolved", canonicalId: direct, candidates: [direct] };
  }

  const partners = findAliasPartners(
    input.providerSource,
    "team",
    input.providerEntityId,
  );
  const viaAlias: string[] = [];
  for (const p of partners) {
    const k = `${p.source}|team|${p.providerEntityId}`;
    const id = input.entityMap.get(k);
    if (id) viaAlias.push(id);
  }
  const unique = [...new Set(viaAlias)];
  if (unique.length === 1) {
    return {
      status: "resolved",
      canonicalId: unique[0]!,
      candidates: unique,
      reason: "verified_alias",
    };
  }
  if (unique.length > 1) {
    return {
      status: "ambiguous",
      canonicalId: null,
      candidates: unique,
      reason: "multiple_alias_targets",
    };
  }

  const decl = input.declarativeAliases?.get(input.providerEntityId);
  if (decl) {
    return {
      status: "resolved",
      canonicalId: decl,
      candidates: [decl],
      reason: "declarative_alias",
    };
  }

  return {
    status: "unresolved",
    canonicalId: null,
    candidates: [],
    reason: "no_exact_or_declarative_match",
  };
}

export function resolveCompetition(input: {
  providerSource: string;
  providerEntityId: string;
  entityMap: ReadonlyMap<string, string>;
}): ResolveResult {
  const mapKey = `${input.providerSource}|competition|${input.providerEntityId}`;
  const direct = input.entityMap.get(mapKey);
  if (direct) {
    return { status: "resolved", canonicalId: direct, candidates: [direct] };
  }
  const partners = findAliasPartners(
    input.providerSource,
    "competition",
    input.providerEntityId,
  );
  const hits = [
    ...new Set(
      partners
        .map((p) =>
          input.entityMap.get(`${p.source}|competition|${p.providerEntityId}`),
        )
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  if (hits.length === 1) {
    return { status: "resolved", canonicalId: hits[0]!, candidates: hits };
  }
  if (hits.length > 1) {
    return { status: "ambiguous", canonicalId: null, candidates: hits };
  }
  return { status: "unresolved", canonicalId: null, candidates: [] };
}

export function resolveEvent(input: {
  providerSource: string;
  providerEntityId: string;
  entityMap: ReadonlyMap<string, string>;
}): ResolveResult {
  const mapKey = `${input.providerSource}|event|${input.providerEntityId}`;
  const direct = input.entityMap.get(mapKey);
  if (direct) {
    return { status: "resolved", canonicalId: direct, candidates: [direct] };
  }
  return {
    status: "unresolved",
    canonicalId: null,
    candidates: [],
    reason: "events_require_explicit_map_no_fuzzy",
  };
}

export function assertResolved(result: ResolveResult): string {
  if (result.status === "ambiguous") {
    throw new Error("AMBIGUOUS_ENTITY: reject — do not invent merge");
  }
  if (result.status !== "resolved" || !result.canonicalId) {
    throw new Error("UNRESOLVED_ENTITY: reject — do not create silently");
  }
  return result.canonicalId;
}
