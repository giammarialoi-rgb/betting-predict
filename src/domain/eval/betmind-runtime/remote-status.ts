/**
 * Mirror Lab B runtime status to Neon so Vercel can show honest ONLINE/OFFLINE
 * without local disk. Stale heartbeats stay OFFLINE — never invent alive state.
 */
import { neon } from "@neondatabase/serverless";
import { existsSync, readFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { buildHealthPayload053 } from "@/domain/eval/bankroll-053/system";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { piRoot } from "@/domain/eval/predictive-intelligence/config";

export const RUNTIME_STATUS_ID = "default";
/** After this age, remote status must not light ONLINE components. */
export const RUNTIME_STALE_MS = 10 * 60 * 1000;

export type BetMindRemoteComponents = {
  supervisor: "ONLINE" | "OFFLINE" | "UNKNOWN" | "DEGRADED";
  worker: "ONLINE" | "OFFLINE" | "UNKNOWN" | "DEGRADED";
  brain: "ONLINE" | "OFFLINE" | "UNKNOWN" | "DEGRADED";
  predictive_engine: "ONLINE" | "OFFLINE" | "UNKNOWN" | "DEGRADED";
  data_pipeline: "ONLINE" | "OFFLINE" | "UNKNOWN" | "DEGRADED";
  settlement: "ONLINE" | "OFFLINE" | "UNKNOWN" | "DEGRADED";
  learning: "ONLINE" | "OFFLINE" | "UNKNOWN" | "DEGRADED";
};

export type BetMindRuntimePayload = {
  schema_version: 1;
  published_at: string;
  host: string;
  real_money: false;
  store_present_local: boolean;
  components: BetMindRemoteComponents;
  detail: Record<string, unknown>;
  health053: Record<string, unknown>;
  observatory: Record<string, unknown> | null;
  predictive: {
    final_verdict: Record<string, unknown> | null;
    validation: Record<string, unknown> | null;
    model_manifest: Record<string, unknown> | null;
  };
};

export type LoadedRuntimeStatus = {
  published_at: string;
  age_ms: number;
  fresh: boolean;
  payload: BetMindRuntimePayload;
};

function sqlClient() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function statusFromAlive(alive: boolean | null | undefined): "ONLINE" | "OFFLINE" | "UNKNOWN" {
  if (alive === true) return "ONLINE";
  if (alive === false) return "OFFLINE";
  return "UNKNOWN";
}

/** Build publishable payload from local Lab B (PC worker). */
export function buildRuntimePayloadFromLocal(root = permanentRoot044()): BetMindRuntimePayload {
  const pi = piRoot(root);
  const base = buildHealthPayload053(root);
  const system = base.system as {
    supervisor_alive?: boolean | null;
    worker_alive?: boolean | null;
    status?: string;
    official_status?: string | null;
    heartbeat_age_ms?: number | null;
    last_cycle_at?: string | null;
  };
  const brain = base.brain as { status?: string };
  const verdict = readJson(join(pi, "final-verdict.json"));
  const validation = readJson(join(pi, "validation-report.json"));
  const modelManifest = readJson(join(pi, "model-manifest.json"));

  const storePresent =
    existsSync(join(root, "events.jsonl")) && existsSync(join(root, "decisions.jsonl"));
  const settlementsPresent = existsSync(join(root, "settlements.jsonl"));
  const learningPresent =
    existsSync(join(pi, "learning", "cases.jsonl")) ||
    existsSync(join(root, "learning-cases.jsonl"));

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

  const published_at = new Date().toISOString();
  const components: BetMindRemoteComponents = {
    supervisor: statusFromAlive(system.supervisor_alive),
    worker: statusFromAlive(system.worker_alive),
    brain: brainLabel,
    predictive_engine: predictiveEngine,
    data_pipeline: storePresent ? "ONLINE" : "OFFLINE",
    settlement: settlementsPresent ? "ONLINE" : "UNKNOWN",
    learning: learningPresent ? "ONLINE" : "UNKNOWN",
  };

  return {
    schema_version: 1,
    published_at,
    host: hostname(),
    real_money: false,
    store_present_local: storePresent,
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
      mirror: "neon",
      host: hostname(),
    },
    health053: base as unknown as Record<string, unknown>,
    observatory: {
      at: published_at,
      system: base.system,
      brain: base.brain,
      current_work: base.current_work,
      next_events: [],
      note: "Remote mirror — full decision board stays on Lab B host until store sync exists",
      capital: { CAPITAL: "PAPER_1000", REAL_MONEY: false },
      api_calls_ui: 0,
    },
    predictive: {
      final_verdict: verdict,
      validation,
      model_manifest: modelManifest,
    },
  };
}

export async function ensureRuntimeStatusTable(): Promise<boolean> {
  const sql = sqlClient();
  if (!sql) return false;
  await sql`
    CREATE TABLE IF NOT EXISTS betmind_runtime_status (
      id text PRIMARY KEY DEFAULT 'default',
      published_at timestamptz NOT NULL DEFAULT now(),
      payload jsonb NOT NULL
    )
  `;
  return true;
}

export async function publishRuntimeStatus(
  payload: BetMindRuntimePayload = buildRuntimePayloadFromLocal(),
): Promise<{ ok: true; published_at: string } | { ok: false; error: string }> {
  try {
    const sql = sqlClient();
    if (!sql) return { ok: false, error: "DATABASE_URL is not set" };
    await ensureRuntimeStatusTable();
    const publishedAt = payload.published_at;
    await sql`
      INSERT INTO betmind_runtime_status (id, published_at, payload)
      VALUES (${RUNTIME_STATUS_ID}, ${publishedAt}::timestamptz, ${JSON.stringify(payload)}::jsonb)
      ON CONFLICT (id) DO UPDATE
      SET published_at = EXCLUDED.published_at,
          payload = EXCLUDED.payload
    `;
    return { ok: true, published_at: publishedAt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function loadRuntimeStatus(
  nowMs = Date.now(),
  staleMs = RUNTIME_STALE_MS,
): Promise<LoadedRuntimeStatus | null> {
  try {
    const sql = sqlClient();
    if (!sql) return null;
    const rows = (await sql`
      SELECT published_at::text AS published_at, payload
      FROM betmind_runtime_status
      WHERE id = ${RUNTIME_STATUS_ID}
      LIMIT 1
    `) as Array<{ published_at: string; payload: BetMindRuntimePayload | string }>;
    const row = rows[0];
    if (!row) return null;
    const payload =
      typeof row.payload === "string"
        ? (JSON.parse(row.payload) as BetMindRuntimePayload)
        : row.payload;
    const published_at = row.published_at ?? payload.published_at;
    const age_ms = Math.max(0, nowMs - Date.parse(published_at));
    return {
      published_at,
      age_ms,
      fresh: Number.isFinite(age_ms) && age_ms <= staleMs,
      payload,
    };
  } catch {
    return null;
  }
}

let lastPublishMs = 0;
let publishInFlight = false;

/** Debounced fire-and-forget publish (brain cycles). Never throws. */
export function schedulePublishRuntimeStatus(minIntervalMs = 60_000): void {
  const now = Date.now();
  if (publishInFlight || now - lastPublishMs < minIntervalMs) return;
  if (!process.env.DATABASE_URL) return;
  publishInFlight = true;
  void publishRuntimeStatus()
    .then((r) => {
      if (r.ok) lastPublishMs = Date.now();
    })
    .catch(() => {
      /* swallow — local Lab B must not die on mirror failure */
    })
    .finally(() => {
      publishInFlight = false;
    });
}
