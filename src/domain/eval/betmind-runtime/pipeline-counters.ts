/**
 * Honest pipeline counters — never call prediction-row presence "analyzed/inferred".
 * Legacy EVENTS_ANALYZED = unique event_id in predictions.jsonl (often INSUFFICIENT).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { catalogueById } from "@/domain/eval/data-intelligence/research/source-catalogue";
import { loadResearchQueue, queueCounts } from "@/domain/eval/data-intelligence/research/queue";
import { RESEARCH_BUDGET_PER_CYCLE } from "@/domain/eval/data-intelligence/research/orchestrator";
import { hasIndependentModel } from "@/domain/eval/permanent-044/prediction-precedence";
import {
  loadAllResearchObservations,
  summarizeObservations,
} from "@/domain/eval/data-intelligence/research/data-yield";

export type PipelineCounters3d = {
  events_discovered: number;
  events_with_research: number;
  events_eligible: number;
  model_inferences: number;
  predictions_produced: number;
  /** Unique events with ≥1 prediction row (legacy EVENTS_ANALYZED — NOT inference). */
  predictions_persisted_events: number;
  insufficient_data: number;
  no_independent_features: number;
  no_independent_model: number;
  features_too_sparse: number;
  skipped: number;
  events_with_multi_research_sources: number;
  events_queued: number;
  events_researched: number;
  research_budget_per_cycle: number;
  sources_attempted_today: number;
  data_acquired_today: number;
  sources_blocked_today: number;
  sources_missing_adapter_today: number;
  events_with_real_event_data: number;
  events_with_historical_data: number;
  real_observations: number;
  historical_observations: number;
  derived_observations: number;
  missing_features_estimate: number;
  data_yield: number;
  /** Explicit: what the old "analyzed" counter meant. */
  legacy_analyzed_meaning: string;
};

function readJsonl(path: string): Record<string, unknown>[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\n/)
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l.replace(/^\uFEFF/, "")) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Record<string, unknown>[];
}

function latestByEvent(rows: Record<string, unknown>[]): Map<string, Record<string, unknown>> {
  const by = new Map<string, Record<string, unknown>>();
  const hasModel = (p: Record<string, unknown>) =>
    Boolean(p.probability_model && typeof p.probability_model === "object");
  for (const p of rows) {
    const id = String(p.event_id ?? "");
    if (!id) continue;
    const prev = by.get(id);
    if (!prev) {
      by.set(id, p);
      continue;
    }
    const ts = String(p.timestamp ?? "");
    const prevTs = String(prev.timestamp ?? "");
    if (ts > prevTs) {
      by.set(id, p);
      continue;
    }
    if (ts < prevTs) continue;
    // Same timestamp: prefer real independent inference over null placeholder
    if (hasModel(p) && !hasModel(prev)) by.set(id, p);
    else if (hasModel(p) === hasModel(prev)) {
      // Prefer INDEPENDENT model version over NO_INDEPENDENT / market-only
      const score = (x: Record<string, unknown>) => {
        const mv = String(x.model_version ?? "");
        if (mv.includes("INDEPENDENT") && !mv.includes("NO_INDEPENDENT")) return 2;
        if (hasModel(x)) return 1;
        return 0;
      };
      if (score(p) > score(prev)) by.set(id, p);
    }
  }
  return by;
}

function hasCode(p: Record<string, unknown>, code: string): boolean {
  return ((p.reason_codes as string[]) ?? []).includes(code);
}

/** Market-layer sources never count as independent research observations. */
function isIndependentResearchSource(sourceId: string): boolean {
  const cat = catalogueById(sourceId);
  if (cat?.market_layer) return false;
  if (sourceId === "the-odds-api") return false;
  return true;
}

/**
 * Compute Control Center pipeline counters from Lab B disk.
 */
