export const WINDOWS_036 = [
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

export type Window036 = (typeof WINDOWS_036)[number];

export type TemporalBasis036 = "SOURCE_TIMESTAMP" | "COLLECTOR_TIMESTAMP";

export type AvailabilityClass036 =
  | "STRICT"
  | "RESEARCH_TEMPORAL"
  | "POSTMATCH"
  | "DATE_ONLY"
  | "AMBIGUOUS"
  | "SOURCE_UNAVAILABLE";

export type DecisionState036 = "PRELOCK" | "DECISION" | "LOCKED" | "KICKOFF" | "SETTLED" | "EVALUATED";

export type LabVerdict036 = "PROSPECTIVE_COLLECTION_READY" | "PROSPECTIVE_COLLECTION_BLOCKED";

export type IntegrityCode036 =
  | "QUOTE_AFTER_KICKOFF"
  | "SOURCE_TIME_NON_MONOTONIC"
  | "FUTURE_DATA"
  | "MISSING_KICKOFF"
  | "MISSING_QUOTE_TIME"
  | "DUPLICATE_OBSERVATION"
  | "AMBIGUOUS_TIMEZONE"
  | "POST_LOCK_MUTATION"
  | "OUTCOME_BEFORE_LOCK"
  | "CLOSE_USED_AS_DECISION"
  | "DATE_ONLY_PROMOTION"
  | "SYNTHETIC_TIMESTAMP"
  | "CLOCK_DRIFT"
  | "NAIVE_TIMESTAMP"
  | "IGNORED_DUPLICATE";

export type Exp036Config = {
  experiment_id: string;
  dataset_version: string;
  collection_start: string;
  baseline: string;
  baseline_devig: "proportional";
  decision_windows: string[];
  observation_windows: string[];
  markets: string[];
  sources: string[];
  cold_start_min_strict: number;
  models: string[];
  capital_gate: false;
  observation_only_until_cold_start: true;
  optimize_during_collection: false;
  winner: null;
  auto_promotion: false;
  auto_promote: false;
  real_money: false;
  invent_timestamps: false;
  invent_timezone: false;
  synthetic_data: false;
  use_historical_hunt: false;
  modify_frozen_031: false;
  open_task_037_historical: false;
  test_locked: true;
  holdout_locked: true;
  poll_interval_ms: number;
  clock_drift_max_ms: number;
  close_in_decision: false;
  date_only_promoted_to_strict: false;
};

export type ProspectiveEvent036 = {
  event_id: string;
  source_event_id: string;
  competition: string;
  season: string | null;
  home_team: string;
  away_team: string;
  kickoff_at_utc: string;
  source: string;
  version: number;
  supersedes: string | null;
  ingested_at_utc: string;
};

export type ProspectiveQuote036 = {
  event_id: string;
  source_event_id: string;
  competition: string;
  season: string | null;
  home_team: string;
  away_team: string;
  kickoff_at_utc: string;
  market: string;
  selection: string;
  odds_decimal: number;
  quote_observed_at_utc: string;
  source_timestamp_utc: string | null;
  collector_timestamp_utc: string;
  requested_at_utc: string;
  received_at_utc: string;
  source: string;
  bookmaker: string;
  source_record_id: string;
  observation_id: string;
  ingested_at_utc: string;
  temporal_basis: TemporalBasis036;
  availability_class: AvailabilityClass036;
  decision_id: string | null;
  snapshot_id: string;
  data_fingerprint: string;
  window: Window036 | null;
  seconds_to_kickoff: number | null;
};

export type ProspectiveSnapshot036 = {
  snapshot_id: string;
  event_id: string;
  snapshot_at_utc: string;
  kickoff_at_utc: string;
  seconds_to_kickoff: number | null;
  markets_present: string[];
  bookmakers_present: string[];
  quotes_hash: string;
  decision_context_hash: string | null;
};

export type DecisionContext036 = {
  decision_id: string;
  event_id: string;
  decision_timestamp_utc: string;
  window: "T-1h";
  state: DecisionState036;
  market: "1X2";
  home_raw: number;
  draw_raw: number;
  away_raw: number;
  home_devig: number;
  draw_devig: number;
  away_devig: number;
  overround: number;
  bookmaker: string;
  observation_ids: string[];
  decision_context_hash: string;
  observation_only: true;
};

export type SourcePull036 = {
  source: string;
  requested_at_utc: string;
  received_at_utc: string | null;
  status: "ok" | "SOURCE_UNAVAILABLE" | "error" | "retry";
  error: string | null;
  events: number;
  quotes: number;
};

export type Coverage036 = Record<Window036, 0 | 1>;

export type SourceHealth036 = {
  source: string;
  status: "ok" | "SOURCE_UNAVAILABLE" | "error";
  last_success: string | null;
  last_error: string | null;
  events_seen: number;
  quotes_seen: number;
  strict_events: number;
  last_observation: string | null;
  coverage: Coverage036;
  latency_ms: number | null;
  clock_quality: "UTC_OFFSET" | "NONE" | "UNAVAILABLE";
};
