import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BlindLeakageError, ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { holmBonferroni } from "@/domain/eval/multiple-testing";
import { deVig, deVigProportional, deVigShin, deVigPower } from "@/domain/markets/consensus-engine";
import { computeOverround } from "@/domain/odds/math";
import { auditTask034 } from "@/domain/eval/market-034/audit";
import { assertHoldoutLocked034, assertTestLocked034, loadExp034Config } from "@/domain/eval/market-034/config";
import { buildCoverage } from "@/domain/eval/market-034/coverage";
import { classifyMovement034, hosmerLemeshow, MOVEMENT_STEAM_ABS } from "@/domain/eval/market-034/diagnostics";
import { HYPOTHESES_034 } from "@/domain/eval/market-034/hypotheses";
import {
  fingerprint034,
  classifySignal034,
  runTask034,
  verdict034,
} from "@/domain/eval/market-034/lab";
import {
  leakCrossBookFuture,
  leakEloAdded,
  leakFtHt,
  leakOpen035,
  runHostileBattery034,
} from "@/domain/eval/market-034/leakage";
import {
  bestPriceOdds,
  deVigAdditive,
  favoriteBand,
  flbBin,
  flbTable,
  medianOdds,
  mixToward,
  overroundOf,
  priceDispersion,
  proportionalP,
} from "@/domain/eval/market-034/price";

