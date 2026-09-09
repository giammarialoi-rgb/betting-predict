import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildControlCenter047, enhanceEventDetail047 } from "@/domain/eval/factory-047/control";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { loadModelState048, MODEL_V2_048 } from "@/domain/eval/factory-048/config";
import type { DecisionRecord048 } from "@/domain/eval/factory-048/decision";
import type { Autopsy048 } from "@/domain/eval/factory-048/autopsy";
import { buildRankings048 } from "@/domain/eval/factory-048/ranking";
import type { DecisionMetrics048 } from "@/domain/eval/factory-048/metrics";

function readJsonlDecisions(root: string): DecisionRecord048[] {
  const p = join(root, "decisions.jsonl");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split(/\n/)
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l) as DecisionRecord048;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as DecisionRecord048[];
}

function readAutopsies048(root: string): Autopsy048[] {
  const p = join(root, "autopsies-048.jsonl");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split(/\n/)
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l) as Autopsy048;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Autopsy048[];
}

function loadMetrics(root: string): DecisionMetrics048 | null {
  const p = join(root, "decision-metrics.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as DecisionMetrics048;
}

/** Disk-only Control Center extension for TASK 048. */
export function buildControlCenter048(nowIso = new Date().toISOString()) {
  const base = buildControlCenter047(nowIso);
  const root = permanentRoot044();
  const store = loadStore044(root);
  const decisions = readJsonlDecisions(root);
  const latest = new Map<string, DecisionRecord048>();
  for (const d of decisions) {
    const prev = latest.get(d.event_id);
    if (!prev || d.timestamp >= prev.timestamp) latest.set(d.event_id, d);
  }
  const vals = [...latest.values()];
  const rankings = buildRankings048(store, decisions);
  const metrics = loadMetrics(root);
  const model = loadModelState048(root);
  const patterns = existsSync(join(root, "error-patterns.json"))
    ? (JSON.parse(readFileSync(join(root, "error-patterns.json"), "utf8")) as {
        patterns?: { pattern: string; occurrences: number; status: string }[];
      }).patterns ?? []
    : [];

  return {
    ...base,
    decision_048: {
      model_version: model.current || MODEL_V2_048,
      parent_model: model.parent,
      auto_promotion: false as const,
      capital: "CLOSED" as const,
      metrics: metrics ?? {
        TOTAL_ANALYZED: vals.length,
        NO_BET: vals.filter((d) => d.decision === "NO_BET").length,
        BET_CANDIDATE: vals.filter((d) => d.decision === "BET_CANDIDATE").length,
        STRONG_CANDIDATE: vals.filter((d) => d.decision === "STRONG_CANDIDATE").length,
        SETTLED: store.settlements.length,
        CORRECT: 0,
        WRONG: 0,
        MODEL_EDGE: "UNKNOWN" as const,
        note: "metrics pending first engine cycle",
      },
      rankings,
      bet_candidates: vals.filter((d) => d.decision === "BET_CANDIDATE").slice(0, 20),
      strong_candidates: vals.filter((d) => d.decision === "STRONG_CANDIDATE").slice(0, 20),
      watchlist: rankings.TOP_WATCHLIST,
      no_bet_explanations: vals
        .filter((d) => d.decision === "NO_BET")
        .slice(0, 15)
        .map((d) => ({
          event_id: d.event_id,
          why: d.explanation.WHY_NO_BET ?? d.explanation.WHY_PRIMARY,
          codes: d.decision_reason_codes,
        })),
      learning_status: {
        learning_cases: patterns.reduce((a, p) => a + (p.occurrences || 0), 0) || vals.length * 0,
        error_patterns: patterns.slice(0, 15),
        observation_only: true as const,
      },
      why_performance: metrics?.why_performance ?? [],
    },
  };
}

export type ControlCenter048 = ReturnType<typeof buildControlCenter048>;

export function enhanceEventDetail048(store: ReturnType<typeof loadStore044>, id: string) {
  const base = enhanceEventDetail047(store, id);
  if (!base) return null;
  const root = store.root;
  const decisions = readJsonlDecisions(root).filter((d) => d.event_id === id || store.events.find((e) => e.event_id === id)?.event_id === d.event_id);
  const ev = store.events.find((e) => e.event_id === id || e.canonical_event_id === id);
  if (!ev) return null;
  const decs = decisions.filter((d) => d.event_id === ev.event_id);
  const latest = decs.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] ?? null;
  const autopsy = readAutopsies048(root).filter((a) => a.event_id === ev.event_id).at(-1) ?? null;

  const timeline = [
    { phase: "DISCOVERED", done: true, at: ev.first_seen_at ?? ev.collected_at_utc },
    { phase: "ANALYZED", done: Boolean(latest), at: latest?.timestamp ?? null },
    { phase: "SNAPSHOTS", done: store.quotes.some((q) => q.event_id === ev.event_id), at: null },
    { phase: "PREDICTION", done: store.predictions.some((p) => p.event_id === ev.event_id), at: latest?.timestamp ?? null },
    {
      phase: "LOCK",
      done: store.lockEventIds.has(ev.event_id),
      at: store.locks.find((l) => l.event_id === ev.event_id)?.lock_timestamp ?? null,
    },
    { phase: "POST_LOCK", done: false, at: null },
    {
      phase: "KICKOFF",
      done: ev.kickoff_utc ? Date.parse(ev.kickoff_utc) <= Date.now() : false,
      at: ev.kickoff_utc,
    },
    {
      phase: "SETTLEMENT",
      done: store.settlements.some((s) => s.event_id === ev.event_id),
      at: store.settlements.find((s) => s.event_id === ev.event_id)?.settled_at ?? null,
    },
    { phase: "AUTOPSY", done: Boolean(autopsy), at: autopsy?.created_at ?? null },
    { phase: "LEARNING", done: Boolean(autopsy?.prediction_correct === false), at: null },
  ];

  return {
    ...base,
    decision_048: latest,
    autopsy_048: autopsy,
    decision_timeline: timeline,
    autopsy_ui: autopsy
      ? {
          PREVISIONE: autopsy.predicted_outcome,
          RISULTATO: autopsy.actual_outcome,
          E_ANDATA_COME_PREVISTO: autopsy.prediction_correct === true ? "YES" : autopsy.prediction_correct === false ? "NO" : "—",
          RAGIONAMENTO_CORRETTO: autopsy.reasoning_supported,
          OUTCOME_CLASS: autopsy.outcome_reasoning_class,
          ERROR_LABELS: autopsy.error_labels,
          THEORETICAL_EDGE: autopsy.theoretical_edge_at_lock,
          capital_note: autopsy.capital_note,
        }
      : null,
  };
}
