/**
 * TASK 026 — break the data bottleneck: acquisition + STRICT vs RESEARCH split.
 */

export const PARSER_VERSION_026 = "task-026-parser-v1";
export const DATASET_ID_026 = "break_data_bottleneck_v1";
export const STRICT_EVENT_GATE = 100;

export type TemporalPrecision026 =
  | "EXACT_TIMESTAMP"
  | "DATE_ONLY"
  | "DATASET_WINDOW"
  | "UNKNOWN";

export type TimestampOrigin026 = "SOURCE_TIMESTAMP" | "DERIVED_TIMESTAMP" | "ASSUMED_TIMESTAMP";

export type CorpusLevel026 =
  | "CAPITAL_STRICT"
  | "RESEARCH_STRICT"
  | "RESEARCH_DATE_ONLY"
  | "SECONDARY"
  | "INDEX"
  | "UNUSABLE";

export type MatchGrade026 = "EXACT" | "PROBABLE" | "AMBIGUOUS" | "FAILED";

export type BetfairProvenance026 = "OFFICIAL" | "MIRROR" | "SAMPLE" | "THIRD_PARTY" | "UNKNOWN";

export type SuccessBand026 = "SUCCESS_A" | "SUCCESS_B" | "SUCCESS_C" | "FAILURE";

export type Task026Verdict = "INSUFFICIENT_DATA";

export type Exp026Config = {
  experiment_id: string;
  dataset_id: string;
  initial_bankroll: number;
  as_of_policy: string;
  frozen_model_id: string;
  frozen_edge_threshold: number;
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
  auto_purchase: false;
  use_user_credentials: false;
  mirror_as_licensed_capital: false;
  kaggle_unknown_license_in_capital: false;
  holdout_years: number[];
  train_years: number[];
  val_years: number[];
  test_years: number[];
  solar_years: number[];
  strict_event_gate: number;
  challenger_models: string[];
  primary_risk_policy: string;
};

export type AcquisitionProbe026 = {
  channel: string;
  url: string;
  http_status: number | null;
  acquired: boolean;
  license: string;
  note: string;
};

export type ClassifiedClock026 = {
  precision: TemporalPrecision026;
  origin: TimestampOrigin026;
  iso: string | null;
  capitalEligible: false | true;
  reason: string;
};

export type FixtureIdentity026 = {
  competition: string;
  season: string | null;
  date: string;
  kickoff: string | null;
  home: string;
  away: string;
};

export type AnnualRow026 = {
  year: number;
  events: number;
  strict: number;
  decisions: number;
  bets: number;
  start: number;
  end: number | null;
  pnl: number | null;
  roi: number | null;
  max_dd: number | null;
  model: string | null;
  status: "VALID" | "INSUFFICIENT_DATA" | "INCOMPLETE" | "RESEARCH_NOT_CAPITAL";
};

export type AcquisitionFunnel026 = {
  sources_tried: number;
  accessible: number;
  with_timestamp: number;
  with_historical_rows: number;
  exact_timestamp_events: number;
  temporally_verified_events: number;
  capital_strict_events: number;
  blocker: string;
};

export type SourceMatrixRow026 = {
  sourceId: string;
  accessible: boolean;
  free: boolean;
  events: number | null;
  quotes: number | null;
  timestamp_exact: boolean | null;
  opening_timestamp: boolean | null;
  closing_timestamp: boolean | null;
  tick_history: boolean | null;
  markets: string;
  license: string;
  corpus_level: CorpusLevel026;
  strict_events: number;
  note: string;
};

export type PaidAlternative026 = {
  source: string;
  cost: string;
  events: string;
  timestamp_quality: string;
  markets: string;
  historical_depth: string;
  license: string;
  cost_per_event: string;
};

export type WindowAvailability026 = {
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

export type QualifiedGate026 = {
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
