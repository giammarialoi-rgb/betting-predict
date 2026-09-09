import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BlindLeakageError,
  ExperimentIntegrityError,
} from "@/domain/eval/actuarial-018/integrity";
import { runTask021 } from "@/domain/eval/capital-021/lab";
import { auditTask021 } from "@/domain/eval/capital-021/audit";
import { loadExp021Config } from "@/domain/eval/capital-021/config";
import {
  leakL1QuoteAfterAsOf,
  leakL2OutcomeBeforeLock,
  leakL3CloseUsedWhenUnavailable,
  leakL4NewsAfterAsOf,
  leakL5PostMatchStats,
  leakL6ParamChosenOnTest,
  leakL7ParamChosenOnHoldout,
  leakL8BankrollCarriedAcrossYears,
  leakL9StakeUsesResult,
  leakL10StrategyChosenFromPnl,
} from "@/domain/eval/capital-021/leakage";
import { assertIndividualBookmaker, dedupeLedger } from "@/domain/eval/capital-021/ledger";
import {
  ODDS_API_DOCS_SAMPLE,
  parseOddsApiHistoricalSnapshot,
} from "@/domain/eval/capital-021/odds-api-format";
import {
  assertNotInventedClock,
  ledgerEligibleForStrictCapital,
  map020ClassTo021,
  snapshotToLedger,
} from "@/domain/eval/capital-021/temporal";
import type { MarketSnapshot } from "@/domain/eval/capital-020/types";

const FDCU_FIX = `Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,B365H,B365D,B365A,B365CH,B365CD,B365CA,B365>2.5,B365<2.5,MaxH,AvgH
E0,10/08/19,Liverpool,Norwich,4,1,H,1.14,9.00,21.00,1.11,10.00,26.00,1.40,2.90,1.17,1.14
`;
const EPL_RESULTS = `match_id,season,season_code,date,home_team,away_team,fthg,ftag,ftr
t1,2019-20,1920,2019-08-10,Liverpool,Norwich,4,1,H
`;
const EPL_ODDS = `match_id,season,date,home_team,away_team,bet365_1x2_home,bet365_1x2_draw,bet365_1x2_away,bet365_1x2_home_close,market_max_1x2_home,bet365_over25,bet365_under25
t1,2019-20,2019-08-10,Liverpool,Norwich,1.14,9.00,21.00,1.11,1.17,1.40,2.90
`;

function snap(partial: Partial<MarketSnapshot> & Pick<MarketSnapshot, "eventId" | "odds">): MarketSnapshot {
  return {
    sport: "football",
    marketType: "1X2",
    line: null,
    selection: "HOME",
    bookmaker: "bet365",
    observedAt: "2019-08-10T00:00:00.000Z",
    availableAt: null,
    temporalClass: "DATE_ONLY",
    temporalBasis: "date",
    sourceId: "offline-pack-e0",
    upstreamCluster: "football-data-co-uk",
    observationKind: "open",
    ...partial,
  };
}

