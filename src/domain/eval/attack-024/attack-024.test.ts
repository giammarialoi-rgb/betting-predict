import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BlindLeakageError } from "@/domain/eval/actuarial-018/integrity";
import { auditTask024 } from "@/domain/eval/attack-024/audit";
import { figure2bPrematchBins, btbSeriesCase, assertNotPromoteHourlyBinToUtc } from "@/domain/eval/attack-024/btb-semantics";
import { loadExp024Config } from "@/domain/eval/attack-024/config";
import { decideVerdict, runTask024 } from "@/domain/eval/attack-024/lab";
import {
  leakAOutcomeInDecision,
  leakBAfterAsOf,
  leakCQuoteAfterKickoff,
  leakDAmbiguousTimezone,
  leakEDuplicateDistribution,
  leakFInventedPrematchOffset,
  leakGOutcomeInFeatures,
  leakHClosingBeforeClose,
} from "@/domain/eval/attack-024/leakage";
import { buildStrictLedgerFromBetfairFixture } from "@/domain/eval/attack-024/ledger";
import { clusterCount, duplicateDoesNotSplitCluster, LINEAGE } from "@/domain/eval/attack-024/lineage";
import { classifySoccerSample, loadSoccerAudit, loadSoccerSamples } from "@/domain/eval/attack-024/soccer-audit";
import {
  classifyKickoffPrecision,
  classifyQuotePrecision,
  classifyTemporalRelation,
  strictUsable,
} from "@/domain/eval/attack-024/temporal";
import { seriesColumnRelativeSeconds } from "@/domain/eval/recovery-022/temporal";
import { isAggregateBookmakerLabel } from "@/domain/eval/recovery-022/bookmakers";

