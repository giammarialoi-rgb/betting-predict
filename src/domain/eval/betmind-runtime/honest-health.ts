/**
 * Single honest health payload. Never pings Neon. Never claims ONLINE unverified.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildHealthPayload053 } from "@/domain/eval/bankroll-053/system";
import { loadRuntimeStatus } from "@/domain/eval/betmind-runtime/remote-status";
import { localLabStorePresent, staleMirrorComponents } from "@/domain/eval/betmind-runtime/production-mirror";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { piRoot } from "@/domain/eval/predictive-intelligence/config";
import { dossierMirrorHealth } from "@/domain/eval/betmind-runtime/dossier-mirror";
import { loadResearchQueue } from "@/domain/eval/data-intelligence/research/queue";
import { NEON_IN_USE, NEON_STATUS_IT } from "@/domain/storage";

export type HonestComponentState = "ONLINE" | "OFFLINE" | "DEGRADED" | "UNKNOWN";

export type HonestHealthPayload = {
  ok: boolean;
  service: "betmind";
  app: "ok";
  neon_in_use: false;
  neon_status_it: typeof NEON_STATUS_IT;
  db: "unused";
  project: "sports-prediction-engine";
  at: string;
  latency_ms: number;
  real_money: false;
  api_calls: 0;
  components: Record<string, HonestComponentState | string>;
  detail: Record<string, unknown>;
};

function statusFromAlive(alive: boolean | null | undefined): HonestComponentState {
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

function base(started: number, extra: Partial<HonestHealthPayload> & { components: HonestHealthPayload["components"]; detail: Record<string, unknown>; ok: boolean }): HonestHealthPayload {
  return {
    ok: extra.ok,
    service: "betmind",
    app: "ok",
    neon_in_use: false,
    neon_status_it: NEON_STATUS_IT,
    db: "unused",
    project: "sports-prediction-engine",
    at: new Date().toISOString(),
    latency_ms: Date.now() - started,
    real_money: false,
    api_calls: 0,
    components: extra.components,
    detail: {
      ...extra.detail,
      neon_in_use: false,
      neon_status_it: NEON_STATUS_IT,
    },
  };
}

export async function buildHonestHealth(started = Date.now()): Promise<HonestHealthPayload> {
  if (NEON_IN_USE) {
    throw new Error("NEON_BANNED");
  }
  const root = permanentRoot044();
  const pi = piRoot(root);
  const storePresent = localLabStorePresent(root);

  if (!storePresent) {
    const remote = await loadRuntimeStatus();
    if (remote?.fresh) {
      const components = remote.payload.components as Record<string, string>;
      const offline = Object.values(components).filter((s) => s === "OFFLINE").length;
      const ok = offline === 0 && components.data_pipeline === "ONLINE";
      return base(started, {
        ok,
        components,
        detail: {
          ...remote.payload.detail,
          store_present: false,
          store_present_local_on_publisher: remote.payload.store_present_local,
          mirror_source: "remote",
          mirror_published_at: remote.published_at,
          mirror_age_ms: remote.age_ms,
          mirror_host: remote.payload.host,
          analysis: remote.payload.analysis,
          dossier_mirror: await dossierMirrorHealth(root),
          sources: { note_it: "Stato adattatori su /sources — non inventato qui." },
        },
      });
    }
    if (remote && !remote.fresh) {
      return base(started, {
        ok: false,
        components: staleMirrorComponents(),
        detail: {
          ...remote.payload.detail,
          store_present: false,
          store_present_local_on_publisher: remote.payload.store_present_local,
          mirror_source: "remote",
          mirror_published_at: remote.published_at,
          mirror_age_ms: remote.age_ms,
          mirror_stale: true,
          brain_status: "STALE_MIRROR",
          last_known_brain_status: remote.payload.detail.brain_status,
          last_known_components: remote.payload.components,
          analysis: remote.payload.analysis,
          dossier_mirror: await dossierMirrorHealth(root),
        },
      });
    }
  }

  const system = storePresent ? buildHealthPayload053(root).system : { supervisor_alive: null, worker_alive: null, status: "UNKNOWN", official_status: null, heartbeat_age_ms: null, last_cycle_at: null };
  const brain = storePresent ? buildHealthPayload053(root).brain : null;
  const verdict = readJson(join(pi, "final-verdict.json"));
  const validation = readJson(join(pi, "validation-report.json"));
  const modelManifest = readJson(join(pi, "model-manifest.json"));

  const settlementsPresent = existsSync(join(root, "settlements.jsonl"));
  const learningPresent =
    existsSync(join(pi, "learning", "cases.jsonl")) || existsSync(join(root, "learning-cases.jsonl"));

  const supervisor = statusFromAlive(system.supervisor_alive);
  const worker = statusFromAlive(system.worker_alive);
  const brainStatus = String(brain?.status ?? system.status ?? "UNKNOWN");
  const brainLabel: HonestComponentState = /HEALTHY|RUN|WORKING/i.test(brainStatus)
    ? "ONLINE"
    : /DEAD|STOPPED/i.test(brainStatus)
      ? "OFFLINE"
      : /DEGRADED|PAUSED|RECOVER/i.test(brainStatus)
        ? "DEGRADED"
        : "UNKNOWN";

  const predictiveEngine: HonestComponentState =
    verdict || validation || modelManifest
      ? verdict?.model_is_market_only === false ||
        String(verdict?.model_independent ?? "").includes("INDEPENDENT")
        ? "ONLINE"
        : "DEGRADED"
      : storePresent
        ? "UNKNOWN"
        : "OFFLINE";

  const dataPipeline: HonestComponentState = storePresent ? "ONLINE" : "OFFLINE";
  const settlement: HonestComponentState = settlementsPresent ? "ONLINE" : "UNKNOWN";
  const learning: HonestComponentState = learningPresent ? "ONLINE" : "UNKNOWN";

  const queue = storePresent ? loadResearchQueue(root) : { items: [] as { state: string }[] };
  const researching = queue.items.filter((i) => i.state === "RESEARCHING" || i.state === "QUEUED").length;
  const researched = queue.items.filter((i) =>
    ["RESEARCHED", "FEATURED", "INFERENCE", "PREDICTION", "INSUFFICIENT"].includes(i.state),
  ).length;
  const researchComponent: HonestComponentState =
    researching > 0 ? "ONLINE" : researched > 0 ? "DEGRADED" : storePresent ? "UNKNOWN" : "OFFLINE";

  const mirrorHealth = await dossierMirrorHealth(root);
  const dossierMirrorComponent: HonestComponentState =
    mirrorHealth.remote_count != null && mirrorHealth.remote_count > 0
      ? "ONLINE"
      : mirrorHealth.local_count > 0
        ? "DEGRADED"
        : "UNKNOWN";

  const sources: HonestComponentState = researched > 0 || researching > 0 ? "DEGRADED" : "UNKNOWN";

  const components = {
    supervisor,
    worker,
    brain: brainLabel,
    predictive_engine: predictiveEngine,
    data_pipeline: dataPipeline,
    sources,
    research: researchComponent,
    dossier_mirror: dossierMirrorComponent,
    settlement,
    learning,
  };

  const offline = Object.values(components).filter((s) => s === "OFFLINE").length;
  const ok = offline === 0 && dataPipeline === "ONLINE";

  return base(started, {
    ok,
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
      mirror_source: storePresent ? "local_disk" : "none",
      mirror_reason_it: storePresent
        ? undefined
        : "Nessuno specchio remoto. App online ≠ Runtime online. Senza publish dal PC, Vercel resta OFFLINE.",
      sources: {
        note_it: "Store presente ≠ fonti verificate. ONLINE solo dopo probe/research.",
      },
      research: { queued: researching, researched },
      dossier_mirror: mirrorHealth,
    },
  });
}
