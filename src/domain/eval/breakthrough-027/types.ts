/**
 * TASK 027 — historical odds recovery + blind capital test.
 */

export const PARSER_VERSION_027 = "task-027-parser-v1";
export const DATASET_ID_027 = "data_breakthrough_v1";
export const STRICT_EVENT_GATE = 100;
export const STRICT_EVENT_GATE_STRONG = 500;
export const STRICT_EVENT_GATE_BREAKTHROUGH = 1000;

export type TemporalPrecision027 =
  | "EXACT_TIMESTAMP"
  | "DATE_ONLY"
  | "DATASET_WINDOW"
  | "UNKNOWN";

export type TimestampOrigin027 = "SOURCE_TIMESTAMP" | "DERIVED_TIMESTAMP" | "ASSUMED_TIMESTAMP";

export type MatchGrade027 = "MATCH_EXACT" | "MATCH_PROBABLE" | "MATCH_AMBIGUOUS" | "MATCH_FAILED";

export type CorpusClass027 =
  | "VALID"
  | "PARTIAL"
  | "TEMPORALLY_UNKNOWN"
  | "MATCH_AMBIGUOUS"
  | "POST_MATCH"
  | "DUPLICATE"
  | "CORRUPTED"
  | "UNLICENSED_FOR_REPO"
  | "ACCESS_BLOCKED"
  | "RESEARCH_ONLY";

export type CapitalLevel027 = "LEVEL_A" | "LEVEL_B" | "LEVEL_C";

export type DataBand027 = "BREAKTHROUGH" | "STRONG_SUCCESS" | "SUCCESS" | "NO_DATA_BREAKTHROUGH";

export type ScientificVerdict027 =
  | "NO_EVIDENCE"
  | "NO_EDGE"
  | "EDGE_DETECTED_BUT_NOT_SIGNIFICANT"
  | "EDGE_STATISTICALLY_SUPPORTED";

export type Exp027Config = {
  experiment_id: string;
  dataset_id: string;
  initial_bankroll: number;
  as_of_policy: string;
  frozen_model_id: string;
  frozen_edge_threshold: number;
  min_train_events: number;
  declared_edge: true;
  retroactive_optimization: false;
  auto_promote: false;
  winner: null;
  real_money: false;
  strategy_selected_from_pnl: false;
  close_in_decision: false;
  date_only_in_strict_capital: false;
  invent_available_at: false;
  invent_timezone: false;
  assume_btb_datetime_utc: false;
  assume_kickoff_1500: false;
  nearest_match_in_strict: false;
  auto_purchase: false;
  use_user_credentials: false;
  mirror_as_licensed_capital: false;
  kaggle_unknown_license_in_capital: false;
  kaggle_ah_in_capital: false;
  holdout_years: number[];
  train_years: number[];
  val_years: number[];
  test_years: number[];
  solar_years: number[];
  strict_event_gate: number;
  challenger_models: string[];
  primary_risk_policy: string;
  risk_policies: string[];
  sizing: {
    flat_unit: number;
    kelly_fractional_factor: number;
    max_stake_fraction_event: number;
    max_stake_fraction_market: number;
    max_exposure_per_match: number;
    max_correlated_exposure: number;
    max_daily_exposure: number;
    max_league_exposure: number;
    bankroll_floor_fraction: number;
    drawdown_reduction_start: number;
    drawdown_reduction_factor: number;
    masaniello_target_hits_per_cycle: number;
    masaniello_cycle_length: number;
    masaniello_safety: number;
  };
};

export type HuntRow027 = {
  source: string;
  url: string;
  what_found: string;
  downloadable: boolean;
  format: string;
  timestamp: string;
  kickoff: string;
  matchable: string;
  event_count: number | null;
  strict_count: number | null;
  license_status: string;
  class: CorpusClass027;
};

export type StrictCandidate027 = {
  event_id: string;
  match_id: string;
  competition: string;
  season: string;
  home: string;
  away: string;
  kickoff: string;
  odds_timestamp: string;
  hours_before: number;
  bookmaker: string;
  market: "1X2";
  home_odds: number;
  draw_odds: number;
  away_odds: number;
  as_of: string;
  source: string;
  source_url: string;
  source_id: string;
  match_confidence: MatchGrade027;
  temporal_precision: TemporalPrecision027;
  timestamp_origin: TimestampOrigin027;
  capital_level: CapitalLevel027;
  retrieved_at: string;
  published_at: string | null;
  available_at: string;
  observed_at: string;
  temporal_basis: string;
  license_status: string;
  hash: string;
  /** Outcome — forbidden in DecisionContext. */
  ft_home: number;
  ft_away: number;
  windows: WindowAvailability027;
};

export type WindowAvailability027 = {
  eventId: string;
  "T-72h": boolean;
  "T-48h": boolean;
  "T-24h": boolean;
  "T-12h": boolean;
  "T-6h": boolean;
  "T-3h": boolean;
  "T-1h": boolean;
  "T-30m": boolean;
  "T-15m": boolean;
  "T-5m": boolean;
  "T-1m": boolean;
};

export type AnnualRow027 = {
  year: number;
  dataset: string;
  events: number;
  strict: number;
  decisions: number;
  bets: number;
  start: number;
  end: number | null;
  pnl: number | null;
  roi: number | null;
  max_dd: number | null;
  brier: number | null;
  logloss: number | null;
  strategy: string | null;
  status: "VALID" | "NO_BET" | "INSUFFICIENT_DATA" | "INCOMPLETE";
};

export type QualifiedGate027 = {
  temporal_exact: boolean;
  fixture_exact: boolean;
  market_valid: boolean;
  model_calibrated: boolean;
  sample_sufficient: boolean;
  walk_forward_pass: boolean;
  holdout_pass: boolean;
  statistical_gate_pass: boolean;
  evidence_available: boolean;
  qualified: boolean;
};

export type CapitalProtocol027 = {
  temporal_exact: boolean;
  fixture_exact: boolean;
  market_valid: boolean;
  sample_sufficient: boolean;
  walk_forward_pass: boolean;
  evidence_available: boolean;
  ok: boolean;
};
