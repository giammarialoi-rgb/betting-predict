import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { heartbeatPath042, loadGovernorConfig042 } from "@/domain/eval/collector-042/config";
import { loadCreditState042, remainingCredits042 } from "@/domain/eval/collector-042/credit";
import { isLockHeldByAliveProcess042, readProcessLock042 } from "@/domain/eval/collector-042/lock";
import type { CollectorHeartbeat042, CollectorStatus042 } from "@/domain/eval/collector-042/types";

export function defaultHeartbeat042(): CollectorHeartbeat042 {
  const cfg = loadGovernorConfig042();
  const credit = loadCreditState042();
  return {
    status: "NOT_RUNNING",
    pid: null,
    startedAt: null,
    lastPullAt: null,
    nextPullAt: null,
    eventsDiscovered: 0,
    quoteObservations: 0,
    lockedDecisions: 0,
    settledEvents: 0,
    remainingTo100: cfg.settledTarget,
    apiKeyConfigured: false,
    providerStatus: "unknown",
    budget: {
      monthlyLimit: credit.monthlyLimit,
      used: credit.observedUsed ?? credit.estimatedUsed,
      remaining: remainingCredits042(credit),
      estimatedRemaining: credit.estimatedRemaining,
      safeRemaining: credit.safeRemaining,
      maxCreditsPerRun: credit.maxCreditsPerRun,
      sourceOfTruth: credit.sourceOfTruth,
    },
    lastError: null,
    pausedReason: null,
    backoffMs: 0,
    mode: "IDLE",
    updatedAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString(),
  };
}

export function loadHeartbeat042(root?: string): CollectorHeartbeat042 {
  const path = heartbeatPath042(root);
  if (!existsSync(path)) return defaultHeartbeat042();
  try {
    return { ...defaultHeartbeat042(), ...(JSON.parse(readFileSync(path, "utf8")) as CollectorHeartbeat042) };
  } catch {
    return defaultHeartbeat042();
  }
}

export function saveHeartbeat042(hb: CollectorHeartbeat042, root?: string): void {
  const path = heartbeatPath042(root);
  mkdirSync(dirname(path), { recursive: true });
  const now = new Date().toISOString();
  writeFileSync(path, JSON.stringify({ ...hb, heartbeatAt: now, updatedAt: now }, null, 2));
}

/** UI/status: RUNNING only if lock PID alive and heartbeat fresh. */
export function resolveDisplayedStatus042(
  root?: string,
  nowMs = Date.now(),
): {
  status: CollectorStatus042;
  heartbeat: CollectorHeartbeat042;
  stale: boolean;
} {
  const cfg = loadGovernorConfig042();
  const hb = loadHeartbeat042(root);
  const lockAlive = isLockHeldByAliveProcess042(root);
  const lock = readProcessLock042(root);
  const age = nowMs - Date.parse(hb.heartbeatAt || hb.updatedAt || "0");
  const stale = !Number.isFinite(age) || age > cfg.staleHeartbeatMs;

  if (hb.status === "COMPLETED") return { status: "COMPLETED", heartbeat: hb, stale: false };
  if (hb.status === "STOPPED" && !lockAlive) return { status: "STOPPED", heartbeat: hb, stale };

  if (!lockAlive) {
    if (hb.status === "RUNNING" || stale) {
      return { status: "NOT_RUNNING", heartbeat: { ...hb, pid: lock?.pid ?? hb.pid }, stale: true };
    }
    return { status: hb.status, heartbeat: hb, stale };
  }

  if (stale && hb.status === "RUNNING") {
    return { status: "STALE", heartbeat: hb, stale: true };
  }
  return { status: hb.status, heartbeat: hb, stale };
}
