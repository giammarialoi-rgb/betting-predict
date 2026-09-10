/**
 * Honest pipeline counters — never call prediction-row presence "analyzed/inferred".
 * Legacy EVENTS_ANALYZED = unique event_id in predictions.jsonl (often INSUFFICIENT).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { catalogueById } from "@/domain/eval/data-intelligence/research/source-catalogue";

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
  for (const p of rows) {
    const id = String(p.event_id ?? "");
    if (!id) continue;
    const prev = by.get(id);
    if (!prev || String(p.timestamp ?? "") >= String(prev.timestamp ?? "")) by.set(id, p);
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

  const withModel = latestRows.filter(
    (p) => p.probability_model && typeof p.probability_model === "object",
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

  return {
    events_discovered: events.length,
    events_with_research: researchOk.size,
    events_eligible: eligible,
    model_inferences: withModel.length,
    predictions_produced: preds.length,
    predictions_persisted_events: latest.size,
    insufficient_data: insufficient,
    no_independent_features: noFeat,
    no_independent_model: noModel,
    features_too_sparse: sparse,
    skipped,
    events_with_multi_research_sources: [...researchOk.values()].filter((s) => s.size >= 2).length,
    legacy_analyzed_meaning:
      "Unique event_id with ≥1 predictions.jsonl row. Includes INSUFFICIENT_DATA / null probability_model. Does NOT mean independent model inference.",
  };
}
