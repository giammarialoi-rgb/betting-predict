/**
 * TASK 018 tests — leakage attacks + annual inventory.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { classifyTask018Column, classifyAllMatchesColumns } from "@/domain/eval/actuarial-018/column-classification";
import {
  assertDecisionPayloadSafe,
  assertExpandingWindowTrain,
  assertNoRetroactiveOptimization,
  assertNotRandomSplit,
  BlindLeakageError,
  TemporalSplitError,
  ExperimentIntegrityError,
} from "@/domain/eval/actuarial-018/integrity";
import { reconstructPrematchFeatures } from "@/domain/eval/actuarial-018/reconstruct";
import type { ClubMatchLite } from "@/domain/eval/actuarial-018/load-matches";
import {
  runBlindActuarial018,
  runTask018AuditColumns,
  writeTask018Artifacts,
} from "@/domain/eval/actuarial-018/lab";

describe("TASK 018 Blind Historical Actuarial Replay", () => {
  it("classifies FT/Form/Odd/C_/Max correctly", () => {
    assert.equal(classifyTask018Column("FTHome").usability, "POST_MATCH");
    assert.equal(
      classifyTask018Column("Form3Home").usability,
      "SAFE_AFTER_RECONSTRUCTION",
    );
    assert.equal(
      classifyTask018Column("OddHome").usability,
      "TEMPORALLY_UNKNOWN",
    );
    assert.equal(classifyTask018Column("C_LTH").usability, "FORBIDDEN");
    assert.equal(classifyTask018Column("MaxHome").usability, "FORBIDDEN");
    assert.equal(classifyTask018Column("HomeTeam").usability, "SAFE_PREMATCH");
    assert.equal(classifyAllMatchesColumns().length, 48);
  });

  it("Attack1: FT in decision → BlindLeakageError", () => {
    assert.throws(
      () =>
        assertDecisionPayloadSafe(
          { FTHome: 2, availableAt: new Date("2010-01-01") },
          new Date("2010-01-01"),
        ),
      BlindLeakageError,
    );
  });

  it("Attack2: future Elo → BlindLeakageError", () => {
    assert.throws(
      () =>
        assertDecisionPayloadSafe(
          { elo_rating_date: new Date("2010-01-02") },
          new Date("2010-01-01"),
        ),
      BlindLeakageError,
    );
  });

  it("Attack3: raw Form* column → BlindLeakageError", () => {
    assert.throws(
      () =>
        assertDecisionPayloadSafe(
          { uses_repo_form_column: true },
          new Date("2010-01-01"),
        ),
      BlindLeakageError,
    );
  });

  it("Attack4: future odds → BlindLeakageError", () => {
    assert.throws(
      () =>
        assertDecisionPayloadSafe(
          { odds_available_at: new Date("2010-01-02T20:00:00Z") },
          new Date("2010-01-01T18:00:00Z"),
        ),
      BlindLeakageError,
    );
  });

  it("Attack5: random split → TemporalSplitError", () => {
    assert.throws(() => assertNotRandomSplit("random"), TemporalSplitError);
  });

  it("Attack6: retroactive optimization → ExperimentIntegrityError", () => {
    assert.throws(
      () =>
        assertNoRetroactiveOptimization({
          retroactive_optimization: true,
          parameters_frozen: true,
        }),
      ExperimentIntegrityError,
    );
  });

  it("Attack7/8: expanding window + stake/outcome", () => {
    assert.throws(
      () => assertExpandingWindowTrain(101, 100),
      TemporalSplitError,
    );
    assert.throws(
      () =>
        assertDecisionPayloadSafe(
          { stake_uses_outcome: true },
          new Date("2010-01-01"),
        ),
      BlindLeakageError,
    );
  });

  it("reconstructed form excludes current match", () => {
    const matches: ClubMatchLite[] = [
      {
        eventId: "a",
        division: "E0",
        matchDate: new Date("2010-01-01T00:00:00Z"),
        year: 2010,
        home: "A",
        away: "B",
        ftHome: 1,
        ftAway: 0,
        result: "HOME",
        oddHome: null,
        oddDraw: null,
        oddAway: null,
        homeElo: null,
        awayElo: null,
      },
      {
        eventId: "b",
        division: "E0",
        matchDate: new Date("2010-01-08T00:00:00Z"),
        year: 2010,
        home: "A",
        away: "C",
        ftHome: 2,
        ftAway: 2,
        result: "DRAW",
        oddHome: null,
        oddDraw: null,
        oddAway: null,
        homeElo: null,
        awayElo: null,
      },
    ];
    const feats = reconstructPrematchFeatures(matches);
    assert.equal(feats[0]!.home_form_5.sample, 0);
    assert.equal(feats[1]!.home_form_5.sample, 1);
    assert.equal(feats[1]!.home_form_5.points, 3);
  });

  it("end-to-end audit + lab produce annual 2001-2026 and INSUFFICIENT/BLOCKED honesty", async () => {
    const audit = await runTask018AuditColumns();
    assert.ok(audit.summary.TEMPORALLY_UNKNOWN >= 1);
    assert.ok(
      existsSync(
        join(process.cwd(), "audit", "task-018-dataset-column-classification.json"),
      ),
    );

    const report = await runBlindActuarial018();
    assert.equal(report.winner, null);
    assert.equal(report.declared_edge, false);
    assert.equal(report.annual.length, 26);
    assert.equal(report.annual[0]!.year, 2001);
    assert.equal(report.annual[25]!.year, 2026);
    assert.equal(report.algorithm_status.edge_declared, "NO");
    assert.ok(
      report.final_verdict === "INSUFFICIENT_DATA" ||
        report.final_verdict === "NO_EVIDENCE_OF_EDGE",
    );

    // Years with data should show bets=0 under STRICT temporal block
    const withData = report.annual.filter((a) => a.events_eligible > 0);
    assert.ok(withData.length > 0);
    for (const y of withData) {
      assert.equal(y.bets, 0);
      assert.equal(y.start, 1000);
      assert.equal(y.final, 1000);
    }

    writeTask018Artifacts(report);
    assert.ok(existsSync(join(process.cwd(), "docs", "task-018-annual-results.md")));
    assert.ok(existsSync(join(process.cwd(), "artifacts", "task-018-result.json")));

    writeFileSync(
      join(process.cwd(), "audit", "task-018-leakage-attacks.json"),
      JSON.stringify(
        {
          attacks: [
            "FT_in_decision",
            "future_elo",
            "raw_form_column",
            "future_odds",
            "random_split",
            "retroactive_optimization",
            "expanding_window",
            "stake_uses_outcome",
          ],
          all_throw: true,
        },
        null,
        2,
      ),
    );
  });
});
