/**
 * Assessment validity gates — no naked probability.
 */

import type { AssessmentReport } from "@/domain/evidence/types";

export class AssessmentEvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssessmentEvidenceError";
  }
}

/**
 * Hard-fail if an assessment states a probability without evidence
 * or an explicit insufficiency declaration.
 */
export function assertAssessmentHasEvidence(report: AssessmentReport): void {
  const g = report.evidenceGraph;
  const hasEvidence =
    g.supporting.length > 0 ||
    g.contradicting.length > 0 ||
    g.contextual.length > 0;
  const hasInsufficient = g.insufficient.length > 0;

  if (report.probability !== null) {
    if (!hasEvidence && !hasInsufficient) {
      throw new AssessmentEvidenceError(
        "NAKED_PROBABILITY: assessment has probability but no evidence and no insufficient declaration",
      );
    }
  }

  if (report.evidenceStrength !== "insufficient" && !hasEvidence && !hasInsufficient) {
    throw new AssessmentEvidenceError(
      "EMPTY_ASSESSMENT: no evidence and no insufficient declaration",
    );
  }

  // Blocked items must never appear inside the graph buckets
  const graphIds = new Set([
    ...g.supporting,
    ...g.contradicting,
    ...g.contextual,
  ].map((e) => e.evidenceId));
  for (const blocked of report.blockedByTemporal) {
    if (graphIds.has(blocked.evidenceId)) {
      throw new AssessmentEvidenceError(
        `TEMPORAL_LEAK: blocked evidence ${blocked.evidenceId} present in graph`,
      );
    }
    if (blocked.availableAt.getTime() <= report.asOf.getTime()) {
      throw new AssessmentEvidenceError(
        `TEMPORAL_MISCLASSIFIED: ${blocked.evidenceId} availableAt <= asOf but listed as blocked`,
      );
    }
  }

  for (const item of [...g.supporting, ...g.contradicting, ...g.contextual]) {
    if (item.availableAt.getTime() > report.asOf.getTime()) {
      throw new AssessmentEvidenceError(
        `TEMPORAL_LEAK: evidence ${item.evidenceId} availableAt > asOf in graph`,
      );
    }
    if (item.sourceReliability !== null) {
      throw new AssessmentEvidenceError(
        `INVENTED_RELIABILITY: evidence ${item.evidenceId} must keep sourceReliability null until measured`,
      );
    }
  }
}

function isPredictiveEpistemic(kind: AssessmentReport["evidenceGraph"]["supporting"][number]["epistemicKind"]): boolean {
  return (
    kind === "QUANTITATIVE_EVIDENCE" ||
    kind === "FACT" ||
    kind === "MODEL_JUDGMENT"
  );
}

/**
 * News / CONTEXT_ONLY items must not be treated as the sole justification
 * for a non-null probability. Quantitative path must exist separately.
 */
export function assertNewsNotSolePredictiveJustification(
  report: AssessmentReport,
): void {
  if (report.probability === null) return;

  // Explicit insufficiency already documents that the probability is not evidence-backed.
  if (report.evidenceGraph.insufficient.length > 0) return;

  const supporting = report.evidenceGraph.supporting;
  const contradicting = report.evidenceGraph.contradicting;

  const hasQuantitative =
    supporting.some((e) => isPredictiveEpistemic(e.epistemicKind)) ||
    contradicting.some((e) => isPredictiveEpistemic(e.epistemicKind));

  // Probability requires at least one FACT / QUANTITATIVE / MODEL_JUDGMENT
  // in supporting or contradicting — contextual news alone is not enough.
  if (!hasQuantitative) {
    throw new AssessmentEvidenceError(
      "NEWS_CAUSAL_JUMP: probability cannot be justified by news/context alone",
    );
  }

  // CONTEXT_ONLY must never sit in supporting bucket
  for (const e of supporting) {
    if (e.polarity === "CONTEXT_ONLY") {
      throw new AssessmentEvidenceError(
        `CONTEXT_IN_SUPPORTING: ${e.evidenceId} CONTEXT_ONLY must not be supporting`,
      );
    }
    if (e.category === "news" && e.epistemicKind !== "MODEL_JUDGMENT") {
      // News may only support after an explicit verified correlation path
      // promoted away from CONTEXT_ONLY — still forbid raw news category in supporting
      // unless polarity was upgraded via lineup/stats correlation (injury/lineup categories).
      throw new AssessmentEvidenceError(
        `NEWS_IN_SUPPORTING: ${e.evidenceId} news must stay CONTEXT_ONLY; use correlated injury/lineup FACT instead`,
      );
    }
  }
}
