import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeFixtures057 } from "@/domain/data-sources/api-sports/normalize";
import { redactSecrets057, getApiSportsKey057 } from "@/domain/data-sources/api-sports/config";
import { emptyIndependentContract057 } from "@/domain/data-sources/api-sports/contract";
import { auditTask057 } from "@/domain/data-sources/api-sports/audit";
import { canSpend057, loadBudget057 } from "@/domain/data-sources/api-sports/budget";
import { labAFingerprint046 } from "@/domain/eval/control-046/lab-a-firewall";
import { createApiSportsAdapter057 } from "@/domain/data-sources/api-sports/adapter";

describe("TASK 057 API-Sports data foundation", () => {
  it("normalizes fixtures without inventing markets", () => {
    const rows = normalizeFixtures057({
      response: [
        {
          fixture: { id: 99, date: "2026-09-10T12:00:00+00:00", status: { short: "NS" } },
          league: { id: 39, name: "Premier League", season: 2026 },
          teams: { home: { id: 1, name: "Home" }, away: { id: 2, name: "Away" } },
          goals: { home: null, away: null },
        },
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.source, "API_SPORTS");
    assert.equal(rows[0]!.provider_event_id, "99");
    assert.equal(rows[0]!.home_team, "Home");
  });

  it("redacts secrets from strings", () => {
    const key = getApiSportsKey057();
    if (key) {
      assert.equal(redactSecrets057(`leak ${key} end`).includes(key), false);
    }
    assert.match(redactSecrets057("x-apisports-key: abc"), /REDACTED/i);
  });

  it("independent model contract is stub only", () => {
    const c = emptyIndependentContract057();
    assert.equal(c.note, "CONTRACT_ONLY_NO_MODEL_v3");
    assert.equal(c.model_probability, null);
    assert.equal(c.decision, null);
  });

  it("budget governor defaults respect Free limits", () => {
    const b = loadBudget057();
    assert.equal(b.limit_day, 100);
    assert.equal(b.limit_minute, 10);
    assert.equal(b.real_money, false);
    assert.equal(b.open_task_058, false);
    const spend = canSpend057(0);
    assert.equal(spend.ok, true);
  });

  it("adapter does not touch decision engine", () => {
    const a = createApiSportsAdapter057();
    assert.equal(a.sourceId, "API_SPORTS");
    assert.equal(a.decisionContract().note, "CONTRACT_ONLY_NO_MODEL_v3");
  });

  it("Lab A fingerprint 114 + audit shape", () => {
    const fp = labAFingerprint046();
    assert.equal(fp.events, 114);
    const r = auditTask057({
      experiment_id: "exp_057_api_sports_data_foundation",
      task: "057",
      FINAL_VERDICT: "PASS",
      API_SPORTS_REACHABLE: true,
      KEY_CONFIGURED: true,
      KEY_EXPOSED: false,
      CAPABILITY_DISCOVERY: true,
      NORMALIZED_EVENTS: 1,
      AVAILABLE: ["status"],
      PLAN_LIMITED: [],
      UNAVAILABLE: [],
      REQUESTS_THIS_RUN: 1,
      REQUESTS_TODAY: 1,
      REMAINING: 99,
      PLAN: "Free",
      LAB_A_MUTATION: false,
      LAB_A_EVENTS: 114,
      LAB_A_LOCKED: 114,
      REAL_MONEY: false,
      AUTO_PROMOTION: false,
      CAPITAL: "PAPER_ONLY",
      PAPER_INITIAL: 1000,
      MODEL_ENGINE_TOUCHED: false,
      SUPERVISOR_TOUCHED: false,
      open_task_058: false,
      fingerprint: "x",
    });
    assert.equal(r.ok, true);
  });
});
