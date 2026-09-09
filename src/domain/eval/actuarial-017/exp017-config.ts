/**
 * TASK 017 config loader.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Exp017Config = {
  experiment_id: string;
  immutable: true;
  dataset_version: string;
  feature_version: string;
  model_versions: string[];
  champion_for_bankroll: string;
  declared_edge: false;
  risk_engine_version: string;
  evidence_version: string;
  as_of_policy: string;
  blind_replay: true;
  annual_initial_bankroll: number;
  holdout_sacred: true;
  holdout_years: number[];
  partitions: Record<string, number[]>;
  HOLDOUT_TOUCHED: false;
  real_money: false;
  auto_promotion: false;
  winner: null;
  masaniello_champion: false;
  solar_years_requested: number[];
  markets_admitted_for_bankroll: string[];
  markets_blocked: string[];
  secondary_dataset: {
    id: string;
    role: string;
    status: string;
    audit_summary: string;
    commit_sha_from_audit: string;
  };
};

let cached: Exp017Config | null = null;

export function loadExp017Config(): Exp017Config {
  if (cached) return cached;
  const raw = JSON.parse(
    readFileSync(
      join(process.cwd(), "experiments", "exp_017_blind_actuarial_replay_v1.json"),
      "utf8",
    ),
  ) as Exp017Config;
  if (raw.experiment_id !== "exp_017_blind_actuarial_replay_v1") {
    throw new Error("EXP017: bad experiment_id");
  }
  if (raw.HOLDOUT_TOUCHED !== false) {
    throw new Error("EXP017: HOLDOUT_TOUCHED must be false");
  }
  if (raw.auto_promotion !== false || raw.winner !== null) {
    throw new Error("EXP017: auto_promotion/winner violation");
  }
  if (raw.masaniello_champion !== false) {
    throw new Error("EXP017: Masaniello cannot be champion");
  }
  cached = raw;
  return raw;
}
