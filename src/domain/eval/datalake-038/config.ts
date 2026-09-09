import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { FROZEN_031_SHA256_038, type Exp038Config } from "@/domain/eval/datalake-038/types";

export function exp038Path(): string {
  return join(process.cwd(), "experiments", "exp_038_data_lake_live.json");
}

export function experimentSha038(): string {
  return createHash("sha256").update(readFileSync(exp038Path())).digest("hex");
}

export function loadExp038Config(): Exp038Config {
  const raw = JSON.parse(readFileSync(exp038Path(), "utf8")) as Exp038Config;
  if (raw.experiment_id !== "exp_038_data_lake_live") {
    throw new ExperimentIntegrityError("bad experiment_id");
  }
  if (
    raw.winner !== null ||
    raw.auto_promotion !== false ||
    raw.auto_promote !== false ||
    raw.real_money !== false ||
    raw.invent_timestamps !== false ||
    raw.invent_timezone !== false ||
    raw.invent_quotes !== false ||
    raw.synthetic_data !== false ||
    raw.client_retrieved_as_quote !== false ||
    raw.date_only_promoted_to_strict !== false ||
    raw.close_in_decision !== false ||
    raw.modify_frozen_031 !== false ||
    raw.count_legacy_031_as_new_strict !== false ||
    raw.historical_hunt !== false ||
    raw.open_task_039 !== false ||
    raw.capital_gate !== false ||
    raw.test_locked !== true ||
    raw.holdout_locked !== true ||
    raw.legacy_dataset_sha256 !== FROZEN_031_SHA256_038 ||
    raw.baseline !== "MARKET_DEVIG"
  ) {
    throw new ExperimentIntegrityError("frozen TASK 038 flags violated");
  }
  return raw;
}

export function lakeRoot038(): string {
  return join(process.cwd(), "data");
}

export function storeRoot038(override?: string): string {
  return override ?? join(process.cwd(), "audit", "external", "task-038");
}

export function artifactsRoot038(): string {
  return join(process.cwd(), "artifacts", "task-038");
}

export function isProductionLedger038(root: string): boolean {
  return root.replaceAll("\\", "/").includes("audit/external/task-038");
}
