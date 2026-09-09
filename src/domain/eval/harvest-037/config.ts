import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { FROZEN_031_SHA256_037, type Exp037Config } from "@/domain/eval/harvest-037/types";

export function exp037Path(): string {
  return join(process.cwd(), "experiments", "exp_037_github_harvest.json");
}

export function experimentSha037(): string {
  return createHash("sha256").update(readFileSync(exp037Path())).digest("hex");
}

export function loadExp037Config(): Exp037Config {
  const raw = JSON.parse(readFileSync(exp037Path(), "utf8")) as Exp037Config;
  if (raw.experiment_id !== "exp_037_github_harvest") throw new ExperimentIntegrityError("bad experiment_id");
  if (
    raw.winner !== null ||
    raw.auto_promotion !== false ||
    raw.real_money !== false ||
    raw.open_task_038 !== false ||
    raw.modify_frozen_031 !== false ||
    raw.count_legacy_031_as_new_strict !== false ||
    raw.invent_timestamps !== false ||
    raw.client_retrieved_as_quote !== false ||
    raw.date_only_promoted_to_strict !== false ||
    raw.use_user_credentials !== false ||
    raw.bypass_auth !== false ||
    raw.mirror_as_independent !== false ||
    raw.legacy_dataset_sha256 !== FROZEN_031_SHA256_037 ||
    raw.baseline !== "MARKET_DEVIG"
  ) {
    throw new ExperimentIntegrityError("frozen TASK 037 flags violated");
  }
  return raw;
}

export function clonesRoot037(): string {
  return join(process.cwd(), "data", "external", "github", "_clones");
}

export function manifestsRoot037(): string {
  return join(process.cwd(), "data", "external", "manifests");
}

export function artifactsRoot037(): string {
  return join(process.cwd(), "artifacts", "task-037");
}
