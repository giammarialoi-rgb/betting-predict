import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { FROZEN_031_SHA256_044 } from "@/domain/eval/permanent-044/types";

export function exp055Path(): string {
  return join(process.cwd(), "experiments", "exp_055_multisource_universal_discovery.json");
}

export function experimentSha055(): string {
  return createHash("sha256").update(readFileSync(exp055Path())).digest("hex");
}

export function loadExp055Config() {
  const parsed = JSON.parse(readFileSync(exp055Path(), "utf8")) as {
    experiment_id: string;
    winner: null;
    auto_promotion: false;
    real_money: false;
    capital_gate: false;
    open_task_056: false;
    modify_lab_a: false;
    modify_frozen_031: false;
    synthetic_data: false;
    seed_events_are_not_a_cap: true;
    no_artificial_event_cap: true;
    virtual_bankroll_initial: number;
    scraping_default: false;
    legacy_dataset_sha256: string;
    baseline: string;
  };
  if (parsed.experiment_id !== "exp_055_multisource_universal_discovery") {
    throw new ExperimentIntegrityError("bad experiment_id");
  }
  if (
    parsed.winner !== null ||
    parsed.auto_promotion !== false ||
    parsed.real_money !== false ||
    parsed.open_task_056 !== false ||
    parsed.modify_lab_a !== false ||
    parsed.synthetic_data !== false ||
    parsed.capital_gate !== false ||
    parsed.scraping_default !== false ||
    parsed.no_artificial_event_cap !== true ||
    parsed.virtual_bankroll_initial !== 1000 ||
    parsed.legacy_dataset_sha256 !== FROZEN_031_SHA256_044 ||
    parsed.baseline !== "MARKET_DEVIG"
  ) {
    throw new ExperimentIntegrityError("frozen TASK 055 flags violated");
  }
  return parsed;
}

export function writeArtifact055(name: string, payload: unknown): void {
  const root = join(process.cwd(), "artifacts", "task-055");
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, name), typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
}
