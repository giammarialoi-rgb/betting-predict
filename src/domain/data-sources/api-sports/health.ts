/**
 * API-Sports health snapshot for Control Center / source-health.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { apiSportsRoot057, getApiSportsKey057 } from "@/domain/data-sources/api-sports/config";
import { loadBudget057 } from "@/domain/data-sources/api-sports/budget";
import { loadCapabilities057 } from "@/domain/data-sources/api-sports/capabilities";
import type { ApiSportsHealth057 } from "@/domain/data-sources/api-sports/types";

export function buildApiSportsHealth057(): ApiSportsHealth057 {
  const root = apiSportsRoot057();
  const key = Boolean(getApiSportsKey057());
  const budget = loadBudget057(root);
  const caps = loadCapabilities057(root);
  const available = (caps?.capabilities ?? []).filter((c) => c.status === "AVAILABLE").map((c) => c.endpoint);
  const lastErr =
    caps?.capabilities.find((c) => c.status === "ERROR" || c.status === "UNAVAILABLE")?.error ?? null;
  const lastOk = caps?.capabilities.find((c) => c.status === "AVAILABLE")?.tested_at ?? null;

  let status: ApiSportsHealth057["status"] = "NOT_CONFIGURED";
  if (!key) status = "NOT_CONFIGURED";
  else if (budget.remaining_day <= 0) status = "RATE_LIMITED";
  else if (available.length > 0) status = "AVAILABLE";
  else if (caps?.capabilities.some((c) => c.status === "PLAN_LIMITED")) status = "PLAN_LIMITED";
  else if (caps?.capabilities.some((c) => c.status === "ERROR")) status = "ERROR";
  else status = "UNAVAILABLE";

  const health: ApiSportsHealth057 = {
    source: "API_SPORTS",
    status,
    requests_today: budget.used_day,
    remaining: budget.remaining_day,
    sports: ["football"],
    data_types: available,
    last_success: lastOk,
    last_error: lastErr,
    plan: budget.plan,
    key_configured: key,
    key_exposed: false,
  };

  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "source-health.json"), JSON.stringify(health, null, 2));
  return health;
}
