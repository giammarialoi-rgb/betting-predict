/** Verifiable prediction lineage — reconstructability, not mutation. */

export type LineageStep055 = {
  step:
    | "SOURCE"
    | "OBSERVATION"
    | "FEATURE_SNAPSHOT"
    | "MODEL_INPUT"
    | "PREDICTION"
    | "DECISION"
    | "LOCK"
    | "RESULT"
    | "AUTOPSY"
    | "LEARNING";
  at: string | null;
  ref: string | null;
  note: string | null;
};

export function buildLineage055(input: {
  sources: string[];
  observation_at: string | null;
  snapshot_at: string | null;
  prediction_id: string | null;
  prediction_at: string | null;
  decision: string | null;
  lock_at: string | null;
  result_at: string | null;
  autopsy_id: string | null;
  learning_id: string | null;
}): LineageStep055[] {
  return [
    { step: "SOURCE", at: input.observation_at, ref: input.sources.join(","), note: "provenance" },
    { step: "OBSERVATION", at: input.observation_at, ref: null, note: "pre_lock_only" },
    { step: "FEATURE_SNAPSHOT", at: input.snapshot_at, ref: null, note: null },
    { step: "MODEL_INPUT", at: input.prediction_at, ref: null, note: "frozen_at_lock" },
    { step: "PREDICTION", at: input.prediction_at, ref: input.prediction_id, note: "immutable_after_write" },
    { step: "DECISION", at: input.prediction_at, ref: input.decision, note: null },
    { step: "LOCK", at: input.lock_at, ref: null, note: "T-1h_immutable" },
    { step: "RESULT", at: input.result_at, ref: null, note: "post_event_only" },
    { step: "AUTOPSY", at: input.result_at, ref: input.autopsy_id, note: "no_retroactive_prediction_edit" },
    { step: "LEARNING", at: input.result_at, ref: input.learning_id, note: "proposed_change_only" },
  ];
}
