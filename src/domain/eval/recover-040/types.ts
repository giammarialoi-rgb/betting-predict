import { FROZEN_031_SHA256_039 } from "@/domain/eval/live-039/types";
import type { Window039 } from "@/domain/eval/live-039/types";

export const FROZEN_031_SHA256_040 = FROZEN_031_SHA256_039;

export type LabVerdict040 =
  | "LIVE_DATA_RECOVERED"
  | "INSUFFICIENT_DATA"
  | "COLLECTION_BLOCKED"
  | "NO_DEMONSTRATED_EDGE"
  | "DEMONSTRATED_EDGE"
  | "LIVE_NOT_CONFIGURED";

export type Exp040Config = {
  experiment_id: string;
  dataset_version: string;
  model_version: string;
  baseline: string;
  baseline_devig: "proportional";
  pilot_target: number;
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
  open_task_041: false;
  refit_market_devig: false;
  optimize_on_test: false;
  consume_task_039_store: true;
  legacy_dataset_sha256: string;
};

export type RecoverTable040 = {
  TOTAL_QUOTE_ROWS: number;
  UNIQUE_QUOTE_ROWS: number;
  UNIQUE_EVENTS: number;
  EVENTS_WITH_KICKOFF: number;
  EVENTS_WITH_EXACT_KICKOFF: number;
  EVENTS_WITH_PREMATCH_QUOTES: number;
  EVENTS_WITH_T1H_QUOTE: number;
  EVENTS_WITH_T1H_COMPLETE_1X2: number;
  MATCH_EXACT: number;
  STRICT_EVENTS: number;
  LOCKED_DECISIONS: number;
  SETTLED_EVENTS: number;
};

export type CoverageMap040 = Record<Window039, number>;
