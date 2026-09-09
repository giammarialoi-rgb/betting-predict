import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { storeRoot039 } from "@/domain/eval/live-039/config";

export const FROZEN_031_SHA256_043 = "6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b";

export function exp043Path(): string {
  return join(process.cwd(), "experiments", "exp_043_total_live_lab.json");
}

export function experimentSha043(): string {
  return createHash("sha256").update(readFileSync(exp043Path())).digest("hex");
}

export function loadExp043Config() {
  const raw = JSON.parse(readFileSync(exp043Path(), "utf8")) as {
    experiment_id: string;
    winner: null;
    auto_promotion: false;
    real_money: false;
    capital_gate: false;
    historical_hunt: false;
    open_task_044: false;
    modify_frozen_031: false;
    modify_existing_locks: false;
    retro_recalculate: false;
    refit_market_devig: false;
    legacy_dataset_sha256: string;
    baseline: string;
    model_version: string;
  };
  if (raw.experiment_id !== "exp_043_total_live_lab") throw new ExperimentIntegrityError("bad experiment_id");
  if (
    raw.winner !== null ||
    raw.auto_promotion !== false ||
    raw.real_money !== false ||
    raw.open_task_044 !== false ||
    raw.historical_hunt !== false ||
    raw.modify_frozen_031 !== false ||
    raw.modify_existing_locks !== false ||
    raw.retro_recalculate !== false ||
    raw.refit_market_devig !== false ||
    raw.capital_gate !== false ||
    raw.legacy_dataset_sha256 !== FROZEN_031_SHA256_043 ||
    raw.baseline !== "MARKET_DEVIG"
  ) {
    throw new ExperimentIntegrityError("frozen TASK 043 flags violated");
  }
  return raw;
}

export function sourceStore043(override?: string): string {
  return override ?? storeRoot039();
}

export function artifactStore043(override?: string): string {
  return override ?? join(process.cwd(), "audit", "external", "task-043");
}

export function artifactsRoot043(): string {
  return join(process.cwd(), "artifacts", "task-043");
}

export const TENNIS_SPORTS_043 = [
  "tennis_atp_aus_open_singles",
  "tennis_wta_aus_open_singles",
  "tennis_atp_french_open",
  "tennis_wta_french_open",
  "tennis_atp_wimbledon",
  "tennis_wta_wimbledon",
  "tennis_atp_us_open",
  "tennis_wta_us_open",
] as const;

export function sportKind043(sportKey: string): "soccer" | "tennis" | "other" {
  if (sportKey.startsWith("soccer_")) return "soccer";
  if (sportKey.startsWith("tennis_")) return "tennis";
  return "other";
}
