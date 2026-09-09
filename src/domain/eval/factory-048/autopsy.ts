import { createHash } from "node:crypto";
import type { PermanentAutopsy044, PermanentPrediction044, PermanentSettlement044 } from "@/domain/eval/permanent-044/types";
import type {
  BackwardAvail048,
  ErrorLabel048,
  OutcomeReasoningClass048,
} from "@/domain/eval/factory-048/config";
import type { DecisionRecord048 } from "@/domain/eval/factory-048/decision";
import type { Store044 } from "@/domain/eval/permanent-044/store";

export type Autopsy048 = {
  autopsy_id: string;
  event_id: string;
  prediction_id: string;
  decision_id: string | null;
  model_version: string;
  decision: string | null;
  market: string;
  predicted_probability: number | null;
  predicted_outcome: string | null;
  actual_outcome: string;
  prediction_correct: boolean | null;
  prediction_calibration_bucket: string | null;
  decision_correct: boolean | null;
  outcome_reasoning_class: OutcomeReasoningClass048;
  reasoning_supported: "YES" | "PARTIAL" | "NO" | "N/A";
  error_labels: ErrorLabel048[];
  bet_would_have_won: boolean | null;
  theoretical_edge_at_lock: number | null;
  theoretical_pnl: null;
  capital_note: "THEORETICAL_ONLY_CAPITAL_CLOSED";
  created_at: string;
};

export type BackwardFinding048 = {
  event_id: string;
  autopsy_id: string;
  signal: string;
  availability: BackwardAvail048;
  SIGNAL_TIMESTAMP: string | null;
  SIGNAL_VALUE: string | null;
  note: string;
  info_class: "POST_EVENT_ANALYSIS";
};

function outcomeMatch(actual: string, selection: string | null): boolean | null {
  if (!selection) return null;
  const a = actual.toUpperCase();
  const s = selection.toUpperCase();
  if (a.includes("-") && /^\d+-\d+$/.test(a)) {
    const [h, aw] = a.split("-").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(aw)) return null;
    const mapped = h > aw! ? "HOME" : h < aw! ? "AWAY" : "DRAW";
    return s === mapped || s.includes(mapped);
  }
  return s === a || s.includes(a) || a.includes(s);
}

export function buildAutopsy048(input: {
  prediction: PermanentPrediction044;
  settlement: PermanentSettlement044;
  decision: DecisionRecord048 | null;
  nowIso: string;
}): Autopsy048 {
  const correct = outcomeMatch(input.settlement.result, input.prediction.selection);
  const marketOnly = input.prediction.reason_codes.includes("MODEL_IS_MARKET_ONLY");
  let outcome_reasoning_class: OutcomeReasoningClass048;
  let reasoning_supported: Autopsy048["reasoning_supported"];

  if (correct === false) {
    outcome_reasoning_class = "OUTCOME_WRONG";
    reasoning_supported = "NO";
  } else if (correct === true && marketOnly) {
    outcome_reasoning_class = "OUTCOME_CORRECT_REASONING_NOT_SUPPORTED";
    reasoning_supported = "PARTIAL";
  } else if (correct === true) {
    outcome_reasoning_class = "OUTCOME_CORRECT_REASONING_SUPPORTED";
    reasoning_supported = "YES";
  } else {
    outcome_reasoning_class = "OUTCOME_CORRECT";
    reasoning_supported = "N/A";
  }

  const error_labels: ErrorLabel048[] = [];
  if (correct === false) {
    error_labels.push("MODEL_ERROR");
    if (marketOnly) error_labels.push("INSUFFICIENT_INFORMATION");
    if ((input.decision?.risk_score ?? 0) < 30) error_labels.push("RISK_UNDERESTIMATION");
  }

  const isCandidate =
    input.decision?.decision === "BET_CANDIDATE" || input.decision?.decision === "STRONG_CANDIDATE";

  return {
    autopsy_id: createHash("sha256")
      .update(`au048|${input.prediction.prediction_id}|${input.settlement.settled_at}`)
      .digest("hex")
      .slice(0, 24),
    event_id: input.prediction.event_id,
    prediction_id: input.prediction.prediction_id,
    decision_id: input.decision?.decision_id ?? null,
    model_version: input.decision?.model_version ?? input.prediction.model_version,
    decision: input.decision?.decision ?? null,
    market: input.prediction.market,
    predicted_probability: input.decision?.probability ?? null,
    predicted_outcome: input.prediction.selection,
    actual_outcome: input.settlement.result,
    prediction_correct: correct,
    prediction_calibration_bucket:
      input.decision?.probability != null
        ? `p_${Math.floor((input.decision.probability ?? 0) * 10) / 10}`
        : null,
    decision_correct: correct,
    outcome_reasoning_class,
    reasoning_supported,
    error_labels,
    bet_would_have_won: isCandidate ? correct : null,
    theoretical_edge_at_lock: isCandidate ? input.decision?.estimated_edge ?? null : null,
    theoretical_pnl: null,
    capital_note: "THEORETICAL_ONLY_CAPITAL_CLOSED",
    created_at: input.nowIso,
  };
}