describe("TASK 034 market inefficiency", () => {
  it("temporal snapshots: T-72h and sub-hour coverage 0, no interpolation", () => {
    const cov = buildCoverage({ nEvents: 10, t1h: 10, t24: 4 });
    assert.equal(cov["T-1h"].observed, 10);
    assert.equal(cov["T-1h"].coverage, 1);
    assert.equal(cov["T-24h"].observed, 4);
    assert.equal(cov["T-72h"].observed, 0);
    assert.equal(cov["T-72h"].coverage, 0);
    assert.equal(cov["T-72h"].php_possible, false);
    for (const w of ["T-30m", "T-15m", "T-5m", "T-1m"] as const) {
      assert.equal(cov[w].observed, 0);
      assert.equal(cov[w].coverage, 0);
      assert.equal(cov[w].php_possible, false);
    }
    for (const w of ["T-48h", "T-12h", "T-6h", "T-3h"] as const) {
      assert.equal(cov[w].observed, 0);
      assert.equal(cov[w].coverage, 0);
      assert.equal(cov[w].php_possible, true);
    }
  });

  it("overround + devig methods + additive fallback", () => {
    const odds = [1.8, 3.6, 4.5];
    const ov = computeOverround(odds);
    assert.ok(ov.overround > 1);
    assert.equal(overroundOf({ home: 1.8, draw: 3.6, away: 4.5 }), ov.margin);
    const prop = deVigProportional(odds);
    assert.equal(prop.status, "COMPUTED");
    const shin = deVigShin(odds);
    const power = deVigPower(odds);
    assert.ok(shin.status === "COMPUTED" || shin.status === "NOT_IMPLEMENTED");
    assert.ok(power.status === "COMPUTED" || power.status === "NOT_IMPLEMENTED");
    assert.equal(deVig(odds, "odds_ratio").status, "NOT_IMPLEMENTED");
    const add = deVigAdditive(odds);
    assert.ok(add);
    assert.ok(Math.abs(add[0]! + add[1]! + add[2]! - 1) < 1e-9);
    const tight = deVigAdditive([1.01, 1.01, 1.01]);
    assert.ok(tight);
    const mkt = proportionalP({ home: 1.8, draw: 3.6, away: 4.5 });
    assert.ok(mkt);
  });

  it("cross-book dispersion, consensus, best price", () => {
    const books = [
      { matchId: "1", bookmaker: "a", home: 2.0, draw: 3.4, away: 3.8 },
      { matchId: "1", bookmaker: "b", home: 2.2, draw: 3.3, away: 3.6 },
    ];
    const d = priceDispersion(books.map((b) => b.home));
    assert.equal(d.n, 2);
    assert.equal(d.best_back, 2.2);
    assert.equal(d.worst_price, 2.0);
    assert.ok((d.range ?? 0) > 0);
    const fallback = { home: 2.0, draw: 3.4, away: 3.8 };
    const best = bestPriceOdds(books, fallback);
    assert.equal(best.home, 2.2);
    const med = medianOdds(books, fallback);
    assert.equal(med.home, 2.1);
    assert.deepEqual(bestPriceOdds([books[0]!], fallback), fallback);
  });

  it("movement + frozen reversal labels (no post-hoc patterns)", () => {
    const now: [number, number, number] = [0.5, 0.25, 0.25];
    const early: [number, number, number] = [0.4, 0.3, 0.3];
    const mixed = mixToward(now, early, 0.5);
    assert.ok(mixed[0]! > now[0]!);
    assert.equal(classifyMovement034(null), "no_second_snapshot");
    assert.equal(classifyMovement034(0.001), "stability");
    assert.equal(classifyMovement034(0.01), "drift");
    assert.equal(classifyMovement034(MOVEMENT_STEAM_ABS), "steam");
    assert.equal(classifyMovement034(-MOVEMENT_STEAM_ABS), "reverse_steam");
  });

  it("favorite-longshot bins + favorite bands + HL", () => {
    assert.equal(flbBin(0.05), 0);
    assert.equal(flbBin(0.95), 9);
    assert.equal(favoriteBand(1.4), "<1.50");
    assert.equal(favoriteBand(1.7), "1.50–1.80");
    assert.equal(favoriteBand(2.0), "1.80–2.20");
    assert.equal(favoriteBand(2.5), "2.20–3.00");
    assert.equal(favoriteBand(4), ">3.00");
    const table = flbTable([
      { p: 0.2, y: 0 },
      { p: 0.2, y: 1 },
    ]);
    assert.equal(table.length, 10);
    assert.equal(table[2]!.n, 2);
    const hl = hosmerLemeshow([
      { p: 0.2, y: 0 },
      { p: 0.8, y: 1 },
    ]);
    assert.equal(hl.n, 2);
  });

  it("hypothesis registry frozen before TEST + Holm + locks", () => {
    assert.equal(HYPOTHESES_034.length, 10);
    assert.ok(HYPOTHESES_034.every((h) => h.created_before_test === true));
    assert.equal(HYPOTHESES_034.filter((h) => h.inferential).length, 6);
    const holm = holmBonferroni([0.001, 0.04, 0.2, 0.5, 0.8, 0.9], 0.05);
    assert.equal(holm.method, "holm_bonferroni");
    assert.equal(holm.rejected[0], true);
    assert.throws(() => assertTestLocked034(true), ExperimentIntegrityError);
    assert.throws(() => assertHoldoutLocked034(true), ExperimentIntegrityError);
    assert.doesNotThrow(() => assertTestLocked034(false));
    assert.doesNotThrow(() => assertHoldoutLocked034(false));
    const cfg = loadExp034Config();
    assert.equal(cfg.test_locked, true);
    assert.equal(cfg.holdout_locked, true);
    assert.equal(cfg.feature_selection_on_test, false);
    assert.equal(cfg.open_task_035, false);
    assert.equal(cfg.add_elo, false);
    assert.equal(cfg.winner, null);
  });

  it("leakage battery + CLV not invented + bankroll gate", async () => {
    assert.throws(() => leakFtHt({ FT: "1-0" }), BlindLeakageError);
    assert.throws(() => leakFtHt({ HT: "1-0" }), BlindLeakageError);
    assert.throws(() => leakCrossBookFuture(true), BlindLeakageError);
    assert.throws(() => leakEloAdded(true), ExperimentIntegrityError);
    assert.throws(() => leakOpen035(true), ExperimentIntegrityError);
    const batt = runHostileBattery034();
    assert.ok(batt.every((x) => x.throws), batt.filter((x) => !x.throws).map((x) => x.id).join(","));
    const a = await runTask034({ skipHeavy: true });
    const b = await runTask034({ skipHeavy: true });
    assert.equal(a.winner, null);
    assert.equal(a.auto_promotion, false);
    assert.equal(a.real_money, false);
    assert.equal(a.test_used_for_selection, false);
    assert.equal(a.HOLDOUT_TOUCHED, false);
    assert.equal(a.HOLDOUT_STATUS, "EMPTY");
    assert.equal(a.qualified, false);
    assert.equal(a.CAPITAL_QUALIFIED, false);
    assert.equal(a.BET_COUNT, 0);
    assert.equal(a.CLV, null);
    assert.equal(a.CLV_STATUS, "NOT_COMPUTABLE_LAST_QUOTE_IS_AS_OF");
    assert.equal(a.verdict, "INSUFFICIENT_DATA");
    assert.equal(a.fingerprint, b.fingerprint);
    assert.ok(a.quote_windows.length >= 1);
    for (const w of a.quote_windows) {
      assert.equal(w["T-72h"], 0);
      assert.equal(w["T-1m"], 0);
      assert.equal(w.t1h, 1);
    }
    for (const row of a.annual) {
      assert.equal(row.start, 1000);
      if (row.bets === 0) assert.equal(row.end, null);
    }
    assert.equal(auditTask034(a).ok, true, auditTask034(a).failures.join(","));
    assert.equal(
      fingerprint034({
        verdict: a.verdict,
        sha: a.observed_sha256,
        exp: a.experiment_sha256,
        hyp: a.hypothesis_registry_hash,
        selected: a.selected_on_val,
        test: Object.fromEntries(Object.entries(a.scores).map(([k, v]) => [k, v.TEST])),
        holm: a.holm.adjusted_p,
        clv_status: a.CLV_STATUS,
      }),
      a.fingerprint,
    );
    assert.equal(verdict034({ fixture: true, testN: 3, anyCandidate: true }), "INSUFFICIENT_DATA");
    assert.equal(verdict034({ fixture: false, testN: 200, anyCandidate: false }), "NO_DEMONSTRATED_INEFFICIENCY");
    assert.equal(verdict034({ fixture: false, testN: 200, anyCandidate: true }), "INEFFICIENCY_FOUND");
    assert.equal(
      classifySignal034({ delta: -0.001, holmRejected: true, ci: { low: -0.002, high: -0.0001 } }),
      "EDGE_CANDIDATE",
    );
    assert.equal(
      classifySignal034({ delta: 0.01, holmRejected: false, ci: { low: 0.001, high: 0.02 } }),
      "HARMFUL",
    );
    assert.equal(
      classifySignal034({ delta: -0.0001, holmRejected: false, ci: { low: -0.001, high: 0.001 } }),
      "NON_INFERIOR",
    );
  });
});
