import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { FROZEN_031_SHA256_039, type Exp039Config } from "@/domain/eval/live-039/types";

export function exp039Path(): string {
  return join(process.cwd(), "experiments", "exp_039_prospective_live.json");
}

export function experimentSha039(): string {
  return createHash("sha256").update(readFileSync(exp039Path())).digest("hex");
}

export function loadExp039Config(): Exp039Config {
  const raw = JSON.parse(readFileSync(exp039Path(), "utf8")) as Exp039Config;
  if (raw.experiment_id !== "exp_039_prospective_live") {
    throw new ExperimentIntegrityError("bad experiment_id");
  }
  if (
    raw.winner !== null ||
    raw.auto_promotion !== false ||
    raw.real_money !== false ||
    raw.open_task_040 !== false ||
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
    raw.legacy_dataset_sha256 !== FROZEN_031_SHA256_039 ||
    raw.baseline !== "MARKET_DEVIG"
  ) {
    throw new ExperimentIntegrityError("frozen TASK 039 flags violated");
  }
  return raw;
}

export function storeRoot039(override?: string): string {
  return override ?? join(process.cwd(), "audit", "external", "task-039");
}

export function artifactsRoot039(): string {
  return join(process.cwd(), "artifacts", "task-039");
}
