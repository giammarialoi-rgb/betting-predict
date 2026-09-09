import { buildAssessmentReport } from "@/domain/evidence/build-assessment";
import type { EvidenceItem } from "@/domain/evidence/types";

export function buildCapital020Assessment(input: {
  eventId: string;
  asOf: Date;
  formHome: number;
  formAway: number;
  formSample: number;
  dateOpenBooks: number;
  strictQuotes: number;
}): ReturnType<typeof buildAssessmentReport> {
  const items: EvidenceItem[] = [];
  if (input.formSample > 0) {
    items.push({
      evidenceId: `${input.eventId}|form`,
      category: "statistical",
      epistemicKind: "QUANTITATIVE_EVIDENCE",
      claim: `Lagged form before asOf: home ${input.formHome} vs away ${input.formAway} (n=${input.formSample})`,
      entityRef: input.eventId,
      eventId: input.eventId,
      sourceId: "reconstructed-form",
      sourceUrl: null,
      publishedAt: null,
      availableAt: input.asOf,
      observedAt: input.asOf,
      temporalPrecision: "date",
      polarity: "CONTEXT_ONLY",
      targetHypothesis: "HOME",
      magnitude: input.formHome - input.formAway,
      claimConfidence: null,
      sourceReliability: null,
      confirmations: [],
      rebuttals: [],
    });
  }
  if (input.dateOpenBooks > 0) {
    items.push({
      evidenceId: `${input.eventId}|date-open`,
      category: "market",
      epistemicKind: "FACT",
      claim: `${input.dateOpenBooks} DATE_ONLY OPEN quotes (research; not STRICT capital)`,
      entityRef: input.eventId,
      eventId: input.eventId,
      sourceId: "football-data-co-uk-cluster",
      sourceUrl: null,
      publishedAt: null,
      availableAt: input.asOf,
      observedAt: input.asOf,
      temporalPrecision: "date",
      polarity: "CONTEXT_ONLY",
      targetHypothesis: "HOME",
      magnitude: null,
      claimConfidence: null,
      sourceReliability: null,
      confirmations: [],
      rebuttals: [],
    });
  }
  return buildAssessmentReport({
    eventId: input.eventId,
    asOf: input.asOf,
    hypothesis: "HOME",
    probability: null,
    items,
    insufficient: [
      input.strictQuotes === 0
        ? "No STRICT capital quotes (need exact available_at ≤ asOf)"
        : "STRICT quotes present but declared_edge=false",
    ],
  });
}
