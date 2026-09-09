import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { FROZEN_031_SHA256_034, type Exp034Config } from "@/domain/eval/market-034/types";

export function exp034Path(): string {
  return join(process.cwd(), "experiments", "exp_034_market_inefficiency.json");
}

export function experimentSha034(): string {
  return createHash("sha256").update(readFileSync(exp034Path())).digest("hex");
}

export function loadExp034Config(): Exp034Config {
  const raw = JSON.parse(readFileSync(exp034Path(), "utf8")) as Exp034Config;
  if (raw.experiment_id !== "exp_034_market_inefficiency") {
    throw new ExperimentIntegrityError("bad experiment_id");
  }
  if (
    raw.winner !== null ||
    raw.declared_best !== false ||
    raw.auto_promotion !== false ||
    raw.auto_promote !== false ||
    raw.real_money !== false ||
    raw.add_elo !== false ||
    raw.add_form !== false ||
    raw.add_h2h !== false ||
    raw.add_news !== false ||
    raw.open_task_035 !== false ||
    raw.modify_frozen_031 !== false ||
    raw.feature_selection_on_test !== false ||
    raw.holdout_for_training !== false ||
    raw.close_in_decision !== false ||
    raw.date_only_promoted_to_strict !== false ||
    raw.test_locked !== true ||
    raw.holdout_locked !== true ||
    raw.baseline !== "MARKET_DEVIG" ||
    raw.dataset_sha256 !== FROZEN_031_SHA256_034
  ) {
    throw new ExperimentIntegrityError("frozen TASK 034 flags violated");
  }
  return raw;
}

export function assertTestLocked034(used: boolean): void {
  if (used) throw new ExperimentIntegrityError("TEST locked — no selection");
}

export function assertHoldoutLocked034(used: boolean): void {
  if (used) throw new ExperimentIntegrityError("HOLDOUT locked");
}
