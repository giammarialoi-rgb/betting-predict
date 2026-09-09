import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { permanentRoot044, labAStore044 } from "@/domain/eval/permanent-044/config";
import { FROZEN_031_SHA256_044 } from "@/domain/eval/permanent-044/types";

export { permanentRoot044 as labBStore047, labAStore044 };

export function exp047Path(): string {
  return join(process.cwd(), "experiments", "exp_047_universal_live_coverage.json");
}

export function experimentSha047(): string {
  return createHash("sha256").update(readFileSync(exp047Path())).digest("hex");
}

export function loadExp047Config() {
  const raw = JSON.parse(readFileSync(exp047Path(), "utf8")) as {
    experiment_id: string;
    winner: null;
    auto_promotion: false;
    real_money: false;
    capital_gate: false;
    open_task_048: false;
    modify_lab_a: false;
    modify_frozen_031: false;
    synthetic_data: false;
    seed_events_are_not_a_cap: true;
    legacy_dataset_sha256: string;
    baseline: string;
  };
  if (raw.experiment_id !== "exp_047_universal_live_coverage") throw new ExperimentIntegrityError("bad experiment_id");
  if (
    raw.winner !== null ||
    raw.auto_promotion !== false ||
    raw.real_money !== false ||
    raw.open_task_048 !== false ||
    raw.modify_lab_a !== false ||
    raw.modify_frozen_031 !== false ||
    raw.synthetic_data !== false ||
    raw.capital_gate !== false ||
    raw.seed_events_are_not_a_cap !== true ||
    raw.legacy_dataset_sha256 !== FROZEN_031_SHA256_044 ||
    raw.baseline !== "MARKET_DEVIG"
  ) {
    throw new ExperimentIntegrityError("frozen TASK 047 flags violated");
  }
  return raw;
}

export function artifactsRoot047(): string {
  return join(process.cwd(), "artifacts", "task-047");
}

export function writeArtifact047(name: string, payload: unknown): void {
  const root = artifactsRoot047();
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, name), typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
}

export type BudgetPriority047 =
  | "SETTLEMENT"
  | "IMMINENT_LOCK"
  | "SNAPSHOT_EXISTING"
  | "DISCOVERY_TODAY"
  | "DISCOVERY_24H"
  | "DISCOVERY_72H"
  | "DISCOVERY_7D"
  | "EXTRA_SPORTS";

export const BUDGET_PRIORITY_ORDER_047: BudgetPriority047[] = [
  "SETTLEMENT",
  "IMMINENT_LOCK",
  "SNAPSHOT_EXISTING",
  "DISCOVERY_TODAY",
  "DISCOVERY_24H",
  "DISCOVERY_72H",
  "DISCOVERY_7D",
  "EXTRA_SPORTS",
];

export function coverageStatePath047(root = permanentRoot044()): string {
  return join(root, "manifests", "coverage-047-state.json");
}

export type CoverageState047 = {
  tennis_status: "AVAILABLE" | "TENNIS_PROVIDER_UNAVAILABLE" | "UNKNOWN";
  tennis_keys: string[];
  last_market_catalog_at: string | null;
  last_post_lock_scan_at: string | null;
  last_pattern_scan_at: string | null;
};

export function loadCoverageState047(root = permanentRoot044()): CoverageState047 {
  const p = coverageStatePath047(root);
  if (!existsSync(p)) {
    return {
      tennis_status: "UNKNOWN",
      tennis_keys: [],
      last_market_catalog_at: null,
      last_post_lock_scan_at: null,
      last_pattern_scan_at: null,
    };
  }
  return JSON.parse(readFileSync(p, "utf8")) as CoverageState047;
}

export function saveCoverageState047(root: string, state: CoverageState047): void {
  mkdirSync(join(root, "manifests"), { recursive: true });
  writeFileSync(coverageStatePath047(root), JSON.stringify(state, null, 2));
}
