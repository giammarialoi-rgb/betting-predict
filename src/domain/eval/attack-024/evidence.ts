import { buildAssessmentReport } from "@/domain/evidence/build-assessment";
import type { EvidenceItem } from "@/domain/evidence/types";

export function buildAttack024Assessment(input: {
  asOf: Date;
  strictEvents: number;
  soccerOddsFixtures: number;
}): ReturnType<typeof buildAssessmentReport> {
  const items: EvidenceItem[] = [
    {
      evidenceId: "task-024|soccer-known-at",
      category: "market",
      epistemicKind: "FACT",
      claim: `eatpizzanot/soccer-dataset odds.known_at is documented closing/around kick-off; measured known_at == date_utc on all ${input.soccerOddsFixtures} odds fixtures`,
      entityRef: "soccer-dataset odds",
      eventId: "task-024-corpus",
      sourceId: "eatpizzanot/soccer-dataset",
      sourceUrl: "https://huggingface.co/datasets/eatpizzanot/soccer-dataset",
      publishedAt: input.asOf,
      availableAt: input.asOf,
      observedAt: input.asOf,
      temporalPrecision: "exact",
      polarity: "CONTEXT_ONLY",
      targetHypothesis: "HOME",
      magnitude: input.soccerOddsFixtures,
      claimConfidence: null,
      sourceReliability: null,
      confirmations: [],
      rebuttals: [],
    },
    {
      evidenceId: "task-024|betfair-mirror-n",
      category: "market",
      epistemicKind: "QUANTITATIVE_EVIDENCE",
      claim: `STRICT events materialized this attack: ${input.strictEvents} (Betfair Historic BASIC GitHub MIRROR, not official bulk)`,
      entityRef: "M001 Middlesbrough v Man City",
      eventId: "28202626",
      sourceId: "betfair-historic-basic-mirror",
      sourceUrl: "https://github.com/petermclagan/betfair-historical",
      publishedAt: input.asOf,
      availableAt: input.asOf,
      observedAt: input.asOf,
      temporalPrecision: "exact",
      polarity: "CONTEXT_ONLY",
      targetHypothesis: "HOME",
      magnitude: input.strictEvents,
      claimConfidence: null,
      sourceReliability: null,
      confirmations: [],
      rebuttals: [],
    },
  ];
  return buildAssessmentReport({
    eventId: "task-024-corpus",
    asOf: input.asOf,
    hypothesis: "HOME",
    probability: null,
    items,
    insufficient: [
      "STRICT < 100 — no capital replay, no model selection, winner = null",
      "News/injuries remain CONTEXT_ONLY; no causal SUPPORT from articles",
      "soccer-dataset match_stats.known_at = kickoff + 105 min is post-match",
      "Closing odds are not prematch decision quotes",
    ],
  });
}
