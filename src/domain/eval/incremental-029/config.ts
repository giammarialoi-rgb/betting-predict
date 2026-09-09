import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Exp029Config } from "@/domain/eval/incremental-029/types";

export function loadExp029Config(): Exp029Config {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), "experiments", "exp_029_information_incremental_v1.json"), "utf8"),
  ) as Exp029Config;
  if (raw.experiment_id !== "exp_029_information_incremental_v1") {
    throw new Error("bad experiment_id");
  }
  if (
    raw.winner !== null ||
    raw.declared_best !== false ||
    raw.auto_promote !== false ||
    raw.real_money !== false ||
    raw.feature_selection_on_test !== false ||
    raw.holdout_for_training !== false ||
    raw.random_split !== false ||
    raw.close_in_decision !== false ||
    raw.date_only_promoted_to_strict !== false ||
    raw.invent_available_at !== false ||
    raw.invent_timestamps !== false
  ) {
    throw new Error("ExperimentIntegrityError: frozen TASK 029 flags violated");
  }
  if (raw.as_of_policy !== "STRICT_AS_OF") {
    throw new Error("ExperimentIntegrityError: STRICT_AS_OF frozen");
  }
  return raw;
}
