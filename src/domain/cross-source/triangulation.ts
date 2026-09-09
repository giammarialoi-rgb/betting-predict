/**
 * Cross-source triangulation — preserve provenance; never majority-vote facts.
 */

export type SourceObservation<T> = {
  sourceId: string;
  value: T;
  availableAt: Date | null;
  temporalPrecision: "exact" | "unknown" | "dataset_window" | "mixed";
  authority: "primary" | "secondary" | "benchmark" | "unknown";
  completeness: "full" | "partial" | "unknown";
};

export type TriangulatedFact<T> = {
  canonical: T | null;
  selectedSourceId: string | null;
  selectionReason:
    | "single_source"
    | "prefer_exact_temporal"
    | "prefer_primary_authority"
    | "prefer_completeness"
    | "conflict_unresolved"
    | "missing";
  observations: SourceObservation<T>[];
  /** Conflicts preserved — not erased by voting. */
  conflicts: Array<{ sourceId: string; value: T }>;
};

function sameValue<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Choose a canonical value by temporal precision → authority → completeness.
 * Does NOT take a majority vote when sources disagree.
 */
export function triangulateFact<T>(
  observations: readonly SourceObservation<T>[],
): TriangulatedFact<T> {
  if (observations.length === 0) {
    return {
      canonical: null,
      selectedSourceId: null,
      selectionReason: "missing",
      observations: [],
      conflicts: [],
    };
  }

  const conflicts: Array<{ sourceId: string; value: T }> = [];
  const first = observations[0]!;
  for (const o of observations.slice(1)) {
    if (!sameValue(o.value, first.value)) {
      conflicts.push({ sourceId: o.sourceId, value: o.value });
    }
  }

  if (observations.length === 1) {
    return {
      canonical: first.value,
      selectedSourceId: first.sourceId,
      selectionReason: "single_source",
      observations: [...observations],
      conflicts,
    };
  }

  const precisionRank = (p: SourceObservation<T>["temporalPrecision"]) =>
    p === "exact" ? 3 : p === "dataset_window" ? 2 : p === "mixed" ? 1 : 0;
  const authorityRank = (a: SourceObservation<T>["authority"]) =>
    a === "primary" ? 3 : a === "secondary" ? 2 : a === "benchmark" ? 1 : 0;
  const completenessRank = (c: SourceObservation<T>["completeness"]) =>
    c === "full" ? 2 : c === "partial" ? 1 : 0;

  const ranked = [...observations].sort((a, b) => {
    const dp = precisionRank(b.temporalPrecision) - precisionRank(a.temporalPrecision);
    if (dp !== 0) return dp;
    const da = authorityRank(b.authority) - authorityRank(a.authority);
    if (da !== 0) return da;
    return completenessRank(b.completeness) - completenessRank(a.completeness);
  });

  const best = ranked[0]!;
  let reason: TriangulatedFact<T>["selectionReason"] = "prefer_exact_temporal";
  if (conflicts.length > 0) {
    const allEqualPrecision =
      new Set(observations.map((o) => o.temporalPrecision)).size === 1;
    const allEqualAuthority =
      new Set(observations.map((o) => o.authority)).size === 1;
    if (allEqualPrecision && allEqualAuthority) {
      reason = "conflict_unresolved";
      return {
        canonical: null,
        selectedSourceId: null,
        selectionReason: reason,
        observations: [...observations],
        conflicts,
      };
    }
    if (
      precisionRank(best.temporalPrecision) >
      Math.min(...observations.map((o) => precisionRank(o.temporalPrecision)))
    ) {
      reason = "prefer_exact_temporal";
    } else if (
      authorityRank(best.authority) >
      Math.min(...observations.map((o) => authorityRank(o.authority)))
    ) {
      reason = "prefer_primary_authority";
    } else {
      reason = "prefer_completeness";
    }
  } else {
    reason = "prefer_exact_temporal";
  }

  return {
    canonical: best.value,
    selectedSourceId: best.sourceId,
    selectionReason: reason,
    observations: [...observations],
    conflicts,
  };
}
