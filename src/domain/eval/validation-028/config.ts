import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Exp028Config } from "@/domain/eval/validation-028/types";

export function loadExp028Config(): Exp028Config {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), "experiments", "exp_028_scientific_validation_v1.json"), "utf8"),
  ) as Exp028Config;
  if (raw.experiment_id !== "exp_028_scientific_validation_v1") {
    throw new Error("bad experiment_id");
  }
  if (
    raw.winner !== null ||
    raw.declared_best !== false ||
    raw.auto_promote !== false ||
    raw.real_money !== false ||
    raw.retroactive_optimization !== false ||
    raw.strategy_selected_from_pnl !== false ||
    raw.threshold_selected_from_test !== false ||
    raw.close_in_decision !== false ||
    raw.holdout_for_training !== false ||
    raw.random_split !== false ||
    raw.invent_available_at !== false
  ) {
    throw new Error("ExperimentIntegrityError: frozen TASK 028 flags violated");
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
  if (raw.dataset_exclusions.length !== 0) {
    throw new Error("ExperimentIntegrityError: exclusions must stay empty (predeclared)");
  }
  return raw;
}
