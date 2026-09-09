import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { permanentRoot044, labAStore044 } from "@/domain/eval/permanent-044/config";
import { FROZEN_031_SHA256_044 } from "@/domain/eval/permanent-044/types";

export { permanentRoot044 as labBStore049, labAStore044 };

export function exp049Path(): string {
  return join(process.cwd(), "experiments", "exp_049_massive_prospective_lab.json");
}

export function experimentSha049(): string {
  return createHash("sha256").update(readFileSync(exp049Path())).digest("hex");
}

export function loadExp049Config() {
  const parsed = JSON.parse(readFileSync(exp049Path(), "utf8")) as {
    experiment_id: string;
    winner: null;
    auto_promotion: false;
    real_money: false;
    capital_gate: false;
    open_task_050: false;
    modify_lab_a: false;
    modify_frozen_031: false;
    synthetic_data: false;
    seed_events_are_not_a_cap: true;
    no_artificial_event_cap: true;
    legacy_dataset_sha256: string;
    baseline: string;
  };
  if (parsed.experiment_id !== "exp_049_massive_prospective_lab") {
    throw new ExperimentIntegrityError("bad experiment_id");
  }
  if (
    parsed.winner !== null ||
    parsed.auto_promotion !== false ||
    parsed.real_money !== false ||
    parsed.open_task_050 !== false ||
    parsed.modify_lab_a !== false ||
    parsed.modify_frozen_031 !== false ||
    parsed.synthetic_data !== false ||
    parsed.capital_gate !== false ||
    parsed.seed_events_are_not_a_cap !== true ||
    parsed.no_artificial_event_cap !== true ||
    parsed.legacy_dataset_sha256 !== FROZEN_031_SHA256_044 ||
    parsed.baseline !== "MARKET_DEVIG"
  ) {
    throw new ExperimentIntegrityError("frozen TASK 049 flags violated");
  }
  return parsed;
}

export function artifactsRoot049(): string {
  return join(process.cwd(), "artifacts", "task-049");
}

export function writeArtifact049(name: string, payload: unknown): void {
  const root = artifactsRoot049();
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, name), typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
}

export function sportCoveragePath049(root = permanentRoot044()): string {
  return join(root, "manifests", "sport-coverage-049.json");
}

export type SportAvailability049 =
  | "AVAILABLE"
  | "PROVIDER_UNAVAILABLE"
  | "AVAILABLE_NO_EVENTS_IN_WINDOW"
  | "DISCOVERY_FAILED"
  | "RATE_LIMITED"
  | "BUDGET_INSUFFICIENT"
  | "PROVIDER_ERROR"
  | "UNKNOWN";

export type SportCoverageEntry049 = {
  family: string;
  status: SportAvailability049;
  keys_active: number;
  keys_pulled: number;
  events_in_lab: number;
  note: string | null;
};

export function loadSportCoverage049(root = permanentRoot044()): {
  at: string | null;
  sports: SportCoverageEntry049[];
} {
  const p = sportCoveragePath049(root);
  if (!existsSync(p)) return { at: null, sports: [] };
  return JSON.parse(readFileSync(p, "utf8"));
}

export function saveSportCoverage049(
  root: string,
  payload: { at: string; sports: SportCoverageEntry049[] },
): void {
  mkdirSync(join(root, "manifests"), { recursive: true });
  writeFileSync(sportCoveragePath049(root), JSON.stringify(payload, null, 2));
}

/** Default Odds API markets — provider returns only what exists. Never invent. */
export const ODDS_MARKETS_DEFAULT_049 = "h2h,spreads,totals";
