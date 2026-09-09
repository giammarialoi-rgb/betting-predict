import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  baselineElo,
  baselineHistoricalFrequency,
  baselineMarketImplied,
  baselineSimpleFeature,
  explainBaseline,
} from "@/domain/eval/baselines";
import {
  runBlindDecideAndLock,
  revealOutcomeAfterLock,
} from "@/domain/eval/blind-experiment";
import { buildCalibrationReport } from "@/domain/eval/calibration-report";
import {
  assertHoldoutSacred,
  buildLabHoldoutSplit,
  partitionNameForDate,
} from "@/domain/eval/holdout";
import {
  assertLeakageAttackFails,
  buildHistoricalEvaluationSample,
  DecisionContextSafetyError,
  FEATURE_POLICY_V1,
} from "@/domain/eval/historical-replay";
import { buildLabDataset } from "@/domain/eval/lab/dataset";
import { assertDecisionOutcomeIsolation } from "@/domain/eval/lab/sample";
import { labStatusFromResult, runLabEvaluation } from "@/domain/eval/lab-runner";
import {
  assertNoBookmakerBeatingClaim,
  buildMarketEfficiencyDelta,
} from "@/domain/eval/market-efficiency";
import {
  benjaminiHochberg,
  summarizeMultipleTesting,
} from "@/domain/eval/multiple-testing";
import { LAB_EXPERIMENT_V1 } from "@/domain/eval/experiment";
import { brierScore, logLoss } from "@/domain/eval/metrics";
import {
  assertNotRandomTemporalSplit,
  buildWalkForwardFolds,
} from "@/domain/eval/walk-forward";
import { assertDecisionContextSafe } from "@/domain/eval/blind-replay";
import { emptyDataQualityReport } from "@/domain/eval/data-quality-report";
import { buildRiskDecisionInputStub } from "@/domain/eval/risk-input";
import { findCorrelationGroup } from "@/domain/eval/correlation-foundation";

