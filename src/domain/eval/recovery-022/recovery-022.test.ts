import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BlindLeakageError,
  ExperimentIntegrityError,
} from "@/domain/eval/actuarial-018/integrity";
import { auditTask022 } from "@/domain/eval/recovery-022/audit";
import { isAggregateBookmakerLabel } from "@/domain/eval/recovery-022/bookmakers";
import { classifyLane } from "@/domain/eval/recovery-022/classify";
import { loadExp022Config } from "@/domain/eval/recovery-022/config";
import { binIndexForRelativeSeconds, measureHorizons } from "@/domain/eval/recovery-022/diagnostic";
import {
  leakL1QuoteAfterAsOf,
  leakL2OutcomeBeforeLock,
  leakL3CloseInDecision,
  leakL5PostMatchStats,
  leakL6ParamChosenOnTest,
  leakL7ParamChosenOnHoldout,
  leakL8BankrollCarriedAcrossYears,
  leakL9StakeUsesResult,
  leakL10StrategyChosenFromPnl,
  leakL11RelativePromotedToUtc,
  leakL12AggregateAsBookmaker,
  leakL13TrustPhpSizeofAsSeconds,
  leakL14FutureFeature,
  leakL15AmbiguousMatchInStrict,
  leakL16OutcomeInjection,
  leakL17ClosingOddsAsDecision,
} from "@/domain/eval/recovery-022/leakage";
import { SAMPLE_CLOSING_CSV, runTask022 } from "@/domain/eval/recovery-022/lab";
import { btbLeagueToCompetition, gradeMatch, subjectFromBtb } from "@/domain/eval/recovery-022/matching";
import { parseClosingOddsLine } from "@/domain/eval/recovery-022/parse-closing";
import {
  buildSeriesTxt,
  documentedSeriesFixtureMatrix,
  parseSeriesFilename,
  parseSeriesTxt,
  seriesCellsToRecords,
  hashSeriesText,
  SERIES_FIXTURE_FILENAME,
} from "@/domain/eval/recovery-022/parse-series";
import {
  classifyMatchDateField,
  deriveAvailableAt,
  seriesColumnRelativeSeconds,
  usableStrictCapital022,
} from "@/domain/eval/recovery-022/temporal";

const FDCU_2005 = `Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,B365H,B365D,B365A
E0,01/01/05,Liverpool,Chelsea,0,1,A,2.90,3.20,2.20
`;

