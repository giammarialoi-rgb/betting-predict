/**
 * Phase 9 OOS backtest types.
 * Odds never enter independent feature vectors.
 * NEON NON UTILIZZATO.
 */

import type { PiLabel, PiMatchRow, PiProb3 } from "@/domain/eval/predictive-intelligence/types";

export type Phase9ModelId =
  | "INDEPENDENT_POISSON_v1"
  | "DIXON_COLES_v1"
  | "NEGBIN_v1"
  | "INDEPENDENT_LOGISTIC_v1"
  | "GBM_STUMPS_v1";

export type Phase9BaselineId =
  | "UNIFORM_1X2"
  | "HISTORICAL_HDA"
  | "LEAGUE_FREQ"
  | "HOME_ADVANTAGE"
  | "MARKET_DEVIG_OPEN";

export type Phase9RegistryStatus =
  | "EXPERIMENTAL"
  | "VALIDATED"
  | "CANDIDATE"
  | "PROMOTED"
  | "RETIRED"
  | "INSUFFICIENT_EVIDENCE";

export type Phase9SplitKind = "chronological" | "walk_forward";

export type Phase9Match = PiMatchRow & {
  /** Optional O/U 2.5 open prices parsed from raw CSV overlay — never a feature. */
  odds_ou25?: { over: number | null; under: number | null };
};

export type Phase9Window = {
  window_id: string;
  kind: Phase9SplitKind;
  train_seasons: string[];
  val_seasons: string[];
  oos_seasons: string[];
  train_start: string;
  train_end: string;
  val_start: string;
  val_end: string;
  oos_start: string;
  oos_end: string;
  train_n: number;
  val_n: number;
  oos_n: number;
};

export type Confusion3 = {
  HOME: { HOME: number; DRAW: number; AWAY: number };
  DRAW: { HOME: number; DRAW: number; AWAY: number };
  AWAY: { HOME: number; DRAW: number; AWAY: number };
};

export type BinaryMetrics = {
  n: number;
  precision: number | null;
  recall: number | null;
  accuracy: number;
  brier: number;
  log_loss: number;
  auc: number | null;
};

export type GoalMetrics = {
  n: number;
  mae_home: number;
  mae_away: number;
  rmse_home: number;
  rmse_away: number;
  poisson_deviance: number | null;
};

export type Phase9QualityMetrics = {
  n: number;
  log_loss: number;
  brier: number;
  accuracy: number;
  balanced_accuracy: number;
  calibration_error: number;
  roc_auc_ovr: number | null;
  confusion: Confusion3;
  binary_one_vs_rest: Record<PiLabel, BinaryMetrics>;
  goals: GoalMetrics | null;
  insufficient: boolean;
  insufficient_reason: string | null;
};

export type Phase9ValueSlice = {
  edge_threshold: number;
  chosen_on: "VAL" | "GRID_REPORT_ONLY";
  n_bets: number;
  hit_rate: number | null;
  yield: number | null;
  roi: number | null;
  max_drawdown: number | null;
  profit: number | null;
  longest_losing_streak: number;
  longest_winning_streak: number;
  insufficient: boolean;
  reason: string | null;
};

export type Phase9MarketId =
  | "1X2"
  | "DC"
  | "DNB"
  | "BTTS"
  | "OU_0_5"
  | "OU_1_5"
  | "OU_2_5"
  | "OU_3_5"
  | "MULTIGOL_1_2"
  | "MULTIGOL_1_3"
  | "MULTIGOL_2_3"
  | "MULTIGOL_2_4"
  | "TEAM_GOALS_HOME_O0_5"
  | "TEAM_GOALS_HOME_O1_5"
  | "TEAM_GOALS_AWAY_O0_5"
  | "TEAM_GOALS_AWAY_O1_5"
  | "CORNERS_O8_5"
  | "CORNERS_O9_5"
  | "CORNERS_O10_5"
  | "CARDS_O3_5"
  | "CARDS_O4_5";

export type Phase9MarketEval = {
  market_id: Phase9MarketId;
  settlement_n: number;
  coverage: number;
  has_historical_odds: boolean;
  model_quality: Phase9QualityMetrics | BinaryMetrics | null;
  value: Phase9ValueSlice | null;
  note: string;
};

export type Phase9Robustness = {
  n: number;
  bootstrap_n: number;
  log_loss_mean: number | null;
  log_loss_se: number | null;
  log_loss_ci95: [number, number] | null;
  brier_mean: number | null;
  brier_se: number | null;
  brier_ci95: [number, number] | null;
  yield_mean: number | null;
  yield_se: number | null;
  yield_ci95: [number, number] | null;
  pnl_concentration_top10pct: number | null;
  max_single_bet_share: number | null;
  snooping_thresholds_tested: number;
  insufficient: boolean;
  reason: string | null;
};

export type Phase9PredRow = {
  canonical_id: string;
  season: string;
  league: string;
  match_date: string;
  y: PiLabel;
  fthg: number;
  ftag: number;
  p: PiProb3;
  market_p: PiProb3 | null;
  odds: { home: number | null; draw: number | null; away: number | null } | null;
  lambda_home: number | null;
  lambda_away: number | null;
};

export const PHASE9_NON_DETERMINABILE = "NON DETERMINABILE CON I DATI DISPONIBILI";
