/**
 * Current work + system status for Control Center (disk-only).
 * Integrates supervisor-054 official statuses (RECOVERING ≠ DEAD when healing).
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { assessBrainHealth051, readHeartbeat051, pidAlive051 } from "@/domain/eval/brain-051/health";
import { loadBrainState051 } from "@/domain/eval/brain-051/config";
import { loadSupervisorState054, readRichHeartbeat054 } from "@/domain/eval/supervisor-054/state";
import { assessWorkerHealth054 } from "@/domain/eval/supervisor-054/heal";
import { pidAlive054, readPidLock054 } from "@/domain/eval/supervisor-054/locks";
import { supervisorLockPath054 } from "@/domain/eval/supervisor-054/state";
import { brainWorkerLockPath051 } from "@/domain/eval/brain-051/config";

export type CurrentWork053 = {
  sport: string | null;
  event: string | null;
  market: string | null;
  phase: string;
  started_at: string | null;
  last_update: string;
  note: string | null;
};

export type SystemStatus053 = {
  status: "HEALTHY" | "DEGRADED" | "PAUSED" | "DEAD" | "RECOVERING" | "RESTARTING" | "STOPPED";
  worker_pid: number | null;
  worker_alive: boolean;
  supervisor_pid: number | null;
  supervisor_alive: boolean;
  official_status: string;
  heartbeat_at: string | null;
  heartbeat_age_ms: number | null;
  last_cycle_at: string | null;
  last_successful_cycle_at: string | null;
  last_priority: string | null;
  restart_count: number;
  last_restart_at: string | null;
  last_restart_reason: string | null;
  consecutive_errors: number;
  uptime_hint: string | null;
  issues: { level: string; code: string; message: string }[];
  phase: string | null;
  sport: string | null;
  event_id: string | null;
  market: string | null;
  budget_state: string | null;
  api_state: string | null;
};

export function writeCurrentWork053(work: CurrentWork053, root = permanentRoot044()): void {
  mkdirSync(join(root, "brain"), { recursive: true });
  writeFileSync(join(root, "brain", "current-work.json"), JSON.stringify(work, null, 2));
}

export function loadCurrentWork053(root = permanentRoot044()): CurrentWork053 | null {
  const p = join(root, "brain", "current-work.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")) as CurrentWork053;
  } catch {
    return null;
  }
}

export function buildSystemStatus053(root = permanentRoot044()): SystemStatus053 {
  const health = assessBrainHealth051(root);
  const state = health.state;
  const hbLegacy = readHeartbeat051(root);
  const hbRich = readRichHeartbeat054(root);
  const sup = loadSupervisorState054(root);
  const assess = assessWorkerHealth054(root);

  const wLock = readPidLock054(brainWorkerLockPath051(root));
  const sLock = readPidLock054(supervisorLockPath054(root));
  const workerPid = wLock?.pid ?? state.worker_pid;
  const supervisorPid = sLock?.pid ?? sup.supervisor_pid;
  const worker_alive = pidAlive054(workerPid) || pidAlive051(workerPid);
  const supervisor_alive = pidAlive054(supervisorPid);

  let status: SystemStatus053["status"] = "STOPPED";
  if (sup.status === "RECOVERING" || assess.official_status === "RECOVERING") status = "RECOVERING";
  else if (sup.status === "RESTARTING") status = "RESTARTING";
  else if (sup.status === "PAUSED_BUDGET" || state.status === "PAUSED_BUDGET") status = "PAUSED";
  else if (!worker_alive && supervisor_alive) status = "RECOVERING";
  else if (!worker_alive && !supervisor_alive) status = "DEAD";
  else if (state.status === "ERROR") status = "DEGRADED";
  else if (state.status === "STOPPED" && !worker_alive) status = "STOPPED";
  else if (hbRich?.age_ms != null && hbRich.age_ms > 20 * 60_000 && worker_alive) status = "DEGRADED";
  else if (worker_alive && (state.status === "RUNNING" || assess.official_status === "WORKING"))
    status = health.ok ? "HEALTHY" : "DEGRADED";
  else if (worker_alive && (state.status === "IDLE" || assess.official_status === "IDLE")) status = "PAUSED";

  const issues = [...health.issues];
  if (!supervisor_alive && worker_alive) {
    issues.push({
      level: "WARNING",
      code: "SUPERVISOR_MISSING",
      message: "Worker alive but supervisor lock not held — start permanent-live:supervisor:start",
    });
  }

  return {
    status,
    worker_pid: workerPid,
    worker_alive,
    supervisor_pid: supervisorPid,
    supervisor_alive,
    official_status: assess.official_status,
    heartbeat_at: hbRich?.heartbeat_at ?? hbLegacy.at,
    heartbeat_age_ms: hbRich?.age_ms ?? hbLegacy.age_ms,
    last_cycle_at: state.last_cycle_at,
    last_successful_cycle_at: state.last_successful_cycle_at,
    last_priority: state.last_priority,
    restart_count: Math.max(state.restart_count ?? 0, sup.restart_count ?? 0),
    last_restart_at: sup.last_restart_at,
    last_restart_reason: sup.last_restart_reason,
    consecutive_errors: state.consecutive_errors,
    uptime_hint: state.started_at ?? sup.started_at,
    issues,
    phase: hbRich?.phase ?? null,
    sport: hbRich?.sport ?? null,
    event_id: hbRich?.event_id ?? null,
    market: hbRich?.market ?? null,
    budget_state: hbRich?.budget_state ?? null,
    api_state: hbRich?.api_state ?? null,
  };
}

export function buildHealthPayload053(root = permanentRoot044()) {
  const system = buildSystemStatus053(root);
  const work = loadCurrentWork053(root);
  const state = loadBrainState051(root);
  const sup = loadSupervisorState054(root);
  return {
    api_calls_ui: 0 as const,
    status: system.status,
    system,
    supervisor: {
      status: sup.status,
      pid: system.supervisor_pid,
      alive: system.supervisor_alive,
      restart_count: system.restart_count,
      last_restart_at: system.last_restart_at,
      last_restart_reason: system.last_restart_reason,
      last_error: sup.last_error,
    },
    current_work: work,
    brain: {
      status: state.status,
      last_error: state.last_error,
      cycles_completed: state.cycles_completed,
    },
    real_money: false as const,
    auto_promotion: false as const,
    capital: "PAPER_ONLY" as const,
    open_task_055: false as const,
  };
}