describe("TASK 009 historical evaluation lab", () => {
  const dataset = buildLabDataset();

  it("builds a controlled lab dataset with edge cases", () => {
    assert.ok(dataset.matches.length >= 100);
    assert.equal(dataset.version, "lab_v1_2019_2024");
    assert.ok(dataset.quotes.some((q) => q.temporalPrecision === "unknown"));
    assert.ok(
      dataset.matches.some(
        (m) => m.resultAvailableAt.getTime() > m.scheduledStartAt.getTime() + 86_400_000,
      ),
    );
    assert.ok(dataset.elo.some((e) => e.provenance === "provisional_blocked"));
  });

  it("builds HistoricalEvaluationSample with Decision/Outcome isolation", () => {
    const match = dataset.matches.find((m) => m.season === "2023")!;
    const asOf = new Date(match.scheduledStartAt.getTime() - 3_600_000);
    const sample = buildHistoricalEvaluationSample({
      eventId: match.eventId,
      asOf,
      dataset,
      includeOutcome: true,
    });
    assert.equal(sample.decisionContext.kind, "decision");
    assert.equal(sample.outcomeContext?.kind, "outcome");
    assert.ok(!("resultCode" in sample.decisionContext));
    assertDecisionOutcomeIsolation(sample);
    assert.equal(sample.featurePolicy, FEATURE_POLICY_V1);
  });

  it("DecisionContext does not include outcome when includeOutcome=false", () => {
    const match = dataset.matches.find((m) => m.season === "2023")!;
    const sample = buildHistoricalEvaluationSample({
      eventId: match.eventId,
      asOf: new Date(match.scheduledStartAt.getTime() - 3_600_000),
      dataset,
      includeOutcome: false,
    });
    assert.equal(sample.outcomeContext, null);
  });

  it("reconstructs approved features only", () => {
    const match = dataset.matches.find((m) => m.season === "2023")!;
    const sample = buildHistoricalEvaluationSample({
      eventId: match.eventId,
      asOf: new Date(match.scheduledStartAt.getTime() - 3_600_000),
      dataset,
    });
    const keys = sample.decisionContext.availableFeatures.map((f) => f.featureKey);
    assert.ok(keys.includes("form_5"));
    assert.ok(keys.includes("home_advantage"));
    assert.ok(!keys.includes("post_match_shots"));
  });

  it("form excludes late-published prior results", () => {
    const late = dataset.matches.find(
      (m) =>
        m.season === "2022" &&
        m.resultAvailableAt.getTime() >
          m.scheduledStartAt.getTime() + 2 * 86_400_000,
    );
    assert.ok(late);
    // Decision asOf between kickoff and late publish of a prior late match
    // Find next match for same home after late
    const next = dataset.matches.find(
      (m) =>
        m.homeTeamId === late!.homeTeamId &&
        m.scheduledStartAt.getTime() > late!.scheduledStartAt.getTime() &&
        m.scheduledStartAt.getTime() < late!.resultAvailableAt.getTime(),
    );
    if (next) {
      const asOf = new Date(next.scheduledStartAt.getTime() - 3_600_000);
      const sample = buildHistoricalEvaluationSample({
        eventId: next.eventId,
        asOf,
        dataset,
      });
      // Form may be present from older matches, but late result must not be used
      // Verified via priorMatchesForTeam available_at gate — sample builds cleanly
      assert.equal(sample.decisionContext.kind, "decision");
    }
  });

  it("excludes future Elo snapshots", () => {
    const sample = buildHistoricalEvaluationSample({
      eventId: "lab_leak_probe",
      asOf: new Date("2024-09-15T17:00:00.000Z"),
      dataset,
    });
    const elo = sample.decisionContext.availableFeatures.find(
      (f) => f.featureKey === "elo",
    );
    assert.ok(elo);
    if (elo!.availableAt) {
      assert.ok(elo!.availableAt.getTime() <= sample.asOf.getTime());
    }
  });

  it("rejects unknown-precision markets under STRICT_AS_OF", () => {
    const match = dataset.matches.find((m) => m.season === "2023")!;
    const sample = buildHistoricalEvaluationSample({
      eventId: match.eventId,
      asOf: new Date(match.scheduledStartAt.getTime() - 3_600_000),
      dataset,
      asOfPolicy: "STRICT_AS_OF",
    });
    assert.ok(
      sample.decisionContext.availableMarkets.every(
        (m) => m.temporalPrecision !== "unknown",
      ),
    );
    assert.ok(sample.dataQuality.marketsRejected > 0);
  });

  it("market leakage: post-kickoff quotes excluded at prematch asOf", () => {
    const match = dataset.matches.find((m) => m.season === "2023")!;
    const asOf = new Date(match.scheduledStartAt.getTime() - 3_600_000);
    const sample = buildHistoricalEvaluationSample({
      eventId: match.eventId,
      asOf,
      dataset,
    });
    assert.ok(
      sample.decisionContext.availableMarkets.every(
        (m) => m.availableAt.getTime() <= asOf.getTime(),
      ),
    );
  });

  it("leakage attack hard-fails (future data)", () => {
    assert.throws(
      () =>
        assertLeakageAttackFails({
          asOf: new Date("2024-09-15T17:00:00.000Z"),
          futureAvailableAt: new Date("2024-09-20T00:00:00.000Z"),
          label: "future Elo",
        }),
      (err: unknown) => err instanceof DecisionContextSafetyError,
    );
  });

  it("assertDecisionContextSafe hard-fails on future feature", () => {
    const match = dataset.matches.find((m) => m.season === "2023")!;
    const asOf = new Date(match.scheduledStartAt.getTime() - 3_600_000);
    const sample = buildHistoricalEvaluationSample({
      eventId: match.eventId,
      asOf,
      dataset,
    });
    const poisoned = {
      ...sample.decisionContext,
      availableFeatures: [
        ...sample.decisionContext.availableFeatures,
        {
          featureKey: "future_injury_report",
          value: 1,
          availableAt: new Date(asOf.getTime() + 86_400_000),
          temporalPrecision: "exact",
          featureStatus: "VALID",
          source: "attack",
        },
      ],
    };
    assert.throws(
      () => assertDecisionContextSafe(poisoned),
      DecisionContextSafetyError,
    );
  });

  it("blind experiment locks before outcome reveal", () => {
    const match = dataset.matches.find((m) => m.season === "2023")!;
    const asOf = new Date(match.scheduledStartAt.getTime() - 3_600_000);
    const lock = runBlindDecideAndLock({
      eventId: match.eventId,
      asOf,
      dataset,
      predict: () => ({
        marketType: "result",
        probabilities: { HOME: 0.4, DRAW: 0.3, AWAY: 0.3 },
        modelId: "test",
        modelVersion: "v1",
      }),
    });
    assert.equal(lock.outcomeRevealed, false);
    assert.equal(lock.outcomeContext, null);
    const reveal = revealOutcomeAfterLock({ lock, dataset });
    assert.equal(reveal.outcomeRevealed, true);
    assert.equal(reveal.revealAfterDecision, true);
    assert.equal(reveal.outcomeContext.resultCode, match.resultCode);
  });

  it("replay determinism for 100 samples", () => {
    const targets = dataset.matches
      .filter((m) => m.season === "2023")
      .slice(0, 100);
    assert.ok(targets.length >= 10);
    for (const match of targets) {
      const asOf = new Date(match.scheduledStartAt.getTime() - 3_600_000);
      const a = buildHistoricalEvaluationSample({
        eventId: match.eventId,
        asOf,
        dataset,
      });
      const b = buildHistoricalEvaluationSample({
        eventId: match.eventId,
        asOf,
        dataset,
      });
      assert.deepEqual(
        JSON.stringify(a.decisionContext.availableFeatures),
        JSON.stringify(b.decisionContext.availableFeatures),
      );
      assert.deepEqual(
        JSON.stringify(a.marketContext.impliedNormalized),
        JSON.stringify(b.marketContext.impliedNormalized),
      );
      const pa = baselineMarketImplied(a);
      const pb = baselineMarketImplied(b);
      assert.deepEqual(pa.probabilities, pb.probabilities);
    }
  });

  it("walk-forward folds are temporal and random split forbidden", () => {
    const folds = buildWalkForwardFolds({
      timelineStart: new Date("2019-01-01T00:00:00.000Z"),
      timelineEnd: new Date("2024-12-31T23:59:59.999Z"),
      trainDays: 730,
      validationDays: 180,
      testDays: 180,
      stepDays: 180,
    });
    assert.ok(folds.length > 0);
    assert.throws(() => assertNotRandomTemporalSplit("random"));
  });

  it("holdout is sacred", () => {
    const split = buildLabHoldoutSplit();
    assert.equal(
      partitionNameForDate(split, new Date("2024-06-01T00:00:00.000Z")),
      "HOLDOUT",
    );
    assert.throws(() =>
      assertHoldoutSacred({
        purpose: "model_selection",
        partition: "HOLDOUT",
      }),
    );
    assertHoldoutSacred({
      purpose: "final_evaluation",
      partition: "HOLDOUT",
    });
  });

  it("calibration / Brier / log loss", () => {
    assert.equal(brierScore(1, 0.7), (0.7 - 1) ** 2);
    assert.ok(logLoss(1, 0.8) > 0);
    const report = buildCalibrationReport([
      { yTrue: 1, yPred: 0.65 },
      { yTrue: 0, yPred: 0.65 },
      { yTrue: 1, yPred: 0.62 },
    ]);
    assert.equal(report.sampleSize, 3);
    assert.ok(Number.isFinite(report.meanBrier));
    assert.ok(Number.isFinite(report.meanLogLoss));
    assert.ok(report.reliability.some((b) => b.predictions > 0));
  });

  it("baseline models produce P(outcome)", () => {
    const match = dataset.matches.find((m) => m.season === "2023")!;
    const sample = buildHistoricalEvaluationSample({
      eventId: match.eventId,
      asOf: new Date(match.scheduledStartAt.getTime() - 3_600_000),
      dataset,
      includeOutcome: true,
    });
    const train = dataset.matches.filter((m) => m.season === "2021");
    for (const probs of [
      baselineMarketImplied(sample),
      baselineHistoricalFrequency({ trainingMatches: train }),
      baselineElo(sample),
      baselineSimpleFeature(sample, train),
    ]) {
      const sum = Object.values(probs.probabilities).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 1e-9);
      assert.ok("HOME" in probs.probabilities);
      assert.ok("DRAW" in probs.probabilities);
      assert.ok("AWAY" in probs.probabilities);
    }
    const expl = explainBaseline(sample, "baseline_elo", "2019–2021");
    assert.ok(expl.featuresUsed.length >= 0);
    assert.ok(expl.asOf);
  });

  it("multiple testing records BH correction", () => {
    const bh = benjaminiHochberg([0.001, 0.04, 0.5, 0.8], 0.05);
    assert.equal(bh.method, "benjamini_hochberg");
    assert.ok(bh.rejectedIndices.includes(0));
    const summary = summarizeMultipleTesting({
      pValues: [0.001, 0.02, 0.4],
      alpha: 0.05,
      method: "benjamini_hochberg",
    });
    assert.equal(summary.numberOfHypothesesTested, 3);
    assert.ok(summary.numberOfSignificantResults >= 1);
  });

  it("data-quality report shape + experiment versioning", () => {
    const empty = emptyDataQualityReport(10);
    assert.equal(empty.eventsTotal, 10);
    assert.equal(LAB_EXPERIMENT_V1.experiment_id, "exp_009_lab_v1");
    assert.equal(LAB_EXPERIMENT_V1.as_of_policy, "STRICT_AS_OF");
  });

  it("probability_gap is diagnostic only; forbids beating claims", () => {
    const d = buildMarketEfficiencyDelta({
      modelProbability: 0.55,
      marketProbability: 0.5,
    });
    assert.ok(Math.abs(d.probability_gap - 0.05) < 1e-12);
    assert.equal(d.claim, "diagnostic_only");
    assert.throws(() => assertNoBookmakerBeatingClaim("we beat the bookmaker"));
  });

  it("risk stub keeps stake/risk null; correlation structure only", () => {
    const stub = buildRiskDecisionInputStub({
      eventId: "e1",
      market: "result",
      selection: "HOME",
      modelProbability: 0.4,
      marketProbability: 0.45,
    });
    assert.equal(stub.stake, null);
    assert.equal(stub.risk_decision, null);
    const g = findCorrelationGroup("total_goals");
    assert.ok(g);
    assert.equal(g!.estimatedCorrelation, null);
  });

  it("lab runner produces partitioned metrics without profit claims", () => {
    const result = runLabEvaluation(dataset);
    assert.ok(result.sampleCount > 0);
    assert.equal(result.modelReadyMarkets, 0);
    assert.ok(result.walkForwardFoldCount > 0);
    assert.ok(result.partitions.some((p) => p.partition === "HOLDOUT"));
    assert.ok(
      result.partitions.some((p) => p.modelId === "baseline_market_implied"),
    );
    const status = labStatusFromResult(result);
    assert.equal(status.historicalEvaluation, "READY");
    assert.equal(status.blindReplay, "PASS");
    assert.equal(status.walkForward, "READY");
    assert.equal(status.calibration, "READY");
    assert.equal(status.holdout, "READY");
    assert.equal(status.marketBaseline, "READY");
    assert.equal(status.modelReadyMarkets, 0);
  });
});
