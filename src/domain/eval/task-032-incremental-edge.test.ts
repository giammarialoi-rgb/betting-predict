import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BlindLeakageError, ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { holmBonferroni } from "@/domain/eval/multiple-testing";
import { leakCloseBin, leakFutureForm, leakFutureMarket } from "@/domain/eval/final-feature-reconstruction";
import { leakCloseAtT1h, leakFeatureSelectOnTest, leakOutcome } from "@/domain/eval/incremental-029/leakage";
import { auditTask032 } from "@/domain/eval/incremental-032/audit";
import { incrementalClass032 } from "@/domain/eval/incremental-032/classify";
import { assertHoldoutLocked032, assertTestLocked032, loadExp032Config } from "@/domain/eval/incremental-032/config";
import { featureFingerprint032 } from "@/domain/eval/incremental-032/feature-audit";
import {
  leakAutoPromote032,
  leakImputationFromTest,
  leakMasanielloProduction,
  leakTuningOnTest,
  runHostileBattery032,
} from "@/domain/eval/incremental-032/leakage";
import { fingerprint032, runTask032, verdict032 } from "@/domain/eval/incremental-032/lab";

describe("TASK 032 incremental edge", () => {
  it("temporal firewall + locks", () => {
    const asOf = Date.parse("2016-06-01T12:00:00.000Z");
    assert.throws(() => leakOutcome({ outcome: "HOME" }), BlindLeakageError);
    assert.throws(() => leakFutureMarket(asOf + 1, asOf), BlindLeakageError);
    assert.throws(() => leakFutureForm(asOf + 1, asOf), BlindLeakageError);
    assert.throws(() => leakCloseAtT1h(true), BlindLeakageError);
    assert.throws(() => leakCloseBin(0), BlindLeakageError);
    assert.throws(() => assertTestLocked032(true), ExperimentIntegrityError);
    assert.throws(() => assertHoldoutLocked032(true), ExperimentIntegrityError);
    assert.throws(() => leakFeatureSelectOnTest(true), ExperimentIntegrityError);
    assert.throws(() => leakTuningOnTest(true), ExperimentIntegrityError);
    assert.throws(() => leakImputationFromTest(true), BlindLeakageError);
    assert.doesNotThrow(() => assertTestLocked032(false));
  });

  it("feature fingerprint + Holm + classes", () => {
    const a = featureFingerprint032({
      policy: "task-032-safe-v1",
      groups: { market_elo: ["elo"] },
      reconstruction: "x",
    });
    const b = featureFingerprint032({
      policy: "task-032-safe-v1",
      groups: { market_elo: ["elo"] },
      reconstruction: "x",
    });
    assert.equal(a, b);
    const holm = holmBonferroni([0.01, 0.04, 0.20], 0.05);
    assert.equal(holm.method, "holm_bonferroni");
    assert.equal(holm.rejected[0], true);
    const score = {
      n: 10,
      brier: 0.2,
      logloss: 1,
      ece: 0.02,
      cal_slope: 1,
      cal_intercept: 0,
      delta_brier: -0.0001,
      delta_logloss: -0.0001,
    };
    assert.equal(
      incrementalClass032({
        id: "market_elo",
        test: score,
        holmRejected: false,
        ci: { low: -0.001, high: 0.001 },
      }),
      "NON_INFERIOR",
    );
    assert.equal(
      incrementalClass032({
        id: "market_elo",
        test: { ...score, delta_brier: 0.01, delta_logloss: 0.01 },
        holmRejected: false,
        ci: { low: 0.001, high: 0.02 },
      }),
      "HARMFUL",
    );
    assert.equal(
      incrementalClass032({
        id: "market_elo",
        test: score,
        holmRejected: true,
        ci: { low: -0.002, high: -0.0001 },
      }),
      "BEATS_MARKET",
    );
  });

  it("bankroll gate + no auto-promotion + reproducibility", async () => {
    assert.throws(() => leakAutoPromote032(true), ExperimentIntegrityError);
    assert.throws(() => leakMasanielloProduction("masaniello"), ExperimentIntegrityError);
    const a = await runTask032({ skipHeavy: true });
    const b = await runTask032({ skipHeavy: true });
    assert.equal(a.winner, null);
    assert.equal(a.auto_promotion, false);
    assert.equal(a.real_money, false);
    assert.equal(a.test_used_for_selection, false);
    assert.equal(a.HOLDOUT_STATUS, "EMPTY");
    assert.equal(a.verdict, "INSUFFICIENT_DATA");
    assert.equal(a.qualified, false);
    for (const row of a.annual) {
      assert.equal(row.start, 1000);
      if (row.bets === 0) assert.equal(row.end, null);
    }
    assert.ok(runHostileBattery032().every((x) => x.throws));
    assert.equal(auditTask032(a).ok, true, auditTask032(a).failures.join(","));
    const cfg = loadExp032Config();
    assert.equal(cfg.test_locked, true);
    assert.equal(cfg.holdout_locked, true);
    assert.equal(cfg.winner, null);
    assert.equal(a.fingerprint, b.fingerprint);
    assert.equal(a.feature_fingerprint, b.feature_fingerprint);
    assert.equal(a.predictions_fingerprint, b.predictions_fingerprint);
    const fp = fingerprint032({
      verdict: a.verdict,
      featureFp: a.feature_fingerprint,
      datasetSha: a.observed_sha256,
      selected: a.selected_on_val,
      testScores: Object.fromEntries(Object.entries(a.scores).map(([k, v]) => [k, v.TEST])),
      predictionsFp: a.predictions_fingerprint,
    });
    assert.equal(fp, a.fingerprint);
    assert.equal(
      verdict032({ fixture: true, testN: 3, selectedClass: "BEATS_MARKET" }),
      "INSUFFICIENT_DATA",
    );
  });
});
