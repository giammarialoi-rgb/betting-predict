/**
 * TASK 015 — Evidence & Attribution Layer V1
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AssessmentEvidenceError,
  assertAssessmentHasEvidence,
  assertNewsNotSolePredictiveJustification,
  buildAssessmentReport,
  buildEvidenceGraph,
  evidenceItemFromInformation,
  evidenceItemFromWhyFactor,
  evidenceItemsFromWhyFactors,
  runBlindEvidenceFixture,
  EVIDENCE_BLIND_FIXTURE,
} from "@/domain/evidence/index";
import type { EvidenceItem } from "@/domain/evidence/types";
import type { WhyFactor } from "@/domain/eval/why-explanation";
import type { InformationEvent } from "@/domain/info/contracts";
import { explainDecision } from "@/domain/eval/explain-decision";

function baseItem(
  over: Partial<EvidenceItem> & Pick<EvidenceItem, "evidenceId" | "polarity" | "claim">,
): EvidenceItem {
  return {
    category: "statistical",
    epistemicKind: "QUANTITATIVE_EVIDENCE",
    entityRef: null,
    eventId: "evt_x",
    sourceId: "src",
    sourceUrl: null,
    publishedAt: null,
    availableAt: new Date("2026-09-06T16:00:00.000Z"),
    observedAt: new Date("2026-09-06T16:00:00.000Z"),
    temporalPrecision: "exact",
    targetHypothesis: "HOME",
    magnitude: null,
    claimConfidence: null,
    sourceReliability: null,
    confirmations: [],
    rebuttals: [],
    ...over,
  };
}

describe("TASK 015 Evidence & Attribution Layer V1", () => {
  it("blind fixture: supporting + contradicting + contextual + blocked", () => {
    const report = runBlindEvidenceFixture();
    assert.equal(report.hypothesis, "HOME");
    assert.equal(report.probability, 0.57);
    assert.equal(report.evidenceStrength, "moderate");
    assert.ok(report.evidenceGraph.supporting.length >= 3);
    assert.ok(report.evidenceGraph.contradicting.length >= 2);
    assert.ok(report.evidenceGraph.contextual.length >= 1);
    assert.ok(report.blockedByTemporal.length >= 1);
    assert.ok(
      report.blockedByTemporal.every(
        (e) => e.availableAt.getTime() > EVIDENCE_BLIND_FIXTURE.asOf.getTime(),
      ),
    );
    assert.ok(report.attributions.length > 0);
    assert.ok(report.attributions.some((a) => a.kind === "news"));
    assert.ok(report.attributions.some((a) => a.kind === "market"));
    for (const e of [
      ...report.evidenceGraph.supporting,
      ...report.evidenceGraph.contradicting,
      ...report.evidenceGraph.contextual,
    ]) {
      assert.equal(e.sourceReliability, null);
    }
  });

  it("assessment without evidence → HARD FAIL", () => {
    assert.throws(
      () =>
        buildAssessmentReport({
          eventId: "evt_x",
          asOf: new Date("2026-09-06T18:00:00.000Z"),
          hypothesis: "HOME",
          items: [],
          probability: 0.58,
        }),
      AssessmentEvidenceError,
    );
  });

  it("probability + explicit insufficient is valid; still no invented reliability", () => {
    const report = buildAssessmentReport({
      eventId: "evt_x",
      asOf: new Date("2026-09-06T18:00:00.000Z"),
      hypothesis: "HOME",
      items: [],
      probability: 0.58,
      insufficient: ["explicit_gap"],
    });
    assertAssessmentHasEvidence(report);
    assertNewsNotSolePredictiveJustification(report);
    assert.equal(report.evidenceGraph.insufficient.length, 1);
  });

  it("future evidence → blocked, not in graph", () => {
    const asOf = new Date("2026-09-06T18:00:00.000Z");
    const { graph, blockedByTemporal } = buildEvidenceGraph({
      eventId: "evt_x",
      asOf,
      hypothesis: "HOME",
      items: [
        baseItem({
          evidenceId: "ok",
          claim: "ok",
          polarity: "SUPPORTS",
        }),
        baseItem({
          evidenceId: "future",
          claim: "after",
          polarity: "SUPPORTS",
          availableAt: new Date("2026-09-06T19:30:00.000Z"),
        }),
      ],
    });
    assert.equal(graph.supporting.length, 1);
    assert.equal(blockedByTemporal.length, 1);
    assert.equal(blockedByTemporal[0]!.evidenceId, "future");
  });

  it("news alone → NO PREDICTIVE EFFECT", () => {
    const asOf = new Date("2026-09-06T18:00:00.000Z");
    const info: InformationEvent = {
      information_type: "NEWS",
      subject: "away",
      published_at: new Date("2026-09-06T14:00:00.000Z"),
      available_at: new Date("2026-09-06T14:30:00.000Z"),
      source: "paper",
      confidence: null,
    };
    const news = evidenceItemFromInformation({
      info,
      eventId: "evt_x",
      targetHypothesis: "HOME",
      evidenceId: "n1",
      claim: "gastro outbreak",
    });
    assert.equal(news.polarity, "CONTEXT_ONLY");
    assert.throws(
      () =>
        buildAssessmentReport({
          eventId: "evt_x",
          asOf,
          hypothesis: "HOME",
          items: [news],
          probability: 0.6,
        }),
      (err: unknown) =>
        err instanceof AssessmentEvidenceError &&
        String(err.message).includes("NEWS_CAUSAL_JUMP"),
    );
    // Context-only without probability is valid
    const ctxOnly = buildAssessmentReport({
      eventId: "evt_x",
      asOf,
      hypothesis: "HOME",
      items: [news],
      probability: null,
      insufficient: ["no_model_output"],
    });
    assert.equal(ctxOnly.evidenceGraph.contextual.length, 1);
    assert.equal(ctxOnly.probability, null);
  });

  it("source reliability always null", () => {
    const report = runBlindEvidenceFixture();
    for (const a of report.attributions) {
      const match = [
        ...report.evidenceGraph.supporting,
        ...report.evidenceGraph.contradicting,
        ...report.evidenceGraph.contextual,
        ...report.blockedByTemporal,
      ].find((e) => e.evidenceId === a.evidenceId);
      if (match) assert.equal(match.sourceReliability, null);
    }
  });

  it("WhyFactor adapter preserves explainDecision compatibility", () => {
    const factors: WhyFactor[] = [
      {
        feature: "form_home",
        value: 0.7,
        asOf: "2026-09-06T16:00:00.000Z",
        source: "pack",
        contribution: "supporting",
        quality: "dataset_window",
      },
      {
        feature: "h2h",
        value: -0.2,
        asOf: "2026-09-06T16:00:00.000Z",
        source: "pack",
        contribution: "contradicting",
        quality: "dataset_window",
      },
    ];
    const explained = explainDecision({
      eventId: "evt_x",
      asOf: new Date("2026-09-06T18:00:00.000Z"),
      factors,
    });
    assert.ok(explained.supporting_data.length >= 1);
    const items = evidenceItemsFromWhyFactors({
      factors,
      eventId: "evt_x",
      targetHypothesis: "HOME",
    });
    assert.equal(items.length, 2);
    assert.equal(items[0]!.polarity, "SUPPORTS");
    assert.equal(items[1]!.polarity, "CONTRADICTS");
    assert.equal(items[0]!.sourceReliability, null);
    const one = evidenceItemFromWhyFactor({
      factor: factors[0]!,
      eventId: "evt_x",
      targetHypothesis: "HOME",
    });
    assert.equal(one.epistemicKind, "QUANTITATIVE_EVIDENCE");
  });

  it("temporal leak in graph → HARD FAIL", () => {
    const asOf = new Date("2026-09-06T18:00:00.000Z");
    const future = baseItem({
      evidenceId: "leaked",
      claim: "leaked",
      polarity: "SUPPORTS",
      availableAt: new Date("2026-09-06T19:00:00.000Z"),
      epistemicKind: "MODEL_JUDGMENT",
    });
    assert.throws(
      () =>
        assertAssessmentHasEvidence({
          eventId: "evt_x",
          asOf,
          hypothesis: "HOME",
          probability: 0.5,
          evidenceStrength: "weak",
          narrativeSummary: "bad",
          evidenceGraph: {
            eventId: "evt_x",
            asOf,
            hypothesis: "HOME",
            supporting: [future],
            contradicting: [],
            contextual: [],
            insufficient: [],
          },
          attributions: [],
          blockedByTemporal: [],
        }),
      AssessmentEvidenceError,
    );
  });
});
