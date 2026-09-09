/**
 * Self-healing supervisor logic — single worker, cooldown, no Lab A writes.
 */

import { spawn } from "node:child_process";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import {
  brainWorkerLockPath051,
  loadBrainState051,
  saveBrainState051,
} from "@/domain/eval/brain-051/config";
import {
  acquirePidLock054,
  pidAlive054,
  readPidLock054,
  releasePidLock054,
  terminateOrphanWorker054,
} from "@/domain/eval/supervisor-054/locks";
import {
  appendSupervisorJournal054,
  ensureSupervisorDirs054,
  loadSupervisorState054,
  readRichHeartbeat054,
  saveSupervisorState054,
  supervisorLockPath054,
  type OfficialStatus054,
  type SupervisorState054,
} from "@/domain/eval/supervisor-054/state";

export const SPAWN_COOLDOWN_MS_054 = 90_000;
export const HEARTBEAT_STALE_MS_054 = 10 * 60_000;

export type HealAssessment054 = {
  worker_alive: boolean;
  heartbeat_fresh: boolean;
  heartbeat_age_ms: number | null;
  needs_restart: boolean;
  reason: string | null;
  official_status: OfficialStatus054;
  brain_status: string;
};

export function assessWorkerHealth054(root = permanentRoot044()): HealAssessment054 {
  const brain = loadBrainState051(root);
  const wLock = readPidLock054(brainWorkerLockPath051(root));
  const workerPid = wLock?.pid ?? brain.worker_pid;
  const worker_alive = pidAlive054(workerPid);
  const hb = readRichHeartbeat054(root);
  const age = hb?.age_ms ?? null;
  const staleMs = loadSupervisorState054(root).heartbeat_stale_ms || HEARTBEAT_STALE_MS_054;
  const heartbeat_fresh = age != null && age >= 0 && age <= staleMs;

  // IDLE / PAUSED_BUDGET with alive worker + fresh/recent hb ≠ DEAD
  if (brain.status === "PAUSED_BUDGET" && worker_alive) {
    return {
      worker_alive,
      heartbeat_fresh: heartbeat_fresh || age == null,
      heartbeat_age_ms: age,
      needs_restart: false,
      reason: null,
      official_status: "PAUSED_BUDGET",
      brain_status: brain.status,
    };
  }

  if (!worker_alive) {
    return {
      worker_alive: false,
      heartbeat_fresh: false,
      heartbeat_age_ms: age,
      needs_restart: true,
      reason: "WORKER_DEAD",
      official_status: "DEAD",
      brain_status: brain.status,
    };
  }

  if (age != null && age > staleMs) {
    return {
      worker_alive: true,
      heartbeat_fresh: false,
      heartbeat_age_ms: age,
      needs_restart: true,
      reason: "HEARTBEAT_STALE",
      official_status: "DEGRADED",
      brain_status: brain.status,
    };
  }

  if (brain.status === "IDLE" || brain.status === "RUNNING") {
    return {
      worker_alive: true,
      heartbeat_fresh: true,
      heartbeat_age_ms: age,
      needs_restart: false,
      reason: null,
      official_status: brain.status === "IDLE" ? "IDLE" : "WORKING",
      brain_status: brain.status,
    };
  }

  if (brain.status === "ERROR") {
    return {
      worker_alive,
      heartbeat_fresh,
      heartbeat_age_ms: age,
      needs_restart: !worker_alive,
      reason: brain.last_error,
      official_status: "DEGRADED",
      brain_status: brain.status,
    };
  }

  return {
    worker_alive,
    heartbeat_fresh,
    heartbeat_age_ms: age,
    needs_restart: false,
    reason: null,
    official_status: "NORMAL",
    brain_status: brain.status,
  };
}

function inCooldown(state: SupervisorState054, nowMs: number): boolean {
  if (!state.spawn_cooldown_until) return false;
  const t = Date.parse(state.spawn_cooldown_until);
  return Number.isFinite(t) && nowMs < t;
}

export function spawnBrainWorker054(repoRoot = process.cwd()): void {
  const child = spawn(
    process.platform === "win32" ? "cmd.exe" : "pnpm",
    process.platform === "win32"
      ? ["/c", "pnpm", "exec", "tsx", "src/scripts/brain-worker.ts"]
      : ["exec", "tsx", "src/scripts/brain-worker.ts"],
    {
      cwd: repoRoot,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    },
  );
  child.unref();
}

export type HealResult054 = {
  action: "none" | "spawned" | "cooldown" | "paused_budget" | "failed";
  assessment: HealAssessment054;
  state: SupervisorState054;
  new_worker_pid: number | null;
};

