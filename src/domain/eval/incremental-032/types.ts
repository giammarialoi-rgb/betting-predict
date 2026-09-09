export const PARSER_VERSION_032 = "task-032-parser-v1";
export const FROZEN_031_SHA256 =
  "6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b";

export type Family032 = "elo" | "form" | "history" | "schedule" | "movement";

export type ModelId032 =
  | "market_only"
  | "market_elo"
  | "market_form"
  | "market_history"
  | "market_schedule"
  | "market_movement"
  | "market_all";

export type FeatureClass032 =
  | "SAFE_PREMATCH"
  | "SAFE_AFTER_RECONSTRUCTION"
  | "RESEARCH_ONLY"
  | "TEMPORALLY_UNKNOWN"
  | "POST_MATCH"
  | "FORBIDDEN";

export type IncrementalClass032 = "BEATS_MARKET" | "NON_INFERIOR" | "HARMFUL" | "INCONCLUSIVE";

export type Verdict032 = "EDGE_DEMONSTRATED" | "NO_DEMONSTRATED_EDGE" | "INCONCLUSIVE" | "INSUFFICIENT_DATA";

export type Exp032Config = {
  experiment_id: string;
  dataset_version: string;
  dataset_sha256: string;
  as_of_policy: string;
  baseline: string;
  model_version: string;
  feature_policy_version: string;
  selection_split: string;
  test_locked: true;
  holdout_locked: true;
  ece_bins: number;
  bootstrap_n: number;
  bootstrap_n_selected: number;
  bootstrap_seed: number;
  permutation_n: number;
  alpha: number;
  logistic_iters: number;
  logistic_lr: number;
  logistic_seed: number;
  val_improve_eps: number;
  movement_min_train_coverage: number;
  history_min_meetings: number;
  fragile_top_fraction: number;
  groups: Record<ModelId032, Family032[]>;
  corpus_partitions: Record<"TRAIN" | "VALIDATION" | "TEST" | "HOLDOUT", { start: string; end: string }>;
  solar_years: number[];
  primary_risk_policy: string;
  masaniello_production: false;
  winner: null;
  declared_best: false;
  auto_promotion: false;
  auto_promote: false;
  real_money: false;
  feature_selection_on_test: false;
  holdout_for_training: false;
  random_split: false;
  close_in_decision: false;
  date_only_promoted_to_strict: false;
  invent_available_at: false;
  invent_timestamps: false;
  modify_frozen_031: false;
};

export type FeatureAuditRow032 = {
  feature: string;
  source: string;
  coverage: string;
  temporal_basis: string;
  available_at: string;
  matchability: string;
  leakage_risk: string;
  missingness: string;
  usable_t1h: "YES" | "NO";
  class: FeatureClass032;
  reason: string;
};

export type Score032 = {
  n: number;
  brier: number | null;
  logloss: number | null;
  ece: number | null;
  cal_slope: number | null;
  cal_intercept: number | null;
  delta_brier: number | null;
  delta_logloss: number | null;
};

export type AnnualRow032 = {
  year: number;
  strict: number;
  decisions: number;
  bets: number;
  start: number;
  end: number | null;
  pnl: number | null;
  roi: number | null;
  max_dd: number | null;
  risk_policy: string | null;
  model: string | null;
  confidence: string | null;
  status: "VALID" | "NO_EDGE" | "PARTIAL_DATA" | "INSUFFICIENT_DATA" | "INCOMPLETE_YEAR";
};
