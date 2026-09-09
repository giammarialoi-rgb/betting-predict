import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertDecisionPayloadSafe,
  assertNoRetroactiveOptimization,
  BlindLeakageError,
} from "@/domain/eval/actuarial-018/integrity";
import { buildNormalizedEvent, matchEvents } from "@/domain/eval/acquisition-019/event-matching";
import { loadExp020Config, assertHoldoutUntouched } from "@/domain/eval/capital-020/config";
import { parseBetfairBasicFixture } from "@/domain/eval/capital-020/betfair-format";
import { bookmakerConsensus } from "@/domain/eval/capital-020/consensus";
import { conservativeSameEventCap, marketFamily, RHO } from "@/domain/eval/capital-020/correlation";
import { buildCapital020Assessment } from "@/domain/eval/capital-020/evidence";
import { runTask020 } from "@/domain/eval/capital-020/lab";
import { auditTask020 } from "@/domain/eval/capital-020/audit";
import { lineageFor019Source, uniqueUpstreamClusters } from "@/domain/eval/capital-020/lineage";
import { assertLockedBeforeReveal, assertOutcomeAbsentFromDecision } from "@/domain/eval/capital-020/lock";
import { ALL_MODELS_020, runModel020 } from "@/domain/eval/capital-020/models";
import { marketPath } from "@/domain/eval/capital-020/movement";
import { runBlindCapital020 } from "@/domain/eval/capital-020/replay";
import { allocateCapital, settleBankroll, signalStrength } from "@/domain/eval/capital-020/risk";
import { settleObservedMarket } from "@/domain/eval/capital-020/settlement";
import { dedupeSnapshots, observation019ToSnapshot } from "@/domain/eval/capital-020/snapshot";
import {
  assertNoFutureSnapshot,
  dateOnlyNotStrict,
  decisionAsOfCandidates,
  isStrictCapitalClass,
  map019ToTemporalClass,
  snapshotEligibleForStrictCapital,
} from "@/domain/eval/capital-020/temporal-gate";
import type { MarketSnapshot } from "@/domain/eval/capital-020/types";
import { bonferroniThreshold, survivesBonferroni } from "@/domain/eval/multiple-testing";
import { loadExp016Config } from "@/domain/eval/bankroll/exp016-config";
import type { MarketObservation019 } from "@/domain/eval/acquisition-019/types";
import { TEMPORAL_BASIS_OPEN } from "@/domain/eval/acquisition-019/types";

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
    temporalBasis: TEMPORAL_BASIS_OPEN,
    sourceId: "offline-pack-e0",
    upstreamCluster: "football-data-co-uk",
    observationKind: "open",
    ...partial,
  };
}

function ev(year: number, date: string, home: string, away: string, hg: number, ag: number) {
  return buildNormalizedEvent({
    sourceId: "offline-pack-e0",
    sourceEventId: `${home}-${away}-${date}`,
    competitionRaw: "E0",
    matchDate: date,
    year,
    season: String(year),
    homeRaw: home,
    awayRaw: away,
    ftHome: hg,
    ftAway: ag,
  });
}