export function computePipelineCounters3d(root = permanentRoot044()): PipelineCounters3d {
  const events = readJsonl(join(root, "events.jsonl"));
  const preds = readJsonl(join(root, "predictions.jsonl"));
  const research = readJsonl(join(root, "research-status.jsonl"));
  const latest = latestByEvent(preds);
  const latestRows = [...latest.values()];

  const withModel = latestRows.filter((p) =>
    hasIndependentModel({
      probability_model: p.probability_model as Record<string, number> | null,
      model_version: String(p.model_version ?? ""),
      reason_codes: (p.reason_codes as string[]) ?? [],
    }),
  );

  /** Eligible = had non-null independent model probability (strict). */
  const eligible = withModel.length;

  const researchOk = new Map<string, Set<string>>();
  for (const r of research) {
    const id = String(r.event_id ?? "");
    if (!id || id === "batch") continue;
    const sid = String(r.source_id);
    if (!isIndependentResearchSource(sid)) continue;
    // Real observation: fetch attempted with OK/BLOCKED (HTTP truth) — not DENIED/MISSING stubs
    const real =
      (r.fetched === true &&
        (r.ok === true || r.phase === "OK" || r.phase === "BLOCKED" || r.phase === "UNAVAILABLE")) ||
      r.ok === true;
    if (!real) continue;
    if (!researchOk.has(id)) researchOk.set(id, new Set());
    researchOk.get(id)!.add(sid);
  }

  const insufficient = latestRows.filter((p) => hasCode(p, "INSUFFICIENT_DATA")).length;
  const noFeat = latestRows.filter((p) => hasCode(p, "NO_INDEPENDENT_FEATURES")).length;
  const noModel = latestRows.filter((p) => hasCode(p, "NO_INDEPENDENT_MODEL")).length;
  const sparse = latestRows.filter((p) => hasCode(p, "FEATURES_TOO_SPARSE")).length;

  const skipped = latestRows.filter(
    (p) =>
      !p.probability_model ||
      hasCode(p, "INSUFFICIENT_DATA") ||
      hasCode(p, "NO_INDEPENDENT_MODEL") ||
      hasCode(p, "NO_INDEPENDENT_FEATURES"),
  ).length;

  const q = queueCounts(loadResearchQueue(root), Date.now());
  const today = new Date().toISOString().slice(0, 10);
  const todayRows = research.filter((r) => String(r.at ?? "").slice(0, 10) === today);
  const yieldSum = summarizeObservations(loadAllResearchObservations(root), todayRows.length);
  const uniq = (pred: (r: Record<string, unknown>) => boolean) =>
    new Set(todayRows.filter(pred).map((r) => String(r.source_id))).size;

  return {
    events_discovered: events.length,
    events_with_research: researchOk.size,
    events_eligible: eligible,
    model_inferences: withModel.length,
    /** Successful independent inferences only — not insufficient placeholder rows. */
    predictions_produced: withModel.length,
    predictions_persisted_events: latest.size,
    insufficient_data: insufficient,
    no_independent_features: noFeat,
    no_independent_model: noModel,
    features_too_sparse: sparse,
    skipped,
    events_with_multi_research_sources: [...researchOk.values()].filter((s) => s.size >= 2).length,
    events_queued: q.queued,
    events_researched: q.researched,
    research_budget_per_cycle: RESEARCH_BUDGET_PER_CYCLE,
    sources_attempted_today: uniq(
      (r) =>
        r.fetched === true ||
        r.phase === "OK" ||
        r.phase === "BLOCKED" ||
        r.phase === "UNAVAILABLE" ||
        r.adapter_kind === "CACHE_ONLY" ||
        r.adapter_kind === "PRODUCTION_ADAPTER" ||
        r.adapter_kind === "TEST_PROBE",
    ),
    data_acquired_today: uniq(
      (r) => r.ok === true && Array.isArray(r.fields_extracted) && (r.fields_extracted as unknown[]).length > 0,
    ),
    sources_blocked_today: uniq((r) => r.phase === "BLOCKED" || r.http_status === 403),
    sources_missing_adapter_today: uniq(
      (r) => r.phase === "MISSING_ADAPTER" || r.adapter_kind === "MISSING_ADAPTER",
    ),
    events_with_real_event_data: yieldSum.events_with_real_event_data,
    events_with_historical_data: yieldSum.events_with_historical_data,
    real_observations: yieldSum.real_event_observations,
    historical_observations: yieldSum.historical_observations,
    derived_observations: yieldSum.derived_observations,
    missing_features_estimate: Math.max(0, latest.size * 8 - yieldSum.model_eligible_observations),
    data_yield: yieldSum.data_yield,
    legacy_analyzed_meaning:
      "Unique event_id with ≥1 predictions.jsonl row. Includes INSUFFICIENT_DATA / null probability_model. Does NOT mean independent model inference.",
  };
}