/** Backward search uses only quotes with available_at <= lock. */
export function backwardSearch048(input: {
  store: Store044;
  prediction: PermanentPrediction044;
  autopsy: Autopsy048 | PermanentAutopsy044;
  lockTime: string | null;
}): BackwardFinding048 {
  const autopsyId = "autopsy_id" in input.autopsy ? input.autopsy.autopsy_id : "unknown";
  const lockMs = input.lockTime ? Date.parse(input.lockTime) : null;
  const pre = input.store.quotes.filter((q) => {
    if (q.event_id !== input.prediction.event_id || !q.available_at_utc) return false;
    if (lockMs == null) return true;
    const t = Date.parse(q.available_at_utc);
    return Number.isFinite(t) && t <= lockMs;
  });

  if (pre.length < 2) {
    return {
      event_id: input.prediction.event_id,
      autopsy_id: autopsyId,
      signal: "book_dispersion",
      availability: "NOT_AVAILABLE",
      SIGNAL_TIMESTAMP: null,
      SIGNAL_VALUE: null,
      note: "NO_PRE_EVENT_SIGNAL_FOUND",
      info_class: "POST_EVENT_ANALYSIS",
    };
  }

  const bySel = new Map<string, number[]>();
  for (const q of pre) {
    const arr = bySel.get(q.selection) ?? [];
    arr.push(q.price);
    bySel.set(q.selection, arr);
  }
  let best = 0;
  let bestSel: string | null = null;
  for (const [sel, prices] of bySel) {
    if (prices.length < 2) continue;
    const d = Math.max(...prices) - Math.min(...prices);
    if (d > best) {
      best = d;
      bestSel = sel;
    }
  }

  if (bestSel == null || best < 0.05) {
    return {
      event_id: input.prediction.event_id,
      autopsy_id: autopsyId,
      signal: "book_dispersion",
      availability: "NOT_PREDICTABLE",
      SIGNAL_TIMESTAMP: null,
      SIGNAL_VALUE: null,
      note: "NO_PRE_EVENT_SIGNAL_FOUND",
      info_class: "POST_EVENT_ANALYSIS",
    };
  }

  const used = input.prediction.reason_codes.includes("INSUFFICIENT_BOOK_TRIANGULATION");
  return {
    event_id: input.prediction.event_id,
    autopsy_id: autopsyId,
    signal: `dispersion_${bestSel}`,
    availability: used ? "AVAILABLE_BUT_MISINTERPRETED" : "AVAILABLE_BUT_IGNORED",
    SIGNAL_TIMESTAMP: pre.sort((a, b) => Date.parse(a.available_at_utc!) - Date.parse(b.available_at_utc!)).at(-1)!
      .available_at_utc,
    SIGNAL_VALUE: String(best.toFixed(3)),
    note: "Pre-lock disagreement observed — hypothesis only",
    info_class: "POST_EVENT_ANALYSIS",
  };
}
