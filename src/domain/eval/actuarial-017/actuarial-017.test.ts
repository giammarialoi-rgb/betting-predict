/**
 * TASK 017 tests — blind actuarial historical replay.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadExp017Config } from "@/domain/eval/actuarial-017/exp017-config";
import {
  buildBlindDecision,
  classifyDifference,
} from "@/domain/eval/actuarial-017/blind-decision";
import {
  formatTask017Report,
  runBlindActuarial017,
  writeTask017Audits,
} from "@/domain/eval/actuarial-017/lab";
import {
  BlindLeakageError,
  assertAsOfNotAfter,
  assertNoOutcomeFieldsInDecisionPayload,
} from "@/domain/eval/bankroll/leakage";
import { buildAssessmentReport } from "@/domain/evidence/build-assessment";
import type { DecisionContext } from "@/domain/eval/contexts";
import { assertClubFootballColumnAllowedForStrict } from "@/domain/eval/real-lab/club-football-guard";

describe("TASK 017 Blind Actuarial Historical Replay V1", () => {
  it("loads immutable config with sacred holdout", () => {
    const c = loadExp017Config();
    assert.equal(c.experiment_id, "exp_017_blind_actuarial_replay_v1");
    assert.equal(c.HOLDOUT_TOUCHED, false);
    assert.equal(c.auto_promotion, false);
    assert.equal(c.winner, null);
    assert.equal(c.masaniello_champion, false);
    assert.equal(c.annual_initial_bankroll, 1000);
    assert.equal(c.declared_edge, false);
  });

  it("anti-cheating temporal + outcome leaks fail hard", () => {
    const asOf = new Date("2019-08-01T17:00:00.000Z");
    assert.throws(
      () => assertAsOfNotAfter(new Date("2019-08-01T19:00:00.000Z"), asOf, "odds"),
      BlindLeakageError,
    );
    assert.throws(
      () =>
        assertNoOutcomeFieldsInDecisionPayload(
          { ft_result: "H", availableAt: asOf },
          asOf,
        ),
      BlindLeakageError,
    );
    assert.throws(
      () => assertClubFootballColumnAllowedForStrict("C_LTH"),
      /CLUB_FOOTBALL_BLOCKED/,
    );
  });

  it("difference categories never auto VALIDATED_EDGE without gate", () => {
    assert.equal(classifyDifference(0.55, 0.5, false), "UNVALIDATED_EDGE");
    assert.equal(classifyDifference(0.55, 0.5, true), "VALIDATED_EDGE");
    assert.equal(classifyDifference(0.501, 0.5, false), "NO_SIGNAL");
  });

  it("BlindDecision has LOCK and outcome null", () => {
    const asOf = new Date("2019-08-01T17:00:00.000Z");
    const assessment = buildAssessmentReport({
      eventId: "e1",
      asOf,
      hypothesis: "HOME",
      items: [],
      probability: 0.45,
      insufficient: ["fixture"],
    });
    const ctx: DecisionContext = {
      kind: "decision",
      eventId: "e1",
      sportId: "football",
      asOf,
      asOfPolicy: "RESEARCH",
      availableFeatures: [],
      featureStatuses: {},
      availableMarkets: [],
      marketSnapshots: [],
      dataQuality: {
        featurePresent: 0,
        featureMissing: 0,
        featureForbidden: 0,
        marketCount: 0,
      },
      temporalWarnings: [],
      modelProbability: null,
      uncertainty: null,
      edge: null,
      confidence: null,
      riskState: null,
    };
    const d = buildBlindDecision({
      decisionId: "d1",
      eventId: "e1",
      asOf,
      market: "result",
      selection: "HOME",
      odds: 2.1,
      modelProbability: 0.45,
      marketProbability: 0.45,
      assessment,
      policy: "flat",
      stake: 10,
      bankrollBefore: 1000,
      riskClass: "moderate",
      noPosition: false,
      reason: "flat",
      decisionContext: ctx,
    });
    assert.equal(d.LOCK, true);
    assert.equal(d.outcome, null);
    assert.equal(d.kind, "BlindDecision");
  });

  it("end-to-end lab: yearly 1000 starts, status honest, audits written", () => {
    const report = runBlindActuarial017();
    assert.equal(report.HOLDOUT_TOUCHED, false);
    assert.equal(report.winner, null);
    assert.equal(report.auto_promotion, false);
    assert.ok(
      report.algorithm_status.status === "E_DATA_INSUFFICIENT" ||
        report.algorithm_status.status === "A_NO_EVIDENCE_OF_ADVANTAGE",
    );

    for (const row of report.main_result) {
      assert.equal(row.initial_bankroll, 1000);
      if (row.year < 2019) {
        assert.ok(
          row.data_quality === "INSUFFICIENT_DATA" ||
            row.data_quality === "SECONDARY_ONLY_CATALOGUED",
        );
        assert.equal(row.final_bankroll, null);
      }
    }

    const okYears = report.main_result.filter((r) => r.final_bankroll != null);
    assert.ok(okYears.length >= 1);

    writeTask017Audits(report);
    assert.ok(
      existsSync(join(process.cwd(), "audit", "task-017-yearly-results.json")),
    );
    assert.ok(
      existsSync(join(process.cwd(), "audit", "task-017-strategy-results.json")),
    );

    const text = formatTask017Report(report);
    assert.ok(text.includes("WHERE WE ARE TODAY"));
    assert.ok(text.includes(report.algorithm_status.status));
  });

  it("markets beyond result are not claimed MODEL_READY", () => {
    const report = runBlindActuarial017();
    const corners = report.market_results.find((m) => m.market === "corners");
    assert.ok(corners);
    assert.equal(corners!.model_ready, false);
    assert.notEqual(corners!.status, "ADMITTED");
  });
});
