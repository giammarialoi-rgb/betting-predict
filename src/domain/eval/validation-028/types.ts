export const PARSER_VERSION_028 = "task-028-parser-v1";
export const DATASET_ID_028 = "task_027_strict_level_b_v1";

export type Partition028 = "TRAIN" | "VALIDATION" | "TEST" | "HOLDOUT";

export type ModelId028 =
  | "market_devig"
  | "frequency"
  | "elo"
  | "form"
  | "poisson"
  | "logistic"
  | "ensemble";

export type AblationId028 =
  | "market_only"
  | "market_elo"
  | "market_form"
  | "market_history"
  | "market_all";

export type ScientificVerdict028 =
  | "NO_SIGNAL"
  | "PREDICTIVE_SIGNAL_BUT_NO_MARKET_EDGE"
  | "POSITIVE_OBSERVED_RETURN_NOT_SIGNIFICANT"
  | "EDGE_DETECTED_NOT_ROBUST"
  | "EDGE_STATISTICALLY_SUPPORTED"
  | "ROBUST_OUT_OF_SAMPLE_EDGE"
  | "INSUFFICIENT_DATA"
  | "DATA_INVALID";

export type ErrorClass028 =
  | "MARKET_CORRECT"
  | "MODEL_CORRECT"
  | "MODEL_OVERCONFIDENT"
  | "INSUFFICIENT_INFORMATION"
  | "DATA_QUALITY"
  | "TEMPORAL_LIMIT"
  | "MARKET_MOVEMENT"
  | "UNKNOWN";

export type Exp028Config = {
  experiment_id: string;
  dataset_id: string;
  dataset_file: string;
  dataset_exclusions: unknown[];
  as_of_policy: string;
  frozen_model_id: string;
  frozen_edge_threshold: number;
  min_train_events: number;
  diagnostic_thresholds: number[];
  bootstrap_n: number;
  bootstrap_seed: number;
  bootstrap_block: string;
  permutation_n: number;
  alpha: number;
  multiple_testing_method: string;
  ece_bins: number;
  friction_rates: number[];
  primary_risk_policy: string;
  risk_policies: string[];
  models: string[];
  ablation: string[];
  corpus_partitions: Record<Partition028, { start: string; end: string }>;
  project_calendar_train_years: number[];
  project_calendar_val_years: number[];
  project_calendar_test_years: number[];
  project_calendar_holdout_years: number[];
  solar_years: number[];
  logistic_iters: number;
  logistic_lr: number;
  logistic_seed: number;
  winner: null;
  declared_best: false;
  auto_promote: false;
  real_money: false;
  retroactive_optimization: false;
  strategy_selected_from_pnl: false;
  threshold_selected_from_test: false;
  close_in_decision: false;
  holdout_for_training: false;
  random_split: false;
  invent_available_at: false;
  sizing: {
    flat_unit: number;
    kelly_fractional_factor: number;
    max_stake_fraction_event: number;
    max_stake_fraction_market: number;
    max_exposure_per_match: number;
    max_correlated_exposure: number;
    max_daily_exposure: number;
    bankroll_floor_fraction: number;
    drawdown_reduction_start: number;
    drawdown_reduction_factor: number;
    masaniello_target_hits_per_cycle: number;
    masaniello_cycle_length: number;
    masaniello_safety: number;
  };
};

export type DatasetFreeze028 = {
  path: string;
  sha256: string;
  dataset_version: string;
  bytes: number;
  events: number;
  quotes: number;
  period_start: string | null;
  period_end: string | null;
  markets: string[];
  bookmakers: string[];
  source_lineage: string;
  fixture: boolean;
};

export type Score028 = {
  n: number;
  brier: number | null;
  logloss: number | null;
  ece: number | null;
  cal_slope: number | null;
  cal_intercept: number | null;
  hit_rate: number | null;
};

export type AnnualRow028 = {
  year: number;
  events: number;
  decisions: number;
  bets: number;
  start: number;
  end: number | null;
  pnl: number | null;
  roi: number | null;
  max_dd: number | null;
  brier_market: number | null;
  brier_model: number | null;
  logloss_market: number | null;
  logloss_model: number | null;
  strategy: string | null;
  status: "VALID" | "NO_BET" | "INSUFFICIENT_DATA" | "INCOMPLETE";
};