describe("TASK 024 historical data attack", () => {
  it("soccer-dataset known_at equals kickoff on every sample — never STRICT", () => {
    const samples = loadSoccerSamples();
    assert.ok(samples.length >= 8);
    for (const row of samples) {
      assert.equal(row.delta_seconds, 0);
      const audit = classifySoccerSample(row);
      assert.equal(audit.delta_seconds, 0);
      assert.notEqual(audit.temporal_class, "STRICT_PREMATCH");
      assert.equal(
        strictUsable({
          acquired: true,
          parsed: true,
          kickoff: classifyKickoffPrecision({
            kickoffRaw: row.kickoff,
            timezoneProven: true,
          }),
          quote: classifyQuotePrecision({
            quoteRaw: row.odds_known_at,
            timezoneProven: true,
            isRelativeBin: false,
          }),
          relation: classifyTemporalRelation({
            quoteMs: Date.parse(`${row.odds_known_at}Z`),
            kickoffMs: Date.parse(`${row.kickoff}Z`),
          }),
        }),
        false,
      );
    }
    const midnight = samples.filter((s) => s.kickoff_midnight);
    const clock = samples.filter((s) => !s.kickoff_midnight);
    assert.ok(midnight.length >= 1);
    assert.ok(clock.length >= 1);
    assert.equal(classifySoccerSample(midnight[0]!).temporal_class, "MIDNIGHT_PLACEHOLDER");
    assert.equal(classifySoccerSample(clock[0]!).temporal_class, "CLOSING_AT_KICKOFF");
    const max = samples.find((s) => s.bookmaker === "Maximum");
    assert.ok(max);
    assert.equal(isAggregateBookmakerLabel("Maximum") || max.bookmaker === "Maximum", true);
    const audit = loadSoccerAudit();
    assert.equal(audit.known_at_eq_kickoff, audit.odds_rows);
    assert.equal(audit.known_at_before, 0);
    assert.equal(audit.known_at_after, 0);
  });

  it("Figure2B 5→1h bins are MATLAB 67:71 = PHP 66:70, excluding kickoff", () => {
    const bins = figure2bPrematchBins();
    assert.equal(bins.length, 5);
    assert.equal(bins[0]?.relative_hours, 5);
    assert.equal(bins[bins.length - 1]?.relative_hours, 1);
    assert.equal(seriesColumnRelativeSeconds(66), 5 * 3600);
    assert.equal(seriesColumnRelativeSeconds(70), 3600);
    assert.equal(seriesColumnRelativeSeconds(71), 0);
    assert.ok(bins.every((b) => !b.is_kickoff_marker));
    const cas = btbSeriesCase({
      bulkAcquired: false,
      hasAbsoluteDatetime: false,
      timezoneProven: false,
      generatorRelativeDocumented: true,
    });
    assert.equal(cas.strict, false);
    assert.equal(cas.case, "D");
    assert.throws(() => assertNotPromoteHourlyBinToUtc("2016-04-03T14:00:00.000Z", false));
  });

  it("GitHub + Kaggle BeatTheBookie remain one lineage cluster", () => {
    const github = LINEAGE.find((l) => l.sourceId === "beatthebookie-closing")!;
    const kaggle = LINEAGE.find((l) => l.sourceId === "beatthebookie-kaggle")!;
    assert.equal(duplicateDoesNotSplitCluster({ github, kaggle }), true);
    assert.equal(clusterCount([github, kaggle]), 1);
    const soccerHf = LINEAGE.find((l) => l.sourceId === "soccer-dataset-hf")!;
    const soccerGh = LINEAGE.find((l) => l.sourceId === "soccer-dataset-github")!;
    assert.equal(clusterCount([soccerHf, soccerGh]), 1);
    assert.ok(clusterCount() >= 4);
  });

  it("hostile A–H all HARD FAIL", () => {
    const clock = loadSoccerSamples().find((s) => !s.kickoff_midnight)!;
    const asOf = new Date("2017-04-30T12:05:00.000Z");
    const ko = "2017-04-30T13:05:00.000Z";
    assert.throws(() => leakAOutcomeInDecision({ outcome: "DRAW" }), BlindLeakageError);
    assert.throws(() => leakBAfterAsOf("2017-04-30T12:06:00.000Z", asOf), BlindLeakageError);
    assert.throws(() => leakCQuoteAfterKickoff("2017-04-30T13:06:00.000Z", ko), BlindLeakageError);
    assert.equal(leakDAmbiguousTimezone(), "UNKNOWN");
    assert.throws(() => leakEDuplicateDistribution(2), BlindLeakageError);
    leakEDuplicateDistribution(1);
    assert.throws(() => leakFInventedPrematchOffset(clock, 3600), BlindLeakageError);
    assert.throws(() => leakGOutcomeInFeatures({ FT: 1 }), BlindLeakageError);
    assert.throws(
      () => leakHClosingBeforeClose({ observationKind: "close", decisionBeforeClose: true }),
      BlindLeakageError,
    );
  });

  it("STRICT ledger has quote_timestamp < kickoff on the Betfair MIRROR event only", () => {
    const rows = buildStrictLedgerFromBetfairFixture();
    assert.equal(rows.length, 1);
    const r = rows[0]!;
    assert.equal(r.strict, "YES");
    assert.equal(r.competition, "EPL");
    assert.equal(r.market, "MATCH_ODDS");
    assert.ok(r.delta_kickoff_sec < 0);
    assert.ok(Date.parse(r.quote_timestamp) < Date.parse(r.kickoff_utc));
    assert.equal(r.independence, "MIRROR");
    assert.equal(r.outcome, "DRAW");
  });

  it("frozen config, verdict, lab offline, no soccer STRICT, no silent 1000", async () => {
    const cfg = loadExp024Config();
    assert.equal(cfg.winner, null);
    assert.equal(cfg.auto_promote, false);
    assert.equal(cfg.real_money, false);
    assert.equal(decideVerdict({ strictEvents: 100, datasetsAcquired: 1 }), "STRICT_DATA_FOUND");
    assert.equal(decideVerdict({ strictEvents: 1, datasetsAcquired: 3 }), "PARTIAL_STRICT");
    assert.equal(decideVerdict({ strictEvents: 0, datasetsAcquired: 2 }), "NO_STRICT_DATA");
    assert.equal(decideVerdict({ strictEvents: 0, datasetsAcquired: 0 }), "ACQUISITION_BLOCKED");
    const report = await runTask024({ allowNetwork: false });
    assert.equal(report.verdict, "PARTIAL_STRICT");
    assert.equal(report.success, "B");
    assert.equal(report.winner, null);
    assert.ok(report.metrics.strict_events >= 1);
    assert.ok(report.metrics.strict_events < 100);
    assert.equal(report.walk_forward.replay_launched, false);
    const soccer = report.gates.find((g) => g.sourceId === "soccer-dataset")!;
    assert.equal(soccer.STRICT_USABLE, false);
    assert.equal(soccer.temporal_class, "CLOSING_AT_KICKOFF");
    assert.ok(report.leakage.every((l) => l.throws));
    for (const y of report.annual) {
      assert.notEqual(y.end_bankroll, 1000);
      if (y.strict_events < 100) assert.equal(y.end_bankroll, null);
    }
    const audit = auditTask024(report);
    assert.deepEqual(audit.failures, []);
    assert.equal(audit.ok, true);
  });

  it("does not auto-promote winner", () => {
    assert.equal(loadExp024Config().winner, null);
    assert.equal(loadExp024Config().auto_promote, false);
  });
});
