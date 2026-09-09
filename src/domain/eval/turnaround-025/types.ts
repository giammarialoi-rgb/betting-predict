/**
 * TASK 025 — real data turnaround: A STRICT / B RESEARCH_TEMPORAL / C RESEARCH_ONLY / D INVALID.
 */

export const PARSER_VERSION_025 = "task-025-parser-v1";
export const DATASET_ID_025 = "real_data_turnaround_v1";
export const STRICT_EVENT_GATE = 100;

export type DataClass025 = "A_STRICT" | "B_RESEARCH_TEMPORAL" | "C_RESEARCH_ONLY" | "D_INVALID";

export type Task025Verdict =
  | "DEMONSTRATED_EDGE"
  | "PROMISING_BUT_UNCONFIRMED"
  | "MARKET_MATCHED"
  | "MARKET_UNDERPERFORMED"
  | "INSUFFICIENT_DATA";

export type MatchGrade025 =
  | "MATCH_EXACT"
  | "MATCH_HIGH_CONFIDENCE"
  | "MATCH_PROBABLE"
  | "MATCH_AMBIGUOUS"
  | "MATCH_FAILED";

export type Exp025Config = {
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
  holdout_years: number[];
  train_years: number[];
  val_years: number[];
  test_years: number[];
  solar_years: number[];
  strict_event_gate: number;
  challenger_models: string[];
  primary_risk_policy: string;
};

export type AcquisitionProbe025 = {
  channel: string;
  url: string;
  http_status: number | null;
  acquired: boolean;
  license: string;
  note: string;
};

export type AcquisitionScore025 = {
  sourceId: string;
  temporalPrecision: number;
  eventCoverage: number;
  marketCoverage: number;
  bookmakerCoverage: number;
  provenance: number;
  license: number;
  independence: number;
  accessibility: number;
  cost: number;
  matchingQuality: number;
  expectedInformationGain: number;
  eigOverCost: number;
  capitalEligible: boolean;
  dataClass: DataClass025;
};

export type GithubAudit025 = {
  repo: string;
  license: string | null;
  hasRawData: boolean;
  provenance: string;
  redistributionOk: boolean | null;
  note: string;
};

export type WeeklyBetfairRow025 = {
  event_id: string;
  sports_id: string;
  scheduled_off: string;
  actual_off: string | null;
  first_taken: string | null;
  latest_taken: string | null;
  in_play: string;
  selection: string;
  selection_id: string;
  odds: number;
  number_bets: number | null;
  volume_matched: number | null;
  win_flag: number | null;
  full_description: string;
};

export type ClassifiedObservation025 = {
  id: string;
  dataClass: DataClass025;
  capitalEligible: boolean;
  reason: string;
};

export type CoverageCell025 = {
  year: number;
  competition: string;
  events: number;
  odds: number;
  exact_timestamp: number;
  date_only: number;
  strict: number;
  strict_ratio: number;
  research_ratio: number;
  observed: true;
};

export type AnnualRow025 = {
  year: number;
  events: number;
  strict: number;
  decisions: number;
  candidates: number;
  bets: number;
  start: number;
  end: number | null;
  pnl: number | null;
  roi: number | null;
  max_dd: number | null;
  sharpe: number | null;
  status: "VALID" | "INSUFFICIENT_DATA" | "INCOMPLETE" | "RESEARCH_NOT_CAPITAL";
};

export type ResearchDiag025 = {
  events: number;
  with_odds: number;
  decisions: number;
  would_be_edge_candidates_if_illegal_date_only: number;
  bets: 0;
  market_brier: number | null;
  frequency_brier: number | null;
  form_brier: number | null;
  elo_brier: number | null;
  poisson_brier: number | null;
  market_beats_frequency: boolean | null;
  note: string;
};

export type AcademicCandidate025 = {
  name: string;
  paperUrl: string;
  datasetUrl: string | null;
  license: string;
  files: string;
  coverage: string;
  events: string;
  timestampPrecision: string;
  kickoff: string;
  odds: string;
  provenance: string;
  redistribution: string;
  acquired: boolean;
};
