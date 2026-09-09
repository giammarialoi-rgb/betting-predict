import { FROZEN_031_SHA256_040 } from "@/domain/eval/recover-040/types";

export const FROZEN_031_SHA256_041 = FROZEN_031_SHA256_040;

export type LabVerdict041 =
  | "DEMONSTRATED_EDGE"
  | "NO_DEMONSTRATED_EDGE"
  | "INSUFFICIENT_DATA_FINAL"
  | "COLLECTING"
  | "COLLECTION_BLOCKED"
  | "LIVE_NOT_CONFIGURED";

export type Exp041Config = {
  experiment_id: string;
  dataset_version: string;
  model_version: string;
  baseline: string;
  baseline_devig: "proportional";
  pilot_target: number;
  settled_target: number;
  test_locked: true;
  holdout_locked: true;
  capital_gate: false;
  winner: null;
  auto_promotion: false;
  auto_promote: false;
  real_money: false;
  invent_timestamps: false;
  invent_timezone: false;
  invent_quotes: false;
  synthetic_data: false;
  client_retrieved_as_quote: false;
  date_only_promoted_to_strict: false;
  close_in_decision: false;
  modify_frozen_031: false;
  count_legacy_031_as_new_strict: false;
  historical_hunt: false;
  open_task_042: false;
  refit_market_devig: false;
  optimize_on_test: false;
  consume_task_039_store: true;
  market_only_until_features: true;
  legacy_dataset_sha256: string;
};
