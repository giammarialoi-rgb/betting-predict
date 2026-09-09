import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import type { Exp032Config } from "@/domain/eval/incremental-032/types";

export function loadExp032Config(): Exp032Config {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), "experiments", "exp_032_incremental_edge.json"), "utf8"),
  ) as Exp032Config;
  if (raw.experiment_id !== "exp_032_incremental_edge") {
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
    raw.modify_frozen_031 !== false ||
    raw.masaniello_production !== false ||
    raw.test_locked !== true ||
    raw.holdout_locked !== true
  ) {
    throw new ExperimentIntegrityError("frozen TASK 032 flags violated");
  }
  if (raw.as_of_policy !== "STRICT_AS_OF_T_MINUS_1H") {
    throw new ExperimentIntegrityError("as_of_policy frozen");
  }
  if (raw.baseline !== "MARKET_DEVIG") throw new ExperimentIntegrityError("baseline frozen");
  if (raw.dataset_version !== "TASK_031_BASE") throw new ExperimentIntegrityError("dataset frozen");
  if (raw.selection_split !== "TRAIN_VAL_ONLY") {
    throw new ExperimentIntegrityError("selection_split frozen");
  }
  return raw;
}

export function assertTestLocked032(usedTestForSelection: boolean): void {
  if (usedTestForSelection) throw new ExperimentIntegrityError("TEST locked — no selection");
}

export function assertHoldoutLocked032(usedHoldout: boolean): void {
  if (usedHoldout) throw new ExperimentIntegrityError("HOLDOUT locked");
}
