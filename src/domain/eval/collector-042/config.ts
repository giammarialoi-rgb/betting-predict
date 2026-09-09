import { join } from "node:path";
import { storeRoot039 } from "@/domain/eval/live-039/config";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function loadGovernorConfig042() {
  return {
    monthlyCreditLimit: envInt("TASK_042_MONTHLY_CREDIT_LIMIT", 500),
    safeRemaining: envInt("TASK_042_SAFE_REMAINING", 100),
    maxCreditsPerRun: envInt("TASK_042_MAX_CREDITS_PER_RUN", 20),
    pollMinutes: envInt("TASK_042_POLL_MINUTES", 15),
    discoveryHours: envInt("TASK_042_DISCOVERY_HOURS", 12),
    /** Conservative estimate when headers missing: uk+eu × h2h = 2 per sport */
    estimatedOddsCreditsPerSport: envInt("TASK_042_EST_ODDS_CREDITS_PER_SPORT", 2),
    estimatedScoresCreditsPerSport: envInt("TASK_042_EST_SCORES_CREDITS_PER_SPORT", 2),
    settledTarget: envInt("TASK_042_SETTLED_TARGET", 100),
    staleHeartbeatMs: envInt("TASK_042_STALE_HEARTBEAT_MS", 45 * 60_000),
    maxBackoffMs: envInt("TASK_042_MAX_BACKOFF_MS", 60 * 60_000),
    regions: process.env.TASK_042_REGIONS?.trim() || "uk,eu",
  };
}

export type GovernorConfig042 = ReturnType<typeof loadGovernorConfig042>;

export function sourceStore042(override?: string): string {
  return override ?? storeRoot039();
}

export function creditStatePath042(root?: string): string {
  return join(sourceStore042(root), "credit-state.json");
}

export function heartbeatPath042(root?: string): string {
  return join(sourceStore042(root), "collector-status.json");
}

export function processLockPath042(root?: string): string {
  return join(sourceStore042(root), "collector.lock");
}

export function collectorLogPath042(root?: string): string {
  return join(sourceStore042(root), "collector.log");
}

export function nextMonthResetUtc(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const next = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
  return next.toISOString();
}
