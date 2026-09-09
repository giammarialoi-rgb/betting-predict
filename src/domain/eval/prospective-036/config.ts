import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import type { Exp036Config } from "@/domain/eval/prospective-036/types";

export function exp036Path(): string {
  return join(process.cwd(), "experiments", "exp_036_prospective_collection.json");
}

export function experimentSha036(): string {
  return createHash("sha256").update(readFileSync(exp036Path())).digest("hex");
}

export function loadExp036Config(): Exp036Config {
  const raw = JSON.parse(readFileSync(exp036Path(), "utf8")) as Exp036Config;
  if (raw.experiment_id !== "exp_036_prospective_collection") {
    throw new ExperimentIntegrityError("bad experiment_id");
  }
  if (
    raw.winner !== null ||
    raw.auto_promotion !== false ||
    raw.auto_promote !== false ||
    raw.real_money !== false ||
    raw.invent_timestamps !== false ||
    raw.invent_timezone !== false ||
    raw.synthetic_data !== false ||
    raw.use_historical_hunt !== false ||
    raw.modify_frozen_031 !== false ||
    raw.open_task_037_historical !== false ||
    raw.optimize_during_collection !== false ||
    raw.capital_gate !== false ||
    raw.close_in_decision !== false ||
    raw.date_only_promoted_to_strict !== false ||
    raw.test_locked !== true ||
    raw.holdout_locked !== true ||
    raw.baseline !== "MARKET_DEVIG"
  ) {
    throw new ExperimentIntegrityError("frozen TASK 036 flags violated");
  }
  return raw;
}

export function storeRoot036(override?: string): string {
  return override ?? join(process.cwd(), "audit", "external", "task-036");
}

export function artifactsRoot036(): string {
  return join(process.cwd(), "artifacts", "task-036");
}
