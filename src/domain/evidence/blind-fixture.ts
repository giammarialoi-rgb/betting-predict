/**
 * Blind fixture: assessment with supporting, contradicting, contextual, blocked.
 * Probability comes from MODEL_JUDGMENT — not from news.
 */

import { buildAssessmentReport } from "@/domain/evidence/build-assessment";
import { evidenceItemFromInformation } from "@/domain/evidence/from-information";
import type { AssessmentReport, EvidenceItem } from "@/domain/evidence/types";
import type { InformationEvent } from "@/domain/info/contracts";

export const EVIDENCE_BLIND_FIXTURE = {
  eventId: "evt_015_home_away_demo",
  asOf: new Date("2026-09-06T18:00:00.000Z"),
  hypothesis: "HOME",
  /** Model output — independent of news CONTEXT_ONLY. */
  modelProbability: 0.57,
} as const;

function item(partial: Omit<EvidenceItem, "sourceReliability" | "confirmations" | "rebuttals"> & {
  confirmations?: string[];
  rebuttals?: string[];
}): EvidenceItem {
  return {
    ...partial,
    sourceReliability: null,
    confirmations: partial.confirmations ?? [],
    rebuttals: partial.rebuttals ?? [],
  };
}

export function buildBlindEvidenceFixtureItems(): EvidenceItem[] {
  const { eventId, asOf } = EVIDENCE_BLIND_FIXTURE;
  const before = new Date("2026-09-06T16:00:00.000Z");
  const after = new Date("2026-09-06T19:30:00.000Z");

  const newsBefore: InformationEvent = {
    information_type: "NEWS",
    subject: "away_team",
    published_at: new Date("2026-09-06T14:00:00.000Z"),
    available_at: before,
    source: "local_polish_paper",
    confidence: null,
    payload: { claim: "8 players unavailable due to gastroenteritis" },
  };

  const newsAfter: InformationEvent = {
    information_type: "NEWS",
    subject: "away_team",
    published_at: after,
    available_at: after,
    source: "local_polish_paper_evening",
    confidence: null,
    payload: { claim: "coach confirms outbreak" },
  };

  const contextualNews = evidenceItemFromInformation({
    info: newsBefore,
    eventId,
    targetHypothesis: "HOME",
    evidenceId: "ev_news_gastro_context",
    sourceUrl: "https://example.local/pl/gastro-2026-09-06",
    claim:
      "Local Polish paper: several AWAY players unavailable due to gastrointestinal illness",
  });

  const blockedNews = evidenceItemFromInformation({
    info: newsAfter,
    eventId,
    targetHypothesis: "HOME",
    evidenceId: "ev_news_after_asof",
    sourceUrl: "https://example.local/pl/gastro-confirm-1930",
    claim: "Evening article confirming outbreak (published after asOf)",
  });

  return [
    item({
      evidenceId: "ev_form_home",
      category: "statistical",
      epistemicKind: "QUANTITATIVE_EVIDENCE",
      claim: "HOME recent form: 4 wins in last 5",
      entityRef: "home_team",
      eventId,
      sourceId: "historical_form_dataset",
      sourceUrl: null,
      publishedAt: null,
      availableAt: before,
      observedAt: before,
      temporalPrecision: "dataset_window",
      polarity: "SUPPORTS",
      targetHypothesis: "HOME",
      magnitude: 0.12,
      claimConfidence: 0.6,
    }),
    item({
      evidenceId: "ev_market_move_home",
      category: "market",
      epistemicKind: "QUANTITATIVE_EVIDENCE",
      claim: "HOME odds shortened 2.10 → 1.95 (market move toward HOME)",
      entityRef: null,
      eventId,
      sourceId: "bookmaker_snapshots",
      sourceUrl: null,
      publishedAt: null,
      availableAt: before,
      observedAt: before,
      temporalPrecision: "exact",
      polarity: "SUPPORTS",
      targetHypothesis: "HOME",
      magnitude: 0.08,
      claimConfidence: 0.55,
    }),
    // Verified correlation path: injury/lineup-linked signal (NOT the news itself)
    item({
      evidenceId: "ev_away_depth_deterioration",
      category: "injury",
      epistemicKind: "FACT",
      claim: "AWAY squad depth deteriorated: 8 listed unavailable (lineup feed)",
      entityRef: "away_team",
      eventId,
      sourceId: "lineup_feed",
      sourceUrl: null,
      publishedAt: before,
      availableAt: before,
      observedAt: before,
      temporalPrecision: "exact",
      polarity: "SUPPORTS",
      targetHypothesis: "HOME",
      magnitude: 0.1,
      claimConfidence: 0.5,
      confirmations: ["ev_news_gastro_context"],
    }),
    item({
      evidenceId: "ev_h2h_contradict",
      category: "historical",
      epistemicKind: "QUANTITATIVE_EVIDENCE",
      claim: "H2H: AWAY won 3 of last 4 meetings",
      entityRef: null,
      eventId,
      sourceId: "h2h_dataset",
      sourceUrl: null,
      publishedAt: null,
      availableAt: before,
      observedAt: before,
      temporalPrecision: "dataset_window",
      polarity: "CONTRADICTS",
      targetHypothesis: "HOME",
      magnitude: -0.07,
      claimConfidence: 0.45,
    }),
    item({
      evidenceId: "ev_market_disagreement",
      category: "market",
      epistemicKind: "QUANTITATIVE_EVIDENCE",
      claim: "Sharp book diverges: Pinnacle holds longer HOME price vs soft books",
      entityRef: null,
      eventId,
      sourceId: "pinnacle_snapshot",
      sourceUrl: null,
      publishedAt: null,
      availableAt: before,
      observedAt: before,
      temporalPrecision: "exact",
      polarity: "CONTRADICTS",
      targetHypothesis: "HOME",
      magnitude: -0.05,
      claimConfidence: 0.5,
    }),
    item({
      evidenceId: "ev_model_judgment",
      category: "statistical",
      epistemicKind: "MODEL_JUDGMENT",
      claim: "Model blend after contradictors → HOME 0.57",
      entityRef: null,
      eventId,
      sourceId: "research_model_v0",
      sourceUrl: null,
      publishedAt: null,
      availableAt: asOf,
      observedAt: asOf,
      temporalPrecision: "exact",
      polarity: "SUPPORTS",
      targetHypothesis: "HOME",
      magnitude: 0.57,
      claimConfidence: null,
    }),
    contextualNews,
    blockedNews,
  ];
}

export function runBlindEvidenceFixture(): AssessmentReport {
  return buildAssessmentReport({
    eventId: EVIDENCE_BLIND_FIXTURE.eventId,
    asOf: EVIDENCE_BLIND_FIXTURE.asOf,
    hypothesis: EVIDENCE_BLIND_FIXTURE.hypothesis,
    items: buildBlindEvidenceFixtureItems(),
    probability: EVIDENCE_BLIND_FIXTURE.modelProbability,
    validate: true,
  });
}
