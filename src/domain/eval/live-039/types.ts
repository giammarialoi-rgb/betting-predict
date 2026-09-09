import { FROZEN_031_SHA256_038 } from "@/domain/eval/datalake-038/types";

export const FROZEN_031_SHA256_039 = FROZEN_031_SHA256_038;

export const WINDOWS_039 = [
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

export type Window039 = (typeof WINDOWS_039)[number];

export type TemporalClass039 =
  | "STRICT"
  | "RESEARCH_TEMPORAL"
  | "DATE_ONLY"
  | "POSTMATCH"
  | "INVALID"
  | "AMBIGUOUS";

export type CollectionStatus039 = "BLOCKED" | "SOURCE_UNAVAILABLE" | "COLLECTING" | "READY";

export type LabVerdict039 =
  | "LIVE_NOT_CONFIGURED"
  | "SOURCE_UNAVAILABLE"
  | "COLLECTING"
  | "DIAGNOSTIC_READY"
  | "NO_DEMONSTRATED_EDGE"
  | "DEMONSTRATED_EDGE";

export type MatchGrade039 = "MATCH_EXACT" | "MATCH_PROBABLE" | "MATCH_AMBIGUOUS" | "MATCH_FAILED";

export type KickoffStatus039 = "OK" | "INVALID_KICKOFF";

export type Outcome039 = "HOME" | "DRAW" | "AWAY" | "UNSETTLED";

export type Exp039Config = {
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
  open_task_040: false;
  refit_market_devig: false;
  optimize_on_test: false;
  poll_interval_ms: number;
  legacy_dataset_sha256: string;
};

export type Event039 = {
  event_id: string;
  source_event_id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  commence_time: string | null;
  source: string;
  first_seen_at: string;
  last_seen_at: string;
  kickoff_status: KickoffStatus039;
};

export type Quote039 = {
  event_id: string;
  market: string;
  bookmaker: string;
  outcome: string;
  price: number;
  source_quote_timestamp: string | null;
  collected_at: string;
  available_at: string | null;
  raw_payload_hash: string;
  temporal_class: TemporalClass039;
  match_status: MatchGrade039;
  window: Window039 | null;
  offset_seconds_from_kickoff: number | null;
  coverage_status: "COVERED" | "NO_OBSERVATION" | "OUT_OF_WINDOW";
};

export type Settlement039 = {
  event_id: string;
  result_source: string;
  settled_at: string;
  home_score: number | null;
  away_score: number | null;
  outcome: Outcome039;
};

export type Decision039 = {
  decision_id: string;
  event_id: string;
  decision_timestamp_utc: string;
  window: "T-1h";
  state: "LOCKED";
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

export type Journal039 = {
  source: string;
  requested_at_utc: string;
  received_at_utc: string | null;
  status: "ok" | "SOURCE_UNAVAILABLE" | "error";
  error: string | null;
  failure_mode: string | null;
  events: number;
  quotes: number;
};

export type Manifest039 = {
  dataset_sha256: string;
  source: string;
  collection_start: string | null;
  collection_end: string | null;
  events_discovered: number;
  events_with_kickoff: number;
  events_with_quotes: number;
  strict_events: number;
  strict_quotes: number;
  t72_coverage: number;
  t24_coverage: number;
  t1h_coverage: number;
  t5m_coverage: number;
  settled_events: number;
  unsettled_events: number;
};