describe("TASK 022 BeatTheBookie recovery + blind capital", () => {
  it("closing CSV sample is DATE_ONLY 1X2 aggregates, not individual books", () => {
    const row = parseClosingOddsLine(SAMPLE_CLOSING_CSV.split("\n")[1]!);
    assert.ok(row);
    assert.equal(row.temporal_precision, "DATE_ONLY");
    assert.equal(classifyMatchDateField(row.match_date), "DATE_ONLY");
    assert.equal(row.has_relative_seconds, false);
    assert.equal(isAggregateBookmakerLabel("avg"), true);
    assert.equal(
      classifyLane({
        kind: "closing_aggregate",
        bookmaker: null,
        precision: "DATE_ONLY",
        timezoneVerified: false,
      }),
      "RESEARCH_ONLY",
    );
  });

  it("does not invent available_at from a calendar date or hourly relative bin", () => {
    assert.equal(
      deriveAvailableAt({
        eventStartTimestamp: "2015-10-10T15:00:00.000Z",
        relativeSeconds: 3600,
        timezoneVerified: false,
        precision: "RELATIVE_TO_KICKOFF_APPROX",
      }),
      null,
    );
    assert.equal(
      usableStrictCapital022({
        precision: "RELATIVE_TO_KICKOFF_APPROX",
        availableAt: null,
        timezoneVerified: false,
        aggregate: false,
      }),
      false,
    );
  });

  it("hourly series parser: 32 books × 216 cols, relative APPROX, STRICT_CANDIDATE", () => {
    const txt = buildSeriesTxt(documentedSeriesFixtureMatrix());
    const parsed = parseSeriesTxt(txt, SERIES_FIXTURE_FILENAME);
    assert.equal(parsed.rows, 32);
    assert.equal(parsed.cols, 216);
    const meta = parseSeriesFilename(SERIES_FIXTURE_FILENAME);
    assert.equal(meta?.kickoff_naive, "2015-10-10 15:00:00");
    assert.equal(meta?.timezone, null);
    assert.equal(seriesColumnRelativeSeconds(71), 0);
    assert.equal(seriesColumnRelativeSeconds(0), 71 * 3600);
    const recs = seriesCellsToRecords({
      cells: parsed.cells,
      meta: parsed.meta,
      dataset: "odds_series_fixture",
      raw_hash: hashSeriesText(txt),
    });
    assert.ok(recs.length > 0);
    assert.ok(recs.every((r) => r.temporal_precision === "RELATIVE_TO_KICKOFF_APPROX"));
    assert.ok(recs.every((r) => r.available_at === null));
    assert.ok(recs.every((r) => r.lane === "STRICT_CANDIDATE"));
    assert.ok(recs.every((r) => r.usable_strict_capital === false));
    assert.ok(recs.every((r) => r.market === "1X2"));
    assert.ok(!recs.some((r) => isAggregateBookmakerLabel(r.bookmaker ?? "")));
  });

  it("horizon diagnostic: hour bins exist; 5m/15m/30m/72h do not", () => {
    const txt = buildSeriesTxt(documentedSeriesFixtureMatrix());
    const parsed = parseSeriesTxt(txt, SERIES_FIXTURE_FILENAME);
    const h = measureHorizons(parsed.cells);
    const by = Object.fromEntries(h.map((x) => [x.window, x]));
    assert.equal(by["72h"]!.bin_exists, false);
    assert.equal(by["48h"]!.bin_exists, true);
    assert.equal(by["48h"]!.reconstructable, true);
    assert.equal(by["1h"]!.bin_exists, true);
    assert.equal(by["30m"]!.bin_exists, false);
    assert.equal(by["15m"]!.bin_exists, false);
    assert.equal(by["5m"]!.bin_exists, false);
    assert.equal(binIndexForRelativeSeconds(48 * 3600), 23);
  });

  it("MATCH_EXACT requires date + teams + competition; STRICT rejects probable", () => {
    assert.equal(btbLeagueToCompetition("England: Premier League"), "e0");
    const left = subjectFromBtb({
      match_id: "170088",
      league: "England: Premier League",
      home_team: "Liverpool",
      away_team: "Chelsea",
      match_date: "2005-01-01",
    });
    const exact = gradeMatch(left, [
      {
        source: "fdcu",
        match_id: "fd-1",
        date: "2005-01-01",
        league: "e0",
        home: "Liverpool",
        away: "Chelsea",
        kickoff: null,
      },
    ]);
    assert.equal(exact.grade, "MATCH_EXACT");
    const probable = gradeMatch(left, [
      {
        source: "club",
        match_id: "c-1",
        date: "2005-01-01",
        league: "england-premier-league",
        home: "Liverpool",
        away: "Chelsea",
        kickoff: null,
      },
    ]);
    assert.equal(probable.grade, "MATCH_PROBABLE");
    assert.throws(() => leakL15AmbiguousMatchInStrict("MATCH_PROBABLE"), BlindLeakageError);
    leakL15AmbiguousMatchInStrict("MATCH_EXACT");
  });

  it("leakage attacks hard-fail", () => {
    const asOf = new Date("2015-10-10T12:00:00.000Z");
    assert.throws(
      () => leakL1QuoteAfterAsOf("2015-10-10T18:00:00.000Z", asOf),
      BlindLeakageError,
    );
    assert.throws(() => leakL2OutcomeBeforeLock(false), BlindLeakageError);
    leakL2OutcomeBeforeLock(true);
    assert.throws(() => leakL3CloseInDecision(true), BlindLeakageError);
    assert.throws(() => leakL5PostMatchStats("FTHome"), BlindLeakageError);
    assert.throws(() => leakL6ParamChosenOnTest(true), ExperimentIntegrityError);
    const cfg = loadExp022Config();
    assert.throws(() => leakL7ParamChosenOnHoldout(cfg, true), /HOLDOUT_SACRED/);
    leakL7ParamChosenOnHoldout(cfg, false);
    assert.throws(
      () =>
        leakL8BankrollCarriedAcrossYears({
          yearStart: 1100,
          previousYearEnd: 1100,
          initial: 1000,
        }),
      BlindLeakageError,
    );
    assert.throws(() => leakL9StakeUsesResult(), BlindLeakageError);
    assert.throws(
      () =>
        leakL10StrategyChosenFromPnl({
          selectedFromPnl: true,
          autoPromote: false,
          best: null,
        }),
      ExperimentIntegrityError,
    );
    assert.throws(
      () =>
        leakL11RelativePromotedToUtc({
          precision: "RELATIVE_TO_KICKOFF_APPROX",
          availableAt: "2015-10-10T14:00:00.000Z",
        }),
      BlindLeakageError,
    );
    assert.throws(() => leakL12AggregateAsBookmaker("Avg"), BlindLeakageError);
    assert.throws(() => leakL13TrustPhpSizeofAsSeconds(true), BlindLeakageError);
    leakL13TrustPhpSizeofAsSeconds(false);
    assert.throws(
      () => leakL14FutureFeature(new Date("2015-10-11T00:00:00.000Z"), asOf),
      BlindLeakageError,
    );
    assert.throws(
      () => leakL16OutcomeInjection({ outcome: "HOME" }),
      BlindLeakageError,
    );
    leakL16OutcomeInjection({ eventId: "x" });
    assert.throws(() => leakL17ClosingOddsAsDecision("close", true), BlindLeakageError);
  });

  it("lab: 0 STRICT bets, no silent 1000→1000, winner null, evidence present", async () => {
    const report = await runTask022({
      allowNetwork: false,
      skipFullInspect: true,
      skipLocalCache: true,
      skipClubIndex: true,
      closingCsvText: SAMPLE_CLOSING_CSV,
      extraFdcu: [
        {
          csvText: FDCU_2005,
          originalFile: "e0-2005.csv",
          sourceUrl: "test://fdcu",
          sourceId: "fdcu-2005",
        },
      ],
    });
    assert.equal(report.winner, null);
    assert.equal(report.auto_promote, false);
    assert.equal(report.real_money, false);
    assert.equal(report.verdict, "NO_DEMONSTRATED_EDGE");
    assert.equal(report.scientific.best_model, null);
    assert.equal(report.scientific.best_risk_policy, null);
    assert.equal(report.counts.bets, 0);
    assert.equal(report.scientific.strict_quotes, 0);
    assert.equal(report.series.usable_strict, 0);
    assert.ok(report.closing.rows >= 2);
    assert.equal(report.closing.date_only, 2);
    assert.equal(report.matching.match_exact, 1);
    assert.ok(report.market_rows.some((m) => m.market === "1X2" && m.lifecycle === "OBSERVED"));
    assert.ok(report.market_rows.some((m) => m.market === "corners" && m.lifecycle === "CATALOGUED"));
    assert.ok(report.market_rows.every((m) => m.model_ready === false));
    const y2005 = report.annual.find((a) => a.year === 2005);
    assert.ok(y2005);
    assert.equal(y2005.status, "INSUFFICIENT_DATA");
    assert.equal(y2005.start_bankroll, 1000);
    assert.equal(y2005.end_bankroll, null);
    assert.equal(y2005.strict_events, 0);
    assert.equal(y2005.risk_policy, "no_bet");
    assert.ok(report.strategy_rows.every((s) => s.selected_from_pnl === false));
    assert.ok(report.sanity.locked);
    assert.equal(report.sanity.stake, 0);
    assert.ok(report.sample_assessment.toLowerCase().includes("insufficient"));
    assert.equal(report.diagnostic.timestamp_absolute, false);
    assert.equal(report.diagnostic.can_reconstruct_asof, false);
    assert.equal(report.HOLDOUT_TOUCHED, false);
    const audit = auditTask022(report);
    assert.equal(audit.ok, true, audit.failures.join(","));
  });
});
