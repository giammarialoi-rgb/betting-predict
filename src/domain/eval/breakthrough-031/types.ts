export const PARSER_VERSION_031 = "task-031-parser-v1";
export const DATASET_ID_031_BASE = "DATASET_031_BASE";
export const FROZEN_028_SHA256_031 =
  "6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b";

export type TemporalBasis031 =
  | "EXACT_ABSOLUTE"
  | "EXACT_RELATIVE"
  | "BIN_DOCUMENTED"
  | "DATE_ONLY"
  | "UNKNOWN";

export type StrictStatus031 = "STRICT" | "RESEARCH" | "BLOCKED";

export type SourceLevel031 = "LEVEL_A" | "LEVEL_B" | "LEVEL_C" | "DATE_ONLY" | "UNKNOWN";

export type MatchGrade031 = "MATCH_EXACT" | "MATCH_PROBABLE" | "MATCH_AMBIGUOUS" | "MATCH_FAILED";

export type Verdict031 =
  | "BREAKTHROUGH_EDGE"
  | "BREAKTHROUGH_NO_EDGE"
  | "INSUFFICIENT_DATA"
  | "HARD_DATA_BLOCK";

export type AnnualStatus031 = "VALID" | "NO_EDGE" | "PARTIAL_DATA" | "INSUFFICIENT_DATA";

export type Exp031Config = {
  experiment_id: string;
  dataset_id: string;
  dataset_file: string;
  frozen_028_sha256: string;
  frozen_030_model_version: string;
  as_of_policy: string;
  primary_window: string;
  primary_metric: string;
  baseline: string;
  primary_risk_policy: string;
  masaniello_production: false;
  strict_event_gate: number;
  ece_bins: number;
  bootstrap_n: number;
  bootstrap_seed: number;
  permutation_n: number;
  alpha: number;
  models: string[];
  corpus_partitions: Record<"TRAIN" | "VALIDATION" | "TEST" | "HOLDOUT", { start: string; end: string }>;
  project_calendar_holdout_years: number[];
  solar_years: number[];
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
  invent_timezone: false;
  modify_frozen_028: false;
  modify_frozen_030_model: false;
};

export type CanonicalQuote031 = {
  event_id: string;
  competition: string;
  season: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  market: "1X2";
  selection: "HOME" | "DRAW" | "AWAY";
  odds: number;
  quote_timestamp: string;
  timestamp_timezone: string;
  available_at: string;
  source: string;
  source_dataset: string;
  bookmaker: string;
  temporal_basis: TemporalBasis031;
  license: string;
  match_confidence: MatchGrade031;
  strict_status: StrictStatus031;
};

export type CanonicalEvent031 = {
  event_id: string;
  competition: string;
  season: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  market: "1X2";
  home_odds: number;
  draw_odds: number;
  away_odds: number;
  quote_timestamp: string;
  timestamp_timezone: string;
  available_at: string;
  source: string;
  source_dataset: string;
  bookmaker: string;
  temporal_basis: TemporalBasis031;
  license: string;
  match_confidence: MatchGrade031;
  strict_status: StrictStatus031;
  /** Settlement only — never in DecisionContext. */
  ft_home: number;
  ft_away: number;
};

export type SourceRow031 = {
  source: string;
  url: string;
  dataset: string;
  license: string;
  events: number | null;
  quotes: number | null;
  markets: string;
  bookmakers: string;
  kickoff: string;
  quote_timestamp: string;
  timestamp_type: string;
  timezone: string;
  matching: string;
  strict_events: number;
  status: string;
  sha256: string | null;
  level: SourceLevel031;
  cluster: string;
};

export type Probe031 = {
  channel: string;
  url: string;
  http_status: number | null;
  acquired: boolean;
  snippet: string;
  license: string;
  bytes: number;
  sha256: string | null;
};

export type AnnualRow031 = {
  year: number;
  strict: number;
  decisions: number;
  bets: number;
  start: number;
  end: number | null;
  pnl: number | null;
  roi: number | null;
  max_dd: number | null;
  model: string | null;
  status: AnnualStatus031;
};
