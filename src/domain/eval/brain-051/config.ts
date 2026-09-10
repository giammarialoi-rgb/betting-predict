import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { permanentRoot044, labAStore044 } from "@/domain/eval/permanent-044/config";
import { FROZEN_031_SHA256_044 } from "@/domain/eval/permanent-044/types";
import { ANALYSIS_RUNTIME_VERSION } from "@/domain/eval/permanent-044/prediction-precedence";

export { permanentRoot044 as labBStore051, labAStore044 };
export { ANALYSIS_RUNTIME_VERSION };

export const BRAIN_MODEL_051 = "MODEL_v2_DECISION_ENGINE";

export function exp051Path(): string {
  return join(process.cwd(), "experiments", "exp_051_autonomous_24_7_brain.json");
}

export function experimentSha051(): string {
  return createHash("sha256").update(readFileSync(exp051Path())).digest("hex");
}

export function loadExp051Config() {
  const parsed = JSON.parse(readFileSync(exp051Path(), "utf8")) as {
    experiment_id: string;
    winner: null;
    auto_promotion: false;
    real_money: false;
    capital_gate: false;
    open_task_052: false;
    modify_lab_a: false;
    modify_frozen_031: false;
    synthetic_data: false;
    seed_events_are_not_a_cap: true;
    no_artificial_event_cap: true;
    legacy_dataset_sha256: string;
    baseline: string;
  };
  if (parsed.experiment_id !== "exp_051_autonomous_24_7_brain") {
    throw new ExperimentIntegrityError("bad experiment_id");
  }
  if (
    parsed.winner !== null ||
    parsed.auto_promotion !== false ||
    parsed.real_money !== false ||
    parsed.open_task_052 !== false ||
    parsed.modify_lab_a !== false ||
    parsed.modify_frozen_031 !== false ||
    parsed.synthetic_data !== false ||
    parsed.capital_gate !== false ||
    parsed.seed_events_are_not_a_cap !== true ||
    parsed.no_artificial_event_cap !== true ||
    parsed.legacy_dataset_sha256 !== FROZEN_031_SHA256_044 ||
    parsed.baseline !== "MARKET_DEVIG"
  ) {
    throw new ExperimentIntegrityError("frozen TASK 051 flags violated");
  }
  return parsed;
}

export function artifactsRoot051(): string {
  return join(process.cwd(), "artifacts", "task-051");
}

export function writeArtifact051(name: string, payload: unknown): void {
  const root = artifactsRoot051();
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, name), typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
}

export function brainDir051(root = permanentRoot044()): string {
  return join(root, "brain");
}

export function ensureBrainDirs051(root = permanentRoot044()): void {
  mkdirSync(brainDir051(root), { recursive: true });
  mkdirSync(join(brainDir051(root), "logs"), { recursive: true });
}

export type SchedulerPriority051 = "P0" | "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "IDLE";

export const PRIORITY_LABELS_051: Record<SchedulerPriority051, string> = {
  P0: "settlement",
  P1: "next_24h",
  P2: "next_72h",
  P3: "next_7d",
  P4: "new_events",
  P5: "pre_lock_refresh",
  P6: "secondary_markets",
  P7: "autopsy_learning",
  IDLE: "idle",
};

export function brainStatePath051(root = permanentRoot044()): string {
  return join(brainDir051(root), "brain-state.json");
}

export function brainHeartbeatPath051(root = permanentRoot044()): string {
  return join(brainDir051(root), "heartbeat.json");
}

export function brainWorkerLockPath051(root = permanentRoot044()): string {
  return join(brainDir051(root), "worker.lock");
}

export function brainWatchdogLockPath051(root = permanentRoot044()): string {
  return join(brainDir051(root), "watchdog.lock");
}

export type BrainState051 = {
  status: "RUNNING" | "IDLE" | "ERROR" | "STOPPED" | "PAUSED_BUDGET";
  worker_pid: number | null;
  watchdog_pid: number | null;
  started_at: string | null;
  last_successful_cycle_at: string | null;
  last_cycle_at: string | null;
  last_error: string | null;
  consecutive_errors: number;
  restart_count: number;
  uptime_started_at: string | null;
  last_priority: SchedulerPriority051;
  cycles_completed: number;
  model_version: string;
  /** Phase 3E.1 — stamps which analysis code the worker is running. */
  analysis_runtime_version: string;
  capital: "CLOSED";
  real_money: false;
  auto_promotion: false;
};

export function defaultBrainState051(): BrainState051 {
  return {
    status: "STOPPED",
    worker_pid: null,
    watchdog_pid: null,
    started_at: null,
    last_successful_cycle_at: null,
    last_cycle_at: null,
    last_error: null,
    consecutive_errors: 0,
    restart_count: 0,
    uptime_started_at: null,
    last_priority: "IDLE",
    cycles_completed: 0,
    model_version: BRAIN_MODEL_051,
    analysis_runtime_version: ANALYSIS_RUNTIME_VERSION,
    capital: "CLOSED",
    real_money: false,
    auto_promotion: false,
  };
}

export function loadBrainState051(root = permanentRoot044()): BrainState051 {
  const p = brainStatePath051(root);
  if (!existsSync(p)) return defaultBrainState051();
  try {
    const raw = readFileSync(p, "utf8").replace(/^\uFEFF/, "");
    return { ...defaultBrainState051(), ...JSON.parse(raw) };
  } catch {
    return defaultBrainState051();
  }
}

export function saveBrainState051(root: string, state: BrainState051): void {
  ensureBrainDirs051(root);
  const p = brainStatePath051(root);
  const tmp = p + ".tmp";
  const payload = JSON.stringify(state, null, 2);
  writeFileSync(tmp, payload, { encoding: "utf8" });
  writeFileSync(p, payload, { encoding: "utf8" });
}
