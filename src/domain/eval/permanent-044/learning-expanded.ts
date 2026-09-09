import { createHash } from "node:crypto";
import { join } from "node:path";
import type { Settlement039 } from "@/domain/eval/live-039/types";
import { appendJsonl044 } from "@/domain/eval/permanent-044/store";
import type { PermanentAutopsy044, PermanentPrediction044 } from "@/domain/eval/permanent-044/types";
import { runAutopsy044, learningFromAutopsy044 } from "@/domain/eval/permanent-044/autopsy";

export type SignalClass044 =
  | "SIGNAL_PRESENT_AND_USED"
  | "SIGNAL_PRESENT_BUT_IGNORED"
  | "SIGNAL_PRESENT_BUT_UNDERWEIGHTED"
  | "SIGNAL_PRESENT_BUT_MISINTERPRETED"
  | "SIGNAL_ABSENT"
  | "SIGNAL_CONTRADICTORY"
  | "SIGNAL_UNRELIABLE";

export type SuccessClass044 =
  | "CORRECT_FOR_EXPECTED_REASON"
  | "CORRECT_DESPITE_WRONG_REASON"
  | "CORRECT_MARKET_ALIGNMENT"
  | "CORRECT_MODEL_SIGNAL"
  | "LUCKY_CORRECT"
  | "UNCERTAIN_CORRECT";

export type Counterfactual044 = {
  counterfactual_feature: string;
  original_weight: number;
  counterfactual_weight: number;
  original_prediction: string | null;
  counterfactual_prediction: string | null;
  actual_result: string;
  counterfactual_improvement: boolean | null;
  note: string;
  info_class: "POST_EVENT_ANALYSIS";
};

export type LearningCase044 = {
  case_id: string;
  event_id: string;
  prediction_id: string;
  result_id: string;
  prediction_correct: boolean | null;
  reason_correct: SuccessClass044 | null;
  autopsy_class: string | null;
  root_cause: string | null;
  signals: SignalClass044[];
  missed_signals: string[];
  counterfactuals: Counterfactual044[];
  model_version: string;
  feature_snapshot_hash: string;
  created_at: string;
  info_class: "POST_EVENT_ANALYSIS";
};

export type ExpandedAutopsy044 = PermanentAutopsy044 & {
  success_class: SuccessClass044 | null;
  missed_signals: string[];
  signal_search: { feature: string; class: SignalClass044; was_used: boolean }[];
  counterfactuals: Counterfactual044[];
  prediction_vs_result: Record<string, string | boolean | null>;
};

function outcomeMatchesSelection(outcome: string, selection: string | null): boolean | null {
  if (!selection) return null;
  const s = selection.toUpperCase();
  const o = outcome.toUpperCase();
  if (o === "UNSETTLED") return null;
  return s === o || s.includes(o) || o.includes(s);
}

export function expandedAutopsy044(input: {
  prediction: PermanentPrediction044;
  settlement: Settlement039;
  lockTime: string | null;
}): ExpandedAutopsy044 {
  const base = runAutopsy044({
    prediction: input.prediction,
    settlement: input.settlement,
    decision: null,
  });
  const correct = outcomeMatchesSelection(input.settlement.outcome, input.prediction.selection);
  const signal_search: ExpandedAutopsy044["signal_search"] = [
    {
      feature: "market_consensus",
      class: input.prediction.probability_market ? "SIGNAL_PRESENT_AND_USED" : "SIGNAL_ABSENT",
      was_used: Boolean(input.prediction.probability_market),
    },
    {
      feature: "lineup",
      class: "SIGNAL_ABSENT",
      was_used: false,
    },
    {
      feature: "injury",
      class: "SIGNAL_ABSENT",
      was_used: false,
    },
  ];
  const missed = signal_search.filter((s) => s.class === "SIGNAL_ABSENT" || s.class === "SIGNAL_PRESENT_BUT_IGNORED").map((s) => s.feature);

  let success_class: SuccessClass044 | null = null;
  if (correct === true) {
    success_class = input.prediction.reason_codes.includes("MODEL_IS_MARKET_ONLY")
      ? "CORRECT_MARKET_ALIGNMENT"
      : "UNCERTAIN_CORRECT";
  }

  const counterfactuals: Counterfactual044[] = [
    {
      counterfactual_feature: "hypothetical_non_market_signal",
      original_weight: 0,
      counterfactual_weight: 0.1,
      original_prediction: input.prediction.selection,
      counterfactual_prediction: input.prediction.selection,
      actual_result: input.settlement.outcome,
      counterfactual_improvement: null,
      note: "Illustrative only — no auto-promotion; MARKET_ONLY has no alternate feature weight.",
      info_class: "POST_EVENT_ANALYSIS",
    },
  ];

  return {
    ...base,
    success_class,
    missed_signals: missed,
    signal_search,
    counterfactuals,
    prediction_vs_result: {
      predicted: input.prediction.selection,
      actual: input.settlement.outcome,
      correct,
      calibration_question: "probability_coherence_unknown_until_n_large",
      explanation_pertinent: null,
    },
  };
}

export function learningCaseFromExpanded044(a: ExpandedAutopsy044, modelVersion: string): LearningCase044 {
  return {
    case_id: createHash("sha256").update(`case|${a.autopsy_id}`).digest("hex").slice(0, 24),
    event_id: a.event_id,
    prediction_id: a.prediction_id,
    result_id: a.event_id,
    prediction_correct: a.result_class === "CORRECT" ? true : a.result_class === "INCORRECT" ? false : null,
    reason_correct: a.success_class,
    autopsy_class: a.error_type,
    root_cause: a.cause_hypotheses[0]?.hypothesis ?? null,
    signals: a.signal_search.map((s) => s.class),
    missed_signals: a.missed_signals,
    counterfactuals: a.counterfactuals,
    model_version: modelVersion,
    feature_snapshot_hash: createHash("sha256").update(JSON.stringify(a.evidence)).digest("hex").slice(0, 16),
    created_at: a.created_at,
    info_class: "POST_EVENT_ANALYSIS",
  };
}

export function appendLearningCase044(root: string, c: LearningCase044): void {
  appendJsonl044(join(root, "learning-cases.jsonl"), c);
}

export { learningFromAutopsy044 };
