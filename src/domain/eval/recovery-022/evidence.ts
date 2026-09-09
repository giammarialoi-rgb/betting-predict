import { buildAssessmentReport } from "@/domain/evidence/build-assessment";
import type { EvidenceItem } from "@/domain/evidence/types";
import type { ResearchAggregate022 } from "@/domain/eval/recovery-022/types";

export function buildBeatTheBookieAssessment(input: {
  eventId: string;
  asOf: Date;
  aggregates: readonly ResearchAggregate022[];
  seriesQuotes: number;
  strictQuotes: number;
}): ReturnType<typeof buildAssessmentReport> {
  const items: EvidenceItem[] = [];
  if (input.aggregates.length > 0) {
    items.push({
      evidenceId: `${input.eventId}|btb-avg-max`,
      category: "market",
      epistemicKind: "QUANTITATIVE_EVIDENCE",
      claim: `${input.aggregates.length} avg/max closing 1X2 aggregates (research; not individual books, not STRICT)`,
      entityRef: input.eventId,
      eventId: input.eventId,
      sourceId: "beat-the-bookie-closing-odds",
      sourceUrl: "https://github.com/Lisandro79/BeatTheBookie",
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
  if (input.seriesQuotes > 0) {
    items.push({
      evidenceId: `${input.eventId}|btb-series`,
      category: "market",
      epistemicKind: "FACT",
      claim: `${input.seriesQuotes} hourly relative 1X2 bins (RELATIVE_TO_KICKOFF_APPROX; TZ undocumented; available_at=null)`,
      entityRef: input.eventId,
      eventId: input.eventId,
      sourceId: "beat-the-bookie-odds-series",
      sourceUrl: "https://github.com/Lisandro79/BeatTheBookie",
      publishedAt: null,
      availableAt: input.asOf,
      observedAt: input.asOf,
      temporalPrecision: "unknown",
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
        ? "No STRICT capital quotes (need EXACT_TIMESTAMP + verified timezone + available_at ≤ asOf)"
        : "STRICT quotes present but declared_edge=false",
    ],
  });
}
