import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildHealthPayload053 } from "@/domain/eval/bankroll-053/system";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { piRoot } from "@/domain/eval/predictive-intelligence/config";

export const dynamic = "force-dynamic";

function statusFromAlive(alive: boolean | null | undefined): "ONLINE" | "OFFLINE" | "UNKNOWN" {
  if (alive === true) return "ONLINE";
  if (alive === false) return "OFFLINE";
  return "UNKNOWN";
}

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function degraded(started: number, error: unknown) {
  return NextResponse.json(
    {
      ok: false,
      service: "betmind",
      at: new Date().toISOString(),
      latency_ms: Date.now() - started,
      real_money: false as const,
      api_calls: 0 as const,
      components: {
        supervisor: "UNKNOWN",
        worker: "UNKNOWN",
        brain: "UNKNOWN",
        predictive_engine: "OFFLINE",
        data_pipeline: "OFFLINE",
        settlement: "UNKNOWN",
        learning: "UNKNOWN",
      },
      detail: {
        official_status: null,
        heartbeat_age_ms: null,
        last_cycle_at: null,
        brain_status: "UNKNOWN",
        model_independent: null,
        model_edge: "UNKNOWN",
        store_root: "audit/external/task-044",
        store_present: false,
        pi_verdict_present: false,
        error: error instanceof Error ? error.message : "unknown",
      },
    },
    { status: 200 },
  );
}

/**
 * Production BetMind health — disk/read-only.
 * Zero Odds API / API-Sports calls from this endpoint.
 * Never throws 500 when Lab B store is missing (Vercel FS).
 */
export async function GET() {
  const started = Date.now();
  try {
    const root = permanentRoot044();
    const pi = piRoot(root);
    const base = buildHealthPayload053(root);
    const system = base.system;
    const brain = base.brain;
    const verdict = readJson(join(pi, "final-verdict.json"));
    const validation = readJson(join(pi, "validation-report.json"));
    const modelManifest = readJson(join(pi, "model-manifest.json"));

    const storePresent =
      existsSync(join(root, "events.jsonl")) && existsSync(join(root, "decisions.jsonl"));
    const settlementsPresent = existsSync(join(root, "settlements.jsonl"));
    const learningPresent =
      existsSync(join(pi, "learning", "cases.jsonl")) ||
      existsSync(join(root, "learning-cases.jsonl"));

    const supervisor = statusFromAlive(system.supervisor_alive);
    const worker = statusFromAlive(system.worker_alive);
    const brainStatus = String(brain?.status ?? system.status ?? "UNKNOWN");
    const brainLabel = /HEALTHY|RUN|WORKING/i.test(brainStatus)
      ? "ONLINE"
      : /DEAD|STOPPED/i.test(brainStatus)
        ? "OFFLINE"
        : /DEGRADED|PAUSED|RECOVER/i.test(brainStatus)
          ? "DEGRADED"
          : "UNKNOWN";

    const predictiveEngine =
      verdict || validation || modelManifest
        ? verdict?.model_is_market_only === false ||
          String(verdict?.model_independent ?? "").includes("INDEPENDENT")
          ? "ONLINE"
          : "DEGRADED"
        : storePresent
          ? "UNKNOWN"
          : "OFFLINE";

    const dataPipeline = storePresent ? "ONLINE" : "OFFLINE";
    const settlement = settlementsPresent ? "ONLINE" : "UNKNOWN";
    const learning = learningPresent ? "ONLINE" : "UNKNOWN";

    const components = {
      supervisor,
      worker,
      brain: brainLabel,
      predictive_engine: predictiveEngine,
      data_pipeline: dataPipeline,
      settlement,
      learning,
    } as const;

    const offline = Object.values(components).filter((s) => s === "OFFLINE").length;
    const ok = offline === 0 && dataPipeline === "ONLINE";

    return NextResponse.json({
      ok,
      service: "betmind",
      at: new Date().toISOString(),
      latency_ms: Date.now() - started,
      real_money: false as const,
      api_calls: 0 as const,
      components,
      detail: {
        official_status: system.official_status ?? null,
        heartbeat_age_ms: system.heartbeat_age_ms ?? null,
        last_cycle_at: system.last_cycle_at ?? null,
        brain_status: brainStatus,
        model_independent: verdict?.model_independent ?? null,
        model_edge:
          (verdict?.promotion_gate as { model_edge?: string } | undefined)?.model_edge ?? "UNKNOWN",
        store_root: "audit/external/task-044",
        store_present: storePresent,
        pi_verdict_present: Boolean(verdict),
      },
    });
  } catch (error) {
    return degraded(started, error);
  }
}
