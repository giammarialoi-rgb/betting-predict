import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Exp022Config } from "@/domain/eval/recovery-022/types";

export function loadExp022Config(): Exp022Config {
  const raw = JSON.parse(
    readFileSync(
      join(process.cwd(), "experiments", "exp_022_historical_odds_recovery_v1.json"),
      "utf8",
    ),
  ) as Exp022Config;
  if (raw.experiment_id !== "exp_022_historical_odds_recovery_v1") {
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
    raw.relative_auto_promoted_to_absolute !== false ||
    raw.approx_relative_in_strict_capital !== false ||
    raw.max_avg_as_bookmaker !== false
  ) {
    throw new Error("ExperimentIntegrityError: frozen TASK 022 flags violated");
  }
  if (raw.as_of_policy !== "STRICT_AS_OF") {
    throw new Error("ExperimentIntegrityError: STRICT_AS_OF frozen");
  }
  if (raw.frozen_model_id !== "frequency") {
    throw new Error("ExperimentIntegrityError: frozen_model_id must stay frequency");
  }
  if (raw.dataset_id !== "beat_the_bookie_temporal_v1") {
    throw new Error("ExperimentIntegrityError: dataset_id frozen");
  }
  return raw;
}

export function assertHoldoutUntouched022(input: {
  holdoutYears: readonly number[];
  usedHoldoutForSelection: boolean;
}): void {
  if (input.usedHoldoutForSelection) {
    throw new Error("HOLDOUT_SACRED: holdout must not choose model/staking/threshold");
  }
  if (!input.holdoutYears.includes(2015)) {
    throw new Error("HOLDOUT_SACRED: 2015 (last acquired closing year) must remain listed");
  }
}
