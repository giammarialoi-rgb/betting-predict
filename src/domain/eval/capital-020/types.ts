/**
 * TASK 020 — sport-agnostic market snapshots, lineage, extended temporal classes.
 */

export const PARSER_VERSION_020 = "task-020-parser-v1";

export type TemporalClass020 =
  | "EXACT_DECISION_TIME"
  | "EXACT_OBSERVATION_TIME"
  | "OPEN_TIME_EXACT"
  | "CLOSE_TIME_EXACT"
  | "DATE_ONLY"
  | "DATASET_WINDOW"
  | "UNKNOWN";

export const STRICT_CAPITAL_CLASSES: readonly TemporalClass020[] = [
  "EXACT_DECISION_TIME",
  "EXACT_OBSERVATION_TIME",
  "OPEN_TIME_EXACT",
];

export type SportId020 =
  | "football"
  | "basketball"
  | "tennis"
  | "baseball"
  | "ice_hockey"
  | "american_football"
  | "rugby"
  | "volleyball"
  | "handball"
  | "cricket"
  | "motor_sports"
  | "combat_sports"
  | "other";

export type SourceLineage = {
  sourceId: string;
  upstreamSource: string;
  publisher: string;
  dataset: string;
  repository: string | null;
  license: string;
  retrievedAt: string;
  upstreamCluster: string;
  independence: "PRIMARY" | "REDISTRIBUTION" | "SECONDARY_INDEX" | "BLOCKED";
};

export type MarketSnapshot = {
  sport: SportId020;
  eventId: string;
  marketType: string;
  line: number | null;
  selection: string;
  bookmaker: string;
  odds: number;
  observedAt: string;
  availableAt: string | null;
  temporalClass: TemporalClass020;
  temporalBasis: string;
  sourceId: string;
  upstreamCluster: string;
  observationKind: "open" | "intermediate" | "latest" | "close" | "unknown";
};

export type Exp020Config = {
  experiment_id: string;
  initial_bankroll: number;
  as_of_policy: string;
  declared_edge: false;
  retroactive_optimization: false;
  auto_promote: false;
  winner: null;
  real_money: false;
  holdout_years: number[];
  train_years: number[];
  val_years: number[];
  test_years: number[];
  solar_years: number[];
  frozen_model_id: string;
  model_frozen_before_holdout: true;
  close_in_decision: false;
  date_only_in_strict_capital: false;
  sizing: {
    flat_unit: number;
    kelly_fractional_factor: number;
    max_stake_fraction_event: number;
    max_correlated_exposure: number;
    min_train_events_for_model: number;
  };
};

export type AnnualCapitalRow = {
  year: number;
  data_status: "OK" | "INSUFFICIENT_DATA" | "INCOMPLETE";
  insufficient_reason: string | null;
  valid_data: number;
  decisions: number;
  bets: number;
  wins: number;
  losses: number;
  pushes: number;
  start: number;
  final: number | null;
  pnl: number | null;
  roi: number | null;
  max_dd: number | null;
  max_dd_absolute: number | null;
  peak: number | null;
  lowest: number | null;
  turnover: number;
  average_exposure: number | null;
  maximum_exposure: number | null;
  model: string;
};

export type ModelCompareRow = {
  period: string;
  market: string;
  n: number;
  market_brier: number | null;
  model_brier: number | null;
  market_logloss: number | null;
  model_logloss: number | null;
  calibration: string;
  significant: false;
  used_for_capital: false;
  note: string;
};

export type EvidenceCite020 = {
  source: string;
  title: string;
  url: string | null;
  published_at: string | null;
  available_at: string | null;
  claim: string;
  polarity: string;
};

export type DecisionRecord020 = {
  eventId: string;
  year: number;
  market: string;
  decision: "BET" | "NO_BET";
  reason: string;
  probability: number | null;
  odds: number | null;
  edge: number | null;
  supporting: number;
  contradicting: number;
  contextual: number;
  sourceId: string;
  locked: true;
  outcome_in_decision: false;
  evidence: EvidenceCite020[];
};

export type ErrorClass020 =
  | "MODEL_ERROR"
  | "DATA_ERROR"
  | "TEMPORAL_ERROR"
  | "MARKET_ERROR"
  | "CALIBRATION_ERROR"
  | "CORRELATION_ERROR"
  | "SOURCE_CONFLICT"
  | "INSUFFICIENT_INFORMATION";

export type GithubRepoAudit = {
  repository: string;
  author: string;
  license: string;
  original_source: string;
  coverage: string;
  sports: string[];
  competitions: string;
  markets: string;
  bookmakers: string;
  timestamps: string;
  open_close_semantics: string;
  historical_depth: string;
  granularity: string;
  provenance: string;
  independence: string;
  access: string;
  legal: string;
  usable_strict: false;
};
