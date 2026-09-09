import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Exp025Config } from "@/domain/eval/turnaround-025/types";

export function loadExp025Config(): Exp025Config {
  const raw = JSON.parse(
    readFileSync(
      join(process.cwd(), "experiments", "exp_025_real_data_turnaround_v1.json"),
      "utf8",
    ),
  ) as Exp025Config;
  if (raw.experiment_id !== "exp_025_real_data_turnaround_v1") {
    throw new Error("bad experiment_id");
  }
  if (
    raw.retroactive_optimization !== false ||
    raw.auto_promote !== false ||
    raw.winner !== null ||
    raw.real_money !== false ||
    raw.declared_edge !== false ||
    raw.strategy_selected_from_pnl !== false ||
    raw.close_in_decision !== false ||
    raw.date_only_in_strict_capital !== false ||
    raw.invent_available_at !== false ||
    raw.invent_timezone !== false ||
    raw.auto_purchase !== false ||
    raw.use_user_credentials !== false
  ) {
    throw new Error("ExperimentIntegrityError: frozen TASK 025 flags violated");
  }
  if (raw.as_of_policy !== "STRICT_AS_OF") {
    throw new Error("ExperimentIntegrityError: STRICT_AS_OF frozen");
  }
  if (raw.frozen_model_id !== "market_devig") {
    throw new Error("ExperimentIntegrityError: frozen_model_id must stay market_devig");
  }
  if (raw.frozen_edge_threshold !== 0.03) {
    throw new Error("ExperimentIntegrityError: edge threshold must stay predeclared 0.03");
  }
  return raw;
}

export function assertHoldoutUntouched025(input: {
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

export const KAGGLE_CACHE = join(
  process.cwd(),
  "audit",
  "external",
  "task-025",
  "betfair-sports.csv",
);
