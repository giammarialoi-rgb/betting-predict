/**
 * TASK 024 — historical data attack: find, acquire, prove STRICT events.
 */

export const PARSER_VERSION_024 = "task-024-parser-v1";
export const DATASET_ID_024 = "historical_data_attack_v1";
export const STRICT_EVENT_GATE = 100;

export type Task024Verdict =
  | "STRICT_DATA_FOUND"
  | "PARTIAL_STRICT"
  | "NO_STRICT_DATA"
  | "ACQUISITION_BLOCKED";

export type SourceGate024 =
  | "SOURCE_EXISTS"
  | "SOURCE_ACQUIRED"
  | "SOURCE_PARSED"
  | "SOURCE_HAS_TIMESTAMP"
  | "TIMESTAMP_IS_EXACT"
  | "KICKOFF_IS_EXACT"
  | "TEMPORAL_RELATION_PROVEN"
  | "STRICT_USABLE";

export type TemporalRelation024 =
  | "QUOTE_BEFORE_KICKOFF"
  | "QUOTE_EQUALS_KICKOFF"
  | "QUOTE_AFTER_KICKOFF"
  | "UNKNOWN";

export type TemporalClass024 =
  | "STRICT_PREMATCH"
  | "CLOSING_AT_KICKOFF"
  | "POST_KICKOFF"
  | "DATE_ONLY"
  | "MIDNIGHT_PLACEHOLDER"
  | "RELATIVE_UNVERIFIED_TZ"
  | "TEMPORALLY_UNKNOWN"
  | "POST_MATCH"
  | "NOT_ACQUIRED";

export type IndependenceClass024 =
  | "OFFICIAL"
  | "MIRROR"
  | "DERIVED"
  | "REDISTRIBUTION"
  | "UNKNOWN";

export type KickoffPrecision024 =
  | "EXACT"
  | "DATE_ONLY"
  | "MIDNIGHT_PLACEHOLDER"
  | "UNKNOWN";

export type TimestampPrecision024 =
  | "EXACT"
  | "RELATIVE"
  | "DATE_ONLY"
  | "UNKNOWN";

export type BtbSeriesCase024 = "A" | "B" | "C" | "D";

export type Exp024Config = {
  experiment_id: string;
  dataset_id: string;
  initial_bankroll: number;
  as_of_policy: string;
  frozen_model_id: string;
  declared_edge: false;
  retroactive_optimization: false;
  auto_promote: false;
  winner: null;
  real_money: false;
  strategy_selected_from_pnl: false;
  close_in_decision: false;
  date_only_in_strict_capital: false;
  unknown_in_strict_capital: false;
  match_probable_in_strict: false;
  invent_available_at: false;
  invent_timezone: false;
  date_only_promoted_to_exact: false;
  close_promoted_to_open: false;
  auto_purchase: false;
  use_user_credentials: false;
  holdout_years: number[];
  train_years: number[];
  val_years: number[];
  test_years: number[];
  solar_years: number[];
  strict_event_gate: number;
  primary_risk_policy: string;
};

export type AcquisitionProbe024 = {
  channel: string;
  url: string;
  http_status: number | null;
  content_type: string | null;
  bytes: number | null;
  acquired: boolean;
  source_class: IndependenceClass024;
  note: string;
};

export type SourceLineage024 = {
  sourceId: string;
  lineageRoot: string;
  upstreamSources: string[];
  distributionChannel: string;
  independenceClass: IndependenceClass024;
};

export type GateTrace024 = {
  sourceId: string;
  SOURCE_EXISTS: boolean;
  SOURCE_ACQUIRED: boolean;
  SOURCE_PARSED: boolean;
  SOURCE_HAS_TIMESTAMP: boolean;
  TIMESTAMP_IS_EXACT: boolean;
  KICKOFF_IS_EXACT: boolean;
  TEMPORAL_RELATION_PROVEN: boolean;
  STRICT_USABLE: boolean;
  temporal_class: TemporalClass024;
  note: string;
};

export type InventoryRow024 = {
  source: string;
  events: number;
  odds: number;
  exact_timestamp: boolean | "mixed";
  exact_kickoff: boolean | "mixed";
  temporal_relation_proven: boolean | "equals_kickoff";
  strict: number;
  independence: string;
  status: string;
};

export type TemporalAuditRow024 = {
  fixture_id: string;
  kickoff: string | null;
  odds_known_at: string | null;
  bookmaker: string | null;
  source: string;
  delta_seconds: number | null;
  temporal_class: TemporalClass024;
};

export type StrictLedgerRow024 = {
  event: string;
  competition: string;
  kickoff_utc: string;
  market: string;
  bookmaker_or_exchange: string;
  quote_timestamp: string;
  delta_kickoff_sec: number;
  outcome: string;
  strict: "YES";
  lineage_root: string;
  independence: IndependenceClass024;
};

export type RejectBucket024 = {
  reason: string;
  events: number;
  odds_rows: number;
};

export type NextBlocker024 = {
  rank: number;
  id: string;
  action: string;
  expected_information_gain: "high" | "medium" | "low";
  acquisition_cost: string;
  notes: string;
};

export type AnnualRow024 = {
  year: number;
  start_bankroll: number;
  bets: number;
  turnover: number | null;
  gross_profit: number | null;
  net_profit: number | null;
  end_bankroll: number | null;
  roi: number | null;
  max_drawdown: number | null;
  number_of_bets: number;
  no_bet_count: number;
  events: number;
  strict_events: number;
  status: "VALID" | "INSUFFICIENT_DATA" | "INCOMPLETE";
};

export type SoccerAudit024 = {
  odds_rows: number;
  odds_fixtures: number;
  known_at_eq_kickoff: number;
  known_at_before: number;
  known_at_after: number;
  kickoff_midnight: number;
  kickoff_has_clock: number;
  odds_fixtures_midnight: number;
  odds_fixtures_clock: number;
  bookmakers: Record<string, number>;
  sources: Record<string, number>;
  year_min: number;
  year_max: number;
  files: Record<string, { bytes: number; sha256: string }>;
  match_stats_rows: number;
  match_stats_known_at_offset_sec: number;
  lineups_rows: number;
  teams: number;
  leagues: number;
  fixtures: number;
  dictionary_odds_known_at?: string;
  dictionary_fixtures_date_utc?: string;
  dictionary_match_stats_known_at?: string;
};

export type SoccerOddsSample024 = {
  fixture_id: number;
  kickoff: string;
  odds_known_at: string;
  bookmaker: string;
  source: string;
  home_win: number | null;
  draw: number | null;
  away_win: number | null;
  delta_seconds: number;
  kickoff_midnight: boolean;
  league_id: number | null;
  note?: string;
};

export type FileHashCheck024 = {
  file: string;
  present: boolean;
  bytes: number | null;
  sha256: string | null;
  sha256_expected: string | null;
  match: boolean | null;
};
