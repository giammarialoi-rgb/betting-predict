import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Autopsy048, BackwardFinding048 } from "@/domain/eval/factory-048/autopsy";
import type { DecisionRecord048 } from "@/domain/eval/factory-048/decision";
import type { PermanentPrediction044, PermanentSettlement044 } from "@/domain/eval/permanent-044/types";
import { appendJsonl044 } from "@/domain/eval/permanent-044/store";

export type LearningCase048 = {
  learning_case_id: string;
  event_id: string;
  error_type: string[];
  original_prediction: string | null;
  actual_result: string;
  signals_present: string[];
  signals_ignored: string[];
  signals_wrong: string[];
  missing_information: string[];
  hypothesis: string;
  recommended_model_change: string;
  confidence: number;
  created_at: string;
  status: "OBSERVATION_ONLY";
  auto_applied: false;
};

export type Counterfactual048 = {
  event_id: string;
  prediction_id: string;
  OBSERVED_DECISION: string;
  COUNTERFACTUAL_DECISION: string;
  would_have_won: boolean | null;
  note: string;
  capital: "CLOSED";
  info_class: "POST_EVENT_ANALYSIS";
};

export type ErrorPattern048 = {
  pattern_id: string;
  pattern: string;
  occurrences: number;
  losses: number | null;
  confidence: "low" | "medium" | "high";
  status: "INSUFFICIENT_N" | "OBSERVATION_ONLY";
  first_seen: string;
  last_seen: string;
};

export function learningCase048(input: {
  autopsy: Autopsy048;
  backward: BackwardFinding048;
  nowIso: string;
}): LearningCase048 | null {
  if (input.autopsy.prediction_correct !== false) return null;
  return {
    learning_case_id: createHash("sha256")
      .update(`lc048|${input.autopsy.autopsy_id}`)
      .digest("hex")
      .slice(0, 24),
    event_id: input.autopsy.event_id,
    error_type: input.autopsy.error_labels,
    original_prediction: input.autopsy.predicted_outcome,
    actual_result: input.autopsy.actual_outcome,
    signals_present: input.backward.SIGNAL_VALUE ? [input.backward.signal] : [],
    signals_ignored:
      input.backward.availability === "AVAILABLE_BUT_IGNORED" ? [input.backward.signal] : [],
    signals_wrong:
      input.backward.availability === "AVAILABLE_BUT_MISINTERPRETED" ? [input.backward.signal] : [],
    missing_information:
      input.backward.availability === "NOT_AVAILABLE" ? ["NO_PRE_EVENT_SIGNAL_FOUND"] : [],
    hypothesis:
      input.backward.SIGNAL_VALUE != null
        ? `Possibile segnale pre-lock ignorato: ${input.backward.signal}=${input.backward.SIGNAL_VALUE}`
        : "Nessun segnale pre-lock identificabile — non modificare pesi",
    recommended_model_change: "Review only — no auto weight change",
    confidence: input.backward.SIGNAL_VALUE ? 0.35 : 0.15,
    created_at: input.nowIso,
    status: "OBSERVATION_ONLY",
    auto_applied: false,
  };
}

export function counterfactual048(input: {
  decision: DecisionRecord048;
  prediction: PermanentPrediction044;
  settlement: PermanentSettlement044;
}): Counterfactual048 {
  const observed = input.decision.decision;
  const alt = observed === "NO_BET" ? "BET_CANDIDATE" : "NO_BET";
  let would: boolean | null = null;
  if (observed === "NO_BET" && input.prediction.selection) {
    const a = input.settlement.result.toUpperCase();
    const s = input.prediction.selection.toUpperCase();
    would = a.includes(s) || s.includes(a.split("-")[0] ?? "");
  }
  return {
    event_id: input.decision.event_id,
    prediction_id: input.prediction.prediction_id,
    OBSERVED_DECISION: observed,
    COUNTERFACTUAL_DECISION: alt,
    would_have_won: would,
    note: "Counterfactual only — not a real bet; CAPITAL CLOSED",
    capital: "CLOSED",
    info_class: "POST_EVENT_ANALYSIS",
  };
}

export function aggregateErrorPatterns048(
  cases: LearningCase048[],
  nowIso: string,
): ErrorPattern048[] {
  const map = new Map<string, { n: number; first: string; last: string }>();
  for (const c of cases) {
    for (const t of c.error_type.length ? c.error_type : ["OTHER"]) {
      const prev = map.get(t);
      if (!prev) map.set(t, { n: 1, first: c.created_at, last: c.created_at });
      else {
        prev.n += 1;
        if (c.created_at < prev.first) prev.first = c.created_at;
        if (c.created_at > prev.last) prev.last = c.created_at;
      }
    }
  }
  const out: ErrorPattern048[] = [];
  for (const [pattern, v] of map) {
    out.push({
      pattern_id: createHash("sha256").update(`pat048|${pattern}`).digest("hex").slice(0, 12),
      pattern,
      occurrences: v.n,
      losses: v.n,
      confidence: v.n < 5 ? "low" : v.n < 20 ? "medium" : "high",
      status: v.n < 20 ? "INSUFFICIENT_N" : "OBSERVATION_ONLY",
      first_seen: v.first,
      last_seen: v.last,
    });
  }
  if (!out.length) {
    out.push({
      pattern_id: "none",
      pattern: "NO_LEARNING_CASES_YET",
      occurrences: 0,
      losses: null,
      confidence: "low",
      status: "INSUFFICIENT_N",
      first_seen: nowIso,
      last_seen: nowIso,
    });
  }
  return out;
}

export function writeErrorPatterns048(root: string, patterns: ErrorPattern048[], nowIso: string): void {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "error-patterns.json"), JSON.stringify({ at: nowIso, patterns }, null, 2));
}

export function appendLearningCase048(root: string, c: LearningCase048): void {
  appendJsonl044(join(root, "learning-cases.jsonl"), { kind: "LEARNING_CASE_048", ...c });
}

export function loadLearningCases048(root: string): LearningCase048[] {
  const p = join(root, "learning-cases.jsonl");
  if (!existsSync(p)) return [];
  const out: LearningCase048[] = [];
  for (const line of readFileSync(p, "utf8").split(/\n/).filter(Boolean)) {
    try {
      const j = JSON.parse(line) as LearningCase048 & { kind?: string; learning_case_id?: string };
      if (j.learning_case_id || j.kind === "LEARNING_CASE_048") out.push(j as LearningCase048);
    } catch {
      /* skip */
    }
  }
  return out;
}
