import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertDecisionPayloadSafe, BlindLeakageError } from "@/domain/eval/actuarial-018/integrity";
import { TEMPORAL_BASIS_CLOSE, TEMPORAL_BASIS_OPEN } from "@/domain/eval/acquisition-019/types";
import { classifyAnishColumn, isAggregateColumn } from "@/domain/eval/acquisition-019/columns";
import { matchEvents } from "@/domain/eval/acquisition-019/event-matching";
import { buildNormalizedEvent } from "@/domain/eval/acquisition-019/event-matching";
import {
  emptyFailureBudget,
  parseAnishEpl,
  parseDate019,
  parseFdcuCsv,
} from "@/domain/eval/acquisition-019/parse";
import { runTask019 } from "@/domain/eval/acquisition-019/lab";
import { canSatisfyPrecision } from "@/domain/odds/temporal";

const FDCU_FIX = `Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,B365H,B365D,B365A,B365CH,B365CD,B365CA,B365>2.5,B365<2.5,MaxH,AvgH
E0,10/08/19,Liverpool,Norwich,4,1,H,1.14,9.00,21.00,1.11,10.00,26.00,1.40,2.90,1.17,1.14
`;

const EPL_RESULTS = `match_id,season,season_code,date,home_team,away_team,fthg,ftag,ftr
t1,2019-20,1920,2019-08-10,Liverpool,Norwich,4,1,H
`;

const EPL_ODDS = `match_id,season,date,home_team,away_team,bet365_1x2_home,bet365_1x2_draw,bet365_1x2_away,bet365_1x2_home_close,market_max_1x2_home,bet365_over25,bet365_under25
t1,2019-20,2019-08-10,Liverpool,Norwich,1.14,9.00,21.00,1.11,1.17,1.40,2.90
`;

describe("TASK 019 historical market acquisition", () => {
  it("parses documented dates without inventing a quote clock", () => {
    const d = parseDate019("10/08/19");
    assert.ok(d);
    assert.equal(d.toISOString(), "2019-08-10T00:00:00.000Z");
    assert.equal(parseDate019("2019-08-10")?.toISOString(), "2019-08-10T00:00:00.000Z");
  });

  it("matches events on date + deterministic slugs; confidence ≠ reliability", () => {
    const a = buildNormalizedEvent({
      sourceId: "s1",
      sourceEventId: "a",
      competitionRaw: "E0",
      matchDate: "2019-08-10",
      year: 2019,
      season: "1920",
      homeRaw: "Man United",
      awayRaw: "Liverpool",
      ftHome: 1,
      ftAway: 1,
    });
    const b = buildNormalizedEvent({
      sourceId: "s2",
      sourceEventId: "b",
      competitionRaw: "Premier League",
      matchDate: "2019-08-10",
      year: 2019,
      season: "1920",
      homeRaw: "Manchester United",
      awayRaw: "Liverpool",
      ftHome: 1,
      ftAway: 1,
    });
    assert.equal(a.canonicalEventId, b.canonicalEventId);
    const m = matchEvents([a], [b]);
    assert.equal(m.matches.length, 1);
    assert.equal(m.matches[0]!.confidence, "exact_alias");
  });

  it("extracts OPEN as Level B date and CLOSE as unknown; skips Max/Avg", () => {
    const budget = emptyFailureBudget();
    const parsed = parseFdcuCsv({
      csvText: FDCU_FIX,
      sourceId: "fdcu-fix",
      sourceUrl: "test://fdcu",
      originalFile: "fix.csv",
      datasetVersion: "test",
      licenseStatus: "offline_pack",
      retrievedAt: "2026-09-07T00:00:00.000Z",
      budget,
    });
    const open = parsed.observations.filter((o) => o.observationKind === "dataset_open");
    const close = parsed.observations.filter((o) => o.observationKind === "dataset_close");
    assert.ok(open.length >= 5);
    assert.ok(close.length >= 3);
    assert.ok(open.every((o) => o.temporalPrecision === "date"));
    assert.ok(open.every((o) => o.availableAt === null));
    assert.ok(open.every((o) => o.temporalBasis === TEMPORAL_BASIS_OPEN));
    assert.ok(close.every((o) => o.temporalPrecision === "unknown"));
    assert.ok(close.every((o) => o.temporalBasis === TEMPORAL_BASIS_CLOSE));
    assert.ok(!parsed.observations.some((o) => o.bookmakerId.includes("max")));
    assert.ok(budget.AGGREGATE_SKIPPED >= 1);
    assert.equal(
      parsed.observations.some((o) => o.temporalBasis.includes("assumed before kickoff")),
      false,
    );
    assert.ok(open.some((o) => o.marketType === "OU25"));
  });

  it("parses Anish archive columns and drops market_max aggregates", () => {
    const budget = emptyFailureBudget();
    const parsed = parseAnishEpl({
      resultsCsv: EPL_RESULTS,
      oddsCsv: EPL_ODDS,
      sourceUrl: "test://epl",
      originalFile: "epl.csv",
      retrievedAt: "2026-09-07T00:00:00.000Z",
      budget,
    });
    assert.equal(parsed.events.length, 1);
    assert.ok(parsed.observations.some((o) => o.bookmakerId === "bet365" && o.marketType === "1X2"));
    assert.ok(parsed.observations.some((o) => o.marketType === "OU25"));
    assert.ok(!parsed.observations.some((o) => o.originalColumn === "market_max_1x2_home"));
    assert.equal(classifyAnishColumn("market_max_1x2_home"), "aggregate");
    assert.equal(isAggregateColumn("MaxH"), true);
  });

  it("date precision cannot satisfy STRICT exact", () => {
    assert.equal(canSatisfyPrecision("dataset_window", "exact"), false);
    assert.equal(canSatisfyPrecision("unknown", "exact"), false);
    assert.equal(canSatisfyPrecision("exact", "exact"), true);
  });

  it("Attack: outcome in DecisionContext throws", () => {
    assert.throws(
      () =>
        assertDecisionPayloadSafe(
          { FTHome: 2, availableAt: new Date("2019-08-10") },
          new Date("2019-08-10"),
        ),
      BlindLeakageError,
    );
  });

  it("lab: new date-valid markets, 0 STRICT bets, no silent 1000→1000, winner null", async () => {
    const report = await runTask019({
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
    assert.equal(report.counts.n_bets, 0);
    assert.equal(report.counts.n_temporally_valid_strict, 0);
    assert.ok(report.counts.n_temporally_valid_date > 0);
    assert.ok(report.counts.n_decisions >= 1);
    assert.ok(report.new_markets.includes("1X2"));
    assert.ok(report.new_markets.includes("OU25"));
    assert.equal(report.counts.n_model_ready, 0);
    const y2019 = report.annual.find((a) => a.year === 2019);
    assert.ok(y2019);
    assert.equal(y2019.data_status, "INSUFFICIENT_DATA");
    assert.equal(y2019.final, null);
    assert.equal(y2019.pnl, null);
    assert.ok(y2019.no_bet_temporal >= 1);
    const corners = report.markets.find((m) => m.market === "CORNERS");
    assert.equal(corners?.lifecycle, "CATALOGUED");
    assert.equal(corners?.observed, false);
    const ou = report.markets.find((m) => m.market === "OU25");
    assert.equal(ou?.observed, true);
    assert.equal(ou?.temporally_valid_date, true);
    assert.equal(ou?.temporally_valid_strict, false);
    assert.equal(ou?.model_ready, false);
    assert.equal(report.verdict, "D_DATASET_INSUFFICIENT_FOR_STRICT");
    assert.equal(report.policies.best_performing_policy, null);
  });
});
