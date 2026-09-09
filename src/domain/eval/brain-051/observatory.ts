import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildControlCenter049 } from "@/domain/eval/factory-049/control";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { loadBrainState051, BRAIN_MODEL_051 } from "@/domain/eval/brain-051/config";
import { assessBrainHealth051, pidAlive051, readHeartbeat051 } from "@/domain/eval/brain-051/health";
import { loadCreditState042, remainingCredits042 } from "@/domain/eval/collector-042/credit";
import { labAStore044 } from "@/domain/eval/permanent-044/config";
import { computeMassiveStats049 } from "@/domain/eval/factory-049/stats";

function readActivity(root: string, limit = 40) {
  const p = join(root, "brain", "activity-feed.jsonl");
  if (!existsSync(p)) return [];
  const lines = readFileSync(p, "utf8").split(/\n/).filter(Boolean);
  return lines
    .slice(-limit)
    .reverse()
    .map((l) => {
      try {
        return JSON.parse(l) as { at: string; kind: string; summary: string };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function fileSize(path: string): number {
  try {
    return existsSync(path) ? statSync(path).size : 0;
  } catch {
    return 0;
  }
}

/** Disk-only full observatory. Browser never calls Odds API. */
export function buildObservatory051(nowIso = new Date().toISOString()) {
  const base = buildControlCenter049(nowIso);
  const root = permanentRoot044();
  const store = loadStore044(root);
  const brain = loadBrainState051(root);
  const health = assessBrainHealth051(root);
  const hb = readHeartbeat051(root);
  const stats = computeMassiveStats049(store, nowIso);
  const credit = loadCreditState042(labAStore044());
  const rem = remainingCredits042(credit);

  const uptimeMs =
    brain.uptime_started_at != null ? Date.parse(nowIso) - Date.parse(brain.uptime_started_at) : null;

  let display: "RUNNING" | "IDLE" | "ERROR" | "STOPPED" | "DEGRADED" | "PAUSED_BUDGET" = brain.status;
  if (brain.status === "RUNNING" && !pidAlive051(brain.worker_pid)) {
    display = "DEGRADED";
  }
  if (brain.status === "IDLE" && brain.worker_pid != null && !pidAlive051(brain.worker_pid)) {
    display = "DEGRADED";
  }
  if (!health.ok && display !== "STOPPED" && display !== "IDLE") {
    display = display === "ERROR" ? "ERROR" : "DEGRADED";
  }

  return {
    ...base,
    brain_051: {
      title: "AUTONOMOUS 24/7 LIVE BRAIN",
      display,
      status: brain.status,
      uptime_ms: uptimeMs,
      uptime_human:
        uptimeMs == null
          ? "—"
          : uptimeMs < 60_000
            ? `${Math.round(uptimeMs / 1000)}s`
            : `${Math.round(uptimeMs / 60_000)}m`,
      pid: brain.worker_pid,
      pid_alive: pidAlive051(brain.worker_pid),
      watchdog_pid: brain.watchdog_pid,
      heartbeat_at: hb.at,
      heartbeat_age_ms: hb.age_ms,
      last_cycle_at: brain.last_cycle_at,
      last_successful_cycle_at: brain.last_successful_cycle_at,
      last_priority: brain.last_priority,
      next_hint: brain.last_priority === "P5" ? "~90s" : brain.last_priority === "P0" ? "~60s" : "~5-15m",
      cycles_completed: brain.cycles_completed,
      restart_count: brain.restart_count,
      consecutive_errors: brain.consecutive_errors,
      last_error: brain.last_error,
      model_version: brain.model_version || BRAIN_MODEL_051,
      capital: "CLOSED" as const,
      real_money: false as const,
      auto_promotion: false as const,
      health_issues: health.issues,
      activity_feed: readActivity(root, 50),
      store: {
        events: store.events.length,
        quotes: store.quotes.length,
        predictions: store.predictions.length,
        locks: store.locks.length,
        settlements: store.settlements.length,
        events_jsonl_bytes: fileSize(join(root, "events.jsonl")),
        quotes_jsonl_bytes: fileSize(join(root, "quotes.jsonl")),
      },
      budget: {
        credits_remaining: rem,
        credits_used: credit.observedUsed ?? credit.estimatedUsed ?? 0,
        safe_reserve: credit.safeRemaining,
      },
      sport_table: (() => {
        const now = Date.parse(nowIso);
        const day = 24 * 3600_000;
        const families = ["SOCCER", "TENNIS", "BASKETBALL", "VOLLEYBALL", "HOCKEY", "OTHER"] as const;
        return families.map((sport) => {
          const key = sport.toLowerCase();
          const evs = store.events.filter((e) => {
            const s = (e.sport || "").toLowerCase();
            if (sport === "OTHER") {
              return !["soccer", "tennis", "basketball", "volleyball", "hockey", "icehockey"].some((f) =>
                s.includes(f),
              );
            }
            if (sport === "HOCKEY") return s.includes("hockey") || s.includes("icehockey");
            return s.includes(key === "soccer" ? "soccer" : key) || (key === "soccer" && s.includes("football"));
          });
          const next24 = evs.filter((e) => {
            if (!e.kickoff_utc) return false;
            const k = Date.parse(e.kickoff_utc);
            return Number.isFinite(k) && k >= now && k < now + day;
          }).length;
          const locked = evs.filter((e) => store.lockEventIds.has(e.event_id)).length;
          const settled = evs.filter((e) => store.settlementEventIds.has(e.event_id)).length;
          const predicted = new Set(
            store.predictions.filter((p) => evs.some((e) => e.event_id === p.event_id)).map((p) => p.event_id),
          ).size;
          return {
            sport,
            events: evs.length,
            next_24h: next24,
            analyzed: predicted,
            predicted,
            locked,
            settled,
          };
        });
      })(),
      counters: {
        EVENTS_TODAY: stats.EVENTS_TODAY,
        EVENTS_TOTAL: stats.EVENTS_ANALYZED,
        PREDICTIONS: stats.TOTAL_PREDICTIONS,
        LOCKED: stats.LOCKED,
        SETTLED: stats.SETTLED,
        AUTOPSIED: stats.AUTOPSIED,
        LEARNING_CASES: stats.LEARNING_CASES,
        NO_BET: stats.NO_BET,
        BET_CANDIDATE: stats.BET_CANDIDATE,
        STRONG_CANDIDATE: stats.STRONG_CANDIDATE,
      },
      api_calls_ui: 0 as const,
    },
  };
}

export type Observatory051 = ReturnType<typeof buildObservatory051>;
