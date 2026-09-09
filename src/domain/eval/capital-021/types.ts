/**
 * TASK 021 — timestamped market ledger + annual capital types.
 */

import type { SportId020 } from "@/domain/eval/capital-020/types";

export const PARSER_VERSION_021 = "task-021-parser-v1";

export type TemporalClass021 =
  | "EXACT_TIMESTAMP"
  | "DATE_ONLY"
  | "DATASET_WINDOW"
  | "UNKNOWN";

export type MarketLifecycle021 =
  | "CATALOGUED"
  | "OBSERVED"
  | "TEMPORALLY_VALID"
  | "MODEL_READY";

export type MarketObservationLedger = {
  sport: SportId020;
  event: string;
  market: string;
  line: number | null;
  selection: string;
  bookmaker: string;
  price: number;
  timestamp: string | null;
  temporal_precision: TemporalClass021;
  source: string;
  source_url: string | null;
  observed_at: string;
  available_at: string | null;
  usable_strict_capital: boolean;
  observationKind: "open" | "intermediate" | "latest" | "close" | "unknown";
  upstreamCluster: string;
};

export type SourceAudit021 = {
  sourceId: string;
  url: string;
  languages: string[];
  intended: string;
  probe: string;
  temporal: TemporalClass021 | "n/a";
  format_verified: boolean;
  acquired: boolean;
  usable_strict: false;
  independence_cluster: string;
  reason: string;
};

export type Exp021Config = {
  experiment_id: string;
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
  holdout_years: number[];
  solar_years: number[];
  primary_risk_policy: string;
  risk_policies: string[];
};

export type AnnualRow021 = {
  year: number;
  dataset: string;
  events: number;
  decisions: number;
  bets: number;
  start: number;
  final: number | null;
  pnl: number | null;
  roi: number | null;
  max_dd: number | null;
  strategy: string;
  confidence: "insufficient" | "untested";
  status: "VALID" | "INSUFFICIENT_DATA" | "INCOMPLETE";
  no_bet_rate: number | null;
  hit_rate: number | null;
  average_odds: number | null;
  average_edge: number | null;
  brier: number | null;
  logloss: number | null;
  calibration: string;
  time_under_water: number | null;
  largest_loss: number | null;
  largest_win: number | null;
  profit_factor: number | null;
  volatility: number | null;
  insufficient_reason: string | null;
};

export type MarketRow021 = {
  market: string;
  lifecycle: MarketLifecycle021;
  events: number;
  bets: number;
  brier: number | null;
  logloss: number | null;
  roi: number | null;
  max_dd: number | null;
  temporally_valid: boolean;
  model_ready: boolean;
  status: string;
};

export type StrategyRow021 = {
  strategy: string;
  role: "operative" | "challenger_unused";
  bets: number;
  pnl: number | null;
  selected_from_pnl: false;
};
