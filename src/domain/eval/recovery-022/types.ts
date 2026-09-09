/**
 * TASK 022 — historical odds recovery (BeatTheBookie) + blind capital types.
 */

export const PARSER_VERSION_022 = "task-022-parser-v1";
export const DATASET_ID_022 = "beat_the_bookie_temporal_v1";

/** Observation clock as measured on the row. */
export type ObservationTemporalClass022 =
  | "EXACT_TIMESTAMP"
  | "RELATIVE_TO_KICKOFF_EXACT"
  | "RELATIVE_TO_KICKOFF_APPROX"
  | "DATE_ONLY"
  | "UNKNOWN";

/** Temporal model kind (how availableAt may be derived). */
export type TemporalModelKind022 =
  | "ABSOLUTE_TIMESTAMP"
  | "RELATIVE_TO_EVENT_START"
  | "DATE_ONLY"
  | "DATASET_WINDOW"
  | "UNKNOWN";

export type RecordLane022 = "STRICT_CANDIDATE" | "RESEARCH_ONLY" | "BLOCKED";

export type MatchGrade022 =
  | "MATCH_EXACT"
  | "MATCH_PROBABLE"
  | "MATCH_AMBIGUOUS"
  | "MATCH_FAILED";

export type ObservedMarketClass022 =
  | "1X2"
  | "OU"
  | "AH"
  | "BTTS"
  | "DC"
  | "DNB"
  | "HT"
  | "correct_score"
  | "team_goals"
  | "corners"
  | "cards"
  | "player"
  | "other";

export type MarketLifecycle022 =
  | "CATALOGUED"
  | "OBSERVED"
  | "TEMPORALLY_VALID"
  | "MODEL_READY";

export type Exp022Config = {
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
  invent_available_at: false;
  invent_timezone: false;
  relative_auto_promoted_to_absolute: false;
  approx_relative_in_strict_capital: false;
  max_avg_as_bookmaker: false;
  holdout_years: number[];
  train_years: number[];
  val_years: number[];
  test_years: number[];
  solar_years: number[];
  primary_risk_policy: string;
  risk_policies: string[];
};

export type BeatTheBookieRecord = {
  source: string;
  dataset: string;
  match_id: string;
  league: string;
  home: string;
  away: string;
  kickoff: string | null;
  kickoff_date: string;
  bookmaker: string | null;
  market: ObservedMarketClass022;
  selection: string;
  odds: number | null;
  odds_timestamp: string | null;
  relative_seconds_to_kickoff: number | null;
  temporal_precision: ObservationTemporalClass022;
  temporal_model: TemporalModelKind022;
  timezone: null;
  timezone_verified: false;
  available_at: string | null;
  lane: RecordLane022;
  provenance: string;
  license: string;
  raw_hash: string;
  usable_strict_capital: false;
};

export type ResearchAggregate022 = {
  match_id: string;
  kickoff_date: string;
  league: string;
  home: string;
  away: string;
  selection: "HOME" | "DRAW" | "AWAY";
  kind: "avg" | "max";
  odds: number;
  n_odds: number;
  top_bookie_label: string | null;
  lane: "RESEARCH_ONLY";
};

export type AcquisitionProbe022 = {
  channel: string;
  url: string;
  http_status: number | null;
  content_type: string | null;
  bytes: number | null;
  acquired: boolean;
  note: string;
};

export type SourceQuality022 = {
  source: string;
  rows: number;
  events: number;
  bookmakers: number;
  markets: string[];
  exact_timestamp: number;
  relative_timestamp: number;
  date_only: number;
  unknown: number;
  match_exact: number;
  match_ambiguous: number;
  strict_usable: number;
  license_status: string;
  data_quality: string;
};

export type HorizonWindow022 =
  | "72h"
  | "48h"
  | "24h"
  | "12h"
  | "6h"
  | "3h"
  | "1h"
  | "30m"
  | "15m"
  | "5m";

export type HorizonCoverage022 = {
  window: HorizonWindow022;
  bin_exists: boolean;
  bin_index: number | null;
  relative_seconds: number | null;
  measured_non_nan: number;
  reconstructable: boolean;
};

export type Diagnostic022 = {
  has_time_series: boolean;
  granularity: string;
  timestamp_absolute: boolean;
  relative_to_kickoff_exact: boolean;
  can_reconstruct_asof: boolean;
  can_reconstruct_first_price: boolean;
  timezone: "UNDOCUMENTED";
  horizons: HorizonCoverage022[];
  php_t_field_bug: string;
  markets_in_generator: string[];
};

export type AnnualRow022 = {
  year: number;
  dataset: string;
  events: number;
  strict_events: number;
  decisions: number;
  qualified_bets: number;
  no_bets: number;
  start_bankroll: number;
  end_bankroll: number | null;
  pnl: number | null;
  roi: number | null;
  max_drawdown: number | null;
  win_rate: number | null;
  avg_odds: number | null;
  total_exposure: number | null;
  risk_policy: string;
  temporal_blocks: number;
  data_quality: string;
  status: "VALID" | "INSUFFICIENT_DATA" | "INCOMPLETE";
};

export type PeriodRow022 = {
  period: string;
  events: number;
  quotes: number;
  markets: string;
  bookmakers: string;
  timestamp: string;
  strict: number;
  model_ready: false;
  stato: string;
};

export type StrategyRow022 = {
  strategy: string;
  role: "operative" | "challenger_unused";
  bets: number;
  pnl: number | null;
  selected_from_pnl: false;
};