describe("TASK 020 historical market acquisition & blind capital", () => {
  it("future available_at vs asOf is a hard fail", () => {
    const s = snap({
      eventId: "e1",
      odds: 1.9,
      availableAt: "2019-08-10T18:00:00.000Z",
      temporalClass: "EXACT_OBSERVATION_TIME",
    });
    assert.throws(
      () => assertNoFutureSnapshot(s, new Date("2019-08-10T12:00:00.000Z")),
      BlindLeakageError,
    );
  });

  it("outcome in DecisionContext is a hard fail", () => {
    assert.throws(
      () =>
        assertDecisionPayloadSafe(
          { outcome: { ftHome: 2 }, availableAt: new Date("2019-08-10") },
          new Date("2019-08-10"),
        ),
      BlindLeakageError,
    );
    assert.throws(
      () => assertOutcomeAbsentFromDecision({ outcome: { ftHome: 1 } }),
      BlindLeakageError,
    );
  });

  it("closing quote after asOf is excluded from consensus and decision path", () => {
    const asOf = new Date("2019-08-10T12:00:00.000Z");
    const rows = [
      snap({
        eventId: "e1",
        odds: 1.9,
        bookmaker: "bet365",
        availableAt: "2019-08-10T10:00:00.000Z",
        temporalClass: "EXACT_OBSERVATION_TIME",
        observationKind: "open",
      }),
      snap({
        eventId: "e1",
        odds: 1.8,
        bookmaker: "pinnacle",
        availableAt: "2019-08-10T10:00:00.000Z",
        temporalClass: "EXACT_OBSERVATION_TIME",
        observationKind: "open",
      }),
      snap({
        eventId: "e1",
        odds: 1.7,
        bookmaker: "william-hill",
        availableAt: "2019-08-10T10:00:00.000Z",
        temporalClass: "EXACT_OBSERVATION_TIME",
        observationKind: "open",
      }),
      snap({
        eventId: "e1",
        odds: 1.5,
        bookmaker: "bet365",
        observedAt: "2019-08-10T15:00:00.000Z",
        availableAt: "2019-08-10T15:00:00.000Z",
        temporalClass: "CLOSE_TIME_EXACT",
        observationKind: "close",
      }),
    ];
    const c = bookmakerConsensus(rows, asOf, "STRICT");
    assert.equal(c.n_books, 3);
    assert.equal(c.min, 1.7);
    const path = marketPath(rows, asOf, false);
    assert.equal(path.closing, null);
    assert.equal(path.close_used_in_decision, false);
    assert.equal(snapshotEligibleForStrictCapital(rows[3]!, asOf), false);
  });

  it("DATE_ONLY and DATASET_WINDOW are not STRICT capital", () => {
    assert.equal(isStrictCapitalClass("DATE_ONLY"), false);
    assert.equal(isStrictCapitalClass("DATASET_WINDOW"), false);
    assert.equal(isStrictCapitalClass("UNKNOWN"), false);
    assert.equal(dateOnlyNotStrict("DATE_ONLY"), true);
    assert.equal(dateOnlyNotStrict("DATASET_WINDOW"), true);
    const s = snap({ eventId: "e1", odds: 2.0, temporalClass: "DATE_ONLY" });
    assert.equal(snapshotEligibleForStrictCapital(s, new Date("2019-08-10T12:00:00.000Z")), false);
  });

  it("maps 019 dataset_open/date → DATE_ONLY and dataset_close → UNKNOWN", () => {
    const open: MarketObservation019 = {
      eventId: "e",
      bookmakerId: "bet365",
      marketType: "1X2",
      line: null,
      selectionSide: "HOME",
      odds: 1.9,
      observationKind: "dataset_open",
      sourceId: "offline-pack-e0",
      originalColumn: "B365H",
      observedAt: "2019-08-10T00:00:00.000Z",
      availableAt: null,
      temporalPrecision: "date",
      temporalBasis: TEMPORAL_BASIS_OPEN,
      oddsLevel: "B",
    };
    assert.equal(map019ToTemporalClass(open), "DATE_ONLY");
    assert.equal(map019ToTemporalClass({ ...open, observationKind: "dataset_close", temporalPrecision: "unknown" }), "UNKNOWN");
    const snap019 = observation019ToSnapshot(open);
    assert.equal(snap019.temporalClass, "DATE_ONLY");
    assert.equal(snap019.upstreamCluster, "football-data-co-uk");
  });

  it("bookmaker aggregation uses only quotes available at asOf", () => {
    const asOf = new Date("2019-08-10T12:00:00.000Z");
    const rows = [
      snap({
        eventId: "e1",
        odds: 2.0,
        bookmaker: "a",
        availableAt: "2019-08-10T11:00:00.000Z",
        temporalClass: "EXACT_OBSERVATION_TIME",
      }),
      snap({
        eventId: "e1",
        odds: 2.1,
        bookmaker: "b",
        availableAt: "2019-08-10T11:00:00.000Z",
        temporalClass: "EXACT_OBSERVATION_TIME",
      }),
      snap({
        eventId: "e1",
        odds: 2.2,
        bookmaker: "c",
        availableAt: "2019-08-10T11:00:00.000Z",
        temporalClass: "EXACT_OBSERVATION_TIME",
      }),
      snap({
        eventId: "e1",
        odds: 9.9,
        bookmaker: "late",
        observedAt: "2019-08-10T13:00:00.000Z",
        availableAt: "2019-08-10T13:00:00.000Z",
        temporalClass: "EXACT_OBSERVATION_TIME",
      }),
    ];
    const c = bookmakerConsensus(rows, asOf, "STRICT");
    assert.equal(c.n_books, 3);
    assert.ok(c.mean != null && c.mean < 3);
    assert.ok(c.de_vig);
  });

  it("same-event multi-market exposure is capped when rho is UNKNOWN", () => {
    assert.equal(RHO, "UNKNOWN");
    assert.equal(marketFamily("1X2"), marketFamily("DNB"));
    assert.equal(marketFamily("TOTAL_GOALS"), marketFamily("BTTS"));
    const cap = conservativeSameEventCap({
      bankroll: 1000,
      maxClusterFraction: 0.05,
      openSameEventExposure: 50,
      proposed: 40,
    });
    assert.equal(cap.stake, 0);
  });

  it("annual bankroll resets at 1000 and never carries between years", () => {
    const cfg = loadExp020Config();
    const events = [
      ev(2018, "2018-08-11", "Arsenal", "Chelsea", 1, 0),
      ev(2019, "2019-08-10", "Liverpool", "Norwich", 4, 1),
    ];
    const out = runBlindCapital020({
      cfg,
      events,
      clubIndex: events,
      snapshots: events.flatMap((e) => [
        snap({ eventId: e.canonicalEventId, odds: 1.8, temporalClass: "DATE_ONLY" }),
      ]),
    });
    for (const row of out.annual) {
      assert.equal(row.start, 1000);
    }
    const y18 = out.annual.find((a) => a.year === 2018)!;
    const y19 = out.annual.find((a) => a.year === 2019)!;
    assert.equal(y18.bets, 0);
    assert.equal(y19.bets, 0);
    assert.equal(y18.final, null);
    assert.equal(y19.final, null);
    assert.notEqual(y18.data_status, "OK");
  });

  it("bankroll is never negative", () => {
    assert.equal(settleBankroll(10, 10, -50), 0);
    assert.ok(settleBankroll(1000, 10, -5) >= 0);
  });

  it("zero bets when no STRICT quotes exist", () => {
    const cfg = loadExp020Config();
    const e = ev(2019, "2019-08-10", "Liverpool", "Norwich", 4, 1);
    const out = runBlindCapital020({
      cfg,
      events: [e],
      clubIndex: [e],
      snapshots: [snap({ eventId: e.canonicalEventId, odds: 1.8 })],
    });
    assert.equal(out.bets, 0);
    assert.ok(out.noBet >= 1);
  });

  it("holdout is sacred and frozen model stays frequency", () => {
    const cfg = loadExp020Config();
    assert.equal(cfg.frozen_model_id, "frequency");
    assert.deepEqual(cfg.holdout_years, [2024, 2025, 2026]);
    assert.throws(
      () => assertHoldoutUntouched({ holdoutYears: cfg.holdout_years, usedHoldoutForSelection: true }),
      /HOLDOUT_SACRED/,
    );
    assert.equal(ALL_MODELS_020.includes("frequency"), true);
  });

  it("model is frozen before HOLDOUT — no automatic winner", () => {
    const p = runModel020("frequency", {
      freq: [0.5, 0.25, 0.25],
      formHome: 0,
      formAway: 0,
      formSample: 0,
      marketHome: null,
      eloDiff: null,
    });
    assert.deepEqual(p, [0.5, 0.25, 0.25]);
    assert.equal(
      runModel020("elo", {
        freq: [0.5, 0.25, 0.25],
        formHome: 0,
        formAway: 0,
        formSample: 0,
        marketHome: null,
        eloDiff: null,
      }),
      null,
    );
    const cfg = loadExp020Config();
    assert.equal(cfg.winner, null);
    assert.equal(cfg.declared_edge, false);
  });

  it("evidence is required and source reliability stays null", () => {
    const report = buildCapital020Assessment({
      eventId: "e1",
      asOf: new Date("2019-08-10T00:00:00.000Z"),
      formHome: 6,
      formAway: 3,
      formSample: 5,
      dateOpenBooks: 3,
      strictQuotes: 0,
    });
    assert.ok(report.evidenceGraph.insufficient.length >= 1);
    assert.ok(report.evidenceGraph.contextual.length >= 1);
    assert.equal(report.probability, null);
    for (const item of [
      ...report.evidenceGraph.supporting,
      ...report.evidenceGraph.contradicting,
      ...report.evidenceGraph.contextual,
    ]) {
      assert.equal(item.sourceReliability, null);
    }
  });

  it("provenance and lineage cluster redistributions", () => {
    const rows = [
      lineageFor019Source("anishkhetani-epl-archive", "2026-09-07T00:00:00.000Z"),
      lineageFor019Source("jokecamp-e0-2014-15", "2026-09-07T00:00:00.000Z"),
      lineageFor019Source("offline-pack-e0", "2026-09-07T00:00:00.000Z"),
      lineageFor019Source("club-football-match-data", "2026-09-07T00:00:00.000Z"),
    ];
    assert.equal(uniqueUpstreamClusters(rows).includes("football-data-co-uk"), true);
    assert.equal(rows.filter((r) => r.upstreamCluster === "football-data-co-uk").length, 3);
    assert.equal(rows[0]!.independence, "REDISTRIBUTION");
    assert.equal(rows[3]!.independence, "SECONDARY_INDEX");
  });

  it("duplicate snapshots are detected", () => {
    const a = snap({ eventId: "e1", odds: 1.9 });
    const out = dedupeSnapshots([a, { ...a }, snap({ eventId: "e1", odds: 2.0, bookmaker: "pinnacle" })]);
    assert.equal(out.length, 2);
  });

  it("entity resolution matches date + team aliases", () => {
    const a = ev(2019, "2019-08-10", "Man United", "Liverpool", 1, 1);
    const b = ev(2019, "2019-08-10", "Manchester United", "Liverpool", 1, 1);
    a.sourceId = "s1";
    b.sourceId = "s2";
    assert.equal(a.canonicalEventId, b.canonicalEventId);
    const m = matchEvents([a], [b]);
    assert.equal(m.matches.length, 1);
  });

  it("settlement is correct for observed 1X2 / OU / AH", () => {
    const ou = { ftHome: 2, ftAway: 1 };
    assert.equal(
      settleObservedMarket({
        marketType: "1X2",
        line: null,
        selection: "HOME",
        odds: 2,
        stake: 10,
        outcome: ou,
      }).result,
      "WIN",
    );
    assert.equal(
      settleObservedMarket({
        marketType: "TOTAL_GOALS",
        line: 2.5,
        selection: "OVER",
        odds: 1.9,
        stake: 10,
        outcome: ou,
      }).result,
      "WIN",
    );
    assert.equal(
      settleObservedMarket({
        marketType: "ASIAN_HANDICAP",
        line: -1,
        selection: "HOME",
        odds: 1.9,
        stake: 10,
        outcome: { ftHome: 1, ftAway: 0 },
      }).result,
      "PUSH",
    );
  });

  it("blind lock is required before reveal", () => {
    assert.throws(() => assertLockedBeforeReveal(false), BlindLeakageError);
    assertLockedBeforeReveal(true);
  });

  it("no retrospective optimization of frozen experiment", () => {
    assert.throws(
      () =>
        assertNoRetroactiveOptimization({
          retroactive_optimization: true,
          parameters_frozen: true,
        }),
      /RETRO_OPT/,
    );
    const cfg = loadExp020Config();
    assert.equal(cfg.retroactive_optimization, false);
  });

  it("multiple-testing correction blocks small-N edge claims", () => {
    const thr = bonferroniThreshold(0.05, 20);
    assert.ok(thr < 0.05);
    assert.equal(survivesBonferroni({ pValue: 0.04, alpha: 0.05, numberOfTests: 20 }), false);
  });

  it("correlation exposure never invents numeric rho", () => {
    assert.equal(RHO, "UNKNOWN");
  });

  it("declared_edge=false yields stake 0 even with exact quotes", () => {
    const sizing = loadExp016Config().sizing;
    const sig = signalStrength({ p: 0.6, odds: 2.2, trainN: 500, declaredEdge: false });
    assert.equal(sig.edge, null);
    const alloc = allocateCapital({
      policy: "actuarial_v1",
      bankroll: 1000,
      p: 0.6,
      odds: 2.2,
      signal: sig,
      sizing,
      openSameEventExposure: 0,
      forceNo: false,
    });
    assert.equal(alloc.stake, 0);
  });

  it("Betfair pt fixture is EXACT_OBSERVATION_TIME but not ingested for capital", () => {
    const ticks = parseBetfairBasicFixture([
      JSON.stringify({
        pt: 1_573_430_400_000,
        eventId: "bf-1",
        selection: "HOME",
        ltp: 1.95,
        marketType: "1X2",
        sport: "tennis",
      }),
    ]);
    assert.equal(ticks[0]!.temporalClass, "EXACT_OBSERVATION_TIME");
    assert.equal(ticks[0]!.availableAt, new Date(1_573_430_400_000).toISOString());
    const horizons = decisionAsOfCandidates(new Date("2019-11-10T18:00:00.000Z"));
    assert.equal(horizons.length, 7);
  });

  it("lab: 0 STRICT bets, no silent 1000→1000, annual report coherent", async () => {
    const report = await runTask020({
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
    assert.equal(report.HOLDOUT_TOUCHED, false);
    assert.equal(report.verdict, "NO_DEMONSTRATED_EDGE");
    assert.equal(report.frozen_model, "frequency");
    assert.equal(report.counts.bets, 0);
    assert.equal(report.dataset.strict_usable, 0);
    assert.ok(report.dataset.date_only > 0);
    assert.ok(report.dataset.events_normalized >= 1);
    assert.ok(report.dataset.observed_markets.includes("1X2"));
    assert.equal(report.model_ready["1X2"], false);
    assert.equal(report.model_ready.BTTS, false);
    assert.equal(report.multiple_testing.any_significant, false);
    const y2019 = report.annual.find((a) => a.year === 2019);
    assert.ok(y2019);
    assert.equal(y2019.data_status, "INSUFFICIENT_DATA");
    assert.equal(y2019.final, null);
    assert.equal(y2019.pnl, null);
    assert.equal(y2019.start, 1000);
    assert.equal(report.annual.find((a) => a.year === 2026)?.data_status, "INCOMPLETE");
    const annualBets = report.annual.reduce((s, a) => s + a.bets, 0);
    const annualDec = report.annual.reduce((s, a) => s + a.decisions, 0);
    assert.equal(annualBets, report.counts.bets);
    assert.equal(annualDec, report.counts.decisions);
    assert.ok(report.decisions.every((d) => d.locked && d.outcome_in_decision === false));
    assert.ok(report.decisions.some((d) => d.evidence.length >= 0));
    const fdCluster = report.lineage.rows.filter((r) => r.upstreamCluster === "football-data-co-uk");
    assert.ok(fdCluster.length >= 2);
    const audit = auditTask020(report);
    assert.equal(audit.ok, true);
    assert.equal(report.better_than_date_only.ingested_for_capital, false);
  });
});
