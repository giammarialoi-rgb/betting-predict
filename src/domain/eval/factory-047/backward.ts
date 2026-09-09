import { createHash } from "node:crypto";
import { join } from "node:path";
import type { PermanentPrediction044, PermanentAutopsy044 } from "@/domain/eval/permanent-044/types";
import { appendJsonl044, type Store044 } from "@/domain/eval/permanent-044/store";

export type BackwardSearch047 = {
  event_id: string;
  autopsy_id: string;
  SIGNAL_FOUND: boolean;
  SIGNAL_TIMESTAMP: string | null;
  SIGNAL_VALUE: string | null;
  SIGNAL_DIRECTION: string | null;
  SIGNAL_STRENGTH: number | null;
  note: string;
  info_class: "POST_EVENT_ANALYSIS";
};

/** Search only pre-LOCK observations. Never use result to invent signals. */
export function backwardSearch047(input: {
  store: Store044;
  prediction: PermanentPrediction044;
  autopsy: PermanentAutopsy044;
  lockTime: string | null;
}): BackwardSearch047 {
  const lockMs = input.lockTime ? Date.parse(input.lockTime) : null;
  const preQuotes = input.store.quotes.filter((q) => {
    if (q.event_id !== input.prediction.event_id || !q.available_at_utc) return false;
    if (lockMs == null) return true;
    const t = Date.parse(q.available_at_utc);
    return Number.isFinite(t) && t <= lockMs;
  });

  if (preQuotes.length < 2) {
    return {
      event_id: input.prediction.event_id,
      autopsy_id: input.autopsy.autopsy_id,
      SIGNAL_FOUND: false,
      SIGNAL_TIMESTAMP: null,
      SIGNAL_VALUE: null,
      SIGNAL_DIRECTION: null,
      SIGNAL_STRENGTH: null,
      note: "NO_PRE_EVENT_SIGNAL_FOUND",
      info_class: "POST_EVENT_ANALYSIS",
    };
  }

  // Simple dispersion signal among pre-lock books for same selection
  const bySel = new Map<string, number[]>();
  for (const q of preQuotes) {
    const arr = bySel.get(q.selection) ?? [];
    arr.push(q.price);
    bySel.set(q.selection, arr);
  }
  let bestSel: string | null = null;
  let bestDisp = -1;
  for (const [sel, prices] of bySel) {
    if (prices.length < 2) continue;
    const mn = Math.min(...prices);
    const mx = Math.max(...prices);
    const d = mx - mn;
    if (d > bestDisp) {
      bestDisp = d;
      bestSel = sel;
    }
  }

  if (bestSel == null || bestDisp < 0.05) {
    return {
      event_id: input.prediction.event_id,
      autopsy_id: input.autopsy.autopsy_id,
      SIGNAL_FOUND: false,
      SIGNAL_TIMESTAMP: null,
      SIGNAL_VALUE: null,
      SIGNAL_DIRECTION: null,
      SIGNAL_STRENGTH: null,
      note: "NO_PRE_EVENT_SIGNAL_FOUND",
      info_class: "POST_EVENT_ANALYSIS",
    };
  }

  const latest = preQuotes
    .filter((q) => q.selection === bestSel)
    .sort((a, b) => Date.parse(a.available_at_utc!) - Date.parse(b.available_at_utc!))
    .at(-1)!;

  return {
    event_id: input.prediction.event_id,
    autopsy_id: input.autopsy.autopsy_id,
    SIGNAL_FOUND: true,
    SIGNAL_TIMESTAMP: latest.available_at_utc,
    SIGNAL_VALUE: `dispersion_${bestSel}=${bestDisp.toFixed(3)}`,
    SIGNAL_DIRECTION: bestSel,
    SIGNAL_STRENGTH: Math.min(1, bestDisp),
    note: "Pre-lock book disagreement observed — hypothesis only, not auto-causal",
    info_class: "POST_EVENT_ANALYSIS",
  };
}

export function appendBackwardSearch047(store: Store044, search: BackwardSearch047): void {
  appendJsonl044(join(store.root, "autopsies.jsonl"), { kind: "BACKWARD_SEARCH", ...search });
}

export type LearningCase047 = {
  case_id: string;
  event_id: string;
  model_version: string;
  prediction: string | null;
  actual: string;
  error_type: string | null;
  root_cause: string | null;
  missing_signal: string | null;
  useful_signal: string | null;
  suggested_adjustment: string;
  confidence: number;
  status: "OBSERVATION_ONLY";
  created_at: string;
};

export function learningCaseFromSearch047(input: {
  autopsy: PermanentAutopsy044;
  prediction: PermanentPrediction044;
  search: BackwardSearch047;
  actual: string;
  nowIso: string;
}): LearningCase047 {
  return {
    case_id: createHash("sha256").update(`lc047|${input.autopsy.autopsy_id}`).digest("hex").slice(0, 24),
    event_id: input.autopsy.event_id,
    model_version: input.prediction.model_version,
    prediction: input.prediction.selection,
    actual: input.actual,
    error_type: input.autopsy.error_type,
    root_cause: input.autopsy.cause_hypotheses[0]?.hypothesis ?? null,
    missing_signal: input.search.SIGNAL_FOUND ? null : "NO_PRE_EVENT_SIGNAL_FOUND",
    useful_signal: input.search.SIGNAL_FOUND ? input.search.SIGNAL_VALUE : null,
    suggested_adjustment: "Review only — no auto model change",
    confidence: input.search.SIGNAL_STRENGTH ?? 0.2,
    status: "OBSERVATION_ONLY",
    created_at: input.nowIso,
  };
}
