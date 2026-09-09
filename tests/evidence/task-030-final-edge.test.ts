import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BlindLeakageError,
  ExperimentIntegrityError,
} from "@/domain/eval/actuarial-018/integrity";
import { assertLockedBeforeReveal, assertOutcomeAbsentFromDecision } from "@/domain/eval/capital-020/lock";
import { brier3 } from "@/domain/eval/capital-020/models";
import { normalizeMarketProbabilities } from "@/domain/odds/math";
import {
  auditTask030,
  fingerprint030,
  leakAutoPromote030,
  leakPostTestSelection,
  loadExp030Config,
  runHostileBattery030,
  runTask030,
  verdict030,
} from "@/domain/eval/final-edge-lab";
import {
  leakCloseBin,
  leakFutureElo,
  leakFutureForm,
  leakFutureH2H,
  leakFutureMarket,
  parseMovementCsv,
} from "@/domain/eval/final-feature-reconstruction";
import { residualPredict } from "@/domain/eval/incremental-029/residual";
import {
  leakCloseAtT1h,
  leakDateOnlyToStrict,
  leakFeatureSelectOnTest,
  leakOutcome,
} from "@/domain/eval/incremental-029/leakage";

describe("TASK 030 final pre-match edge lab", () => {
  it("1-8 hostile leaks HARD FAIL", () => {
    const asOf = new Date("2016-06-01T12:00:00.000Z").getTime();
    assert.throws(() => leakOutcome({ outcome: "HOME" }), BlindLeakageError);
    assert.throws(() => leakFutureForm(asOf + 1, asOf), BlindLeakageError);
    assert.throws(() => leakFutureElo(asOf + 1, asOf), BlindLeakageError);
    assert.throws(() => leakFutureH2H(asOf + 1, asOf), BlindLeakageError);
    assert.throws(() => leakFutureMarket(asOf + 1, asOf), BlindLeakageError);
    assert.throws(() => leakCloseBin(0), BlindLeakageError);
    assert.throws(() => leakCloseAtT1h(true), BlindLeakageError);
    assert.throws(() => leakDateOnlyToStrict("DATE_ONLY", true), BlindLeakageError);
    assert.throws(() => leakPostTestSelection(), ExperimentIntegrityError);
    assert.throws(() => leakFeatureSelectOnTest(true), ExperimentIntegrityError);
  });

  it("9 market baseline de-vig available on STRICT odds", () => {
    const p = normalizeMarketProbabilities([2, 2, 2]);
    assert.ok(Math.abs(p[0]! - 1 / 3) < 1e-12);
    assert.equal(brier3([1, 0, 0], 0), 0);
    const m: [number, number, number] = [0.5, 0.3, 0.2];
    const r = residualPredict(m, [0, 0], [
      [0.2, 0.2],
      [0.2, 0.2],
      [0.2, 0.2],
    ]);
    assert.ok(Math.abs(r[0]! - m[0]!) < 1e-12);
  });

  it("10-12 annual 1000, no year carry, insufficient End=null", async () => {
    const report = await runTask030({ skipHeavy: true });
    for (const row of report.annual) {
      assert.equal(row.start, 1000);
      if (row.bets === 0) assert.equal(row.end, null);
    }
    assert.equal(report.verdict, "INSUFFICIENT_DATA");
  });

  it("13-20 winner/auto/real_money/evidence/reliability/LOCK/REVEAL/reproducible", async () => {
    assert.throws(() => leakAutoPromote030(true), ExperimentIntegrityError);
    assert.throws(() => assertLockedBeforeReveal(false), BlindLeakageError);
    assert.throws(() => assertOutcomeAbsentFromDecision({ outcome: "AWAY" }), BlindLeakageError);
    const locked = true;
    assertLockedBeforeReveal(locked);
    const a = await runTask030({ skipHeavy: true });
    const b = await runTask030({ skipHeavy: true });
    assert.equal(a.winner, null);
    assert.equal(a.auto_promotion, false);
    assert.equal(a.real_money, false);
    assert.equal(a.production, "NOT_DEPLOYABLE");
    const g = a.sample_assessment?.evidenceGraph;
    assert.ok(g);
    const items = [...g!.supporting, ...g!.contradicting, ...g!.contextual];
    assert.ok(items.length + g!.insufficient.length > 0);
    assert.ok(items.every((i) => i.sourceReliability === null));
    assert.ok(runHostileBattery030().every((x) => x.throws));
    assert.equal(auditTask030(a).ok, true, auditTask030(a).failures.join(","));
    const cfg = loadExp030Config();
    assert.equal(cfg.winner, null);
    assert.equal(cfg.auto_promotion, false);
    assert.equal(cfg.real_money, false);
    assert.equal(cfg.as_of_policy, "STRICT_AS_OF");
    const fpA = fingerprint030({
      verdict: a.verdict,
      scores: Object.fromEntries(Object.entries(a.scores).map(([k, v]) => [k, { TEST: v.TEST, HOLDOUT: v.HOLDOUT }])),
      selected: a.selected_families,
    });
    const fpB = fingerprint030({
      verdict: b.verdict,
      scores: Object.fromEntries(Object.entries(b.scores).map(([k, v]) => [k, { TEST: v.TEST, HOLDOUT: v.HOLDOUT }])),
      selected: b.selected_families,
    });
    assert.equal(fpA, fpB);
    assert.equal(a.fingerprint, fpA);
    const books = parseMovementCsv("match_id,bookmaker,home_odds,draw_odds,away_odds\n1,a,2,3,4\n");
    assert.equal(books.length, 1);
    assert.equal(verdict030({ fixture: true, testN: 3, beatsTest: true, holmRejects: true, holdoutAlsoBeats: true, calibrationOk: true }), "INSUFFICIENT_DATA");
  });
});
