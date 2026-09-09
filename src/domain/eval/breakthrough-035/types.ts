export const FROZEN_031_SHA256_035 =
  "6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b";

export const PARSER_VERSION_035 = "task-035-parser-v1";

export type TemporalClass035 =
  | "STRICT_A"
  | "STRICT_B"
  | "RESEARCH_TEMPORAL"
  | "DATE_ONLY"
  | "UNKNOWN"
  | "POSTMATCH"
  | "AMBIGUOUS";

export type MatchGrade035 = "MATCH_EXACT" | "MATCH_PROBABLE" | "MATCH_AMBIGUOUS" | "MATCH_FAILED" | "UNMATCHED";

export type LabVerdict035 =
  | "DATA_BREAKTHROUGH"
  | "DATA_BREAKTHROUGH_NO_EDGE"
  | "MODEL_EDGE_DETECTED"
  | "INSUFFICIENT_DATA_FINAL";

export type Access035 =
  | "LOCAL"
  | "PUBLIC_DOWNLOAD"
  | "SAMPLE_ONLY"
  | "BLOCKED_LOGIN"
  | "BLOCKED_API_KEY"
  | "BLOCKED_PAYWALL"
  | "UNREACHABLE"
  | "NOT_FOUND"
  | "MIRROR";

export type Exp035Config = {
  experiment_id: string;
  dataset_version: string;
  legacy_dataset: string;
  legacy_dataset_sha256: string;
  as_of_policy: string;
  baseline: string;
  baseline_devig: "proportional";
  test_locked: true;
  holdout_locked: true;
  min_strict_events: number;
  min_strict_breakthrough: number;
  ece_bins: number;
  bootstrap_n: number;
  bootstrap_seed: number;
  permutation_n: number;
  alpha: number;
  val_improve_eps: number;
  execution_cost_unknown: true;
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
  open_close_promoted_to_timestamp: false;
  invent_available_at: false;
  invent_timestamps: false;
  invent_timezone: false;
  invent_quotes: false;
  invent_events: false;
  invent_capital: false;
  modify_frozen_031: false;
  use_user_credentials: false;
  bypass_auth: false;
  mirror_as_independent: false;
  synthetic_data: false;
  add_new_model_family: false;
  open_task_036: false;
  corpus_partitions: Record<"TRAIN" | "VALIDATION" | "TEST" | "HOLDOUT", { start: string; end: string }>;
};

export type ScoreCard035 = {
  clock: 0 | 1 | 2 | 3 | 4 | 5;
  kickoff: 0 | 1 | 2 | 3;
  match: 0 | 1 | 2;
  depth: 0 | 1 | 2 | 3;
  coverage: 0 | 1 | 2 | 3;
  holdout: 0 | 1 | 2 | 3;
  total: number;
};

export type SourceRecord035 = {
  id: string;
  title: string;
  axis: string;
  urls: string[];
  probe_url: string | null;
  access: Access035;
  independent: boolean;
  license: string;
  provenance: string;
  local_path: string | null;
  scores: ScoreCard035;
  temporal_class: TemporalClass035;
  can_become_strict: false;
  why_not_strict: string;
  new_source: boolean;
};

export type NormalizedQuote035 = {
  event_id: string;
  market_id: string;
  selection: string;
  price: number;
  quote_timestamp: string | null;
  kickoff_timestamp: string | null;
  source: string;
  source_record_id: string;
  timezone: string | null;
  temporal_basis: string;
  quote_has_offset: boolean;
  kickoff_has_offset: boolean;
  prematch_candidate: boolean;
  inplay_or_post: boolean;
  bookmaker: string | null;
  competition: string | null;
  home: string | null;
  away: string | null;
  ft_home: number | null;
  ft_away: number | null;
};

export type GatedQuote035 = NormalizedQuote035 & {
  temporal_class: TemporalClass035;
  match_grade: MatchGrade035;
};

export type InventoryFile035 = {
  path: string;
  bytes: number;
  sha256: string | null;
  hashed: boolean;
  rows: number | null;
  date_min: string | null;
  date_max: string | null;
  competitions: string[];
  markets: string[];
  bookmakers: string[];
  kickoff: boolean | null;
  quote_timestamp: boolean | null;
  timezone: string | null;
  timestamp_semantics: string;
  availability: "OPEN" | "CLOSE" | "STREAM" | "SNAPSHOT" | "OPEN_CLOSE" | "UNKNOWN" | "N/A";
  match_exact_possible: boolean | null;
  license: string;
  provenance: string;
  temporal_level: TemporalClass035 | "LEGACY_STRICT_B" | "NOT_ODDS";
  strict_usable: boolean;
  exclusion: string;
};

export type Probe035 = {
  id: string;
  url: string;
  attempted: boolean;
  acquired: boolean;
  http_status: number | null;
  sha256: string | null;
  classification: string;
  note: string;
};

export type AnnualRow035 = {
  year_label: string;
  signal: string;
  n: number;
  bets: number;
  start: number;
  end: number | null;
  pnl: number | null;
  roi: number | null;
  max_dd: number | null;
  status: "INSUFFICIENT_DATA" | "LEGACY_NO_HOLDOUT" | "INCOMPLETE_YEAR" | "NO_EDGE";
};

export type MatchReport035 = {
  exact: number;
  probable: number;
  ambiguous: number;
  failed: number;
  unmatched: number;
  collisions: string[];
};
