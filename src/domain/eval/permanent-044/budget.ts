import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadCreditState042, remainingCredits042 } from "@/domain/eval/collector-042/credit";
import { appendJsonl044 } from "@/domain/eval/permanent-044/store";

export type BudgetState044 = {
  remaining: number | null;
  reserved: number;
  spent: number;
  estimated: number;
  last_request: string | null;
  source: string;
  priority_order: string[];
  updated_at: string;
};

export type RequestPriority044 =
  | "SETTLEMENT_LOCKED"
  | "IMMINENT_UPDATE"
  | "DISCOVERY"
  | "MARKETS"
  | "DISTANT_EVENTS";

export const PRIORITY_ORDER_044: RequestPriority044[] = [
  "SETTLEMENT_LOCKED",
  "IMMINENT_UPDATE",
  "DISCOVERY",
  "MARKETS",
  "DISTANT_EVENTS",
];

export function loadBudget044(permanentRoot: string, labARoot: string): BudgetState044 {
  const p = join(permanentRoot, "manifests", "budget-state.json");
  const credit = loadCreditState042(labARoot);
  const rem = remainingCredits042(credit);
  if (existsSync(p)) {
    const prev = JSON.parse(readFileSync(p, "utf8")) as BudgetState044;
    return {
      ...prev,
      remaining: rem,
      source: credit.sourceOfTruth ?? prev.source,
      updated_at: new Date().toISOString(),
    };
  }
  return {
    remaining: rem,
    reserved: 0,
    spent: credit.estimatedCredits ?? 0,
    estimated: credit.estimatedCredits ?? 0,
    last_request: null,
    source: credit.sourceOfTruth ?? "collector-042",
    priority_order: [...PRIORITY_ORDER_044],
    updated_at: new Date().toISOString(),
  };
}

export function saveBudget044(permanentRoot: string, state: BudgetState044): void {
  mkdirSync(join(permanentRoot, "manifests"), { recursive: true });
  writeFileSync(join(permanentRoot, "manifests", "budget-state.json"), JSON.stringify(state, null, 2));
  appendJsonl044(join(permanentRoot, "source-health.jsonl"), {
    kind: "budget",
    ...state,
  });
}

/** Never spend on already-settled events; discovery only if catalog stale. */
export function shouldSpend044(input: {
  priority: RequestPriority044;
  remaining: number | null;
  safeFloor: number;
  catalogFreshHours: number;
}): { allow: boolean; reason: string } {
  if (input.remaining != null && input.remaining <= input.safeFloor) {
    return { allow: false, reason: "SAFE_REMAINING_FLOOR" };
  }
  if (input.priority === "DISCOVERY" && input.catalogFreshHours < 6) {
    return { allow: false, reason: "CATALOG_FRESH_SKIP_DISCOVERY" };
  }
  return { allow: true, reason: "OK" };
}
