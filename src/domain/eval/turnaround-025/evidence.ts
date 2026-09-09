import { buildAssessmentReport } from "@/domain/evidence/build-assessment";
import type { EvidenceItem } from "@/domain/evidence/types";
import type { ClubMatchLite } from "@/domain/eval/actuarial-018/load-matches";

export function buildTurnaround025Assessment(input: {
  asOf: Date;
  eventId: string;
  eventName: string;
  homeLtp: number | null;
  drawLtp: number | null;
  awayLtp: number | null;
  marketProbs: [number, number, number] | null;
  matchGrade: string;
  club: ClubMatchLite | null;
  kickoffIso: string;
}): ReturnType<typeof buildAssessmentReport> {
  const items: EvidenceItem[] = [];
  if (input.marketProbs && input.homeLtp && input.drawLtp && input.awayLtp) {
    items.push({
      evidenceId: "task-025|m001|market-devig",
      category: "market",
      epistemicKind: "QUANTITATIVE_EVIDENCE",
      claim: `Betfair MATCH_ODDS LTP de-vig P(H,D,A)=${input.marketProbs.map((p) => (p * 100).toFixed(1)).join("/")} from prices ${input.homeLtp}/${input.drawLtp}/${input.awayLtp}`,
      entityRef: input.eventName,
      eventId: input.eventId,
      sourceId: "betfair-historic-basic-mirror",
      sourceUrl: "https://historicdata.betfair.com/",
      publishedAt: input.asOf,
      availableAt: input.asOf,
      observedAt: input.asOf,
      temporalPrecision: "exact",
      polarity: "SUPPORTS",
      targetHypothesis: "NO_BET",
      magnitude: input.marketProbs[0],
      claimConfidence: null,
      sourceReliability: null,
      confirmations: [],
      rebuttals: [],
    });
  }
  items.push({
    evidenceId: "task-025|m001|strict-n",
    category: "market",
    epistemicKind: "FACT",
    claim: "STRICT capital sample is 1 GitHub MIRROR event — below gate 100; declared_edge=false",
    entityRef: "M001",
    eventId: input.eventId,
    sourceId: "task-025-ledger",
    sourceUrl: "https://github.com/petermclagan/betfair-historical",
    publishedAt: input.asOf,
    availableAt: input.asOf,
    observedAt: input.asOf,
    temporalPrecision: "exact",
    polarity: "CONTRADICTS",
    targetHypothesis: "BET",
    magnitude: 1,
    claimConfidence: null,
    sourceReliability: null,
    confirmations: [],
    rebuttals: [],
  });
  if (input.club) {
    items.push({
      evidenceId: "task-025|m001|club-overlay",
      category: "historical",
      epistemicKind: "FACT",
      claim: `Club-Football overlay ${input.matchGrade}: ${input.club.home} vs ${input.club.away} OddHome/Draw/Away=${input.club.oddHome}/${input.club.oddDraw}/${input.club.oddAway} DATE_ONLY — capital_eligible=false`,
      entityRef: input.club.eventId,
      eventId: input.eventId,
      sourceId: "club-football-match-data",
      sourceUrl: "https://github.com/xgabora/Club-Football-Match-Data",
      publishedAt: input.asOf,
      availableAt: input.asOf,
      observedAt: input.asOf,
      temporalPrecision: "date",
      polarity: "CONTEXT_ONLY",
      targetHypothesis: "NO_BET",
      magnitude: input.club.oddHome,
      claimConfidence: null,
      sourceReliability: null,
      confirmations: [],
      rebuttals: [],
    });
  }
  const settlement: EvidenceItem = {
    evidenceId: "task-025|m001|settlement-blocked",
    category: "market",
    epistemicKind: "FACT",
    claim: "Match settlement / WIN_FLAG is not available at pre-kickoff asOf",
    entityRef: input.eventName,
    eventId: input.eventId,
    sourceId: "betfair-historic-basic-mirror",
    sourceUrl: "https://historicdata.betfair.com/",
    publishedAt: new Date(input.kickoffIso),
    availableAt: new Date(input.kickoffIso),
    observedAt: input.asOf,
    temporalPrecision: "exact",
    polarity: "CONTEXT_ONLY",
    targetHypothesis: "NO_BET",
    magnitude: null,
    claimConfidence: null,
    sourceReliability: null,
    confirmations: [],
    rebuttals: [],
  };
  items.push(settlement);
  return buildAssessmentReport({
    eventId: input.eventId,
    asOf: input.asOf,
    hypothesis: "NO_BET",
    probability: null,
    items,
    insufficient: [
      "STRICT n=1 < 100 — no capital inference",
      "declared_edge=false — P_model > P_market is not a bet",
      "No contemporaneous news/injury FACT in this corpus",
      "Club Odd* overlay is DATE_ONLY RESEARCH_ONLY",
    ],
  });
}
