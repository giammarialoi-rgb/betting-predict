import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  creditStatePath042,
  loadGovernorConfig042,
  nextMonthResetUtc,
  type GovernorConfig042,
} from "@/domain/eval/collector-042/config";
import type { CreditHeaders042, CreditState042, CollectorStatus042 } from "@/domain/eval/collector-042/types";

export function defaultCreditState042(cfg: GovernorConfig042 = loadGovernorConfig042()): CreditState042 {
  const bootRem = process.env.TASK_042_BOOTSTRAP_REMAINING;
  const bootUsed = process.env.TASK_042_BOOTSTRAP_USED;
  const remaining = bootRem != null && bootRem !== "" && Number.isFinite(Number(bootRem)) ? Number(bootRem) : null;
  const used = bootUsed != null && bootUsed !== "" && Number.isFinite(Number(bootUsed)) ? Number(bootUsed) : null;
  return {
    monthlyLimit: cfg.monthlyCreditLimit,
    observedRemaining: remaining,
    observedUsed: used,
    observedLastCost: null,
    estimatedRemaining: remaining ?? cfg.monthlyCreditLimit,
    estimatedUsed: used ?? 0,
    requests: 0,
    estimatedCredits: used ?? 0,
    lastUpdatedAt: new Date().toISOString(),
    resetAt: nextMonthResetUtc(),
    status: "NOT_RUNNING",
    safeRemaining: cfg.safeRemaining,
    maxCreditsPerRun: cfg.maxCreditsPerRun,
    sourceOfTruth: remaining != null ? "mixed" : "local_estimate",
  };
}

export function loadCreditState042(root?: string): CreditState042 {
  const path = creditStatePath042(root);
  if (!existsSync(path)) return defaultCreditState042();
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as CreditState042;
    return { ...defaultCreditState042(), ...raw };
  } catch {
    return defaultCreditState042();
  }
}

export function saveCreditState042(state: CreditState042, root?: string): void {
  const path = creditStatePath042(root);
  mkdirSync(dirname(path), { recursive: true });
  const clone = { ...state };
  writeFileSync(path, JSON.stringify(clone, null, 2));
}

export function parseCreditHeaders042(headers: Headers | Record<string, string>): CreditHeaders042 {
  const get = (k: string): string | null => {
    if (headers instanceof Headers) return headers.get(k) ?? headers.get(k.toLowerCase());
    const hit = Object.entries(headers).find(([a]) => a.toLowerCase() === k.toLowerCase());
    return hit?.[1] ?? null;
  };
  const num = (v: string | null): number | null => {
    if (v == null || v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    remaining: num(get("x-requests-remaining")),
    used: num(get("x-requests-used")),
    last: num(get("x-requests-last")),
  };
}

export function applyCreditObservation042(
  state: CreditState042,
  headers: CreditHeaders042,
  fallbackCost: number,
  cfg: GovernorConfig042 = loadGovernorConfig042(),
): CreditState042 {
  const cost = headers.last ?? fallbackCost;
  const next: CreditState042 = {
    ...state,
    monthlyLimit: cfg.monthlyCreditLimit,
    safeRemaining: cfg.safeRemaining,
    maxCreditsPerRun: cfg.maxCreditsPerRun,
    requests: state.requests + 1,
    estimatedCredits: state.estimatedCredits + Math.max(0, cost),
    estimatedUsed: state.estimatedUsed + Math.max(0, cost),
    lastUpdatedAt: new Date().toISOString(),
    resetAt: state.resetAt || nextMonthResetUtc(),
  };
  if (headers.remaining != null) {
    next.observedRemaining = headers.remaining;
    next.estimatedRemaining = headers.remaining;
    next.sourceOfTruth = headers.used != null ? "provider_headers" : "mixed";
  } else {
    next.estimatedRemaining =
      next.estimatedRemaining == null
        ? Math.max(0, cfg.monthlyCreditLimit - next.estimatedUsed)
        : Math.max(0, next.estimatedRemaining - Math.max(0, cost));
    next.sourceOfTruth = next.observedRemaining != null ? "mixed" : "local_estimate";
  }
  if (headers.used != null) next.observedUsed = headers.used;
  if (headers.last != null) next.observedLastCost = headers.last;
  return next;
}

export function remainingCredits042(state: CreditState042): number {
  if (state.observedRemaining != null) return state.observedRemaining;
  if (state.estimatedRemaining != null) return state.estimatedRemaining;
  return Math.max(0, state.monthlyLimit - state.estimatedUsed);
}

export function canAffordRun042(
  state: CreditState042,
  estimatedCycleCost: number,
  cfg: GovernorConfig042 = loadGovernorConfig042(),
): { ok: boolean; reason: string | null; status: CollectorStatus042 | null } {
  const rem = remainingCredits042(state);
  if (rem <= cfg.safeRemaining) {
    return { ok: false, reason: `remaining ${rem} <= SAFE_REMAINING ${cfg.safeRemaining}`, status: "PAUSED_BUDGET" };
  }
  if (estimatedCycleCost > cfg.maxCreditsPerRun) {
    return {
      ok: false,
      reason: `estimated cycle ${estimatedCycleCost} > MAX_CREDITS_PER_RUN ${cfg.maxCreditsPerRun}`,
      status: "PAUSED_BUDGET",
    };
  }
  if (rem - estimatedCycleCost < cfg.safeRemaining) {
    return {
      ok: false,
      reason: `cycle would breach SAFE_REMAINING (rem=${rem}, cost=${estimatedCycleCost})`,
      status: "PAUSED_BUDGET",
    };
  }
  return { ok: true, reason: null, status: null };
}
