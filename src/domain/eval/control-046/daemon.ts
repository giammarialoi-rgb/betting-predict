import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadDiscoveryState045 } from "@/domain/eval/factory-045/config";

export type DaemonDisplay046 = "RUNNING" | "STOPPED" | "DEGRADED" | "ERROR";

export type DaemonHealth046 = {
  display: DaemonDisplay046;
  raw_status: string;
  pid: number | null;
  pid_alive: boolean;
  started_at: string | null;
  last_cycle_at: string | null;
  last_discovery_at: string | null;
  last_settlement_at: string | null;
  last_error: string | null;
  last_activity_at: string | null;
  last_activity_ago_ms: number | null;
  last_activity_human: string;
  degraded_reason: string | null;
  store_last_write_at: string | null;
  mode: string;
};

const STALE_MS = 20 * 60_000; // 20 minutes without activity → DEGRADED if claiming RUNNING

function agoHuman(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "unknown";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function latestMtime(paths: string[]): string | null {
  let best = 0;
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      const t = statSync(p).mtimeMs;
      if (t > best) best = t;
    } catch {
      /* ignore */
    }
  }
  return best > 0 ? new Date(best).toISOString() : null;
}

export function resolveDaemonHealth046(root = permanentRoot044(), nowMs = Date.now()): DaemonHealth046 {
  const statusPath = join(root, "collector-status.json");
  const lockPath = join(root, "collector.lock");
  const dstate = loadDiscoveryState045(root);

  let raw = "UNKNOWN";
  let pid: number | null = null;
  let started_at: string | null = null;
  let last_cycle_at: string | null = null;
  let last_error: string | null = dstate.last_error;
  let mode = "IDLE";

  if (existsSync(statusPath)) {
    try {
      const j = JSON.parse(readFileSync(statusPath, "utf8")) as Record<string, unknown>;
      raw = typeof j.status === "string" ? j.status : "UNKNOWN";
      pid = typeof j.pid === "number" ? j.pid : null;
      started_at = typeof j.started_at === "string" ? j.started_at : null;
      last_cycle_at =
        typeof j.last_cycle_at === "string"
          ? j.last_cycle_at
          : typeof j.updated_at === "string"
            ? j.updated_at
            : null;
      if (typeof j.error === "string") last_error = j.error;
      if (j.daily) mode = "ANALYSIS";
    } catch {
      raw = "ERROR";
      last_error = "collector-status.json parse failed";
    }
  }

  let pid_alive = false;
  if (existsSync(lockPath)) {
    try {
      const j = JSON.parse(readFileSync(lockPath, "utf8")) as { pid?: number; started_at?: string };
      if (typeof j.pid === "number") {
        pid = j.pid;
        try {
          process.kill(j.pid, 0);
          pid_alive = true;
        } catch {
          pid_alive = false;
        }
      }
      if (typeof j.started_at === "string") started_at = j.started_at;
    } catch {
      /* ignore */
    }
  }

  const store_last_write_at = latestMtime([
    join(root, "journal.jsonl"),
    join(root, "events.jsonl"),
    join(root, "predictions.jsonl"),
    join(root, "collector-status.json"),
  ]);

  const activityCandidates = [
    last_cycle_at,
    dstate.last_discovery_at,
    dstate.last_settlement_at,
    store_last_write_at,
  ].filter(Boolean) as string[];
  const last_activity_at =
    activityCandidates.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  const last_activity_ago_ms = last_activity_at ? nowMs - Date.parse(last_activity_at) : null;

  let display: DaemonDisplay046 = "STOPPED";
  let degraded_reason: string | null = null;

  if (raw === "PAUSED_ERROR" || raw === "ERROR") {
    display = "ERROR";
  } else if (pid_alive && (raw === "RUNNING" || raw === "UNKNOWN")) {
    if (last_activity_ago_ms != null && last_activity_ago_ms > STALE_MS) {
      display = "DEGRADED";
      degraded_reason = `stale heartbeat: last activity ${agoHuman(last_activity_ago_ms)}`;
    } else {
      display = "RUNNING";
    }
  } else if (!pid_alive && raw === "RUNNING") {
    display = "DEGRADED";
    degraded_reason = "status claims RUNNING but PID not alive (stale lock/status)";
  } else if (raw === "STOPPED" || raw === "RECOVERED" || !pid_alive) {
    display = "STOPPED";
  }

  if (dstate.last_discovery_at && last_cycle_at) mode = "DISCOVERY";
  else if (dstate.last_settlement_at) mode = "SETTLE";
  else if (last_cycle_at) mode = "ANALYSIS";

  return {
    display,
    raw_status: raw,
    pid,
    pid_alive,
    started_at,
    last_cycle_at,
    last_discovery_at: dstate.last_discovery_at,
    last_settlement_at: dstate.last_settlement_at,
    last_error,
    last_activity_at,
    last_activity_ago_ms,
    last_activity_human: agoHuman(last_activity_ago_ms),
    degraded_reason,
    store_last_write_at,
    mode,
  };
}
