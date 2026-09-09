import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  expectedValue056,
  impliedProbability056,
  fairOdds056,
  mirrorsMarket056,
} from "@/domain/eval/audit-056/math";
import { canonicalizeAutostart056 } from "@/domain/eval/audit-056/autostart";
import { runDiagnostics056 } from "@/domain/eval/audit-056/diagnostics";
import { auditTask056 } from "@/domain/eval/audit-056/audit";
import { labAFingerprint046 } from "@/domain/eval/control-046/lab-a-firewall";

describe("TASK 056 audit consolidation", () => {
  it("EV and implied probability formulas", () => {
    assert.ok(Math.abs((impliedProbability056(1.8) ?? 0) - 1 / 1.8) < 1e-12);
    assert.ok(Math.abs((expectedValue056(0.62, 1.8) ?? 0) - (0.62 * 1.8 - 1)) < 1e-12);
    assert.ok(Math.abs((fairOdds056(0.5) ?? 0) - 2) < 1e-12);
    assert.equal(mirrorsMarket056(0.53, 0.529), true);
    assert.equal(mirrorsMarket056(0.62, 0.55), false);
  });

  it("autostart canonicalize", () => {
    assert.equal(canonicalizeAutostart056("StartupOnly", true), "STARTUP_FOLDER");
    assert.equal(canonicalizeAutostart056("TaskSchedulerOnly", true), "TASK_SCHEDULER");
    assert.equal(canonicalizeAutostart056("NONE", false), "DISABLED");
  });

  it("diagnostics runs without throwing; Lab A 114", () => {
    const d = runDiagnostics056();
    assert.ok(Array.isArray(d.issues));
    const fp = labAFingerprint046();
    assert.equal(fp.events, 114);
    assert.equal(fp.decisions, 114);
  });

  it("audit rejects READY without model blocker", () => {
    const r = auditTask056({
      experiment_id: "exp_056_final_system_audit",
      task: "056",
      FINAL_VERDICT: "SYSTEM_OPERATIONAL_MARKET_ONLY",
      SYSTEM_STATUS: "HEALTHY",
      SUPERVISOR_STATUS: "WORKING",
      WORKER_STATUS: "ALIVE",
      BRAIN_STATUS: "RUNNING",
      HEARTBEAT: "FRESH",
      AUTOSTART_STATUS: "STARTUP_FOLDER",
      SUPERVISOR_ALIVE: true,
      WORKER_ALIVE: true,
      HEARTBEAT_FRESH: true,
      NO_DUPLICATE_WORKERS: true,
      EVENTS_TOTAL: 100,
      EVENTS_UNIQUE: 100,
      EVENTS_NEXT_24H: 10,
      EVENTS_NEXT_72H: 20,
      EVENTS_NEXT_7D: 40,
      MARKETS_TOTAL: 3,
      PREDICTIONS_TOTAL: 50,
      BET_CANDIDATES: 0,
      NO_BET: 50,
      LOCKED: 10,
      SETTLED: 2,
      AUTOPSIED: 2,
      LEARNING_CASES: 0,
      SPORTS: {},
      PAPER_INITIAL_CAPITAL: 1000,
      PAPER_CURRENT_CAPITAL: 1000,
      PAPER_BETS: 0,
      PAPER_PNL: 0,
      PAPER_ROI: 0,
      PAPER_MAX_DD: 0,
      MODEL_EDGE: "UNKNOWN",
      MODEL_READINESS: "MARKET_ONLY",
      STATISTICAL_READINESS: "NOT_READY",
      LEARNING_READINESS: "OBSERVATION_ONLY",
      API_CALLS_UI: 0,
      ARTIFICIAL_CAP: false,
      LAB_A_MUTATION: false,
      LAB_A_EVENTS: 114,
      LAB_A_LOCKED: 114,
      REAL_MONEY: false,
      AUTO_PROMOTION: false,
      LEAKAGE: "PASS",
      REPRODUCIBILITY: "PASS",
      DIAGNOSTICS_OK: true,
      BLOCKERS: [],
      CANONICAL_CHAIN: "supervisor→worker→brain→massive049→decision048→bankroll053",
      open_task_057: false,
      fingerprint: "x",
    });
    assert.equal(r.ok, false);
    assert.ok(r.failures.includes("missing_model_blocker"));
  });
});
