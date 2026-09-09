import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import type { Exp031Config } from "@/domain/eval/breakthrough-031/types";

export const TASK031_CACHE_DIR = join(process.cwd(), "audit", "external", "task-031");
export const TASK031_ARTIFACTS_DIR = join(process.cwd(), "artifacts", "task-031");

export function loadExp031Config(): Exp031Config {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), "experiments", "exp_031_final_data_breakthrough.json"), "utf8"),
  ) as Exp031Config;
  if (raw.experiment_id !== "exp_031_final_data_breakthrough") {
    throw new ExperimentIntegrityError("bad experiment_id");
  }
  if (
    raw.winner !== null ||
    raw.declared_best !== false ||
    raw.auto_promotion !== false ||
    raw.auto_promote !== false ||
    raw.real_money !== false ||
    raw.feature_selection_on_test !== false ||
    raw.holdout_for_training !== false ||
    raw.random_split !== false ||
    raw.close_in_decision !== false ||
    raw.date_only_promoted_to_strict !== false ||
    raw.invent_available_at !== false ||
    raw.invent_timestamps !== false ||
    raw.invent_timezone !== false ||
    raw.modify_frozen_028 !== false ||
    raw.modify_frozen_030_model !== false ||
    raw.masaniello_production !== false
  ) {
    throw new ExperimentIntegrityError("frozen TASK 031 flags violated");
  }
  if (raw.as_of_policy !== "STRICT_AS_OF") throw new ExperimentIntegrityError("STRICT_AS_OF frozen");
  if (raw.primary_metric !== "brier_test") throw new ExperimentIntegrityError("primary_metric frozen");
  if (raw.baseline !== "market_devig") throw new ExperimentIntegrityError("baseline frozen");
  if (raw.primary_risk_policy !== "actuarial_v1") {
    throw new ExperimentIntegrityError("production staking must stay actuarial_v1");
  }
  if (raw.frozen_030_model_version !== "task-030-residual-v1") {
    throw new ExperimentIntegrityError("TASK 030 model must stay frozen");
  }
  return raw;
}

export function assertHoldoutUntouched031(usedHoldoutForSelection: boolean): void {
  if (usedHoldoutForSelection) {
    throw new ExperimentIntegrityError("HOLDOUT cannot influence model selection");
  }
}
