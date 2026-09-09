import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Exp027Config } from "@/domain/eval/breakthrough-027/types";

export const TASK027_CACHE_DIR = join(process.cwd(), "audit", "external", "task-027");

export function loadExp027Config(): Exp027Config {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), "experiments", "exp_027_data_breakthrough_v1.json"), "utf8"),
  ) as Exp027Config;
  if (raw.experiment_id !== "exp_027_data_breakthrough_v1") {
    throw new Error("bad experiment_id");
  }
  if (
    raw.retroactive_optimization !== false ||
    raw.auto_promote !== false ||
    raw.winner !== null ||
    raw.real_money !== false ||
    raw.declared_edge !== true ||
    raw.strategy_selected_from_pnl !== false ||
    raw.close_in_decision !== false ||
    raw.date_only_in_strict_capital !== false ||
    raw.invent_available_at !== false ||
    raw.invent_timezone !== false ||
    raw.assume_btb_datetime_utc !== false ||
    raw.assume_kickoff_1500 !== false ||
    raw.nearest_match_in_strict !== false ||
    raw.auto_purchase !== false ||
    raw.use_user_credentials !== false ||
    raw.mirror_as_licensed_capital !== false ||
    raw.kaggle_unknown_license_in_capital !== false ||
    raw.kaggle_ah_in_capital !== false
  ) {
    throw new Error("ExperimentIntegrityError: frozen TASK 027 flags violated");
  }
  if (raw.as_of_policy !== "STRICT_AS_OF") {
    throw new Error("ExperimentIntegrityError: STRICT_AS_OF frozen");
  }
  if (raw.frozen_model_id !== "elo") {
    throw new Error("ExperimentIntegrityError: frozen_model_id must stay elo");
  }
  if (raw.frozen_edge_threshold !== 0.03) {
    throw new Error("ExperimentIntegrityError: edge threshold must stay predeclared 0.03");
  }
  if (raw.min_train_events !== 200) {
    throw new Error("ExperimentIntegrityError: min_train_events must stay 200");
  }
  return raw;
}

export function assertHoldoutUntouched027(input: {
  holdoutYears: readonly number[];
  usedHoldoutForSelection: boolean;
}): void {
  if (input.usedHoldoutForSelection) {
    throw new Error("HOLDOUT_SACRED: holdout must not choose model/staking/threshold");
  }
  if (!input.holdoutYears.includes(2020)) {
    throw new Error("HOLDOUT_SACRED: 2020+ must remain listed");
  }
}

export function kaggleAustroZipPath(): string {
  return join(TASK027_CACHE_DIR, "kaggle-austro.zip");
}

export function kaggleAustroExtractDir(): string {
  return join(TASK027_CACHE_DIR, "kaggle-austro");
}

export function strictCandidatesPath(): string {
  return join(TASK027_CACHE_DIR, "strict-candidates.csv");
}

export function miniStrictPath(): string {
  return join(process.cwd(), "src", "domain", "eval", "breakthrough-027", "fixtures", "mini-strict.csv");
}
