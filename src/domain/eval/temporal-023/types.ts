/**
 * TASK 023 — temporal odds breakthrough (Betfair Historic BASIC).
 */

export const PARSER_VERSION_023 = "task-023-parser-v1";
export const DATASET_ID_023 = "betfair_historic_basic_v1";
export const MATCH_ODDS_FIXTURE_SHA256 =
  "f30b7d7b38bae59c5cff4f2a149b9a5ed3a5ef2ba9070c8a2c2ad09bc07b7f6f";
export const FULL_FOOTBALL_SAMPLE_SHA256 =
  "9a41d7ebf6884fa6ad6d2dbdd943e92bd24502b9a4ce00b2fe168c30e61fcdae";

export type Task023Verdict =
  | "STRICT_UNLOCKED"
  | "PARTIAL_STRICT"
  | "INSUFFICIENT_DATA"
  | "ACQUISITION_BLOCKED"
  | "DATA_INVALID";

export type SourceClass023 =
  | "OFFICIAL"
  | "DERIVED"
  | "MIRROR"
  | "SELF_RECORDED"
  | "ACADEMIC";

export type Phase023 = "PREMATCH" | "INPLAY" | "POSTMATCH" | "UNKNOWN";

export type TemporalPrecision023 = "exact" | "date" | "dataset_window" | "unknown";

export type AsOfWindowId =
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

export const AS_OF_WINDOWS: readonly { window: AsOfWindowId; requestedSec: number }[] = [
  { window: "72h", requestedSec: 72 * 3600 },
  { window: "48h", requestedSec: 48 * 3600 },
  { window: "24h", requestedSec: 24 * 3600 },
  { window: "12h", requestedSec: 12 * 3600 },
  { window: "6h", requestedSec: 6 * 3600 },
  { window: "3h", requestedSec: 3 * 3600 },
  { window: "1h", requestedSec: 3600 },
  { window: "30m", requestedSec: 1800 },
  { window: "15m", requestedSec: 900 },
  { window: "5m", requestedSec: 300 },
  { window: "1m", requestedSec: 60 },
];

export type Exp023Config = {
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
  inplay_false_as_prematch: false;
  interpolate_snapshots: false;
  forward_fill_future: false;
  auto_purchase: false;
  use_user_credentials: false;
  holdout_years: number[];
  train_years: number[];
  val_years: number[];
  test_years: number[];
  solar_years: number[];
  primary_risk_policy: string;
  risk_policies: string[];
};

export type RunnerState023 = {
  selectionId: number;
  selectionName: string;
  status: string;
  sortPriority: number | null;
};

export type MarketDefinition023 = {
  marketId: string;
  eventId: string | null;
  eventName: string | null;
  marketType: string | null;
  marketStartTime: string | null;
  openDate: string | null;
  timezone: string | null;
  countryCode: string | null;
  status: string | null;
  inPlay: boolean | null;
  settledTime: string | null;
  runners: RunnerState023[];
  publishTimeMs: number;
};

export type PriceTick023 = {
  marketId: string;
  eventId: string | null;
  eventName: string | null;
  marketType: string | null;
  marketStartTime: string | null;
  publishTimeMs: number;
  publishTimeIso: string;
  selectionId: number;
  selectionName: string;
  lastPriceTraded: number;
  availableToBack: number | null;
  availableToLay: number | null;
  tradedVolume: number | null;
  ladderDepth: number | null;
  status: string | null;
  inPlay: boolean | null;
  phase: Phase023;
  secondsToKickoff: number | null;
  temporalPrecision: TemporalPrecision023;
};

export type ParsedStream023 = {
  lines: number;
  parseFail: number;
  definitions: MarketDefinition023[];
  ticks: PriceTick023[];
  marketIds: string[];
  eventIds: string[];
  marketTypes: string[];
  batbCount: number;
  atbCount: number;
  atlCount: number;
};

export type CanonicalSnapshot023 = {
  eventId: string;
  kickoff: string;
  asOf: string;
  market: string;
  selection: string;
  price: number | null;
  timestamp: string | null;
  secondsToKickoff: number | null;
  source: string;
  temporalPrecision: TemporalPrecision023;
  status: "OK" | "NO_DATA_AT_ASOF";
};

export type WindowSnapshot023 = {
  window: AsOfWindowId;
  requestedSec: number;
  snapshot_exists: boolean;
  actual_timestamp: string | null;
  seconds_before_kickoff: number | null;
  delta_sec: number | null;
  price_available: boolean;
  bookmaker: "betfair-exchange";
  market_depth: number | null;
  asOf: string;
};

export type FirstAvailable023 = {
  eventId: string;
  marketId: string;
  first_observation_timestamp: string | null;
  last_prematch_timestamp: string | null;
  prematch_observation_count: number;
  median_observation_interval: number | null;
  p95_observation_interval: number | null;
  minimum_observation_interval: number | null;
  maximum_observation_interval: number | null;
};

export type AcquisitionProbe023 = {
  channel: string;
  url: string;
  http_status: number | null;
  content_type: string | null;
  bytes: number | null;
  acquired: boolean;
  source_class: SourceClass023;
  note: string;
};

export type InformationSlot023 = {
  key: string;
  available: boolean;
  availableAt: string | null;
  sourceId: string | null;
  sourceUrl: string | null;
  temporalPrecision: TemporalPrecision023;
  note: string;
};

export type AnnualRow023 = {
  year: number;
  events: number;
  strict_events: number;
  decisions: number;
  bets: number;
  no_bet: number;
  start: number;
  end: number | null;
  pnl: number | null;
  roi: number | null;
  max_dd: number | null;
  total_exposure: number | null;
  clv: number | null;
  brier: number | null;
  logloss: number | null;
  policy: string;
  status: "VALID" | "INSUFFICIENT_DATA" | "INCOMPLETE" | "NOT_ACQUIRED";
};

export type ModelRow023 = {
  model: string;
  n: number;
  brier: number | null;
  logloss: number | null;
  calibration: string;
  roi_diagnostic: number | null;
  clv: number | null;
  max_dd: number | null;
  used_for_capital: false;
  significant: false;
  note: string;
};

export type CostRow023 = {
  events: number;
  basic_gbp: number | null;
  advanced_soccer_gbp: number | null;
  pro_soccer_gbp: number | null;
  cost_per_event_basic: number | null;
  note: string;
};
