import { buildAssessmentReport } from "@/domain/evidence/build-assessment";
import type { EvidenceItem } from "@/domain/evidence/types";
import type { StrictCandidate027 } from "@/domain/eval/breakthrough-027/types";
import { marketDevig } from "@/domain/eval/turnaround-025/models";

export function buildBreakthrough027Assessment(input: {
  event: StrictCandidate027;
  modelProbs: [number, number, number] | null;
  hypothesis: string;
}): ReturnType<typeof buildAssessmentReport> {
  const asOf = new Date(input.event.as_of);
  const mkt = marketDevig({
    home: input.event.home_odds,
    draw: input.event.draw_odds,
    away: input.event.away_odds,
  });
  const items: EvidenceItem[] = [];
  if (mkt) {
    items.push({
      evidenceId: `${input.event.event_id}|market-devig`,
      category: "market",
      epistemicKind: "QUANTITATIVE_EVIDENCE",
      claim: `LEVEL B 1X2 de-vig P(H,D,A)=${mkt.map((p) => (p * 100).toFixed(1)).join("/")} from ${input.event.bookmaker} ${input.event.home_odds}/${input.event.draw_odds}/${input.event.away_odds} at T-${input.event.hours_before}h`,
      entityRef: `${input.event.home} vs ${input.event.away}`,
      eventId: input.event.event_id,
      sourceId: input.event.source,
      sourceUrl: input.event.source_url,
      publishedAt: asOf,
      availableAt: asOf,
      observedAt: asOf,
      temporalPrecision: "exact",
      polarity: "SUPPORTS",
      targetHypothesis: input.hypothesis,
      magnitude: mkt[0],
      claimConfidence: null,
      sourceReliability: null,
      confirmations: [],
      rebuttals: [],
    });
  }
  items.push({
    evidenceId: `${input.event.event_id}|level-b`,
    category: "historical",
    epistemicKind: "FACT",
    claim: input.event.temporal_basis,
    entityRef: input.event.match_id,
    eventId: input.event.event_id,
    sourceId: input.event.source,
    sourceUrl: input.event.source_url,
    publishedAt: asOf,
    availableAt: asOf,
    observedAt: asOf,
    temporalPrecision: "exact",
    polarity: "CONTEXT_ONLY",
    targetHypothesis: input.hypothesis,
    magnitude: null,
    claimConfidence: null,
    sourceReliability: null,
    confirmations: [],
    rebuttals: [],
  });
  items.push({
    evidenceId: `${input.event.event_id}|settlement-blocked`,
    category: "historical",
    epistemicKind: "FACT",
    claim: "FT scores are OutcomeContext and are not available at pre-kickoff asOf",
    entityRef: input.event.event_id,
    eventId: input.event.event_id,
    sourceId: input.event.source,
    sourceUrl: input.event.source_url,
    publishedAt: new Date(input.event.kickoff),
    availableAt: new Date(input.event.kickoff),
    observedAt: asOf,
    temporalPrecision: "exact",
    polarity: "CONTEXT_ONLY",
    targetHypothesis: input.hypothesis,
    magnitude: null,
    claimConfidence: null,
    sourceReliability: null,
    confirmations: [],
    rebuttals: [],
  });
  return buildAssessmentReport({
    eventId: input.event.event_id,
    asOf,
    hypothesis: input.hypothesis,
    probability: input.modelProbs ? input.modelProbs[0] : null,
    items,
    insufficient: [
      "HOLDOUT years have zero STRICT coverage — MODEL_READY stays false",
      "News/injury/lineup not present as FACT in this corpus (CONTEXT_ONLY if added later)",
      "BeatTheBookie naive match_datetime timezone is undocumented — not used as UTC",
    ],
  });
}
