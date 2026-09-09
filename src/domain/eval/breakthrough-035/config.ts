import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { FROZEN_031_SHA256_035, type Exp035Config } from "@/domain/eval/breakthrough-035/types";

export function exp035Path(): string {
  return join(process.cwd(), "experiments", "exp_035_data_breakthrough.json");
}

export function experimentSha035(): string {
  return createHash("sha256").update(readFileSync(exp035Path())).digest("hex");
}

export function loadExp035Config(): Exp035Config {
  const raw = JSON.parse(readFileSync(exp035Path(), "utf8")) as Exp035Config;
  if (raw.experiment_id !== "exp_035_data_breakthrough") {
    throw new ExperimentIntegrityError("bad experiment_id");
  }
  if (
    raw.winner !== null ||
    raw.declared_best !== false ||
    raw.auto_promotion !== false ||
    raw.auto_promote !== false ||
    raw.real_money !== false ||
    raw.modify_frozen_031 !== false ||
    raw.feature_selection_on_test !== false ||
    raw.holdout_for_training !== false ||
    raw.close_in_decision !== false ||
    raw.date_only_promoted_to_strict !== false ||
    raw.open_close_promoted_to_timestamp !== false ||
    raw.invent_available_at !== false ||
    raw.invent_timestamps !== false ||
    raw.invent_timezone !== false ||
    raw.invent_quotes !== false ||
    raw.invent_events !== false ||
    raw.invent_capital !== false ||
    raw.use_user_credentials !== false ||
    raw.bypass_auth !== false ||
    raw.mirror_as_independent !== false ||
    raw.synthetic_data !== false ||
    raw.add_new_model_family !== false ||
    raw.open_task_036 !== false ||
    raw.test_locked !== true ||
    raw.holdout_locked !== true ||
    raw.baseline !== "MARKET_DEVIG" ||
    raw.legacy_dataset_sha256 !== FROZEN_031_SHA256_035
  ) {
    throw new ExperimentIntegrityError("frozen TASK 035 flags violated");
  }
  if (raw.corpus_partitions.HOLDOUT.start < raw.corpus_partitions.TEST.end) {
    if (raw.corpus_partitions.HOLDOUT.start <= raw.corpus_partitions.TEST.start) {
      throw new ExperimentIntegrityError("HOLDOUT must be after TEST");
    }
  }
  const p = raw.corpus_partitions;
  if (!(p.TRAIN.end < p.VALIDATION.start && p.VALIDATION.end < p.TEST.start && p.TEST.end < p.HOLDOUT.start)) {
    throw new ExperimentIntegrityError("partitions must be chronological");
  }
  return raw;
}

export function assertTestLocked035(used: boolean): void {
  if (used) throw new ExperimentIntegrityError("TEST locked — no selection");
}

export function assertHoldoutLocked035(used: boolean): void {
  if (used) throw new ExperimentIntegrityError("HOLDOUT locked");
}

export function assertNo036(open: boolean): void {
  if (open) throw new ExperimentIntegrityError("TASK 036 must not be auto-opened");
}

export function assertNoModify031(modify: boolean): void {
  if (modify) throw new ExperimentIntegrityError("TASK_031_BASE is frozen");
}
