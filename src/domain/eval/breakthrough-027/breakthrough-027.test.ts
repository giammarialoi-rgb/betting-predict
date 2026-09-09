import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { auditTask027 } from "@/domain/eval/breakthrough-027/audit";
import { annualFromReplay027 } from "@/domain/eval/breakthrough-027/bankroll";
import { loadExp027Config } from "@/domain/eval/breakthrough-027/config";
import { runTask027 } from "@/domain/eval/breakthrough-027/lab";
import { runHostileBattery027 } from "@/domain/eval/breakthrough-027/leakage";
import { parseStrictCandidatesCsv } from "@/domain/eval/breakthrough-027/load-candidates";
import { capitalMatchAllowed027, gradeUniqueCount } from "@/domain/eval/breakthrough-027/matching";
import { classifyLevelB, parseSoccerKickoffUtc, refuseBtbDatetimeAsUtc } from "@/domain/eval/breakthrough-027/overlay";
import { phpBinIndex, windowExistsInPhpHourly } from "@/domain/eval/breakthrough-027/php-bins";
import { replayStrict027 } from "@/domain/eval/breakthrough-027/replay";
import { readFileSync } from "node:fs";
import { miniStrictPath } from "@/domain/eval/breakthrough-027/config";
import { classifyClock } from "@/domain/eval/bottleneck-026/classify";

describe("TASK 027 data breakthrough", () => {
  it("PHP bins: T-1h is index 70; T-72h and minutes do not exist", () => {
    assert.equal(phpBinIndex(1), 70);
    assert.equal(phpBinIndex(71), 0);
    assert.equal(phpBinIndex(72), null);
    assert.equal(windowExistsInPhpHourly("T-1h"), true);
    assert.equal(windowExistsInPhpHourly("T-72h"), false);
    assert.equal(windowExistsInPhpHourly("T-1m"), false);
  });

  it("LEVEL B overlay uses soccer UTC + PHP hours; never BTB datetime as UTC", () => {
    assert.equal(refuseBtbDatetimeAsUtc("2015-09-25 17:30:00"), "TEMPORALLY_UNKNOWN");
    assert.equal(parseSoccerKickoffUtc("2015-09-25"), null);
    assert.equal(parseSoccerKickoffUtc("2015-09-25T00:00:00"), null);
    const ok = classifyLevelB({
      soccerKickoffRaw: "2015-09-25T15:30:00",
      hoursBefore: 1,
      matchGrade: "MATCH_EXACT",
      licenseCapitalOk: true,
    });
    assert.equal(ok.capitalEligible, true);
    assert.equal(ok.level, "LEVEL_B");
    assert.equal(ok.kickoff, "2015-09-25T15:30:00.000Z");
    assert.equal(ok.quote, "2015-09-25T14:30:00.000Z");
    const amb = classifyLevelB({
      soccerKickoffRaw: "2015-09-25T15:30:00",
      hoursBefore: 1,
      matchGrade: "MATCH_AMBIGUOUS",
      licenseCapitalOk: true,
    });
    assert.equal(amb.capitalEligible, false);
    const dateOnly = classifyClock({
      raw: "2015-09-25",
      origin: "SOURCE_TIMESTAMP",
      licenseCapitalOk: true,
    });
    assert.equal(dateOnly.capitalEligible, false);
    assert.equal(dateOnly.precision, "DATE_ONLY");
  });

  it("only MATCH_EXACT unique identity may enter capital", () => {
    assert.equal(gradeUniqueCount(1), "MATCH_EXACT");
    assert.equal(gradeUniqueCount(2), "MATCH_AMBIGUOUS");
    assert.equal(capitalMatchAllowed027("MATCH_PROBABLE"), false);
    assert.equal(capitalMatchAllowed027("MATCH_EXACT"), true);
  });

  it("parses mini STRICT fixture as LEVEL B T-1h", () => {
    const rows = parseStrictCandidatesCsv(readFileSync(miniStrictPath(), "utf8"), "2026-09-07T00:00:00.000Z");
    assert.equal(rows.length, 3);
    assert.ok(rows.every((r) => r.capital_level === "LEVEL_B"));
    assert.ok(rows.every((r) => r.windows["T-1h"] === true));
    assert.ok(rows.every((r) => r.windows["T-72h"] === false));
    assert.ok(Date.parse(rows[0]!.odds_timestamp) < Date.parse(rows[0]!.kickoff));
  });

  it("hostile battery all throw; annual never silent 1000", () => {
    const battery = runHostileBattery027();
    assert.ok(battery.length >= 14);
    assert.ok(battery.every((x) => x.throws), battery.filter((x) => !x.throws).map((x) => x.id).join(","));
    const cfg = loadExp027Config();
    const rows = parseStrictCandidatesCsv(readFileSync(miniStrictPath(), "utf8"), "2026-09-07T00:00:00.000Z");
    const replay = replayStrict027({ events: rows, cfg });
    const years = annualFromReplay027({
      years: [2015, 2026],
      replay,
      datasetLabel: "mini",
      primaryStrategy: "actuarial_v1",
    });
    assert.equal(years[0]!.bets, 0);
    assert.equal(years[0]!.end, null);
    assert.equal(years[1]!.status, "INCOMPLETE");
  });

  it("frozen config, skipHeavy lab, no silent 1000, winner null", async () => {
    const cfg = loadExp027Config();
    assert.equal(cfg.winner, null);
    assert.equal(cfg.invent_timezone, false);
    assert.equal(cfg.assume_btb_datetime_utc, false);
    assert.equal(cfg.kaggle_ah_in_capital, false);
    const report = await runTask027({ allowNetwork: false, skipHeavy: true });
    assert.equal(report.winner, null);
    assert.equal(report.real_money, false);
    assert.equal(report.declared_edge, false);
    assert.equal(report.model_ready, false);
    assert.equal(report.qualified.qualified, false);
    assert.equal(report.fixture_mode, true);
    assert.equal(report.data_band, "NO_DATA_BREAKTHROUGH");
    assert.equal(report.metrics.strict_events, 3);
    assert.ok(report.leakage.every((l) => l.throws));
    for (const row of report.annual) {
      assert.notEqual(row.end, 1000);
      if (row.bets === 0) assert.equal(row.end, null);
    }
    const audited = auditTask027(report);
    assert.equal(audited.ok, true, audited.failures.join(","));
  });
});
