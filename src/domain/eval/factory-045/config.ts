import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { permanentRoot044, labAStore044 } from "@/domain/eval/permanent-044/config";
import { FROZEN_031_SHA256_044 as F031 } from "@/domain/eval/permanent-044/types";

export { permanentRoot044 as labBStore045, labAStore044 };

export const FROZEN_031_SHA256_045 = F031;

export function exp045Path(): string {
  return join(process.cwd(), "experiments", "exp_045_permanent_live_factory.json");
}

export function experimentSha045(): string {
  return createHash("sha256").update(readFileSync(exp045Path())).digest("hex");
}

export function loadExp045Config() {
  const raw = JSON.parse(readFileSync(exp045Path(), "utf8")) as {
    experiment_id: string;
    winner: null;
    auto_promotion: false;
    real_money: false;
    capital_gate: false;
    open_task_046: false;
    modify_lab_a: false;
    modify_frozen_031: false;
    synthetic_data: false;
    retro_recalculate: false;
    seed_events_are_not_a_cap: true;
    legacy_dataset_sha256: string;
    baseline: string;
  };
  if (raw.experiment_id !== "exp_045_permanent_live_factory") throw new ExperimentIntegrityError("bad experiment_id");
  if (
    raw.winner !== null ||
    raw.auto_promotion !== false ||
    raw.real_money !== false ||
    raw.open_task_046 !== false ||
    raw.modify_lab_a !== false ||
    raw.modify_frozen_031 !== false ||
    raw.synthetic_data !== false ||
    raw.retro_recalculate !== false ||
    raw.capital_gate !== false ||
    raw.seed_events_are_not_a_cap !== true ||
    raw.legacy_dataset_sha256 !== FROZEN_031_SHA256_045 ||
    raw.baseline !== "MARKET_DEVIG"
  ) {
    throw new ExperimentIntegrityError("frozen TASK 045 flags violated");
  }
  return raw;
}

export function artifactsRoot045(): string {
  return join(process.cwd(), "artifacts", "task-045");
}

export function discoveryStatePath045(root = permanentRoot044()): string {
  return join(root, "manifests", "discovery-045-state.json");
}

export type DiscoveryState045 = {
  last_sports_catalog_at: string | null;
  last_discovery_at: string | null;
  last_settlement_at: string | null;
  api_calls_today: number;
  api_calls_day: string;
  sports_unavailable: string[];
  last_error: string | null;
};

export function loadDiscoveryState045(root = permanentRoot044()): DiscoveryState045 {
  const p = discoveryStatePath045(root);
  if (!existsSync(p)) {
    return {
      last_sports_catalog_at: null,
      last_discovery_at: null,
      last_settlement_at: null,
      api_calls_today: 0,
      api_calls_day: new Date().toISOString().slice(0, 10),
      sports_unavailable: [],
      last_error: null,
    };
  }
  return JSON.parse(readFileSync(p, "utf8")) as DiscoveryState045;
}

export function saveDiscoveryState045(root: string, state: DiscoveryState045): void {
  mkdirSync(join(root, "manifests"), { recursive: true });
  writeFileSync(discoveryStatePath045(root), JSON.stringify(state, null, 2));
}

export function bumpApiCalls045(state: DiscoveryState045, n: number): DiscoveryState045 {
  const day = new Date().toISOString().slice(0, 10);
  if (state.api_calls_day !== day) {
    return { ...state, api_calls_day: day, api_calls_today: n };
  }
  return { ...state, api_calls_today: state.api_calls_today + n };
}

/** Markets requested when provider supports them — never invent if absent. */
export const ODDS_MARKETS_SOCCER_045 = "h2h,spreads,totals";
export const ODDS_MARKETS_TENNIS_045 = "h2h,spreads,totals";
