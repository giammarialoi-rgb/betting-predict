/**
 * Compose AssessmentReport from evidence items + optional model probability.
 * Probability must come from quantification/model — never from news alone.
 */

import { buildAttributions } from "@/domain/evidence/attribution";
import { buildEvidenceGraph } from "@/domain/evidence/build-graph";
import {
  assertAssessmentHasEvidence,
  assertNewsNotSolePredictiveJustification,
} from "@/domain/evidence/assert-assessment";
import type {
  AssessmentReport,
  EvidenceItem,
  EvidenceStrength,
} from "@/domain/evidence/types";

function deriveStrength(input: {
  supporting: number;
  contradicting: number;
  insufficient: number;
  probability: number | null;
}): EvidenceStrength {
  if (input.probability === null || input.insufficient > 0) {
    if (input.supporting + input.contradicting === 0) return "insufficient";
  }
  if (input.supporting === 0 && input.contradicting === 0) return "insufficient";
  if (input.supporting >= 3 && input.contradicting <= 1) return "strong";
  if (input.supporting >= 2) return "moderate";
  if (input.supporting >= 1 && input.contradicting >= 1) return "moderate";
  if (input.supporting >= 1) return "weak";
  return "weak";
}

function buildNarrative(input: {
  hypothesis: string;
  probability: number | null;
  strength: EvidenceStrength;
  supporting: EvidenceItem[];
  contradicting: EvidenceItem[];
  contextual: EvidenceItem[];
  blocked: number;
}): string {
  const pct =
    input.probability === null
      ? "n/a"
      : `~${Math.round(input.probability * 100)}%`;
  const parts = [
    `${input.hypothesis} — Probability: ${pct} — Evidence strength: ${input.strength.toUpperCase()}`,
  ];
  if (input.supporting.length) {
    parts.push(
      `Supporting: ${input.supporting.map((e) => e.claim).join("; ")}`,
    );
  }
  if (input.contradicting.length) {
    parts.push(
      `Contradicting: ${input.contradicting.map((e) => e.claim).join("; ")}`,
    );
  }
  if (input.contextual.length) {
    parts.push(
      `Context: ${input.contextual.map((e) => e.claim).join("; ")}`,
    );
  }
  if (input.blocked > 0) {
    parts.push(`Blocked by temporal firewall: ${input.blocked}`);
  }
  if (input.contradicting.length > 0 && input.probability !== null) {
    parts.push(
      "Assessment reduced/tempered relative to supporting-only view because contradicting signals are present.",
    );
  }
  return parts.join("\n");
}

export function buildAssessmentReport(input: {
  eventId: string;
  asOf: Date;
  hypothesis: string;
  items: readonly EvidenceItem[];
  /** Must come from model/quantification — not from news. */
  probability: number | null;
  insufficient?: string[];
  validate?: boolean;
}): AssessmentReport {
  const { graph, blockedByTemporal } = buildEvidenceGraph({
    eventId: input.eventId,
    asOf: input.asOf,
    hypothesis: input.hypothesis,
    items: input.items,
    insufficient: input.insufficient,
  });

  const strength = deriveStrength({
    supporting: graph.supporting.length,
    contradicting: graph.contradicting.length,
    insufficient: graph.insufficient.length,
    probability: input.probability,
  });

  const included = [
    ...graph.supporting,
    ...graph.contradicting,
    ...graph.contextual,
  ];

  const report: AssessmentReport = {
    eventId: input.eventId,
    asOf: input.asOf,
    hypothesis: input.hypothesis,
    probability: input.probability,
    evidenceStrength: strength,
    narrativeSummary: buildNarrative({
      hypothesis: input.hypothesis,
      probability: input.probability,
      strength,
      supporting: graph.supporting,
      contradicting: graph.contradicting,
      contextual: graph.contextual,
      blocked: blockedByTemporal.length,
    }),
    evidenceGraph: graph,
    attributions: buildAttributions(included),
    blockedByTemporal,
  };

  if (input.validate !== false) {
    assertAssessmentHasEvidence(report);
    assertNewsNotSolePredictiveJustification(report);
  }

  return report;
}
