/**
 * TASK 015 evidence for TASK 019 decisions.
 * Date-precision odds stay CONTEXTUAL. Missing exact clocks → INSUFFICIENT.
 * News cannot appear (none acquired).
 */

import { buildAssessmentReport } from "@/domain/evidence/build-assessment";
import type { EvidenceItem } from "@/domain/evidence/types";
import type { NormalizedEvent } from "@/domain/eval/acquisition-019/types";

export function buildTask019Assessment(input: {
  event: NormalizedEvent;
  asOf: Date;
  openDateObs: number;
  closeObs: number;
  formHomePts: number;
  formAwayPts: number;
  formSample: number;
}): ReturnType<typeof buildAssessmentReport> {
  const items: EvidenceItem[] = [];
  if (input.formSample > 0) {
    items.push({
      evidenceId: `${input.event.canonicalEventId}|form`,
      category: "statistical",
      epistemicKind: "QUANTITATIVE_EVIDENCE",
      claim: `Lagged form before asOf: home ${input.formHomePts} pts vs away ${input.formAwayPts} pts (n=${input.formSample})`,
      entityRef: input.event.canonicalEventId,
      eventId: input.event.canonicalEventId,
      sourceId: "reconstructed-form",
      sourceUrl: null,
      publishedAt: null,
      availableAt: input.asOf,
      observedAt: input.asOf,
      temporalPrecision: "date",
      polarity: "CONTEXT_ONLY",
      targetHypothesis: "HOME",
      magnitude: input.formHomePts - input.formAwayPts,
      claimConfidence: null,
      sourceReliability: null,
      confirmations: [],
      rebuttals: [],
    });
  }
  if (input.openDateObs > 0) {
    items.push({
      evidenceId: `${input.event.canonicalEventId}|open-date`,
      category: "market",
      epistemicKind: "FACT",
      claim: `${input.openDateObs} documented OPEN bookmaker quotes at calendar-date precision (not exact available_at)`,
      entityRef: input.event.canonicalEventId,
      eventId: input.event.canonicalEventId,
      sourceId: input.event.sourceId,
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
    eventId: input.event.canonicalEventId,
    asOf: input.asOf,
    hypothesis: "HOME",
    probability: null,
    items,
    insufficient: [
      "No exact-precision pre-match available_at — STRICT_AS_OF rejects stake",
      input.closeObs > 0
        ? `${input.closeObs} CLOSE quotes are kickoff-adjacent and not pre-match`
        : "No Level A timestamped bookmaker archive acquired",
    ],
  });
}
