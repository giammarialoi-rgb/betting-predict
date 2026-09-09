/**
 * Truth reconciler — audit decisions, never majority-vote facts.
 */

export type TruthAuthority =
  | "primary"
  | "secondary"
  | "benchmark"
  | "unknown";

export type TruthObservation<T> = {
  sourceId: string;
  value: T;
  availableAt: Date | null;
  temporalPrecision: "exact" | "unknown" | "dataset_window" | "mixed";
  authority: TruthAuthority;
  completeness: "full" | "partial" | "unknown";
  freshnessMs: number | null;
  provenance: string;
};

export type TruthDecision =
  | "AGREEMENT"
  | "CONFLICT"
  | "INSUFFICIENT"
  | "SINGLE_SOURCE";

export type TruthReconciliationAudit<T> = {
  subject: string;
  decision: TruthDecision;
  canonical: T | null;
  selectedSourceId: string | null;
  agreement: boolean | null;
  reasons: string[];
  scores: Array<{
    sourceId: string;
    authority: number;
    precision: number;
    completeness: number;
    freshness: number;
  }>;
  observations: TruthObservation<T>[];
};

function sameValue<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function scoreAuthority(a: TruthAuthority): number {
  return a === "primary" ? 1 : a === "secondary" ? 0.7 : a === "benchmark" ? 0.4 : 0.1;
}

function scorePrecision(p: TruthObservation<unknown>["temporalPrecision"]): number {
  return p === "exact" ? 1 : p === "dataset_window" ? 0.6 : p === "mixed" ? 0.4 : 0.1;
}

function scoreCompleteness(c: TruthObservation<unknown>["completeness"]): number {
  return c === "full" ? 1 : c === "partial" ? 0.5 : 0.1;
}

function scoreFreshness(ms: number | null): number {
  if (ms == null) return 0.5;
  if (ms <= 0) return 1;
  if (ms < 3_600_000) return 0.9;
  if (ms < 86_400_000) return 0.7;
  return 0.4;
}

/**
 * Reconcile observations into an audit record.
 * CONFLICT leaves canonical=null — never auto-correct.
 */
export function reconcileTruth<T>(input: {
  subject: string;
  observations: readonly TruthObservation<T>[];
}): TruthReconciliationAudit<T> {
  const obs = [...input.observations];
  if (obs.length === 0) {
    return {
      subject: input.subject,
      decision: "INSUFFICIENT",
      canonical: null,
      selectedSourceId: null,
      agreement: null,
      reasons: ["no_observations"],
      scores: [],
      observations: [],
    };
  }

  const scores = obs.map((o) => ({
    sourceId: o.sourceId,
    authority: scoreAuthority(o.authority),
    precision: scorePrecision(o.temporalPrecision),
    completeness: scoreCompleteness(o.completeness),
    freshness: scoreFreshness(o.freshnessMs),
  }));

  if (obs.length === 1) {
    return {
      subject: input.subject,
      decision: "SINGLE_SOURCE",
      canonical: obs[0]!.value,
      selectedSourceId: obs[0]!.sourceId,
      agreement: null,
      reasons: ["single_source_only"],
      scores,
      observations: obs,
    };
  }

  const allAgree = obs.every((o) => sameValue(o.value, obs[0]!.value));
  if (allAgree) {
    const ranked = [...scores].sort(
      (a, b) =>
        b.authority + b.precision + b.completeness + b.freshness -
        (a.authority + a.precision + a.completeness + a.freshness),
    );
    const best = ranked[0]!;
    return {
      subject: input.subject,
      decision: "AGREEMENT",
      canonical: obs.find((o) => o.sourceId === best.sourceId)!.value,
      selectedSourceId: best.sourceId,
      agreement: true,
      reasons: ["all_sources_agree", "selected_by_authority_precision_completeness_freshness"],
      scores,
      observations: obs,
    };
  }

  return {
    subject: input.subject,
    decision: "CONFLICT",
    canonical: null,
    selectedSourceId: null,
    agreement: false,
    reasons: ["sources_disagree", "no_automatic_correction"],
    scores,
    observations: obs,
  };
}
