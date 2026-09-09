/**
 * TASK 057 lab — API-Sports data foundation (no MODEL change).
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { labAFingerprint046, assertLabAUntouched046 } from "@/domain/eval/control-046/lab-a-firewall";
import { loadStore039 } from "@/domain/eval/live-039/store";
import { labAStore044 } from "@/domain/eval/permanent-044/config";
import { runCapabilityDiscovery057 } from "@/domain/data-sources/api-sports/capabilities";
import { buildApiSportsHealth057 } from "@/domain/data-sources/api-sports/health";
import { createApiSportsAdapter057 } from "@/domain/data-sources/api-sports/adapter";
import { getApiSportsKey057, redactSecrets057, apiSportsRoot057 } from "@/domain/data-sources/api-sports/config";
import { loadBudget057 } from "@/domain/data-sources/api-sports/budget";
import { emptyIndependentContract057 } from "@/domain/data-sources/api-sports/contract";
import { normalizeFixtures057 } from "@/domain/data-sources/api-sports/normalize";

export type Task057Report = {
  experiment_id: "exp_057_api_sports_data_foundation";
  task: "057";
  FINAL_VERDICT: "PASS" | "PARTIAL" | "BLOCKED";
  API_SPORTS_REACHABLE: boolean;
  KEY_CONFIGURED: boolean;
  KEY_EXPOSED: false;
  CAPABILITY_DISCOVERY: boolean;
  NORMALIZED_EVENTS: number;
  AVAILABLE: string[];
  PLAN_LIMITED: string[];
  UNAVAILABLE: string[];
  REQUESTS_THIS_RUN: number;
  REQUESTS_TODAY: number;
  REMAINING: number;
  PLAN: string | null;
  LAB_A_MUTATION: false;
  LAB_A_EVENTS: number;
  LAB_A_LOCKED: number;
  REAL_MONEY: false;
  AUTO_PROMOTION: false;
  CAPITAL: "PAPER_ONLY";
  PAPER_INITIAL: 1000;
  MODEL_ENGINE_TOUCHED: false;
  SUPERVISOR_TOUCHED: false;
  open_task_058: false;
  fingerprint: string;
};

function writeArt(name: string, payload: unknown): void {
  const root = join(process.cwd(), "artifacts", "task-057");
  mkdirSync(root, { recursive: true });
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  if (getApiSportsKey057() && text.includes(getApiSportsKey057()!)) {
    throw new ExperimentIntegrityError("api_key_leakage_in_artifact");
  }
  writeFileSync(join(root, name), redactSecrets057(text));
}

export function printVerdict057(r: Task057Report): string {
  return [
    "TASK 057 — API-SPORTS DATA FOUNDATION",
    `FINAL_VERDICT: ${r.FINAL_VERDICT}`,
    `API_SPORTS_REACHABLE: ${r.API_SPORTS_REACHABLE}`,
    `KEY_CONFIGURED: ${r.KEY_CONFIGURED}`,
    `KEY_EXPOSED: ${r.KEY_EXPOSED}`,
    `CAPABILITY_DISCOVERY: ${r.CAPABILITY_DISCOVERY}`,
    `NORMALIZED_EVENTS: ${r.NORMALIZED_EVENTS}`,
    `AVAILABLE: ${r.AVAILABLE.join(",") || "—"}`,
    `PLAN_LIMITED: ${r.PLAN_LIMITED.join(",") || "—"}`,
    `UNAVAILABLE: ${r.UNAVAILABLE.join(",") || "—"}`,
    `REQUESTS_THIS_RUN: ${r.REQUESTS_THIS_RUN}`,
    `REQUESTS_TODAY: ${r.REQUESTS_TODAY}`,
    `REMAINING: ${r.REMAINING}`,
    `PLAN: ${r.PLAN}`,
    `LAB_A_MUTATION: ${r.LAB_A_MUTATION}`,
    `REAL_MONEY: ${r.REAL_MONEY}`,
    `MODEL_ENGINE_TOUCHED: ${r.MODEL_ENGINE_TOUCHED}`,
    `open_task_058: ${r.open_task_058}`,
  ].join("\n");
}

export async function runTask057(): Promise<Task057Report> {
  const before = labAFingerprint046();
  const labA = loadStore039(labAStore044());
  if (labA.events.length !== 114 || labA.decisions.length !== 114) {
    throw new ExperimentIntegrityError("lab_a_size");
  }

  const keyConfigured = Boolean(getApiSportsKey057());
  const contract = emptyIndependentContract057();
  if (contract.note !== "CONTRACT_ONLY_NO_MODEL_v3") throw new ExperimentIntegrityError("contract");

  // Unit normalize without network
  const fake = {
    response: [
      {
        fixture: { id: 1, date: "2026-09-10T18:00:00+00:00", status: { short: "NS" } },
        league: { id: 39, name: "Premier League", season: 2026 },
        teams: { home: { id: 10, name: "A" }, away: { id: 20, name: "B" } },
        goals: { home: null, away: null },
      },
    ],
  };
  if (normalizeFixtures057(fake).length !== 1) throw new ExperimentIntegrityError("normalize");

  const discovery = await runCapabilityDiscovery057({ maxRequests: 12 });
  const health = buildApiSportsHealth057();
  const adapter = createApiSportsAdapter057();
  void adapter.decisionContract();

  assertLabAUntouched046(before);

  const available = discovery.capabilities.filter((c) => c.status === "AVAILABLE").map((c) => c.endpoint);
  const planLimited = discovery.capabilities.filter((c) => c.status === "PLAN_LIMITED").map((c) => c.endpoint);
  const unavailable = discovery.capabilities
    .filter((c) => c.status === "UNAVAILABLE" || c.status === "ERROR")
    .map((c) => c.endpoint);

  const reachable =
    keyConfigured &&
    discovery.capabilities.some((c) => c.endpoint === "status" && (c.status === "AVAILABLE" || c.http_status === 200));

  let verdict: Task057Report["FINAL_VERDICT"] = "BLOCKED";
  if (
    reachable &&
    discovery.normalized_events >= 1 &&
    available.length >= 1 &&
    before.events === 114
  ) {
    verdict = "PASS";
  } else if (reachable || available.length > 0) {
    verdict = "PARTIAL";
  }

  const budget = loadBudget057();
  const body: Omit<Task057Report, "fingerprint"> = {
    experiment_id: "exp_057_api_sports_data_foundation",
    task: "057",
    FINAL_VERDICT: verdict,
    API_SPORTS_REACHABLE: reachable,
    KEY_CONFIGURED: keyConfigured,
    KEY_EXPOSED: false,
    CAPABILITY_DISCOVERY: discovery.capabilities.length > 0,
    NORMALIZED_EVENTS: discovery.normalized_events,
    AVAILABLE: available,
    PLAN_LIMITED: planLimited,
    UNAVAILABLE: unavailable,
    REQUESTS_THIS_RUN: discovery.requests_this_run,
    REQUESTS_TODAY: budget.used_day,
    REMAINING: budget.remaining_day,
    PLAN: budget.plan ?? health.plan,
    LAB_A_MUTATION: false,
    LAB_A_EVENTS: before.events,
    LAB_A_LOCKED: before.decisions,
    REAL_MONEY: false,
    AUTO_PROMOTION: false,
    CAPITAL: "PAPER_ONLY",
    PAPER_INITIAL: 1000,
    MODEL_ENGINE_TOUCHED: false,
    SUPERVISOR_TOUCHED: false,
    open_task_058: false,
  };

  const fingerprint = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const report: Task057Report = { ...body, fingerprint };

  writeArt("capabilities.json", discovery);
  writeArt("source-health.json", health);
  writeArt("request-budget.json", budget);
  writeArt("normalization-report.json", {
    normalized_events: discovery.normalized_events,
    sample_fixture_id: discovery.sample_fixture_id,
    contract: emptyIndependentContract057(),
  });
  writeArt("final-report.md", printVerdict057(report) + "\n");
  writeArt("task-057-result.json", report);

  // Mirror health into Lab B api-sports already done by builders
  const root = apiSportsRoot057();
  if (existsSync(join(root, "capabilities.json"))) {
    /* ok */
  }

  return report;
}
