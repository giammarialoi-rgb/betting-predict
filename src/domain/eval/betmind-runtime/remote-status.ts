/**
 * Mirror Lab B runtime + analysis board to the filesystem StorageProvider.
 * When ingest URL + secret are set, also POST to Vercel Blob via /api/betmind/runtime/ingest.
 * NEON NON UTILIZZATO. Stale heartbeats stay OFFLINE — never invent alive state.
 */
import { existsSync, readFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { buildHealthPayload053, loadCurrentWork053 } from "@/domain/eval/bankroll-053/system";
import { loadBrainState051, BRAIN_MODEL_051 } from "@/domain/eval/brain-051/config";
import {
  readJsonlTail,
  readJsonlAllSmall,
  summarizeBoardBuckets,
  type BoardEventRow,
} from "@/domain/eval/betmind-runtime/board";
import {
  listCalendarEvents,
  matchesCalendarQuery,
  shiftCalendarDay,
  todayCalendarDay,
} from "@/domain/eval/betmind-runtime/calendar";
import { localLabStorePresent } from "@/domain/eval/betmind-runtime/production-mirror";
import { buildOperationalSourceEngine } from "@/domain/eval/data-intelligence/research/source-engine";
import { loadCoverage055, loadCurrentActivity055, readActivityFeed055 } from "@/domain/eval/catalog-055/cycle";
import { loadAutostartStatus055 } from "@/domain/eval/catalog-055/autostart";
import { computeMassiveStats049 } from "@/domain/eval/factory-049/stats";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { piRoot } from "@/domain/eval/predictive-intelligence/config";
import {
  computePipelineCounters3d,
  type PipelineCounters3d,
} from "@/domain/eval/betmind-runtime/pipeline-counters";
import { getStorage } from "@/domain/storage";
import {
  pushRuntimeToRemoteIngest,
  readRemoteMirror,
  remoteFreshness,
  type RemotePushResult,
} from "@/domain/eval/betmind-runtime/remote-mirror";

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

export type AnalysisSummary = {
  cycle_number: number;
  last_cycle_at: string | null;
  last_successful_cycle_at: string | null;
  priority: string | null;
  idle: boolean;
  reason: string | null;
  events_in_store: number;
  events_discovered: number | null;
  /** @deprecated Prefer predictions_persisted_events — was misread as model inference. */
  events_analyzed: number;
  predictions_produced: number;
  decisions_on_board: number;
  skipped: number;
  no_bet: number;
  model_version: string;
  data_coverage: number | null;
  buckets: ReturnType<typeof summarizeBoardBuckets>;
  no_events_available: boolean;
  no_events_reason: string | null;
  /** Phase 3D honest pipeline counters */
  events_with_research: number;
  events_eligible: number;
  model_inferences: number;
  predictions_persisted_events: number;
  insufficient_data: number;
  no_independent_features: number;
  no_independent_model: number;
  events_queued: number | null;
  events_researched: number | null;
  sources_attempted_today: number | null;
  data_acquired_today: number | null;
  sources_blocked_today: number | null;
  sources_missing_adapter_today: number | null;
  events_with_real_event_data?: number | null;
  events_with_historical_data?: number | null;
  real_observations?: number | null;
  historical_observations?: number | null;
  derived_observations?: number | null;
  data_yield?: number | null;
  pipeline?: PipelineCounters3d;
};

export type BetMindRuntimePayload = {
  schema_version: 2;
  published_at: string;
  host: string;
  real_money: false;
  store_present_local: boolean;
  components: BetMindRemoteComponents;
  detail: Record<string, unknown>;
  health053: Record<string, unknown>;
  analysis: AnalysisSummary;
  observatory: Record<string, unknown> | null;
  predictive: {
    final_verdict: Record<string, unknown> | null;
    validation: Record<string, unknown> | null;
    model_manifest: Record<string, unknown> | null;
    learning_report: Record<string, unknown> | null;
    paper_bankroll_report: Record<string, unknown> | null;
  };
  learning_cases: unknown[];
  recent_settlements: unknown[];
  recent_autopsies: unknown[];
};

export type LoadedRuntimeStatus = {
  published_at: string;
  age_ms: number;
  fresh: boolean;
  payload: BetMindRuntimePayload;
};

function storage() {
  return getStorage(permanentRoot044());
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

export function buildAnalysisSummaryFromLocal(
  root = permanentRoot044(),
  nextEvents: BoardEventRow[] = [],
): AnalysisSummary {
  const state = loadBrainState051(root);
  let stats = null as ReturnType<typeof computeMassiveStats049> | null;
  try {
    stats = computeMassiveStats049(loadStore044(root));
  } catch {
    stats = null;
  }
  const coverage = loadCoverage055(root);
  const buckets = summarizeBoardBuckets(nextEvents);
  let eventsInStore = nextEvents.length;
  try {
    eventsInStore = loadStore044(root).events.length;
  } catch {
    /* keep board length */
  }
  const analyzed = stats?.EVENTS_ANALYZED ?? buckets.ANALYZED;
  const noBet = typeof stats?.NO_BET === "number" ? stats.NO_BET : buckets.SKIPPED;
  const noEvents = eventsInStore === 0 && nextEvents.length === 0;
  const covPct =
    coverage && coverage.catalog_events > 0
      ? coverage.odds_available / coverage.catalog_events
      : null;

  const pipeline = computePipelineCounters3d(root);

  return {
    cycle_number: state.cycles_completed ?? 0,
    last_cycle_at: state.last_cycle_at,
    last_successful_cycle_at: state.last_successful_cycle_at,
    priority: state.last_priority,
    idle: String(state.status).toUpperCase() === "IDLE" || String(state.status).toUpperCase() === "STOPPED",
    reason: state.last_error,
    events_in_store: eventsInStore,
    events_discovered: pipeline.events_discovered,
    events_analyzed: analyzed,
    /** Phase 3E: only independent inferences — not insufficient placeholder rows. */
    predictions_produced: pipeline.predictions_produced,
    decisions_on_board: nextEvents.length,
    skipped: pipeline.skipped || buckets.SKIPPED + buckets.UNAVAILABLE,
    no_bet: noBet,
    model_version: String(state.model_version ?? BRAIN_MODEL_051),
    data_coverage: Number.isFinite(covPct) ? covPct : null,
    buckets,
    no_events_available: noEvents,
    no_events_reason: noEvents
      ? `NO EVENTS AVAILABLE — last discovery/cycle at ${state.last_cycle_at ?? "never"}; store empty or no board rows`
      : null,
    events_with_research: pipeline.events_with_research,
    events_eligible: pipeline.events_eligible,
    model_inferences: pipeline.model_inferences,
    predictions_persisted_events: pipeline.predictions_persisted_events,
    insufficient_data: pipeline.insufficient_data,
    no_independent_features: pipeline.no_independent_features,
    no_independent_model: pipeline.no_independent_model,
    events_queued: pipeline.events_queued,
    events_researched: pipeline.events_researched,
    sources_attempted_today: pipeline.sources_attempted_today,
    data_acquired_today: pipeline.data_acquired_today,
    sources_blocked_today: pipeline.sources_blocked_today,
    sources_missing_adapter_today: pipeline.sources_missing_adapter_today,
    events_with_real_event_data: pipeline.events_with_real_event_data,
    events_with_historical_data: pipeline.events_with_historical_data,
    real_observations: pipeline.real_observations,
    historical_observations: pipeline.historical_observations,
    derived_observations: pipeline.derived_observations,
    data_yield: pipeline.data_yield,
    pipeline,
  };
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
    last_priority?: string | null;
  };
  const brain = base.brain as { status?: string; cycles_completed?: number };
  const verdict = readJson(join(pi, "final-verdict.json"));
  const validation = readJson(join(pi, "validation-report.json"));
  const modelManifest = readJson(join(pi, "model-manifest.json"));
  const learningReport = readJson(join(pi, "learning-report.json"));
  const paperReport = readJson(join(pi, "paper-bankroll-report.json"));

  const storePresent = localLabStorePresent(root);
  const settlementsPresent = existsSync(join(root, "settlements.jsonl"));
  const learningPresent =
    existsSync(join(pi, "learning", "cases.jsonl")) ||
    existsSync(join(root, "learning-cases.jsonl"));

  const brainStatus = String(brain?.status ?? system.status ?? "UNKNOWN");
  const brainLabel = /HEALTHY|RUN|WORKING/i.test(brainStatus)
    ? "ONLINE"
    : /DEAD|STOPPED/i.test(brainStatus)
      ? "OFFLINE"
      : /DEGRADED|PAUSED|RECOVER|IDLE/i.test(brainStatus)
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
  const today = todayCalendarDay(published_at);
  const from = shiftCalendarDay(today, -7);
  const to = shiftCalendarDay(today, 21);
  const calendar = storePresent
    ? listCalendarEvents({ root, date: today, sport: "football" })
    : { day: today, total: 0, events: [] };
  /** Rolling window for the Vercel snapshot — full history stays on Lab B disk / board table. */
  const next_events = storePresent
    ? listCalendarEvents({ root, from, to, sport: "ALL" }).events
    : [];
  const analysis = buildAnalysisSummaryFromLocal(root, next_events);
  const source_engine = storePresent ? buildOperationalSourceEngine({ labBRoot: root }) : [];

  const coverage = loadCoverage055(root);
  const activity = loadCurrentActivity055(root) ?? loadCurrentWork053(root);
  const feed = readActivityFeed055(root, 40);

  const components: BetMindRemoteComponents = {
    supervisor: statusFromAlive(system.supervisor_alive),
    worker: statusFromAlive(system.worker_alive),
    brain: brainLabel,
    predictive_engine: predictiveEngine,
    data_pipeline: storePresent ? "ONLINE" : "OFFLINE",
    settlement: settlementsPresent ? "ONLINE" : analysis.predictions_produced > 0 ? "UNKNOWN" : "UNKNOWN",
    learning: learningPresent ? "ONLINE" : "UNKNOWN",
  };

  const learningPath = join(pi, "learning", "cases.jsonl");
  const learningFromPi = readJsonlTail(learningPath, 40);
  const learningFromStore = readJsonlTail(join(root, "learning-cases.jsonl"), 40);
  const rawLearning = learningFromPi.length ? learningFromPi : learningFromStore;
  const eventById = new Map<string, Record<string, unknown>>();
  for (const e of readJsonlAllSmall(join(root, "events.jsonl"), 2_000_000)) {
    const r = e as Record<string, unknown>;
    if (r.event_id) eventById.set(String(r.event_id), r);
  }
  const learning_cases = rawLearning.map((c) => {
    const row = c as Record<string, unknown>;
    const ev = row.event_id ? eventById.get(String(row.event_id)) : null;
    return {
      ...row,
      home: ev ? String(ev.home_or_a ?? row.home ?? "") : (row.home as string | undefined) ?? null,
      away: ev ? String(ev.away_or_b ?? row.away ?? "") : (row.away as string | undefined) ?? null,
      competition: ev
        ? String(ev.competition ?? row.competition ?? "")
        : (row.competition as string | undefined) ?? null,
      kickoff_utc: ev
        ? ((ev.kickoff_utc as string | null) ?? null)
        : ((row.kickoff_utc as string | null) ?? null),
      model_version:
        (row.model_version as string | undefined) ??
        ((row.prediction as Record<string, unknown> | undefined)?.model_version as string | undefined) ??
        analysis.model_version,
      cycle_number: analysis.cycle_number,
    };
  });

  // Counter labels (unambiguous — Phase 3D)
  const analysisLabeled = {
    ...analysis,
    labels: {
      events_in_store: "events_discovered",
      events_analyzed: "predictions_persisted_events_NOT_inference",
      events_with_research: "events_with_research",
      events_eligible: "events_eligible",
      model_inferences: "model_inferences",
      predictions_produced: "predictions_produced",
      insufficient_data: "insufficient_data",
      skipped: "skipped",
      decisions_on_board: "decision_board_window",
    },
  };

  return {
    schema_version: 2,
    published_at,
    host: hostname(),
    real_money: false,
    store_present_local: storePresent,
    components,
    detail: {
      official_status: system.official_status ?? null,
      heartbeat_age_ms: system.heartbeat_age_ms ?? null,
      last_cycle_at: analysis.last_cycle_at ?? system.last_cycle_at ?? null,
      last_successful_cycle_at: analysis.last_successful_cycle_at,
      last_priority: analysis.priority ?? system.last_priority ?? null,
      brain_status: brainStatus,
      cycles_completed: analysis.cycle_number,
      model_independent: verdict?.model_independent ?? null,
      model_version: analysis.model_version,
      model_edge:
        (verdict?.promotion_gate as { model_edge?: string } | undefined)?.model_edge ?? "UNKNOWN",
      store_root: "audit/external/task-044",
      store_present: storePresent,
      pi_verdict_present: Boolean(verdict),
      mirror: "filesystem",
      host: hostname(),
      events_analyzed: analysis.events_analyzed,
      events_with_predictions_store: analysis.predictions_persisted_events,
      events_discovered_store: analysis.events_in_store,
      events_discovered: analysis.events_discovered ?? analysis.events_in_store,
      events_with_research: analysis.events_with_research,
      events_queued: analysis.events_queued,
      events_researched: analysis.events_researched,
      sources_attempted_today: analysis.sources_attempted_today,
      data_acquired_today: analysis.data_acquired_today,
      sources_blocked_today: analysis.sources_blocked_today,
      sources_missing_adapter_today: analysis.sources_missing_adapter_today,
      events_eligible: analysis.events_eligible,
      model_inferences: analysis.model_inferences,
      predictions_persisted_events: analysis.predictions_persisted_events,
      insufficient_data: analysis.insufficient_data,
      no_independent_features: analysis.no_independent_features,
      no_independent_model: analysis.no_independent_model,
      predictions_produced: analysis.predictions_produced,
      decisions_on_board: analysis.decisions_on_board,
      decision_board_window: analysis.decisions_on_board,
      no_events_available: analysis.no_events_available,
      no_events_reason: analysis.no_events_reason,
      legacy_analyzed_meaning: analysis.pipeline?.legacy_analyzed_meaning ?? null,
    },
    health053: base as unknown as Record<string, unknown>,
    analysis: analysisLabeled,
    observatory: {
      at: published_at,
      system: {
        ...(base.system as object),
        last_cycle_at: analysis.last_cycle_at,
        last_successful_cycle_at: analysis.last_successful_cycle_at,
        last_priority: analysis.priority,
      },
      brain: {
        ...(base.brain as object),
        cycles_completed: analysis.cycle_number,
        model_version: analysis.model_version,
      },
      current_work: activity ?? base.current_work,
      next_events,
      calendar,
      source_engine,
      phase6_metrics: {
        research_attempts: source_engine.reduce((n, s) => n + (s.events_found + s.blocked_count + s.no_event_count), 0),
        research_successes: source_engine.reduce((n, s) => n + s.events_found, 0),
        observations_created: source_engine.reduce((n, s) => n + s.observations_found, 0),
        source_blocked: source_engine.reduce((n, s) => n + s.blocked_count, 0),
        source_no_event: source_engine.reduce((n, s) => n + s.no_event_count, 0),
        source_missing_adapter: source_engine.filter((s) => s.missing_adapter).length,
      },
      analysis: analysisLabeled,
      sport_diagnostics: coverage?.by_sport ?? null,
      coverage_047: coverage,
      multisource_055: {
        title: "UNIVERSAL 24/7 SPORTS INTELLIGENCE BRAIN",
        artificial_cap: false as const,
        coverage,
        current_activity: activity,
        activity_feed: feed,
        paper_bankroll: 1000 as const,
        capital: "PAPER_ONLY" as const,
        real_money: false as const,
        auto_promotion: false as const,
        model_edge:
          (verdict?.promotion_gate as { model_edge?: string } | undefined)?.model_edge ?? "UNKNOWN",
        api_calls_ui: 0 as const,
      },
      capital: { CAPITAL: "PAPER_1000", REAL_MONEY: false },
      audit_056: {
        AUTOSTART_STATUS: loadAutostartStatus055(root)?.ACTIVE_MECHANISM ?? "N/A",
        model_readiness: verdict?.model_is_market_only === false ? "INDEPENDENT_ACTIVE" : "UNKNOWN",
        model_edge:
          (verdict?.promotion_gate as { model_edge?: string } | undefined)?.model_edge ?? "UNKNOWN",
        decision_board_count: next_events.length,
        canonical_chain: "supervisor→worker→brain→massive049→decision048→bankroll053",
        open_task_057: false as const,
      },
      api_calls_ui: 0,
    },
    predictive: {
      final_verdict: verdict,
      validation,
      model_manifest: modelManifest,
      learning_report: learningReport,
      paper_bankroll_report: paperReport,
    },
    learning_cases,
    recent_settlements: readJsonlTail(join(root, "settlements.jsonl"), 30),
    recent_autopsies: readJsonlTail(join(root, "autopsies.jsonl"), 30),
  };
}

export async function ensureRuntimeTables(): Promise<boolean> {
  storage();
  return true;
}

async function persistCycleAndBoard(payload: BetMindRuntimePayload): Promise<void> {
  const store = storage();
  const a = payload.analysis;
  store.appendAnalysisCycle({
    cycle_at: a.last_cycle_at ?? payload.published_at,
    cycle_number: a.cycle_number,
    priority: a.priority,
    idle: a.idle,
    events_in_store: a.events_in_store,
    events_analyzed: a.events_analyzed,
    predictions_produced: a.predictions_produced,
    decisions_on_board: a.decisions_on_board,
    skipped: a.skipped,
    model_version: a.model_version,
    host: payload.host,
    reason: a.reason ?? a.no_events_reason,
    stats: a,
    created_at: new Date().toISOString(),
  });

  const events = (payload.observatory?.next_events as BoardEventRow[] | undefined) ?? [];
  for (const row of events) {
    const eventId = String(row.event_id ?? "");
    if (!eventId) continue;
    store.upsertBoardEvent({
      event_id: eventId,
      published_at: payload.published_at,
      bucket: String(row.bucket ?? "DISCOVERED"),
      payload: row,
    });
  }
}

export async function publishRuntimeStatus(
  payload: BetMindRuntimePayload = buildRuntimePayloadFromLocal(),
): Promise<
  | { ok: true; published_at: string; board: number; remote: RemotePushResult }
  | { ok: false; error: string }
> {
  try {
    const store = storage();
    await ensureRuntimeTables();
    const publishedAt = payload.published_at;
    store.publishRuntime(payload, publishedAt);
    try {
      await persistCycleAndBoard(payload);
    } catch (boardErr) {
      console.warn(
        "[runtime-publish] board/cycle persist failed (heartbeat row already written):",
        boardErr instanceof Error ? boardErr.message : boardErr,
      );
    }
    try {
      const { mirrorDossiersToStore } = await import("@/domain/eval/betmind-runtime/dossier");
      const root = permanentRoot044();
      if (localLabStorePresent(root)) {
        await mirrorDossiersToStore(root, { limit: 150 });
      }
    } catch {
      /* dossier mirror optional — board publish must still succeed */
    }
    const board = ((payload.observatory?.next_events as unknown[]) ?? []).length;
    const remote = await pushRuntimeToRemoteIngest(payload);
    if (!remote.pushed && remote.reason && remote.reason !== "local_only") {
      console.warn("[runtime-publish] remote ingest failed:", remote.reason);
    }
    return { ok: true, published_at: publishedAt, board, remote };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function loadedFromRecord(
  published_at: string,
  payload: BetMindRuntimePayload,
  nowMs: number,
  staleMs: number,
): LoadedRuntimeStatus {
  const { age_ms, fresh } = remoteFreshness(published_at, nowMs, staleMs);
  return { published_at, age_ms, fresh, payload };
}

export async function loadRuntimeStatus(
  nowMs = Date.now(),
  staleMs = RUNTIME_STALE_MS,
): Promise<LoadedRuntimeStatus | null> {
  try {
    const root = permanentRoot044();
    if (localLabStorePresent(root)) {
      const row = storage().loadRuntime();
      if (row?.payload) {
        const payload = row.payload as BetMindRuntimePayload;
        const published_at = row.published_at || payload.published_at;
        return loadedFromRecord(published_at, payload, nowMs, staleMs);
      }
    }
    const remote = await readRemoteMirror();
    if (!remote?.payload) return null;
    const published_at = remote.published_at || remote.payload.published_at;
    return loadedFromRecord(published_at, remote.payload, nowMs, staleMs);
  } catch {
    return null;
  }
}

let lastPublishMs = 0;
let publishInFlight = false;

function buildHeartbeatComponents(root = permanentRoot044()): {
  host: string;
  store_present_local: boolean;
  components: BetMindRemoteComponents;
  detail: Record<string, unknown>;
  health053: Record<string, unknown>;
} {
  const base = buildHealthPayload053(root);
  const system = base.system as {
    supervisor_alive?: boolean | null;
    worker_alive?: boolean | null;
    official_status?: string | null;
    heartbeat_age_ms?: number | null;
    last_cycle_at?: string | null;
    last_priority?: string | null;
    worker_pid?: number | null;
  };
  const brain = base.brain as { status?: string; cycles_completed?: number };
  const brainStatus = String(brain?.status ?? (base.system as { status?: string }).status ?? "UNKNOWN");
  const brainLabel = /HEALTHY|RUN|WORKING/i.test(brainStatus)
    ? "ONLINE"
    : /DEAD|STOPPED/i.test(brainStatus)
      ? "OFFLINE"
      : /DEGRADED|PAUSED|RECOVER|IDLE/i.test(brainStatus)
        ? "DEGRADED"
        : "UNKNOWN";
  const storePresent = localLabStorePresent(root);
  return {
    host: hostname(),
    store_present_local: storePresent,
    components: {
      supervisor: statusFromAlive(system.supervisor_alive),
      worker: statusFromAlive(system.worker_alive),
      brain: brainLabel,
      predictive_engine: "UNKNOWN",
      data_pipeline: storePresent ? "ONLINE" : "OFFLINE",
      settlement: "UNKNOWN",
      learning: "UNKNOWN",
    },
    detail: {
      official_status: system.official_status ?? null,
      heartbeat_age_ms: system.heartbeat_age_ms ?? null,
      last_cycle_at: system.last_cycle_at ?? null,
      last_priority: system.last_priority ?? null,
      brain_status: brainStatus,
      cycles_completed: brain?.cycles_completed ?? null,
      store_present: storePresent,
      store_present_local_on_publisher: storePresent,
      mirror: "filesystem",
      host: hostname(),
      worker_pid: system.worker_pid ?? null,
      heartbeat_kind: "touch",
    },
    health053: base as unknown as Record<string, unknown>,
  };
}

/**
 * Cheap liveness touch: refresh published_at + components without rebuilding the
 * event board. Keeps last next_events so Vercel Eventi does not go empty mid-cycle.
 * First row still needs a full publishRuntimeStatus().
 */
export async function publishRuntimeHeartbeat(): Promise<
  | { ok: true; published_at: string; board: number; heartbeat: true; remote: RemotePushResult }
  | { ok: false; error: string }
> {
  try {
    const existing = await loadRuntimeStatus(Date.now(), Number.POSITIVE_INFINITY);
    if (!existing) {
      const full = await publishRuntimeStatus();
      if (!full.ok) return full;
      return {
        ok: true,
        published_at: full.published_at,
        board: full.board,
        heartbeat: true,
        remote: full.remote,
      };
    }
    const patch = buildHeartbeatComponents();
    const published_at = new Date().toISOString();
    const prevDetail = (existing.payload.detail ?? {}) as Record<string, unknown>;
    const merged: BetMindRuntimePayload = {
      ...existing.payload,
      published_at,
      host: patch.host,
      store_present_local: patch.store_present_local,
      components: {
        ...existing.payload.components,
        ...patch.components,
        predictive_engine: existing.payload.components.predictive_engine,
        settlement: existing.payload.components.settlement,
        learning: existing.payload.components.learning,
      },
      detail: {
        ...prevDetail,
        ...patch.detail,
        predictive_engine: prevDetail.predictive_engine,
        model_independent: prevDetail.model_independent,
        model_version: prevDetail.model_version,
      },
      health053: {
        ...existing.payload.health053,
        ...patch.health053,
      },
    };
    storage().publishRuntime(merged, published_at);
    const board = ((merged.observatory?.next_events as unknown[]) ?? []).length;
    const remote = await pushRuntimeToRemoteIngest(merged);
    if (!remote.pushed && remote.reason && remote.reason !== "local_only") {
      console.warn("[runtime-publish] remote heartbeat failed:", remote.reason);
    }
    return { ok: true, published_at, board, heartbeat: true, remote };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function rowsToBoardEvents(
  rows: { event_id?: string; bucket?: string; payload?: unknown }[],
): unknown[] {
  const events: unknown[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const payload =
      typeof row.payload === "string"
        ? (JSON.parse(row.payload) as Record<string, unknown>)
        : ((row.payload ?? {}) as Record<string, unknown>);
    const eventId = String(row.event_id || payload.event_id || "");
    if (!eventId || seen.has(eventId)) continue;
    seen.add(eventId);
    events.push({
      ...payload,
      event_id: eventId,
      bucket: row.bucket ?? payload.bucket ?? null,
    });
  }
  return events;
}

export async function loadBoardEventsFromStore(q: {
  date?: string | null;
  from?: string | null;
  to?: string | null;
  sport?: string | null;
}): Promise<{ events: unknown[]; total: number } | null> {
  try {
    const root = permanentRoot044();
    const rows = localLabStorePresent(root) ? storage().loadBoardEvents() : [];
    let events = rowsToBoardEvents(rows);
    if (!events.length) {
      const remote = await readRemoteMirror();
      if (remote?.board_events?.length) {
        events = rowsToBoardEvents(remote.board_events);
      } else if (Array.isArray(remote?.payload?.observatory?.next_events)) {
        events = remote.payload.observatory.next_events as unknown[];
      }
    }
    if (!events.length && !rows.length) return null;
    const filtered = events.filter((e) =>
      matchesCalendarQuery(e as { calendar_day?: string; kickoff_utc?: string; sport?: string }, q),
    );
    return { events: filtered, total: filtered.length };
  } catch {
    return null;
  }
}

/** @deprecated name kept for call sites — reads filesystem, not Neon. */
export const loadBoardEventsFromNeon = loadBoardEventsFromStore;

/** Debounced fire-and-forget heartbeat (worker sleep / mid-cycle). Never throws. */
export function schedulePublishRuntimeStatus(minIntervalMs = 30_000): void {
  const now = Date.now();
  if (publishInFlight || now - lastPublishMs < minIntervalMs) return;
  publishInFlight = true;
  void publishRuntimeHeartbeat()
    .then((r) => {
      if (r.ok) lastPublishMs = Date.now();
      else console.warn("[runtime-publish] heartbeat failed:", r.error);
    })
    .catch((e) => {
      console.warn("[runtime-publish] heartbeat exception:", e instanceof Error ? e.message : e);
    })
    .finally(() => {
      publishInFlight = false;
    });
}

/** Awaited full publish after a real cycle — preferred over debounce. */
export async function publishRuntimeStatusNow(): Promise<
  | { ok: true; published_at: string; board: number; remote: RemotePushResult }
  | { ok: false; error: string }
> {
  const result = await publishRuntimeStatus();
  if (result.ok) lastPublishMs = Date.now();
  return result;
}
