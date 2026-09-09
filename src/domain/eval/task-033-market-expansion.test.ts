import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BlindLeakageError, ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { holmBonferroni } from "@/domain/eval/multiple-testing";
import { auditTask033 } from "@/domain/eval/market-033/audit";
import { assertHoldoutLocked033, assertTestLocked033, loadExp033Config } from "@/domain/eval/market-033/config";
import { discoverBasicMarkets033 } from "@/domain/eval/market-033/discover";
import { fingerprint033, runTask033, verdict033 } from "@/domain/eval/market-033/lab";
import {
  leakCloseQuote,
  leakFutureOdds,
  leakNaiveTimezoneAsUtc,
  leakOpenTask034,
  leakPostMatchOdds,
  runHostileBattery033,
} from "@/domain/eval/market-033/leakage";
import { classifyMarketFamily, coverageFromSeconds, refuseNaiveAsUtc, temporalClassFromEvidence } from "@/domain/eval/market-033/markets";

describe("TASK 033 definitive market expansion", () => {
  it("market discovery + timestamp/kickoff/AS_OF + no naive UTC", () => {
    assert.equal(classifyMarketFamily("MATCH_ODDS"), "1X2");
    assert.equal(classifyMarketFamily("OVER_UNDER_25"), "OU");
    assert.equal(classifyMarketFamily("Both teams to Score?"), "BTTS");
    assert.equal(classifyMarketFamily("ASIAN_HANDICAP"), "AH");
    assert.equal(classifyMarketFamily("DRAW_NO_BET"), "DNB");
    assert.equal(classifyMarketFamily("DOUBLE_CHANCE"), "DC");
    assert.equal(classifyMarketFamily("CORRECT_SCORE"), "Correct Score");
    assert.equal(classifyMarketFamily("FIRST_GOAL_SCORER"), "Player");
    assert.equal(refuseNaiveAsUtc("04-09-2014 15:30"), "TEMPORALLY_UNKNOWN");
    assert.equal(
      temporalClassFromEvidence({
        quoteIsoZ: true,
        kickoffIsoZ: true,
        quoteBeforeKickoff: true,
        dateOnly: false,
        postMatch: false,
        closingAtKickoff: false,
      }),
      "LEVEL_A_EXACT",
    );
    assert.equal(
      temporalClassFromEvidence({
        quoteIsoZ: false,
        kickoffIsoZ: false,
        quoteBeforeKickoff: false,
        dateOnly: true,
        postMatch: false,
        closingAtKickoff: false,
      }),
      "LEVEL_B_DATE_ONLY",
    );
    const cov = coverageFromSeconds([3 * 3600, 3600]);
    assert.equal(cov["3h"], true);
    assert.equal(cov["1h"], true);
    assert.equal(cov["72h"], false);
    const basic = discoverBasicMarkets033(true);
    assert.ok(basic.some((b) => b.family === "1X2" || b.market_type === "MATCH_ODDS"));
    assert.ok(basic.some((b) => b.family === "OU"));
    for (const b of basic) {
      if (b.last_prematch_pt && b.kickoff) {
        assert.ok(Date.parse(b.last_prematch_pt) < Date.parse(b.kickoff), "future odds in fixture");
      }
      assert.equal(b.capital_eligible, false);
    }
  });

  it("leakage battery + VAL/TEST/HOLDOUT locks + Holm + bankroll gate", async () => {
    const asOf = Date.parse("2016-06-01T12:00:00.000Z");
    assert.throws(() => leakFutureOdds(asOf + 1, asOf), BlindLeakageError);
    assert.throws(() => leakPostMatchOdds(false, asOf, asOf), BlindLeakageError);
    assert.throws(() => leakCloseQuote(true), BlindLeakageError);
    assert.throws(() => leakNaiveTimezoneAsUtc("2014-09-04 15:30", true), BlindLeakageError);
    assert.throws(() => assertTestLocked033(true), ExperimentIntegrityError);
    assert.throws(() => assertHoldoutLocked033(true), ExperimentIntegrityError);
    assert.throws(() => leakOpenTask034(true), ExperimentIntegrityError);
    const holm = holmBonferroni([], 0.05);
    assert.equal(holm.method, "holm_bonferroni");
    assert.equal(holm.rejected.length, 0);
    const batt = runHostileBattery033();
    assert.ok(batt.every((x) => x.throws), batt.filter((x) => !x.throws).map((x) => x.id).join(","));
    const a = await runTask033({ skipHeavy: true });
    const b = await runTask033({ skipHeavy: true });
    assert.equal(a.winner, null);
    assert.equal(a.auto_promotion, false);
    assert.equal(a.real_money, false);
    assert.equal(a.test_used_for_selection, false);
    assert.equal(a.HOLDOUT_STATUS, "EMPTY");
    assert.equal(a.qualified, false);
    assert.equal(a.BET_COUNT, 0);
    assert.equal(a.BANKROLL, "NOT_QUALIFIED");
    assert.equal(a.verdict, "NO_DEMONSTRATED_EDGE");
    assert.equal(a.fingerprint, b.fingerprint);
    for (const row of a.annual) {
      assert.equal(row.start, 1000);
      if (row.bets === 0) assert.equal(row.end, null);
    }
    const x2 = a.markets.find((m) => m.market === "1X2");
    assert.equal(x2?.verdict, "NO_DEMONSTRATED_EDGE");
    assert.equal(x2?.model, "MARKET_DEVIG");
    const ou = a.markets.find((m) => m.market === "OU");
    assert.ok(ou);
    assert.ok(ou!.verdict === "INSUFFICIENT_N" || ou!.verdict === "RESEARCH_ONLY");
    assert.equal(auditTask033(a).ok, true, auditTask033(a).failures.join(","));
    const cfg = loadExp033Config();
    assert.equal(cfg.retest_task_032, false);
    assert.equal(cfg.open_task_034, false);
    assert.equal(
      fingerprint033({
        verdict: a.verdict,
        carryFp: a.carry_032_fingerprint,
        sha031: a.observed_031_sha256,
        basic: a.basic,
        weekly: a.weekly.families,
        markets: a.markets.map((m) => ({ market: m.market, verdict: m.verdict, strict_events: m.strict_events })),
      }),
      a.fingerprint,
    );
    assert.equal(verdict033({ anyConfirmed: false, anyCandidate: false, tested1x2: true }), "NO_DEMONSTRATED_EDGE");
    assert.doesNotThrow(() => assertTestLocked033(false));
  });
});
