import { existsSync, readFileSync, writeFileSync, appendFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  brainDir051,
  brainHeartbeatPath051,
  ensureBrainDirs051,
  loadBrainState051,
  saveBrainState051,
  type BrainState051,
} from "@/domain/eval/brain-051/config";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { appendJsonl044 } from "@/domain/eval/permanent-044/store";
import { createHash } from "node:crypto";

export function writeHeartbeat051(
  root = permanentRoot044(),
  extra: Record<string, unknown> = {},
): void {
  ensureBrainDirs051(root);
  const payload = {
    at: new Date().toISOString(),
    pid: process.pid,
    ...extra,
  };
  writeFileSync(brainHeartbeatPath051(root), JSON.stringify(payload, null, 2));
}

export function readHeartbeat051(root = permanentRoot044()): {
  at: string | null;
  pid: number | null;
  age_ms: number | null;
} {
  const p = brainHeartbeatPath051(root);
  if (!existsSync(p)) return { at: null, pid: null, age_ms: null };
  try {
    const j = JSON.parse(readFileSync(p, "utf8")) as { at?: string; pid?: number };
    const at = j.at ?? null;
    const age = at ? Date.now() - Date.parse(at) : null;
    return { at, pid: j.pid ?? null, age_ms: age };
  } catch {
    return { at: null, pid: null, age_ms: null };
  }
}

export function pidAlive051(pid: number | null): boolean {
  if (pid == null || !Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function appendActivity051(root: string, kind: string, summary: string, extra: Record<string, unknown> = {}): void {
  appendJsonl044(join(root, "brain", "activity-feed.jsonl"), {
    at: new Date().toISOString(),
    kind,
    summary,
    ...extra,
  });
}

export function appendBrainLog051(root: string, line: string): void {
  ensureBrainDirs051(root);
  appendFileSync(join(brainDir051(root), "logs", "brain.log"), `${new Date().toISOString()} ${line}\n`);
}

export type HealthIssue051 = {
  level: "WARNING" | "ERROR" | "CRITICAL";
  code: string;
  message: string;
};

export function assessBrainHealth051(root = permanentRoot044(), nowMs = Date.now()): {
  ok: boolean;
  issues: HealthIssue051[];
  state: BrainState051;
  heartbeat_age_ms: number | null;
  store_size_bytes: number | null;
} {
  const state = loadBrainState051(root);
  const hb = readHeartbeat051(root);
  const issues: HealthIssue051[] = [];

  if (state.status === "RUNNING") {
    if (!pidAlive051(state.worker_pid)) {
      issues.push({ level: "CRITICAL", code: "WORKER_DEAD", message: "Worker PID not alive" });
    }
    if (hb.age_ms != null && hb.age_ms > 20 * 60_000) {
      issues.push({ level: "ERROR", code: "HEARTBEAT_STALE", message: `Heartbeat age ${Math.round(hb.age_ms / 1000)}s` });
    }
    if (state.consecutive_errors >= 5) {
      issues.push({ level: "ERROR", code: "CONSECUTIVE_ERRORS", message: String(state.consecutive_errors) });
    }
  } else if (state.status === "IDLE" && state.worker_pid != null && !pidAlive051(state.worker_pid)) {
    issues.push({ level: "CRITICAL", code: "WORKER_DEAD", message: "Worker PID not alive while IDLE" });
  }

  if (state.last_error) {
    issues.push({ level: "WARNING", code: "LAST_ERROR", message: state.last_error.slice(0, 200) });
  }

  let store_size_bytes: number | null = null;
  try {
    const events = join(root, "events.jsonl");
    if (existsSync(events)) store_size_bytes = statSync(events).size;
  } catch {
    /* ignore */
  }

  void nowMs;
  return {
    ok: !issues.some((i) => i.level === "CRITICAL" || i.level === "ERROR"),
    issues,
    state,
    heartbeat_age_ms: hb.age_ms,
    store_size_bytes,
  };
}

export function fingerprintPayload051(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/** Watchdog decision — never invent restarts without evidence. */
export function shouldRestartWorker051(health: ReturnType<typeof assessBrainHealth051>): boolean {
  return health.issues.some((i) => i.code === "WORKER_DEAD" || i.code === "HEARTBEAT_STALE");
}

export function markRestart051(root: string): BrainState051 {
  const state = loadBrainState051(root);
  const next = {
    ...state,
    restart_count: state.restart_count + 1,
    last_error: "WATCHDOG_RESTART",
    status: "STOPPED" as const,
    worker_pid: null,
  };
  saveBrainState051(root, next);
  appendActivity051(root, "WATCHDOG", `restart_count=${next.restart_count}`);
  return next;
}
