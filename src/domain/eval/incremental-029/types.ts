export const PARSER_VERSION_029 = "task-029-parser-v1";
export const FROZEN_028_SHA256 =
  "6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b";

export type Partition029 = "TRAIN" | "VALIDATION" | "TEST" | "HOLDOUT";

export type ModelId029 =
  | "market_only"
  | "market_elo"
  | "market_form"
  | "market_schedule"
  | "market_disagreement"
  | "market_news"
  | "market_weather"
  | "market_all_safe"
  | "ensemble";

export type Family029 = "elo" | "form" | "schedule" | "disagreement" | "news" | "weather";

export type SourceClass029 = "A_STRICT" | "B_RESEARCH" | "C_CONTEXT" | "REJECTED";

export type Verdict029 =
  | "INCREMENTAL_SIGNAL_CONFIRMED"
  | "LOCAL_SIGNAL_ONLY"
  | "NO_INCREMENTAL_INFORMATION"
  | "INSUFFICIENT_DATA"
  | "LEAKAGE_DETECTED";

export type Exp029Config = {
  experiment_id: string;
  dataset_id: string;
  dataset_file: string;
  frozen_028_sha256: string;
  dataset_exclusions: unknown[];
  as_of_policy: string;
  feature_policy_version: string;
  model_version: string;
  min_train_events: number;
  ece_bins: number;
  bootstrap_n: number;
  bootstrap_seed: number;
  bootstrap_block: string;
  permutation_n: number;
  alpha: number;
  multiple_testing_method: string;
  logistic_iters: number;
  logistic_lr: number;
  logistic_seed: number;
  val_improve_eps: number;
  models: ModelId029[];
  corpus_partitions: Record<Partition029, { start: string; end: string }>;
  project_calendar_holdout_years: number[];
  solar_years: number[];
  winner: null;
  declared_best: false;
  auto_promote: false;
  real_money: false;
  feature_selection_on_test: false;
  holdout_for_training: false;
  random_split: false;
  close_in_decision: false;
  date_only_promoted_to_strict: false;
  invent_available_at: false;
  invent_timestamps: false;
};

export type Score029 = {
  n: number;
  brier: number | null;
  logloss: number | null;
  ece: number | null;
  cal_slope: number | null;
  cal_intercept: number | null;
  delta_brier: number | null;
  delta_logloss: number | null;
};

export type AnnualRow029 = {
  year: number;
  bets: number;
  start: number;
  end: number | null;
  pnl: number | null;
  roi: number | null;
  max_dd: number | null;
  status: "VALID" | "NO_BET" | "INSUFFICIENT_DATA" | "INCOMPLETE" | "NO_EDGE";
};

export type SourceRow029 = {
  source: string;
  cluster: string;
  url: string;
  access: string;
  data: string;
  timestamp: string;
  kickoff: string;
  license: string;
  match_rate: string;
  classification: SourceClass029;
};
