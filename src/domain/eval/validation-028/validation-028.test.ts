import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BlindLeakageError,
  ExperimentIntegrityError,
  TemporalSplitError,
} from "@/domain/eval/actuarial-018/integrity";
import { brier3, logLoss3 } from "@/domain/eval/capital-020/models";
import { holmBonferroni } from "@/domain/eval/multiple-testing";
import { normalizeMarketProbabilities } from "@/domain/odds/math";
import { auditTask028 } from "@/domain/eval/validation-028/audit";
import { loadExp028Config } from "@/domain/eval/validation-028/config";
import { runTask028 } from "@/domain/eval/validation-028/lab";
import {
  leakClvInDecision,
  leakCloseBeforeLock,
  leakFutureFeature,
  leakHoldoutBeforeFreeze,
  leakHoldoutTrain,
  leakNegativeBankroll,
  leakOutcomeInDecision,
  leakRandomSplit,
  leakReliability,
  leakSilentThousand,
  leakThresholdOnTest,
  leakCarryYear,
  runHostileBattery028,
} from "@/domain/eval/validation-028/leakage";
import { corpusPartition } from "@/domain/eval/validation-028/partition";
import { blockBootstrapMeanCI } from "@/domain/eval/validation-028/stats";

describe("TASK 028 scientific validation", () => {
  it("1-6 hostile leaks are hard fails", () => {
    const asOf = new Date("2016-06-01T12:00:00.000Z");
    assert.throws(() => leakFutureFeature(new Date("2016-06-01T13:00:00Z"), asOf), BlindLeakageError);
    assert.throws(() => leakOutcomeInDecision({ outcome: "HOME" }), BlindLeakageError);
    assert.throws(() => leakCloseBeforeLock(true, false), BlindLeakageError);
    assert.throws(() => leakHoldoutTrain(true), BlindLeakageError);
    assert.throws(() => leakThresholdOnTest(true), ExperimentIntegrityError);
    assert.throws(() => leakRandomSplit(), TemporalSplitError);
  });

  it("7-8 market de-vig is proportional", () => {
    const even = normalizeMarketProbabilities([2, 2, 2]);
    assert.ok(Math.abs(even[0]! - 1 / 3) < 1e-12);
    assert.ok(Math.abs(even.reduce((s, x) => s + x, 0) - 1) < 1e-12);
    const raw = [1 / 1.8, 1 / 3.5, 1 / 4.5];
    const s = raw.reduce((a, b) => a + b, 0);
    const p = normalizeMarketProbabilities([1.8, 3.5, 4.5]);
    assert.ok(Math.abs(p[0]! - raw[0]! / s) < 1e-12);
    assert.ok(Math.abs(p[1]! - raw[1]! / s) < 1e-12);
    assert.ok(Math.abs(p[2]! - raw[2]! / s) < 1e-12);
  });

  it("9-10 Brier and LogLoss identities", () => {
    assert.equal(brier3([1, 0, 0], 0), 0);
    assert.ok(Math.abs(brier3([1, 0, 0], 1) - 2 / 3) < 1e-12);
    assert.ok(Math.abs(brier3([0.5, 0.25, 0.25], 0) - 0.125) < 1e-12);
    assert.ok(Math.abs(logLoss3([0.5, 0.25, 0.25], 0) - -Math.log(0.5)) < 1e-12);
    assert.ok(logLoss3([1, 0, 0], 0) < 1e-8);
  });

  it("11 bootstrap is deterministic with frozen seed 28", () => {
    const args = {
      values: [1, -1, 0.5, -0.5, 0.2],
      blockIds: ["w1", "w1", "w2", "w2", "w3"],
      nBoot: 50,
      seed: 28,
      alpha: 0.05,
    };
    assert.deepEqual(blockBootstrapMeanCI(args), blockBootstrapMeanCI(args));
  });

  it("12 Holm–Bonferroni adjusts and rejects in order", () => {
    const r = holmBonferroni([0.04, 0.01, 0.2], 0.05);
    assert.equal(r.method, "holm_bonferroni");
    assert.equal(r.rejected[1], true);
    assert.equal(r.rejected[0], false);
    assert.ok(r.adjusted[1]! <= r.adjusted[0]!);
    assert.ok(r.adjusted[0]! <= r.adjusted[2]!);
  });

  it("13-16 annual 1000 reset, no year carry, zero-data End=null, negative bankroll leak", () => {
    assert.throws(() => leakSilentThousand(1000, 0), BlindLeakageError);
    assert.throws(() => leakCarryYear(1100, 1100), BlindLeakageError);
    assert.throws(() => leakNegativeBankroll(-1), BlindLeakageError);
  });

  it("17-20 evidence graph, reliability null, CLV out of DecisionContext, HOLDOUT after freeze", () => {
    assert.throws(() => leakClvInDecision({ clv: 0.02 }), BlindLeakageError);
    assert.throws(() => leakReliability(0.9), BlindLeakageError);
    assert.throws(() => leakHoldoutBeforeFreeze(true, false), BlindLeakageError);
  });

  it("hostile battery all throw", () => {
    const battery = runHostileBattery028();
    assert.ok(battery.every((x) => x.throws), battery.filter((x) => !x.throws).map((x) => x.id).join(","));
  });

  it("corpus partitions are temporal, not random", () => {
    const cfg = loadExp028Config();
    assert.equal(cfg.random_split, false);
    assert.equal(cfg.threshold_selected_from_test, false);
    assert.equal(cfg.holdout_for_training, false);
    assert.equal(corpusPartition("2015-12-01T15:00:00.000Z", cfg), "TRAIN");
    assert.equal(corpusPartition("2016-04-15T15:00:00.000Z", cfg), "VALIDATION");
    assert.equal(corpusPartition("2016-07-01T15:00:00.000Z", cfg), "TEST");
    assert.equal(corpusPartition("2016-10-01T15:00:00.000Z", cfg), "HOLDOUT");
  });

  it("skipHeavy lab: INSUFFICIENT_DATA, no silent 1000, winner null, evidence required", async () => {
    const cfg = loadExp028Config();
    assert.equal(cfg.winner, null);
    assert.equal(cfg.frozen_edge_threshold, 0.03);
    const report = await runTask028({ skipHeavy: true });
    assert.equal(report.winner, null);
    assert.equal(report.declared_best, false);
    assert.equal(report.real_money, false);
    assert.equal(report.verdict, "INSUFFICIENT_DATA");
    assert.equal(report.clv, "CLV_UNAVAILABLE");
    assert.equal(report.HOLDOUT_TOUCHED, false);
    assert.equal(report.promotion.promotion, false);
    assert.equal(report.repro.bootstrap_seed, 28);
    assert.ok(report.sample_assessment);
    const g = report.sample_assessment!.evidenceGraph;
    assert.ok(g.supporting.length + g.contradicting.length + g.contextual.length + g.insufficient.length > 0);
    const items = [...g.supporting, ...g.contradicting, ...g.contextual];
    assert.ok(items.every((i) => i.sourceReliability === null));
    for (const row of report.annual) {
      assert.equal(row.start, 1000);
      if (row.bets === 0) assert.equal(row.end, null);
    }
    const audited = auditTask028(report);
    assert.equal(audited.ok, true, audited.failures.join(","));
  });
});
