import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { auditTask026 } from "@/domain/eval/bottleneck-026/audit";
import { classifyClock, parseCompactUtcTimestamp, successBand, isQualified } from "@/domain/eval/bottleneck-026/classify";
import { loadExp026Config } from "@/domain/eval/bottleneck-026/config";
import { inspectAhCsv, inspectKaggleAh, kaggleAhMiniPath } from "@/domain/eval/bottleneck-026/kaggle-ah";
import { runTask026 } from "@/domain/eval/bottleneck-026/lab";
import { runHostileBattery026 } from "@/domain/eval/bottleneck-026/leakage";
import { capitalMatchAllowed, matchFixtures } from "@/domain/eval/bottleneck-026/matching";
import { annualBankroll026 } from "@/domain/eval/bottleneck-026/bankroll";

describe("TASK 026 break the data bottleneck", () => {
  it("never promotes DATE_ONLY, OPEN/CLOSE, or ASSUMED clocks to STRICT", () => {
    assert.equal(classifyClock({ raw: "2017-04-30", origin: "SOURCE_TIMESTAMP" }).precision, "DATE_ONLY");
    assert.equal(classifyClock({ raw: "05/08/2005", origin: "SOURCE_TIMESTAMP" }).precision, "DATE_ONLY");
    assert.equal(classifyClock({ raw: "OPENING", origin: "SOURCE_TIMESTAMP" }).precision, "DATE_ONLY");
    assert.equal(classifyClock({ raw: "CLOSE", origin: "SOURCE_TIMESTAMP" }).capitalEligible, false);
    const assumed = classifyClock({
      raw: "2024-04-09T18:31:42Z",
      origin: "ASSUMED_TIMESTAMP",
      kickoffIso: "2024-04-09T20:00:00Z",
      licenseCapitalOk: true,
    });
    assert.equal(assumed.capitalEligible, false);
    assert.equal(assumed.origin, "ASSUMED_TIMESTAMP");
    const compact = parseCompactUtcTimestamp("20250104225637");
    assert.equal(compact, "2025-01-04T22:56:37.000Z");
    const kaggle = classifyClock({ raw: "20250104225637", origin: "SOURCE_TIMESTAMP" });
    assert.equal(kaggle.precision, "EXACT_TIMESTAMP");
    assert.equal(kaggle.capitalEligible, false);
    const derived = classifyClock({
      raw: "2024-04-09T18:31:42Z",
      origin: "DERIVED_TIMESTAMP",
      kickoffIso: "2024-04-09T20:00:00Z",
      licenseCapitalOk: true,
    });
    assert.equal(derived.capitalEligible, false);
  });

  it("parses Kaggle AH mini fixture timestamps and refuses FT as a clock", () => {
    const file = inspectAhCsv(readFileSync(kaggleAhMiniPath(), "utf8"), "fixtures/kaggle-ah-mini.csv");
    assert.equal(file.kickoff_in_file, false);
    assert.equal(file.has_ft_score, true);
    assert.ok(file.exact_timestamps >= 3);
    assert.equal(file.ts_min, "2023-08-10T12:00:00.000Z");
    assert.equal(successBand(1), "FAILURE");
    assert.equal(successBand(50), "SUCCESS_B");
    assert.equal(successBand(100), "SUCCESS_A");
    const skip = inspectKaggleAh({ skipFull: true });
    assert.equal(skip.license, "UNKNOWN");
    assert.equal(skip.claimed_roi_used, false);
    assert.equal(skip.kickoff_column, false);
  });

  it("matching: only EXACT may enter capital; QUALIFIED is conjunctive", () => {
    const g = matchFixtures(
      {
        competition: "EPL",
        season: "2016",
        date: "2017-04-30",
        kickoff: "2017-04-30T13:05:00.000Z",
        home: "Middlesbrough",
        away: "Man City",
      },
      {
        competition: "E0",
        season: "2016",
        date: "2017-04-30",
        kickoff: null,
        home: "Middlesbrough",
        away: "Manchester City",
      },
    );
    assert.equal(g, "EXACT");
    assert.equal(capitalMatchAllowed("PROBABLE"), false);
    assert.equal(
      isQualified({
        temporal_exact: true,
        fixture_exact: true,
        market_valid: true,
        model_calibrated: true,
        sample_sufficient: true,
        walk_forward_pass: true,
        holdout_pass: true,
        statistical_gate_pass: true,
        evidence_available: true,
      }),
      true,
    );
    assert.equal(
      isQualified({
        temporal_exact: false,
        fixture_exact: true,
        market_valid: true,
        model_calibrated: true,
        sample_sufficient: true,
        walk_forward_pass: true,
        holdout_pass: true,
        statistical_gate_pass: true,
        evidence_available: true,
      }),
      false,
    );
  });

  it("hostile battery all throw; annual never silent 1000", () => {
    const battery = runHostileBattery026();
    assert.ok(battery.length >= 10);
    assert.ok(battery.every((x) => x.throws), battery.filter((x) => !x.throws).map((x) => x.id).join(","));
    const years = annualBankroll026({
      years: [2016, 2017, 2026],
      eventsByYear: new Map([[2017, 1]]),
      strictByYear: new Map([[2017, 0]]),
      decisionsByYear: new Map([[2017, 1]]),
      betsByYear: new Map([[2017, 0]]),
    });
    assert.equal(years[1]!.end, null);
    assert.equal(years[1]!.status, "INSUFFICIENT_DATA");
    assert.equal(years[2]!.status, "INCOMPLETE");
  });

  it("frozen config, offline lab, capital_strict=0, no silent 1000", async () => {
    const cfg = loadExp026Config();
    assert.equal(cfg.winner, null);
    assert.equal(cfg.declared_edge, false);
    assert.equal(cfg.mirror_as_licensed_capital, false);
    assert.equal(cfg.kaggle_unknown_license_in_capital, false);
    const report = await runTask026({ allowNetwork: false, skipHeavy: true });
    assert.equal(report.verdict, "INSUFFICIENT_DATA");
    assert.equal(report.model_ready, false);
    assert.equal(report.metrics.capital_strict_events, 0);
    assert.equal(report.metrics.bets, 0);
    assert.ok(report.metrics.temporally_verified_events >= 1);
    assert.equal(report.blind.decision.decision, "NO_BET");
    assert.equal(report.blind.decision.clv_diagnostic.used_in_decision, false);
    assert.equal(report.qualified.qualified, false);
    assert.ok(report.leakage.every((l) => l.throws));
    for (const row of report.annual) {
      assert.notEqual(row.end, 1000);
      if (row.bets === 0) assert.equal(row.end, null);
    }
    const audited = auditTask026(report);
    assert.equal(audited.ok, true, audited.failures.join(","));
  });
});
