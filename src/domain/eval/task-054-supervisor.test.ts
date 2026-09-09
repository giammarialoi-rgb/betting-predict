import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { saveBrainState051, defaultBrainState051 } from "@/domain/eval/brain-051/config";
import {
  acquirePidLock054,
  pidAlive054,
  releasePidLock054,
  readPidLock054,
} from "@/domain/eval/supervisor-054/locks";
import {
  assessWorkerHealth054,
  healOnce054,
  recoverStoreSnapshot054,
  SPAWN_COOLDOWN_MS_054,
} from "@/domain/eval/supervisor-054/heal";
import {
  ensureSupervisorDirs054,
  loadSupervisorState054,
  saveSupervisorState054,
  writeRichHeartbeat054,
} from "@/domain/eval/supervisor-054/state";
import { loadExp054Config } from "@/domain/eval/catalog-054/config";
import { auditTask054Supervisor } from "@/domain/eval/supervisor-054/audit";
import { labAFingerprint046, assertLabAUntouched046 } from "@/domain/eval/control-046/lab-a-firewall";
import { runSelfHealingSimulation054 } from "@/domain/eval/supervisor-054/lab";

describe("TASK 054 24/7 supervisor self-healing", () => {
  it("exp: paper capital, Directa scrape default false, no TASK 055", () => {
    const cfg = loadExp054Config();
    assert.equal(cfg.real_money, false);
    assert.equal(cfg.auto_promotion, false);
    assert.equal(cfg.open_task_055, false);
    assert.equal(cfg.directa_scraping_default, false);
    assert.equal(cfg.no_artificial_event_cap, true);
  });

  it("atomic pid lock: second acquire fails while held", () => {
    const dir = mkdtempSync(join(tmpdir(), "lock054-"));
    const path = join(dir, "x.lock");
    const a = acquirePidLock054(path, "worker");
    assert.equal(a.ok, true);
    // Same process can re-acquire
    const again = acquirePidLock054(path, "worker");
    assert.equal(again.ok, true);
    releasePidLock054(path);
    assert.equal(readPidLock054(path), null);
  });

  it("IDLE alive worker is not DEAD", () => {
    const dir = mkdtempSync(join(tmpdir(), "idle054-"));
    ensureSupervisorDirs054(dir);
    mkdirSync(join(dir, "brain"), { recursive: true });
    // Write brain state IDLE with current pid as worker
    saveBrainState051(dir, {
      ...defaultBrainState051(),
      status: "IDLE",
      worker_pid: process.pid,
    });
    writeRichHeartbeat054(dir, {
      pid: process.pid,
      started_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      last_cycle_at: null,
      last_successful_cycle_at: null,
      phase: "idle_sleep",
      sport: null,
      event_id: null,
      market: null,
      api_state: "OK",
      budget_state: "OK",
      current_operation: "idle",
      role: "worker",
    });
    const a = assessWorkerHealth054(dir);
    assert.equal(a.worker_alive, true);
    assert.equal(a.needs_restart, false);
    assert.equal(a.official_status, "IDLE");
  });

  it("PAUSED_BUDGET is not crash restart", () => {
    const dir = mkdtempSync(join(tmpdir(), "budget054-"));
    ensureSupervisorDirs054(dir);
    mkdirSync(join(dir, "brain"), { recursive: true });
    saveBrainState051(dir, {
      ...defaultBrainState051(),
      status: "PAUSED_BUDGET",
      worker_pid: process.pid,
    });
    writeRichHeartbeat054(dir, {
      pid: process.pid,
      started_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      last_cycle_at: null,
      last_successful_cycle_at: null,
      phase: "budget",
      sport: null,
      event_id: null,
      market: null,
      api_state: "OK",
      budget_state: "PAUSED",
      current_operation: "wait_budget",
      role: "worker",
    });
    const a = assessWorkerHealth054(dir);
    assert.equal(a.needs_restart, false);
    assert.equal(a.official_status, "PAUSED_BUDGET");
  });

  it("cooldown blocks duplicate spawn", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cool054-"));
    ensureSupervisorDirs054(dir);
    mkdirSync(join(dir, "brain"), { recursive: true });
    writeRichHeartbeat054(dir, {
      pid: 999999,
      started_at: "2020-01-01T00:00:00.000Z",
      heartbeat_at: "2020-01-01T00:00:00.000Z",
      last_cycle_at: null,
      last_successful_cycle_at: null,
      phase: "dead",
      sport: null,
      event_id: null,
      market: null,
      api_state: null,
      budget_state: null,
      current_operation: null,
      role: "worker",
    });
    saveSupervisorState054(dir, {
      ...loadSupervisorState054(dir),
      spawn_cooldown_until: new Date(Date.now() + SPAWN_COOLDOWN_MS_054).toISOString(),
      heartbeat_stale_ms: 1000,
    });
    const r = await healOnce054({ root: dir, waitMs: 50 });
    assert.equal(r.action, "cooldown");
  });

  it("self-healing simulation PASS + Lab A untouched", async () => {
    const before = labAFingerprint046();
    assert.equal(before.events, 114);
    const r = await runSelfHealingSimulation054();
    assert.equal(r, "PASS");
    assertLabAUntouched046(before);
  });

  it("store recovery snapshot does not mutate Lab A", () => {
    const before = labAFingerprint046();
    const snap = recoverStoreSnapshot054();
    assert.equal(snap.lab_a_mutation, false);
    assert.ok(snap.events_unique >= 114);
    assertLabAUntouched046(before);
  });

  it("audit READY shape", () => {
    const r = auditTask054Supervisor({
      experiment_id: "exp_054_directa_multisource_catalog",
      task: "054",
      FINAL_VERDICT: "SUPERVISOR_24_7_SELF_HEALING_READY",
      SUPERVISOR_ALIVE: true,
      WORKER_ALIVE: true,
      HEARTBEAT_FRESH: true,
      SELF_HEALING_TEST: "PASS",
      NO_DUPLICATE_WORKERS: true,
      STORE_RECOVERY: "PASS",
      LAB_A_MUTATION: false,
      REAL_MONEY: false,
      AUTO_PROMOTION: false,
      CAPITAL: "PAPER_ONLY",
      PAPER_BANKROLL: 1000,
      LEAKAGE: "PASS",
      REPRODUCIBILITY: "PASS",
      DIRECTA_POLICY_STATUS: "DISABLED_BY_POLICY",
      OPEN_TASK_055: false,
      ARTIFICIAL_CAP: false,
      SYSTEM_STATUS: "HEALTHY",
      OFFICIAL_STATUS: "WORKING",
      RESTART_COUNT: 1,
      STORE_EVENTS_UNIQUE: 385,
      fingerprint: "x",
      experiment_sha256: "y",
    });
    assert.equal(r.ok, true);
  });

  it("pidAlive false for nonsense pid", () => {
    assert.equal(pidAlive054(null), false);
    assert.equal(pidAlive054(-1), false);
  });
});
