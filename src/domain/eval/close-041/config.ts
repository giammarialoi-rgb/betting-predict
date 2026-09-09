import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { storeRoot039 } from "@/domain/eval/live-039/config";
import { FROZEN_031_SHA256_041, type Exp041Config } from "@/domain/eval/close-041/types";

export function exp041Path(): string {
  return join(process.cwd(), "experiments", "exp_041_prospective_close.json");
}

export function experimentSha041(): string {
  return createHash("sha256").update(readFileSync(exp041Path())).digest("hex");
}

export function loadExp041Config(): Exp041Config {
  const raw = JSON.parse(readFileSync(exp041Path(), "utf8")) as Exp041Config;
  if (raw.experiment_id !== "exp_041_prospective_close") {
    throw new ExperimentIntegrityError("bad experiment_id");
  }
  if (
    raw.winner !== null ||
    raw.auto_promotion !== false ||
    raw.real_money !== false ||
    raw.open_task_042 !== false ||
    raw.historical_hunt !== false ||
    raw.modify_frozen_031 !== false ||
    raw.count_legacy_031_as_new_strict !== false ||
    raw.client_retrieved_as_quote !== false ||
    raw.date_only_promoted_to_strict !== false ||
    raw.close_in_decision !== false ||
    raw.refit_market_devig !== false ||
    raw.optimize_on_test !== false ||
    raw.invent_timestamps !== false ||
    raw.synthetic_data !== false ||
    raw.capital_gate !== false ||
    raw.consume_task_039_store !== true ||
    raw.legacy_dataset_sha256 !== FROZEN_031_SHA256_041 ||
    raw.baseline !== "MARKET_DEVIG" ||
    raw.settled_target !== 100
  ) {
    throw new ExperimentIntegrityError("frozen TASK 041 flags violated");
  }
  return raw;
}

export function sourceStore041(override?: string): string {
  return override ?? storeRoot039();
}

export function artifactsRoot041(): string {
  return join(process.cwd(), "artifacts", "task-041");
}
