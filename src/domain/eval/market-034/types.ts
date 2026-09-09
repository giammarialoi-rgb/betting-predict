export const FROZEN_031_SHA256_034 =
  "6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b";

export const WINDOWS_034 = [
  "T-72h",
  "T-48h",
  "T-24h",
  "T-12h",
  "T-6h",
  "T-3h",
  "T-1h",
  "T-30m",
  "T-15m",
  "T-5m",
  "T-1m",
] as const;

export type Window034 = (typeof WINDOWS_034)[number];

export type Challenger034 =
  | "shin"
  | "power"
  | "additive"
  | "best_price"
  | "median_consensus"
  | "follow_steam";

export type LabVerdict034 = "INEFFICIENCY_FOUND" | "NO_DEMONSTRATED_INEFFICIENCY" | "INSUFFICIENT_DATA";

export type SignalVerdict034 = "BASELINE" | "NON_INFERIOR" | "HARMFUL" | "EDGE_CANDIDATE" | "INCONCLUSIVE";

export type Exp034Config = {
  experiment_id: string;
  dataset_version: string;
  dataset_sha256: string;
  as_of_policy: string;
  baseline: string;
  baseline_devig: "proportional";
  test_locked: true;
  holdout_locked: true;
  min_strict_events: number;
  ece_bins: number;
  bootstrap_n: number;
  bootstrap_seed: number;
  permutation_n: number;
  alpha: number;
  val_improve_eps: number;
  steam_follow_mix: number;
  execution_cost_unknown: true;
  friction_scenarios: number[];
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
  add_elo: false;
  add_form: false;
  add_h2h: false;
  add_news: false;
  open_task_035: false;
  corpus_partitions: Record<"TRAIN" | "VALIDATION" | "TEST" | "HOLDOUT", { start: string; end: string }>;
  challengers: Challenger034[];
};

export type Hypothesis034 = {
  id: string;
  definition: string;
  feature: string;
  dataset: string;
  split: string;
  direction: string;
  metric: string;
  created_before_test: true;
  inferential: boolean;
  status: string;
};

export type Score034 = {
  n: number;
  brier: number | null;
  logloss: number | null;
  ece: number | null;
  delta_brier: number | null;
  delta_logloss: number | null;
};

export type AnnualRow034 = {
  year_label: string;
  signal: string;
  n: number;
  bets: number;
  start: number;
  end: number | null;
  pnl: number | null;
  roi: number | null;
  max_dd: number | null;
  status: "NO_EDGE" | "INSUFFICIENT_DATA" | "INCOMPLETE_YEAR" | "NO_INEFFICIENCY";
};
