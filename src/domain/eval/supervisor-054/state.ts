import { mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { brainDir051, ensureBrainDirs051 } from "@/domain/eval/brain-051/config";

export type OfficialStatus054 =
  | "NORMAL"
  | "IDLE"
  | "WORKING"
  | "PAUSED_BUDGET"
  | "PAUSED_PROVIDER"
  | "RESTARTING"
  | "RECOVERING"
  | "DEGRADED"
  | "DEAD";

export type HeartbeatRich054 = {
  pid: number;
  started_at: string;
  heartbeat_at: string;
  last_cycle_at: string | null;
  last_successful_cycle_at: string | null;
  phase: string;
  sport: string | null;
  event_id: string | null;
  market: string | null;
  api_state: string | null;
  budget_state: string | null;
  current_operation: string | null;
  role: "worker" | "supervisor";
};

export type SupervisorState054 = {
  status: OfficialStatus054;
  supervisor_pid: number | null;
  worker_pid: number | null;
  started_at: string | null;
  last_restart_at: string | null;
  last_restart_reason: string | null;
  restart_count: number;
  last_error: string | null;
  last_heal_at: string | null;
  spawn_cooldown_until: string | null;
  heartbeat_stale_ms: number;
  capital: "PAPER_ONLY";
  real_money: false;
  auto_promotion: false;
  open_task_055: false;
};

export function supervisorDir054(root = permanentRoot044()): string {
  return join(root, "supervisor");
}

export function ensureSupervisorDirs054(root = permanentRoot044()): void {
  ensureBrainDirs051(root);
  mkdirSync(supervisorDir054(root), { recursive: true });
  mkdirSync(join(supervisorDir054(root), "logs"), { recursive: true });
}

export function supervisorLockPath054(root = permanentRoot044()): string {
  return join(supervisorDir054(root), "supervisor.lock");
}

export function supervisorStatePath054(root = permanentRoot044()): string {
  return join(supervisorDir054(root), "supervisor-state.json");
}

export function supervisorJournalPath054(root = permanentRoot044()): string {
  return join(supervisorDir054(root), "journal.jsonl");
}

export function defaultSupervisorState054(): SupervisorState054 {
  return {
    status: "IDLE",
    supervisor_pid: null,
    worker_pid: null,
    started_at: null,
    last_restart_at: null,
    last_restart_reason: null,
    restart_count: 0,
    last_error: null,
    last_heal_at: null,
    spawn_cooldown_until: null,
    heartbeat_stale_ms: 10 * 60_000, // 10m — IDLE is not DEAD
    capital: "PAPER_ONLY",
    real_money: false,
    auto_promotion: false,
    open_task_055: false,
  };
}

export function loadSupervisorState054(root = permanentRoot044()): SupervisorState054 {
  try {
    ensureSupervisorDirs054(root);
  } catch {
    // Read-only / missing FS (e.g. Vercel) — degrade without throwing
  }
  const p = supervisorStatePath054(root);
  if (!existsSync(p)) return defaultSupervisorState054();
  try {
    return { ...defaultSupervisorState054(), ...JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")) };
  } catch {
    return defaultSupervisorState054();
  }
}

export function saveSupervisorState054(root: string, state: SupervisorState054): void {
  ensureSupervisorDirs054(root);
  const tmp = supervisorStatePath054(root) + ".tmp";
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  writeFileSync(supervisorStatePath054(root), readFileSync(tmp));
}

export function appendSupervisorJournal054(
  root: string,
  kind: string,
  summary: string,
  extra: Record<string, unknown> = {},
): void {
  ensureSupervisorDirs054(root);
  const line = JSON.stringify({ at: new Date().toISOString(), kind, summary, ...extra }) + "\n";
  appendFileSync(supervisorJournalPath054(root), line);
  // Mirror to brain activity for Control Center feed
  appendFileSync(join(brainDir051(root), "activity-feed.jsonl"), line);
}

export function writeRichHeartbeat054(root: string, hb: HeartbeatRich054): void {
  ensureBrainDirs051(root);
  writeFileSync(join(brainDir051(root), "heartbeat.json"), JSON.stringify(hb, null, 2));
  writeFileSync(join(supervisorDir054(root), "last-heartbeat.json"), JSON.stringify(hb, null, 2));
}

export function readRichHeartbeat054(root = permanentRoot044()): (HeartbeatRich054 & { age_ms: number | null }) | null {
  const p = join(brainDir051(root), "heartbeat.json");
  if (!existsSync(p)) return null;
  try {
    const j = JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")) as HeartbeatRich054;
    const at = j.heartbeat_at ?? (j as { at?: string }).at ?? null;
    const age = at ? Date.now() - Date.parse(at) : null;
    return { ...j, heartbeat_at: at ?? new Date(0).toISOString(), age_ms: age };
  } catch {
    return null;
  }
}
