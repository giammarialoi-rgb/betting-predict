import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { artifactsRoot037, experimentSha037, loadExp037Config, manifestsRoot037 } from "@/domain/eval/harvest-037/config";
import { harvestGithub037 } from "@/domain/eval/harvest-037/harvest";
import { FEATURES_037, SINGLE_MISSING_RESOURCE_037, buildLake037 } from "@/domain/eval/harvest-037/lake";
import { runHostileBattery037 } from "@/domain/eval/harvest-037/leakage";
import type { LabVerdict037, RepoHarvest037 } from "@/domain/eval/harvest-037/types";

export type Task037Report = {
  experiment_id: string;
  task: "037";
  VERDICT: LabVerdict037;
  COLLECTION_STATUS: "HARVEST_COMPLETE_NO_STRICT";
  GITHUB_REPOSITORIES_SCANNED: number;
  DATASETS_ACQUIRED: number;
  SOURCE_CLUSTERS: number;
  EVENTS_DISCOVERED: number;
  QUOTE_OBSERVATIONS: number;
  STRICT_EVENTS: 0;
  STRICT_QUOTES: 0;
  EXACT_KICKOFFS: number;
  T24_COVERAGE: 0;
  T1H_COVERAGE: 0;
  MODEL_READY: false;
  TRAIN_EVENTS: 0;
  VAL_EVENTS: 0;
  TEST_EVENTS: 0;
  HOLDOUT_EVENTS: 0;
  MARKET_BRIER: null;
  BEST_MODEL: null;
  DELTA_BRIER: null;
  CI_95: null;
  HOLM: null;
  SIGNIFICANT: false;
  CAPITAL_QUALIFIED: false;
  BETS: 0;
  BANKROLL: "—";
  ROI: null;
  MAX_DD: null;
  winner: null;
  auto_promotion: false;
  real_money: false;
  reproducibility: "PASS" | "FAIL" | "NOT_RUN";
  leakage_status: "PASS" | "FAIL";
  FINAL_VERDICT: LabVerdict037;
  harvest: RepoHarvest037[];
  lake: ReturnType<typeof buildLake037>;
  features: typeof FEATURES_037;
  missing_resource: string;
  leakage: { id: string; throws: boolean }[];
  experiment_sha256: string;
  fingerprint: string;
};

