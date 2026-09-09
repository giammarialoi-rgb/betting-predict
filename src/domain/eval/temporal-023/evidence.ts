import { buildAssessmentReport } from "@/domain/evidence/build-assessment";
import type { EvidenceItem } from "@/domain/evidence/types";

export function buildTemporal023Assessment(input: {
  eventId: string;
  asOf: Date;
  eventName: string;
  prematchTicks: number;
  tripleComplete: boolean;
  homeLtp: number | null;
  drawLtp: number | null;
  awayLtp: number | null;
}): ReturnType<typeof buildAssessmentReport> {
  const items: EvidenceItem[] = [];
  if (input.tripleComplete && input.homeLtp && input.drawLtp && input.awayLtp) {
    items.push({
      evidenceId: `${input.eventId}|match-odds-ltp`,
      category: "market",
      epistemicKind: "QUANTITATIVE_EVIDENCE",
      claim: `Betfair Exchange MATCH_ODDS last traded at asOf (H ${input.homeLtp} / D ${input.drawLtp} / A ${input.awayLtp}); BASIC has no ladder/volume`,
      entityRef: input.eventName,
      eventId: input.eventId,
      sourceId: "betfair-historic-basic-mirror",
      sourceUrl: "https://github.com/petermclagan/betfair-historical",
      publishedAt: input.asOf,
      availableAt: input.asOf,
      observedAt: input.asOf,
      temporalPrecision: "exact",
      polarity: "CONTEXT_ONLY",
      targetHypothesis: "HOME",
      magnitude: null,
      claimConfidence: null,
      sourceReliability: null,
      confirmations: [],
      rebuttals: [],
    });
  }
  items.push({
    evidenceId: `${input.eventId}|prematch-count`,
    category: "market",
    epistemicKind: "FACT",
    claim: `${input.prematchTicks} PREMATCH LTP ticks with publishTime < marketStartTime`,
    entityRef: input.eventName,
    eventId: input.eventId,
    sourceId: "betfair-historic-basic-mirror",
    sourceUrl: "https://historicdata.betfair.com/",
    publishedAt: input.asOf,
    availableAt: input.asOf,
    observedAt: input.asOf,
    temporalPrecision: "exact",
    polarity: "CONTEXT_ONLY",
    targetHypothesis: "HOME",
    magnitude: input.prematchTicks,
    claimConfidence: null,
    sourceReliability: null,
    confirmations: [],
    rebuttals: [],
  });
  return buildAssessmentReport({
    eventId: input.eventId,
    asOf: input.asOf,
    hypothesis: "HOME",
    probability: null,
    items,
    insufficient: [
      "declared_edge=false — market-implied is not an edge claim",
      "Elo / lagged form / rest / injuries / lineups / weather / news not in this BASIC file",
      "n=1 GitHub MIRROR event is not a 100-event official bulk",
      "News remains CONTEXT_ONLY; no causal HOME SUPPORT",
    ],
  });
}
