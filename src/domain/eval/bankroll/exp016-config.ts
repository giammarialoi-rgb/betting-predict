/**
 * Frozen risk policy loader — immutable experiment artifact.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Exp016Config = {
  experiment_id: string;
  immutable: true;
  policy_version: string;
  model_version: string;
  feature_version: string;
  dataset_version: string;
  evidence_version: string;
  as_of_policy: "RESEARCH" | "STRICT_AS_OF" | "ANY";
  initial_bankroll_per_year: number;
  solar_years_requested: number[];
  dataset_years_available: number[];
  insufficient_history_years: number[];
  incomplete_years: number[];
  holdout_years: number[];
  markets_admitted: string[];
  markets_blocked: string[];
  selection_rules: {
    market: string;
    selection: string;
    bookmaker_price: string;
    min_books: number;
    require_evidence: true;
    require_assessment: true;
    no_position_if_ruin_risk_high: boolean;
  };
  quality_gates: {
    unknown_temporal_precision_allowed_for_diagnostic: boolean;
    model_ready_required: false;
    declared_edge: false;
    source_reliability: null;
  };
  risk_policies: string[];
  primary_candidate: string;
  sizing: {
    flat_unit: number;
    kelly_fractional_factor: number;
    max_stake_fraction_event: number;
    max_stake_fraction_market: number;
    max_exposure_per_match: number;
    max_correlated_exposure: number;
    max_daily_exposure: number;
    bankroll_floor_fraction: number;
    drawdown_reduction_start: number;
    drawdown_reduction_factor: number;
    masaniello_target_hits_per_cycle: number;
    masaniello_cycle_length: number;
    masaniello_safety: number;
  };
  correlation: {
    guard: string;
    max_cluster_fraction: number;
  };
  monte_carlo: {
    enabled_as_diagnostic_only: true;
    n_paths: number;
    seed: number;
  };
  auto_promotion: false;
  winner: null;
  real_money: false;
};

let cached: Exp016Config | null = null;

export function loadExp016Config(): Exp016Config {
  if (cached) return cached;
  const path = join(
    process.cwd(),
    "experiments",
    "exp_016_actuarial_bankroll_v1.json",
  );
  const raw = JSON.parse(readFileSync(path, "utf8")) as Exp016Config;
  if (raw.experiment_id !== "exp_016_actuarial_bankroll_v1") {
    throw new Error("EXP016: unexpected experiment_id");
  }
  if (raw.immutable !== true) {
    throw new Error("EXP016: config must be immutable");
  }
  if (raw.auto_promotion !== false || raw.winner !== null) {
    throw new Error("EXP016: auto_promotion forbidden / winner must be null");
  }
  cached = raw;
  return raw;
}

/** Test helper — reset cache if needed. */
export function clearExp016ConfigCache(): void {
  cached = null;
}
