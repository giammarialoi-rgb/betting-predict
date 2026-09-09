import { canAffordRun042, remainingCredits042 } from "@/domain/eval/collector-042/credit";
import type { CreditState042 } from "@/domain/eval/collector-042/types";
import type { GovernorConfig042 } from "@/domain/eval/collector-042/config";
import { BUDGET_PRIORITY_ORDER_047, type BudgetPriority047 } from "@/domain/eval/factory-047/config";

export type BudgetPlan047 = {
  allow: boolean;
  reason: string | null;
  remaining: number | null;
  safe_reserve: number;
  max_calls_this_run: number;
  priority_queue: BudgetPriority047[];
  stop_gracefully: boolean;
};

/** Never breach SAFE_REMAINING. Priority: settle → lock → snapshots → discovery horizons. */
export function planBudget047(input: {
  credit: CreditState042;
  cfg: GovernorConfig042;
  estimatedCost: number;
  wantsDiscovery: boolean;
}): BudgetPlan047 {
  const rem = remainingCredits042(input.credit);
  const safe = input.credit.safeRemaining ?? input.cfg.safeRemaining;
  const afford = canAffordRun042(input.credit, input.estimatedCost, input.cfg);
  const queue = [...BUDGET_PRIORITY_ORDER_047];
  if (!input.wantsDiscovery) {
    return {
      allow: afford.ok,
      reason: afford.reason,
      remaining: rem,
      safe_reserve: safe,
      max_calls_this_run: Math.min(input.cfg.maxCreditsPerRun, Math.max(0, rem - safe)),
      priority_queue: queue.filter((p) => !p.startsWith("DISCOVERY") && p !== "EXTRA_SPORTS"),
      stop_gracefully: !afford.ok,
    };
  }
  return {
    allow: afford.ok,
    reason: afford.reason,
    remaining: rem,
    safe_reserve: safe,
    max_calls_this_run: Math.min(input.cfg.maxCreditsPerRun, Math.max(0, rem - safe)),
    priority_queue: queue,
    stop_gracefully: !afford.ok,
  };
}

export function shouldStopGracefully047(remaining: number | null, safe: number, nextCost: number): boolean {
  if (remaining == null) return false;
  return remaining - nextCost < safe;
}