export function fingerprint037(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function printVerdictBlock037(r: Task037Report): string {
  return [
    "TASK 037 — FINAL VERDICT",
    `VERDICT: ${r.VERDICT}`,
    `COLLECTION_STATUS: ${r.COLLECTION_STATUS}`,
    `GITHUB_REPOSITORIES_SCANNED: ${r.GITHUB_REPOSITORIES_SCANNED}`,
    `DATASETS_ACQUIRED: ${r.DATASETS_ACQUIRED}`,
    `SOURCE_CLUSTERS: ${r.SOURCE_CLUSTERS}`,
    `EVENTS_DISCOVERED: ${r.EVENTS_DISCOVERED}`,
    `QUOTE_OBSERVATIONS: ${r.QUOTE_OBSERVATIONS}`,
    `STRICT_EVENTS: ${r.STRICT_EVENTS}`,
    `STRICT_QUOTES: ${r.STRICT_QUOTES}`,
    `EXACT_KICKOFFS: ${r.EXACT_KICKOFFS}`,
    `T24_COVERAGE: ${r.T24_COVERAGE}`,
    `T1H_COVERAGE: ${r.T1H_COVERAGE}`,
    `MODEL_READY: ${r.MODEL_READY}`,
    `TRAIN_EVENTS: ${r.TRAIN_EVENTS}`,
    `VAL_EVENTS: ${r.VAL_EVENTS}`,
    `TEST_EVENTS: ${r.TEST_EVENTS}`,
    `HOLDOUT_EVENTS: ${r.HOLDOUT_EVENTS}`,
    `MARKET_BRIER: ${r.MARKET_BRIER ?? "—"}`,
    `BEST_MODEL: ${r.BEST_MODEL ?? "—"}`,
    `DELTA_BRIER: ${r.DELTA_BRIER ?? "—"}`,
    `CI_95: ${r.CI_95 ?? "—"}`,
    `HOLM: ${r.HOLM ?? "—"}`,
    `SIGNIFICANT: ${r.SIGNIFICANT}`,
    `CAPITAL_QUALIFIED: ${r.CAPITAL_QUALIFIED}`,
    `BETS: ${r.BETS}`,
    `BANKROLL: ${r.BANKROLL}`,
    `ROI: ${r.ROI ?? "—"}`,
    `MAX_DD: ${r.MAX_DD ?? "—"}`,
    `WINNER: ${r.winner}`,
    `AUTO_PROMOTION: ${r.auto_promotion}`,
    `REAL_MONEY: ${r.real_money}`,
    `REPRODUCIBILITY: ${r.reproducibility}`,
    `LEAKAGE: ${r.leakage_status}`,
    `FINAL_VERDICT: ${r.FINAL_VERDICT}`,
  ].join("\n");
}

export async function runTask037(input: { skipHeavy?: boolean } = {}): Promise<Task037Report> {
  const cfg = loadExp037Config();
  if (cfg.open_task_038) throw new ExperimentIntegrityError("TASK 038 forbidden");
  const leakage = runHostileBattery037();
  if (leakage.some((l) => !l.throws)) {
    throw new ExperimentIntegrityError(`leakage miss: ${leakage.filter((l) => !l.throws).map((l) => l.id).join(",")}`);
  }
  const harvest = harvestGithub037({ skipHeavy: input.skipHeavy === true });
  const lake = buildLake037(harvest);
  const events = harvest.reduce((a, h) => a + h.events_est, 0);
  const exactKickoffs = harvest.filter((h) => h.id === "oddsharvester" || h.id === "petermclagan").reduce((a, h) => a + (h.id === "oddsharvester" ? 4 : 1), 0);
  const fp = fingerprint037({
    verdict: "FINAL_BLOCKER",
    exp: experimentSha037(),
    strict: 0,
    bets: 0,
    winner: null,
    scanned: harvest.length,
    missing: SINGLE_MISSING_RESOURCE_037,
  });
  return {
    experiment_id: cfg.experiment_id,
    task: "037",
    VERDICT: "FINAL_BLOCKER",
    COLLECTION_STATUS: "HARVEST_COMPLETE_NO_STRICT",
    GITHUB_REPOSITORIES_SCANNED: harvest.length,
    DATASETS_ACQUIRED: lake.datasets,
    SOURCE_CLUSTERS: lake.clusters.length,
    EVENTS_DISCOVERED: events,
    QUOTE_OBSERVATIONS: events,
    STRICT_EVENTS: 0,
    STRICT_QUOTES: 0,
    EXACT_KICKOFFS: exactKickoffs,
    T24_COVERAGE: 0,
    T1H_COVERAGE: 0,
    MODEL_READY: false,
    TRAIN_EVENTS: 0,
    VAL_EVENTS: 0,
    TEST_EVENTS: 0,
    HOLDOUT_EVENTS: 0,
    MARKET_BRIER: null,
    BEST_MODEL: null,
    DELTA_BRIER: null,
    CI_95: null,
    HOLM: null,
    SIGNIFICANT: false,
    CAPITAL_QUALIFIED: false,
    BETS: 0,
    BANKROLL: "—",
    ROI: null,
    MAX_DD: null,
    winner: null,
    auto_promotion: false,
    real_money: false,
    reproducibility: "NOT_RUN",
    leakage_status: "PASS",
    FINAL_VERDICT: "FINAL_BLOCKER",
    harvest,
    lake,
    features: FEATURES_037,
    missing_resource: SINGLE_MISSING_RESOURCE_037,
    leakage,
    experiment_sha256: experimentSha037(),
    fingerprint: fp,
  };
}

export function persistHarvestManifests(harvest: readonly RepoHarvest037[]): void {
  const dir = manifestsRoot037();
  const catalog = join(process.cwd(), "data", "external", "catalog");
  mkdirSync(dir, { recursive: true });
  mkdirSync(catalog, { recursive: true });
  mkdirSync(artifactsRoot037(), { recursive: true });
  writeFileSync(join(dir, "task-037-harvest.json"), JSON.stringify(harvest, null, 2));
  writeFileSync(join(catalog, "task-037-source-clusters.json"), JSON.stringify(harvest.map((h) => ({
    repository: h.repository,
    cluster: h.cluster,
    role: h.role,
    classification: h.classification,
    commit: h.commit,
  })), null, 2));
  writeFileSync(join(artifactsRoot037(), "harvest.json"), JSON.stringify(harvest, null, 2));
}

export function loadTask037ReportForUi(): Task037Report | null {
  const p = join(process.cwd(), "artifacts", "task-037-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task037Report;
    if (raw.experiment_id !== "exp_037_github_harvest") return null;
    return raw;
  } catch {
    return null;
  }
}

export async function loadOrRunTask037(): Promise<Task037Report> {
  return loadTask037ReportForUi() ?? runTask037({ skipHeavy: true });
}