/** One heal tick — never starts duplicate workers while cooldown or alive worker. */
export async function healOnce054(input: {
  root?: string;
  repoRoot?: string;
  nowMs?: number;
  waitMs?: number;
} = {}): Promise<HealResult054> {
  const root = input.root ?? permanentRoot044();
  const repoRoot = input.repoRoot ?? process.cwd();
  const nowMs = input.nowMs ?? Date.now();
  ensureSupervisorDirs054(root);

  let state = loadSupervisorState054(root);
  const assessment = assessWorkerHealth054(root);

  if (assessment.official_status === "PAUSED_BUDGET") {
    state = { ...state, status: "PAUSED_BUDGET", last_error: null };
    saveSupervisorState054(root, state);
    return { action: "paused_budget", assessment, state, new_worker_pid: state.worker_pid };
  }

  if (!assessment.needs_restart) {
    const wLock = readPidLock054(brainWorkerLockPath051(root));
    state = {
      ...state,
      status: assessment.official_status === "IDLE" ? "IDLE" : "WORKING",
      worker_pid: wLock?.pid ?? state.worker_pid,
      last_error: null,
    };
    saveSupervisorState054(root, state);
    return { action: "none", assessment, state, new_worker_pid: state.worker_pid };
  }

  if (inCooldown(state, nowMs)) {
    state = { ...state, status: "RESTARTING" };
    saveSupervisorState054(root, state);
    appendSupervisorJournal054(root, "RECOVERY_STARTED", "cooldown_active", { reason: assessment.reason });
    return { action: "cooldown", assessment, state, new_worker_pid: null };
  }

  // Begin recovery
  state = {
    ...state,
    status: "RECOVERING",
    last_restart_reason: assessment.reason,
    last_heal_at: new Date(nowMs).toISOString(),
  };
  saveSupervisorState054(root, state);
  appendSupervisorJournal054(root, "WORKER_DEAD", assessment.reason ?? "dead", {
    heartbeat_age_ms: assessment.heartbeat_age_ms,
  });
  appendSupervisorJournal054(root, "RECOVERY_STARTED", "self_heal", { reason: assessment.reason });

  // Verify no valid worker already
  const existing = readPidLock054(brainWorkerLockPath051(root));
  if (existing && pidAlive054(existing.pid)) {
    // Heartbeat stale but process alive — soft restart: terminate orphan then respawn
    if (assessment.reason === "HEARTBEAT_STALE") {
      appendSupervisorJournal054(root, "HEARTBEAT_STALE", `pid=${existing.pid}`);
      terminateOrphanWorker054(brainWorkerLockPath051(root), "worker");
      await sleep(1500);
    } else {
      state = { ...state, status: "WORKING", worker_pid: existing.pid };
      saveSupervisorState054(root, state);
      return { action: "none", assessment: { ...assessment, needs_restart: false, worker_alive: true }, state, new_worker_pid: existing.pid };
    }
  } else if (existing && !pidAlive054(existing.pid)) {
    terminateOrphanWorker054(brainWorkerLockPath051(root), "worker");
  }

  // Mark brain restart bookkeeping
  const brain = loadBrainState051(root);
  saveBrainState051(root, {
    ...brain,
    status: "STOPPED",
    worker_pid: null,
    restart_count: (brain.restart_count ?? 0) + 1,
    last_error: assessment.reason,
  });

  spawnBrainWorker054(repoRoot);
  appendSupervisorJournal054(root, "WORKER_STARTED", "spawned_by_supervisor");

  const waitMs = input.waitMs ?? 12_000;
  const deadline = Date.now() + waitMs;
  let after = readPidLock054(brainWorkerLockPath051(root));
  while (Date.now() < deadline) {
    after = readPidLock054(brainWorkerLockPath051(root));
    if (after && pidAlive054(after.pid) && after.role !== "supervisor") break;
    await sleep(500);
  }

  const alive = !!(after && pidAlive054(after.pid));
  const cooldownUntil = new Date(Date.now() + SPAWN_COOLDOWN_MS_054).toISOString();
  const nowIso = new Date().toISOString();

  if (alive) {
    state = {
      ...state,
      status: "WORKING",
      worker_pid: after!.pid,
      restart_count: state.restart_count + 1,
      last_restart_at: nowIso,
      last_restart_reason: assessment.reason,
      spawn_cooldown_until: cooldownUntil,
      last_error: null,
    };
    saveSupervisorState054(root, state);
    const b2 = loadBrainState051(root);
    saveBrainState051(root, { ...b2, worker_pid: after!.pid, status: "RUNNING", watchdog_pid: state.supervisor_pid });
    appendSupervisorJournal054(root, "RECOVERY_SUCCESS", `new_pid=${after!.pid}`);
    return { action: "spawned", assessment, state, new_worker_pid: after!.pid };
  }

  // Clear dead lock so next heal can retry
  const dead = readPidLock054(brainWorkerLockPath051(root));
  if (dead && !pidAlive054(dead.pid)) {
    try {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(brainWorkerLockPath051(root));
    } catch {
      /* */
    }
  }

  state = {
    ...state,
    status: "DEAD",
    last_error: "RECOVERY_FAILED_NO_WORKER_LOCK",
    spawn_cooldown_until: cooldownUntil,
    restart_count: state.restart_count + 1,
    last_restart_at: nowIso,
    last_restart_reason: assessment.reason,
  };
  saveSupervisorState054(root, state);
  appendSupervisorJournal054(root, "RECOVERY_FAILED", "no_worker_lock_after_spawn");
  return { action: "failed", assessment, state, new_worker_pid: null };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function acquireSupervisorLock054(root = permanentRoot044()) {
  ensureSupervisorDirs054(root);
  return acquirePidLock054(supervisorLockPath054(root), "supervisor");
}

export function releaseSupervisorLock054(root = permanentRoot044()): void {
  releasePidLock054(supervisorLockPath054(root));
}

/** Reconstruct recovery snapshot from Lab B append-only store — no mutation. */
export function recoverStoreSnapshot054(root = permanentRoot044()) {
  const store = loadStore044(root);
  const uniqueEvents = new Set(store.events.map((e) => e.event_id)).size;
  return {
    events_raw: store.events.length,
    events_unique: uniqueEvents,
    decisions: store.predictions.length,
    locks: store.lockEventIds.size,
    settlements: store.settlements.length,
    autopsies: store.autopsies.length,
    learning: store.learning.length,
    quotes: store.quotes.length,
    lab_a_mutation: false as const,
  };
}

