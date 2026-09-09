import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Exp020Config } from "@/domain/eval/capital-020/types";

export function loadExp020Config(): Exp020Config {
  const raw = JSON.parse(
    readFileSync(
      join(process.cwd(), "experiments", "exp_020_historical_capital_v1.json"),
      "utf8",
    ),
  ) as Exp020Config;
  if (raw.experiment_id !== "exp_020_historical_capital_v1") {
    throw new Error("bad experiment_id");
  }
  if (
    raw.retroactive_optimization !== false ||
    raw.auto_promote !== false ||
    raw.winner !== null ||
    raw.real_money !== false ||
    raw.declared_edge !== false ||
    raw.close_in_decision !== false ||
    raw.date_only_in_strict_capital !== false ||
    raw.model_frozen_before_holdout !== true
  ) {
    throw new Error("ExperimentIntegrityError: frozen TASK 020 flags violated");
  }
  if (raw.as_of_policy !== "STRICT_AS_OF") {
    throw new Error("ExperimentIntegrityError: STRICT_AS_OF frozen");
  }
  if (raw.frozen_model_id !== "frequency") {
    throw new Error("ExperimentIntegrityError: frozen_model_id must stay predeclared frequency");
  }
  return raw;
}

export function assertHoldoutUntouched(input: {
  holdoutYears: readonly number[];
  usedHoldoutForSelection: boolean;
}): void {
  if (input.usedHoldoutForSelection) {
    throw new Error("HOLDOUT_SACRED: holdout must not choose model/staking/threshold");
  }
  if (!input.holdoutYears.includes(2024)) {
    throw new Error("HOLDOUT_SACRED: 2024+ must remain listed");
  }
}
