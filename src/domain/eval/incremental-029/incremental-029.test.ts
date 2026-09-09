import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BlindLeakageError,
  ExperimentIntegrityError,
  TemporalSplitError,
} from "@/domain/eval/actuarial-018/integrity";
import { brier3 } from "@/domain/eval/capital-020/models";
import { normalizeMarketProbabilities } from "@/domain/odds/math";
import { auditTask029 } from "@/domain/eval/incremental-029/audit";
import { loadExp029Config } from "@/domain/eval/incremental-029/config";
import { classifyDateOnly } from "@/domain/eval/incremental-029/acquire";
import { runTask029 } from "@/domain/eval/incremental-029/lab";
import {
  leakAutoPromote,
  leakCloseAtT1h,
  leakDateOnlyToStrict,
  leakFeatureSelectOnTest,
  leakFutureFeature,
  leakHoldoutTrain,
  leakInventedTimestamp,
  leakMatchAmbiguous,
  leakOutcome,
  leakRandomSplit,
  leakReliability,
  runHostileBattery029,
} from "@/domain/eval/incremental-029/leakage";
import { residualPredict } from "@/domain/eval/incremental-029/residual";
import { parseBooksCsv } from "@/domain/eval/incremental-029/overlay";

describe("TASK 029 informational edge discovery", () => {
  it("1-4 hostile leaks: future, DATE_ONLY, outcome, close", () => {
    const asOf = new Date("2016-06-01T12:00:00.000Z");
    assert.throws(() => leakFutureFeature(new Date("2016-06-01T13:00:00Z"), asOf), BlindLeakageError);
    assert.throws(() => leakDateOnlyToStrict("DATE_ONLY", true), BlindLeakageError);
    assert.throws(() => leakOutcome({ outcome: "HOME" }), BlindLeakageError);
    assert.throws(() => leakCloseAtT1h(true), BlindLeakageError);
  });

  it("5 market baseline de-vig reproducible", () => {
    const p = normalizeMarketProbabilities([2, 2, 2]);
    assert.ok(Math.abs(p[0]! - 1 / 3) < 1e-12);
    assert.equal(brier3([1, 0, 0], 0), 0);
  });

  it("6-7 feature selection on TEST and random split hard-fail; residual x=0 is market", () => {
    assert.throws(() => leakFeatureSelectOnTest(true), ExperimentIntegrityError);
    assert.throws(() => leakRandomSplit(), TemporalSplitError);
    const m: [number, number, number] = [0.5, 0.3, 0.2];
    const p = residualPredict(m, [0, 0], [
      [0.1, 0.1],
      [0.1, 0.1],
      [0.1, 0.1],
    ]);
    assert.ok(Math.abs(p[0]! - m[0]!) < 1e-12);
    assert.ok(Math.abs(p[1]! - m[1]!) < 1e-12);
  });

  it("8-10 annual 1000, no year carry, insufficient End=null", async () => {
    const report = await runTask029({ skipHeavy: true });
    for (const row of report.annual) {
      assert.equal(row.start, 1000);
      if (row.bets === 0) assert.equal(row.end, null);
    }
    assert.equal(report.verdict, "INSUFFICIENT_DATA");
  });

  it("11-16 evidence, blocked, reliability null, MATCH_AMBIGUOUS, HOLDOUT, no auto-promote", async () => {
    assert.throws(() => leakInventedTimestamp(), BlindLeakageError);
    assert.throws(() => leakHoldoutTrain(true), BlindLeakageError);
    assert.throws(() => leakMatchAmbiguous("MATCH_AMBIGUOUS"), BlindLeakageError);
    assert.throws(() => leakReliability(0.7), BlindLeakageError);
    assert.throws(() => leakAutoPromote(true), ExperimentIntegrityError);
    assert.equal(classifyDateOnly("DATE_ONLY"), "B_RESEARCH");
    const report = await runTask029({ skipHeavy: true });
    assert.equal(report.winner, null);
    assert.equal(report.real_money, false);
    assert.equal(report.auto_promote, false);
    assert.equal(report.HOLDOUT_TOUCHED, false);
    assert.equal(report.promotion, "BLOCKED");
    const g = report.sample_assessment?.evidenceGraph;
    assert.ok(g);
    const items = [...g!.supporting, ...g!.contradicting, ...g!.contextual];
    assert.ok(items.every((i) => i.sourceReliability === null));
    assert.ok(g!.insufficient.length + g!.supporting.length + g!.contextual.length > 0);
    assert.ok(runHostileBattery029().every((x) => x.throws));
    const books = parseBooksCsv("match_id,bookmaker,home_odds,draw_odds,away_odds\n1,a,2,3,4\n");
    assert.equal(books.length, 1);
    const audited = auditTask029(report);
    assert.equal(audited.ok, true, audited.failures.join(","));
    const cfg = loadExp029Config();
    assert.equal(cfg.feature_selection_on_test, false);
  });
});
