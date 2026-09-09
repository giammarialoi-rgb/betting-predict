export const PARSER_VERSION_033 = "task-033-parser-v1";
export const FROZEN_031_SHA256 =
  "6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b";
export const FROZEN_032_FINGERPRINT =
  "fd252d57021317754e2a056b3b59fc11e9df108ac7aaa00e95481caa5a383239";

export const MARKET_ROWS_033 = [
  "1X2",
  "OU",
  "BTTS",
  "AH",
  "DC",
  "DNB",
  "Correct Score",
  "Corners",
  "Cards",
  "Player",
  "Exchange",
] as const;

export type MarketRow033 = (typeof MARKET_ROWS_033)[number];

export type TemporalClass033 =
  | "LEVEL_A_EXACT"
  | "LEVEL_B_EXACT"
  | "LEVEL_B_DATE_ONLY"
  | "DERIVED"
  | "UNKNOWN"
  | "POST_MATCH"
  | "FORBIDDEN";

export type SourceKind033 = "OFFICIAL" | "MIRROR" | "REDISTRIBUTION" | "UNKNOWN";

export type MarketVerdict033 =
  | "NOT_OBSERVED"
  | "RESEARCH_ONLY"
  | "INSUFFICIENT_N"
  | "NO_DEMONSTRATED_EDGE"
  | "EDGE_CANDIDATE"
  | "EDGE_CONFIRMED";

export type LabVerdict033 = "EDGE_CONFIRMED" | "EDGE_CANDIDATE" | "NO_DEMONSTRATED_EDGE" | "INSUFFICIENT_DATA";

export type WindowId033 =
  | "72h"
  | "48h"
  | "24h"
  | "12h"
  | "6h"
  | "3h"
  | "1h"
  | "30m"
  | "15m"
  | "5m"
  | "1m";

export const WINDOW_SECONDS_033: Record<WindowId033, number> = {
  "72h": 72 * 3600,
  "48h": 48 * 3600,
  "24h": 24 * 3600,
  "12h": 12 * 3600,
  "6h": 6 * 3600,
  "3h": 3 * 3600,
  "1h": 3600,
  "30m": 1800,
  "15m": 900,
  "5m": 300,
  "1m": 60,
};

export type Exp033Config = {
  experiment_id: string;
  dataset_id: string;
  immutable_1x2_ref: {
    dataset_version: string;
    dataset_file: string;
    dataset_sha256: string;
    copied: false;
    retest_1x2_models: false;
  };
  as_of_policy: string;
  baseline: string;
  test_locked: true;
  holdout_locked: true;
  min_strict_events_model_ready: number;
  alpha: number;
  ece_bins: number;
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
  invent_available_at: false;
  invent_timestamps: false;
  invent_timezone: false;
  modify_frozen_031: false;
  retest_task_032: false;
  open_task_034: false;
  carry_forward_032: Carry032;
  solar_years: number[];
};

export type Carry032 = {
  experiment_id: string;
  fingerprint: string;
  verdict: "NO_DEMONSTRATED_EDGE";
  strict_events: number;
  test_n: number;
  market_brier: number;
  market_logloss: number;
  selected_on_val: string;
  selected_delta_brier: number;
  holm_any_reject: false;
  holdout: "EMPTY";
  qualified: false;
  winner: null;
};

export type InventoryFile033 = {
  path: string;
  bytes: number;
  sha256: string | null;
  hashed: boolean;
};

export type MarketAuditRow033 = {
  market: MarketRow033;
  observed: boolean;
  strict_events: number;
  research_events: number;
  model: string | null;
  test_brier: number | null;
  market_brier: number | null;
  delta: number | null;
  ci95: string;
  holm_p: string;
  holdout: string;
  verdict: MarketVerdict033;
  temporal_class: TemporalClass033 | "MIXED" | "—";
  note: string;
};

export type AnnualRow033 = {
  year_label: string;
  market: string;
  strict: number;
  decisions: number;
  bets: number;
  start: number;
  end: number | null;
  pnl: number | null;
  roi: number | null;
  max_dd: number | null;
  model: string | null;
  status: "NO_EDGE" | "INSUFFICIENT_DATA" | "INSUFFICIENT_N" | "INCOMPLETE_YEAR" | "NOT_OBSERVED";
};

export type Probe033 = {
  id: string;
  url: string;
  cluster: SourceKind033;
  attempted: boolean;
  acquired: boolean;
  http_status: number | null;
  sha256: string | null;
  classification: string;
  note: string;
};

export type BasicMarket033 = {
  market_id: string;
  market_type: string;
  family: MarketRow033;
  event_id: string;
  event_name: string | null;
  kickoff: string | null;
  timezone: string | null;
  prematch_ticks: number;
  last_prematch_pt: string | null;
  last_prematch_ltp: number | null;
  windows: Record<WindowId033, boolean>;
  capital_eligible: false;
};
