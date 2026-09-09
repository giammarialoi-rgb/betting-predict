import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertNotAggregateAsBookmaker,
  isAggregateOddsLabel,
  canonicalMarketKey,
} from "@/domain/markets/canonical";
import { MarketDiscoveryEngine } from "@/domain/markets/discovery-engine";
import { computeMarketMicrostructure } from "@/domain/markets/microstructure-math";
import {
  assertPackIdempotent,
  loadRealTruthLabPack,
} from "@/domain/eval/real-lab/load-pack";
import {
  buildRealHistoricalEvaluationSample,
  decisionAsOfForEvent,
  DecisionContextSafetyError,
} from "@/domain/eval/real-lab/truth-lab";
import { runRealLabBaseline } from "@/domain/eval/real-lab/baselines-v2";
import { runRealTruthLab } from "@/domain/eval/real-lab/runner";
import {
  assertClubEloNotProvisional,
  assertClubFootballColumnAllowedForStrict,
  clubFootballUsageMode,
} from "@/domain/eval/real-lab/club-football-guard";
import {
  assertHoldoutSacred,
} from "@/domain/eval/holdout";
import {
  assertNotRandomTemporalSplit,
  buildWalkForwardFolds,
} from "@/domain/eval/walk-forward";
import { buildRealLabTemporalConfig, partitionForConfig } from "@/domain/eval/temporal-config";
import { assertDecisionContextSafe } from "@/domain/eval/blind-replay";
import {
  computeDataQualityScore,
  assertNotWinProbability,
} from "@/domain/eval/data-quality-score";
import {
  assertNoAutoModelMutation,
  buildResearchExplanation,
  recordPrediction,
} from "@/domain/eval/research-records";
import { findTopReliableMarkets } from "@/domain/eval/top-n";
import { buildRiskInput } from "@/domain/eval/risk-input-v2";
import { classifyCorrelationRelation } from "@/domain/eval/correlation-foundation";
import { assertTemporalPrecision } from "@/domain/odds/temporal";
import { summarizeMultipleTesting } from "@/domain/eval/multiple-testing";