describe("TASK 021 real-time market truth + blind capital", () => {
  it("L1: quote after asOf hard-fails", () => {
    assert.throws(
      () => leakL1QuoteAfterAsOf("2019-08-10T18:00:00.000Z", new Date("2019-08-10T12:00:00.000Z")),
      BlindLeakageError,
    );
  });

  it("L2: outcome before LOCK hard-fails", () => {
    assert.throws(() => leakL2OutcomeBeforeLock(false), BlindLeakageError);
    leakL2OutcomeBeforeLock(true);
  });

  it("L3: closing odds used when unavailable hard-fails", () => {
    const asOf = new Date("2019-08-10T12:00:00.000Z");
    assert.throws(
      () =>
        leakL3CloseUsedWhenUnavailable({
          closeAvailableAt: null,
          asOf,
          usedInDecision: true,
        }),
      BlindLeakageError,
    );
    assert.throws(
      () =>
        leakL3CloseUsedWhenUnavailable({
          closeAvailableAt: "2019-08-10T15:00:00.000Z",
          asOf,
          usedInDecision: true,
        }),
      BlindLeakageError,
    );
    leakL3CloseUsedWhenUnavailable({
      closeAvailableAt: "2019-08-10T15:00:00.000Z",
      asOf,
      usedInDecision: false,
    });
  });

  it("L4: news after asOf is excluded; using it hard-fails", () => {
    const asOf = new Date("2019-08-10T12:00:00.000Z");
    assert.equal(
      leakL4NewsAfterAsOf(new Date("2019-08-10T13:00:00.000Z"), asOf, false),
      "blocked",
    );
    assert.throws(
      () => leakL4NewsAfterAsOf(new Date("2019-08-10T13:00:00.000Z"), asOf, true),
      BlindLeakageError,
    );
    assert.equal(
      leakL4NewsAfterAsOf(new Date("2019-08-10T11:00:00.000Z"), asOf, true),
      "ok",
    );
  });

  it("L5: post-match stats hard-fail", () => {
    assert.throws(() => leakL5PostMatchStats("FTHome"), BlindLeakageError);
  });

  it("L6: parameter chosen on TEST hard-fails", () => {
    assert.throws(() => leakL6ParamChosenOnTest(true), ExperimentIntegrityError);
    leakL6ParamChosenOnTest(false);
  });

  it("L7: parameter chosen on HOLDOUT hard-fails", () => {
    const cfg = loadExp021Config();
    assert.throws(() => leakL7ParamChosenOnHoldout(cfg, true), /HOLDOUT_SACRED/);
    leakL7ParamChosenOnHoldout(cfg, false);
  });

  it("L8: previous-year bankroll must not transfer", () => {
    assert.throws(
      () =>
        leakL8BankrollCarriedAcrossYears({
          yearStart: 1100,
          previousYearEnd: 1100,
          initial: 1000,
        }),
      BlindLeakageError,
    );
    leakL8BankrollCarriedAcrossYears({
      yearStart: 1000,
      previousYearEnd: 1100,
      initial: 1000,
    });
  });

  it("L9: stake using result hard-fails", () => {
    assert.throws(() => leakL9StakeUsesResult(), BlindLeakageError);
  });

  it("L10: strategy chosen from historical yield hard-fails", () => {
    assert.throws(
      () =>
        leakL10StrategyChosenFromPnl({
          selectedFromPnl: true,
          autoPromote: false,
          best: null,
        }),
      ExperimentIntegrityError,
    );
    leakL10StrategyChosenFromPnl({
      selectedFromPnl: false,
      autoPromote: false,
      best: null,
    });
  });

  it("does not invent a noon clock from a calendar date", () => {
    assert.throws(
      () =>
        assertNotInventedClock({
          raw: "2020-03-07",
          availableAt: "2020-03-07T12:00:00.000Z",
          precision: "EXACT_TIMESTAMP",
        }),
      BlindLeakageError,
    );
    assert.throws(
      () =>
        assertNotInventedClock({
          raw: undefined,
          availableAt: "2020-03-07T00:00:00.000Z",
          precision: "DATE_ONLY",
        }),
      BlindLeakageError,
    );
  });

  it("DATE_ONLY is not STRICT capital", () => {
    const row = snapshotToLedger(snap({ eventId: "e1", odds: 1.9 }));
    assert.equal(row.temporal_precision, "DATE_ONLY");
    assert.equal(row.available_at, null);
    assert.equal(row.usable_strict_capital, false);
    assert.equal(
      ledgerEligibleForStrictCapital(row, new Date("2019-08-10T12:00:00.000Z")),
      false,
    );
    assert.equal(map020ClassTo021("DATE_ONLY"), "DATE_ONLY");
  });

  it("Max/Avg are not bookmakers", () => {
    assert.throws(() => assertIndividualBookmaker("max"), /AGGREGATE/);
    assert.throws(() => assertIndividualBookmaker("Avg"), /AGGREGATE/);
  });

  it("The Odds API docs sample is EXACT_TIMESTAMP but not licensed for capital", () => {
    const rows = parseOddsApiHistoricalSnapshot(ODDS_API_DOCS_SAMPLE, {
      usableStrictCapital: false,
    });
    assert.ok(rows.length >= 2);
    assert.ok(rows.every((r) => r.temporal_precision === "EXACT_TIMESTAMP"));
    assert.ok(rows.every((r) => r.available_at === "2021-10-18T11:48:09Z"));
    assert.ok(rows.every((r) => r.usable_strict_capital === false));
    assert.equal(rows[0]!.bookmaker, "draftkings");
  });

  it("ledger dedupes identical observations", () => {
    const a = snapshotToLedger(snap({ eventId: "e1", odds: 1.9 }));
    assert.equal(dedupeLedger([a, { ...a }]).length, 1);
  });

  it("lab: 0 STRICT bets, no silent 1000→1000, winner null, formats verified", async () => {
    const report = await runTask021({
      allowNetwork: false,
      skipLocalCache: true,
      skipClubIndex: true,
      eplResultsText: EPL_RESULTS,
      eplOddsText: EPL_ODDS,
      extraFdcu: [
        {
          csvText: FDCU_FIX,
          originalFile: "fix.csv",
          sourceUrl: "test://fdcu",
          sourceId: "fdcu-fix",
        },
      ],
    });
    assert.equal(report.winner, null);
    assert.equal(report.auto_promote, false);
    assert.equal(report.real_money, false);
    assert.equal(report.verdict, "NO_DEMONSTRATED_EDGE");
    assert.equal(report.timestamped_source_verified, true);
    assert.equal(report.timestamped_source_acquired_for_capital, false);
    assert.equal(report.counts.bets, 0);
    assert.equal(report.ledger.strict_usable, 0);
    assert.ok(report.ledger.date_only > 0);
    assert.ok(report.format_fixtures.odds_api_docs_exact >= 1);
    assert.ok(report.format_fixtures.betfair_pt_exact >= 1);
    assert.equal(report.scientific.best_model, null);
    assert.equal(report.scientific.best_risk_policy, null);
    const y2019 = report.annual.find((a) => a.year === 2019);
    assert.ok(y2019);
    assert.equal(y2019.status, "INSUFFICIENT_DATA");
    assert.equal(y2019.final, null);
    assert.equal(y2019.start, 1000);
    assert.equal(y2019.strategy, "no_bet");
    assert.equal(report.annual.find((a) => a.year === 2026)?.status, "INCOMPLETE");
    assert.ok(report.strategy_rows.every((s) => s.selected_from_pnl === false));
    assert.ok(report.market_rows.some((m) => m.market === "1X2" && m.lifecycle === "OBSERVED"));
    assert.ok(report.market_rows.some((m) => m.market === "CORNERS" && m.lifecycle === "CATALOGUED"));
    const audit = auditTask021(report);
    assert.equal(audit.ok, true);
  });
});
