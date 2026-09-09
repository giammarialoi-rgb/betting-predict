import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { storeRoot039 } from "@/domain/eval/live-039/config";
import { FROZEN_031_SHA256_040, type Exp040Config } from "@/domain/eval/recover-040/types";

export function exp040Path(): string {
  return join(process.cwd(), "experiments", "exp_040_recover_live.json");
}

export function experimentSha040(): string {
  return createHash("sha256").update(readFileSync(exp040Path())).digest("hex");
}

export function loadExp040Config(): Exp040Config {
  const raw = JSON.parse(readFileSync(exp040Path(), "utf8")) as Exp040Config;
  if (raw.experiment_id !== "exp_040_recover_live") {
    throw new ExperimentIntegrityError("bad experiment_id");
  }
  if (
    raw.winner !== null ||
    raw.auto_promotion !== false ||
    raw.real_money !== false ||
    raw.open_task_041 !== false ||
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
    raw.legacy_dataset_sha256 !== FROZEN_031_SHA256_040 ||
    raw.baseline !== "MARKET_DEVIG"
  ) {
    throw new ExperimentIntegrityError("frozen TASK 040 flags violated");
  }
  return raw;
}

export function sourceStore040(override?: string): string {
  return override ?? storeRoot039();
}

export function artifactsRoot040(): string {
  return join(process.cwd(), "artifacts", "task-040");
}

export function storeRoot040(override?: string): string {
  return override ?? join(process.cwd(), "audit", "external", "task-040");
}
