/**
 * Mirror Lab B runtime + analysis board to Neon for Vercel Control Center.
 * Stale heartbeats stay OFFLINE — never invent alive state or fake predictions.
 */
import { neon } from "@neondatabase/serverless";
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
import { listCalendarEvents, todayCalendarDay } from "@/domain/eval/betmind-runtime/calendar";
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
  const calendar = storePresent
    ? listCalendarEvents({ root, date: today, sport: "football" })
    : { day: today, total: 0, events: [] };
  const next_events = storePresent
    ? listCalendarEvents({ root, sport: "ALL" }).events
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
      mirror: "neon",
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
      analysis,
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
      analysis: analysisLabeled,
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
  const sql = sqlClient();
  if (!sql) return false;
  await sql`
    CREATE TABLE IF NOT EXISTS betmind_runtime_status (
      id text PRIMARY KEY DEFAULT 'default',
      published_at timestamptz NOT NULL DEFAULT now(),
      payload jsonb NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS betmind_analysis_cycles (
      id bigserial PRIMARY KEY,
      cycle_at timestamptz NOT NULL,
      cycle_number integer,
      priority text,
      idle boolean NOT NULL DEFAULT false,
      events_in_store integer,
      events_analyzed integer,
      predictions_produced integer,
      decisions_on_board integer,
      skipped integer,
      model_version text,
      host text,
      reason text,
      stats jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS betmind_board_events (
      event_id text PRIMARY KEY,
      published_at timestamptz NOT NULL,
      bucket text,
      payload jsonb NOT NULL
    )
  `;
  return true;
}

async function persistCycleAndBoard(payload: BetMindRuntimePayload): Promise<void> {
  const sql = sqlClient();
  if (!sql) return;
  const a = payload.analysis;
  await sql`
    INSERT INTO betmind_analysis_cycles (
      cycle_at, cycle_number, priority, idle,
      events_in_store, events_analyzed, predictions_produced, decisions_on_board,
      skipped, model_version, host, reason, stats
    ) VALUES (
      ${a.last_cycle_at ?? payload.published_at}::timestamptz,
      ${a.cycle_number},
      ${a.priority},
      ${a.idle},
      ${a.events_in_store},
      ${a.events_analyzed},
      ${a.predictions_produced},
      ${a.decisions_on_board},
      ${a.skipped},
      ${a.model_version},
      ${payload.host},
      ${a.reason ?? a.no_events_reason},
      ${JSON.stringify(a)}::jsonb
    )
  `;

  const events = (payload.observatory?.next_events as BoardEventRow[] | undefined) ?? [];
  for (const row of events) {
    const eventId = String(row.event_id ?? "");
    if (!eventId) continue;
    const bucket = String(row.bucket ?? "DISCOVERED");
    await sql`
      INSERT INTO betmind_board_events (event_id, published_at, bucket, payload)
      VALUES (${eventId}, ${payload.published_at}::timestamptz, ${bucket}, ${JSON.stringify(row)}::jsonb)
      ON CONFLICT (event_id) DO UPDATE
      SET published_at = EXCLUDED.published_at,
          bucket = EXCLUDED.bucket,
          payload = EXCLUDED.payload
    `;
  }
}

export async function publishRuntimeStatus(
  payload: BetMindRuntimePayload = buildRuntimePayloadFromLocal(),
): Promise<{ ok: true; published_at: string; board: number } | { ok: false; error: string }> {
  try {
    const sql = sqlClient();
    if (!sql) return { ok: false, error: "DATABASE_URL is not set" };
    await ensureRuntimeTables();
    const publishedAt = payload.published_at;
    await sql`
      INSERT INTO betmind_runtime_status (id, published_at, payload)
      VALUES (${RUNTIME_STATUS_ID}, ${publishedAt}::timestamptz, ${JSON.stringify(payload)}::jsonb)
      ON CONFLICT (id) DO UPDATE
      SET published_at = EXCLUDED.published_at,
          payload = EXCLUDED.payload
    `;
    await persistCycleAndBoard(payload);
    // Keep event dossiers in sync with the board so Vercel detail pages do not 404
    try {
      const { mirrorDossiersToNeon } = await import("@/domain/eval/betmind-runtime/dossier");
      const root = permanentRoot044();
      if (existsSync(join(root, "events.jsonl"))) {
        await mirrorDossiersToNeon(root, { limit: 150 });
      }
    } catch {
      /* dossier mirror optional — board publish must still succeed */
    }
    const board = ((payload.observatory?.next_events as unknown[]) ?? []).length;
    return { ok: true, published_at: publishedAt, board };
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
export function schedulePublishRuntimeStatus(minIntervalMs = 30_000): void {
  const now = Date.now();
  if (publishInFlight || now - lastPublishMs < minIntervalMs) return;
  if (!process.env.DATABASE_URL) return;
  publishInFlight = true;
  void publishRuntimeStatus()
    .then((r) => {
      if (r.ok) lastPublishMs = Date.now();
    })
    .catch(() => {
      /* swallow */
    })
    .finally(() => {
      publishInFlight = false;
    });
}

/** Awaited publish after a real cycle — preferred over debounce. */
export async function publishRuntimeStatusNow(): Promise<
  { ok: true; published_at: string; board: number } | { ok: false; error: string }
> {
  if (!process.env.DATABASE_URL) return { ok: false, error: "DATABASE_URL is not set" };
  const result = await publishRuntimeStatus();
  if (result.ok) lastPublishMs = Date.now();
  return result;
}