describe("TASK 010 real truth lab", () => {
  const dataset = loadRealTruthLabPack();

  it("A: loads real historical events from offline pack", () => {
    assert.ok(dataset.events.length >= 40);
    assert.ok(dataset.quotes.length > 100);
    assert.equal(dataset.sources[0]?.role, "PRIMARY");
    assert.ok(dataset.aggregatesSkipped > 0);
  });

  it("B: reconstructs what was known at T", () => {
    const event = dataset.events[10]!;
    const asOf = decisionAsOfForEvent(event);
    const sample = buildRealHistoricalEvaluationSample({
      eventId: event.eventId,
      asOf,
      dataset,
      includeOutcome: false,
      asOfPolicy: "STRICT_AS_OF",
    });
    assert.equal(sample.outcomeContext, null);
    assert.equal(sample.decisionContext.kind, "decision");
    assert.ok(
      sample.decisionContext.availableFeatures.every(
        (f) => !f.availableAt || f.availableAt.getTime() <= asOf.getTime(),
      ),
    );
  });

  it("C/D/E: future feature, future odds, post-match stats hard-fail", () => {
    const event = dataset.events[5]!;
    const asOf = decisionAsOfForEvent(event);
    const sample = buildRealHistoricalEvaluationSample({
      eventId: event.eventId,
      asOf,
      dataset,
    });
    const poisoned = {
      ...sample.decisionContext,
      availableFeatures: [
        ...sample.decisionContext.availableFeatures,
        {
          featureKey: "post_match_shots",
          value: 12,
          availableAt: new Date(asOf.getTime() + 86_400_000),
          temporalPrecision: "exact",
          featureStatus: "VALID",
          source: "attack",
        },
      ],
    };
    assert.throws(() => assertDecisionContextSafe(poisoned), DecisionContextSafetyError);

    assert.throws(() =>
      assertDecisionContextSafe({
        ...sample.decisionContext,
        availableMarkets: [
          {
            marketType: "result",
            selectionSide: "HOME",
            line: null,
            oddsDecimal: 1.01,
            availableAt: new Date(asOf.getTime() + 3_600_000),
            temporalPrecision: "exact",
            observationKind: "exact_tick",
          },
        ],
      }),
    );
  });

  it("F/G: market baseline + at least two statistical baselines", () => {
    const event = dataset.events.find((e) => e.season === "2023") ?? dataset.events[20]!;
    const sample = buildRealHistoricalEvaluationSample({
      eventId: event.eventId,
      asOf: decisionAsOfForEvent(event),
      dataset,
      allowUnknownPrecisionMarkets: true,
      includeOutcome: true,
    });
    assert.ok(sample.marketContext.impliedNormalized);
    const market = runRealLabBaseline("market_implied", sample, dataset.events);
    const elo = runRealLabBaseline("elo", sample, dataset.events);
    const freq = runRealLabBaseline("frequency", sample, dataset.events.slice(0, 10));
    assert.ok(Math.abs(Object.values(market.probabilities).reduce((a, b) => a + b, 0) - 1) < 1e-9);
    assert.ok(Math.abs(Object.values(elo.probabilities).reduce((a, b) => a + b, 0) - 1) < 1e-9);
    assert.ok(Math.abs(Object.values(freq.probabilities).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  });

  it("H/I: walk-forward on real data; holdout sacred", () => {
    const cfg = buildRealLabTemporalConfig();
    const folds = buildWalkForwardFolds({
      timelineStart: cfg.train_start,
      timelineEnd: cfg.holdout_end,
      trainDays: 730,
      validationDays: 180,
      testDays: 180,
      stepDays: 180,
    });
    assert.ok(folds.length > 0);
    assert.equal(
      partitionForConfig(cfg, new Date("2024-06-01T00:00:00.000Z")),
      "HOLDOUT",
    );
    assert.throws(() =>
      assertHoldoutSacred({ purpose: "feature_selection", partition: "HOLDOUT" }),
    );
    assert.throws(() => assertNotRandomTemporalSplit("random"));
  });

  it("J: multiple testing with BH + effect sizes", () => {
    const mt = summarizeMultipleTesting({
      pValues: [0.001, 0.02, 0.4],
      alpha: 0.05,
      method: "benjamini_hochberg",
      effectSizes: [0.02, 0.01, 0.0],
      confidenceIntervals: [
        { low: 0.01, high: 0.03 },
        null,
        null,
      ],
    });
    assert.equal(mt.correctionMethod, "benjamini_hochberg");
    assert.equal(mt.economicSignificanceCount, 0);
    assert.ok(mt.effectSizes.length === 3);
  });

  it("K: explanation + data-quality metadata", () => {
    const dq = computeDataQualityScore({
      exactPrecisionShare: 0,
      knownProvenanceShare: 1,
      completenessShare: 0.8,
      identityResolvedShare: 1,
      duplicateRate: 0,
      freshnessShare: 0.5,
    });
    assert.equal(dq.kind, "DATA_QUALITY");
    assert.throws(() => assertNotWinProbability("WIN_PROBABILITY"));
    const expl = buildResearchExplanation({
      supportingFeatures: ["elo_expected_probability", "form_5"],
      marketEvidence: ["implied_probability"],
      temporalQualityNotes: ["STRICT_AS_OF"],
    });
    assert.ok(expl.reasoning_summary.includes("supporting"));
  });

  it("L: pack load is idempotent", () => {
    assertPackIdempotent();
  });

  it("M: unknown precision cannot become exact", () => {
    assert.throws(() => assertTemporalPrecision("unknown", "exact"));
  });

  it("negative: Max/Avg not bookmaker; provisional Elo; club columns; outcome leak; random split", () => {
    assert.throws(() => assertNotAggregateAsBookmaker("max"));
    assert.throws(() => assertNotAggregateAsBookmaker("avg"));
    assert.ok(isAggregateOddsLabel("MaxH"));
    assert.throws(() => assertClubEloNotProvisional("2025-07-01"));
    assert.throws(() => assertClubFootballColumnAllowedForStrict("C_LTH"));
    assert.throws(() => assertClubFootballColumnAllowedForStrict("Form3Home"));
    assert.throws(() => assertClubFootballColumnAllowedForStrict("MaxHome"));
    assert.equal(clubFootballUsageMode().primary, false);

    const event = dataset.events[0]!;
    const sample = buildRealHistoricalEvaluationSample({
      eventId: event.eventId,
      asOf: decisionAsOfForEvent(event),
      dataset,
      includeOutcome: true,
    });
    assert.equal(sample.decisionContext.kind, "decision");
    assert.ok(!("resultCode" in sample.decisionContext));
    assert.throws(() => assertNoAutoModelMutation("auto_update_model"));
  });

  it("market discovery coverage + canonical key + microstructure", () => {
    const engine = new MarketDiscoveryEngine();
    const coverage = engine.discoverCoverage(dataset);
    assert.ok(coverage.every((c) => c.model_ready === false));
    assert.ok(coverage.some((c) => c.market_type === "result"));
    assert.ok(coverage.some((c) => c.market_type === "total_goals"));
    const top = findTopReliableMarkets(coverage, 5);
    assert.ok(top.length > 0);
    assert.equal(
      canonicalMarketKey({
        sport: "football",
        marketType: "total_goals",
        period: "FT",
        line: 2.5,
        selection: "OVER",
      }),
      "football|total_goals|FT|2.5|OVER|||",
    );
    const micro = computeMarketMicrostructure({
      prices: [1.9, 2.0, 2.1],
      openingOdds: 2.0,
      closingOdds: 1.9,
      marketOddsList: [2.0, 3.4, 4.0],
    });
    assert.ok(micro.dispersion !== null);
    assert.ok(micro.overround !== null);
  });

  it("closing odds before available: STRICT excludes unknown close", () => {
    const event = dataset.events[8]!;
    const sample = buildRealHistoricalEvaluationSample({
      eventId: event.eventId,
      asOf: decisionAsOfForEvent(event),
      dataset,
      asOfPolicy: "STRICT_AS_OF",
    });
    assert.ok(
      sample.decisionContext.availableMarkets.every(
        (m) => m.temporalPrecision !== "unknown",
      ),
    );
  });

  it("future Elo / form excluded via available_at", () => {
    const event = dataset.events.find((e) =>
      e.scheduledStartAt.toISOString().startsWith("2019"),
    )!;
    const sample = buildRealHistoricalEvaluationSample({
      eventId: event.eventId,
      asOf: decisionAsOfForEvent(event),
      dataset,
    });
    const elo = sample.decisionContext.availableFeatures.find(
      (f) => f.featureKey === "home_elo",
    );
    if (elo?.availableAt) {
      assert.ok(elo.availableAt.getTime() <= sample.asOf.getTime());
    }
  });

  it("risk input stake null; correlation classification; prediction record", () => {
    const risk = buildRiskInput({
      eventId: "e1",
      market: "result",
      selection: "HOME",
      modelProbability: 0.4,
      marketProbability: 0.45,
      temporalQuality: "unknown",
      experimentVersion: "exp_010",
    });
    assert.equal(risk.stake, null);
    assert.equal(risk.risk_decision, null);
    const rel = classifyCorrelationRelation({
      eventA: "e1",
      eventB: "e1",
      marketA: "total_goals",
      marketB: "both_teams_to_score",
      selectionA: "OVER",
      selectionB: "YES",
    });
    assert.ok(rel.includes("same_event"));
    assert.ok(rel.includes("cross_market"));
    const pred = recordPrediction({
      model_version: "v1",
      feature_version: "v2",
      experiment_version: "exp_010",
      prediction: { HOME: 0.4, DRAW: 0.3, AWAY: 0.3 },
      market: "result",
      timestamp: new Date().toISOString(),
      eventId: "e1",
    });
    assert.equal(pred.model_version, "v1");
  });

  it("real lab runner compares baselines without betting claims", () => {
    const summary = runRealTruthLab(dataset);
    assert.ok(summary.eventCount >= 40);
    assert.equal(summary.modelReadyMarkets, 0);
    assert.ok(summary.baselines.some((b) => b.modelId === "market_implied"));
    assert.ok(summary.baselines.some((b) => b.modelId === "elo"));
    assert.ok(summary.baselines.some((b) => b.partition === "HOLDOUT"));
    assert.equal(summary.holdoutIntact, true);
    assert.equal(summary.dataQuality.kind, "DATA_QUALITY");
  });
});
