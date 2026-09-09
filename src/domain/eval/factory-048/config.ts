import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { permanentRoot044, labAStore044 } from "@/domain/eval/permanent-044/config";
import { FROZEN_031_SHA256_044 } from "@/domain/eval/permanent-044/types";

export { permanentRoot044 as labBStore048, labAStore044 };

export const MODEL_V2_048 = "MODEL_v2_DECISION_ENGINE";
export const PARENT_MODEL_048 = "MODEL_v1";

export function exp048Path(): string {
  return join(process.cwd(), "experiments", "exp_048_decision_engine.json");
}

export function experimentSha048(): string {
  return createHash("sha256").update(readFileSync(exp048Path())).digest("hex");
}

export function loadExp048Config() {
  const raw = JSON.parse(readFileSync(exp048Path(), "utf8")) as {
    experiment_id: string;
    winner: null;
    auto_promotion: false;
    real_money: false;
    capital_gate: false;
    open_task_049: false;
    modify_lab_a: false;
    modify_frozen_031: false;
    synthetic_data: false;
    seed_events_are_not_a_cap: true;
    legacy_dataset_sha256: string;
    baseline: string;
    model_version: string;
    parent_model: string;
  };
  if (raw.experiment_id !== "exp_048_decision_engine") throw new ExperimentIntegrityError("bad experiment_id");
  if (
    raw.winner !== null ||
    raw.auto_promotion !== false ||
    raw.real_money !== false ||
    raw.open_task_049 !== false ||
    raw.modify_lab_a !== false ||
    raw.modify_frozen_031 !== false ||
    raw.synthetic_data !== false ||
    raw.capital_gate !== false ||
    raw.seed_events_are_not_a_cap !== true ||
    raw.legacy_dataset_sha256 !== FROZEN_031_SHA256_044 ||
    raw.baseline !== "MARKET_DEVIG" ||
    raw.model_version !== MODEL_V2_048 ||
    raw.parent_model !== PARENT_MODEL_048
  ) {
    throw new ExperimentIntegrityError("frozen TASK 048 flags violated");
  }
  return raw;
}

export function artifactsRoot048(): string {
  return join(process.cwd(), "artifacts", "task-048");
}

export function writeArtifact048(name: string, payload: unknown): void {
  const root = artifactsRoot048();
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, name), typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
}

export type LabDecision048 =
  | "NO_BET"
  | "BET_CANDIDATE"
  | "STRONG_CANDIDATE"
  | "INSUFFICIENT_DATA"
  | "MODEL_UNCERTAIN";

export type OutcomeReasoningClass048 =
  | "OUTCOME_CORRECT"
  | "OUTCOME_CORRECT_REASONING_SUPPORTED"
  | "OUTCOME_CORRECT_REASONING_NOT_SUPPORTED"
  | "OUTCOME_WRONG";

export type ErrorLabel048 =
  | "MODEL_ERROR"
  | "MARKET_ERROR"
  | "DATA_MISSING"
  | "DATA_QUALITY"
  | "TIMING_ERROR"
  | "SIGNAL_MISREAD"
  | "SIGNAL_OVERWEIGHT"
  | "SIGNAL_UNDERWEIGHT"
  | "MARKET_MOVEMENT_MISREAD"
  | "RISK_UNDERESTIMATION"
  | "UNCERTAINTY_UNDERESTIMATION"
  | "UNEXPECTED_EVENT"
  | "INSUFFICIENT_INFORMATION"
  | "OTHER";

export type BackwardAvail048 =
  | "AVAILABLE_BUT_IGNORED"
  | "AVAILABLE_BUT_MISINTERPRETED"
  | "NOT_AVAILABLE"
  | "ARRIVED_AFTER_LOCK"
  | "NOT_PREDICTABLE";

export type ChangeClass048 = "NO_CHANGE" | "MINOR_CHANGE" | "MATERIAL_CHANGE" | "CRITICAL_CHANGE";

export type DataQualityStatus048 = "COMPLETE" | "PARTIAL" | "LOW_QUALITY" | "BLOCKED";

export function modelStatePath048(root = permanentRoot044()): string {
  return join(root, "model-state.json");
}

export function loadModelState048(root = permanentRoot044()): {
  current: string;
  parent: string;
  candidates: { id: string; status: "OBSERVATION_ONLY"; parent: string }[];
  auto_promotion: false;
} {
  const p = modelStatePath048(root);
  if (!existsSync(p)) {
    return {
      current: MODEL_V2_048,
      parent: PARENT_MODEL_048,
      candidates: [],
      auto_promotion: false,
    };
  }
  return JSON.parse(readFileSync(p, "utf8"));
}

export function saveModelState048(
  root: string,
  state: ReturnType<typeof loadModelState048>,
): void {
  writeFileSync(modelStatePath048(root), JSON.stringify({ ...state, auto_promotion: false }, null, 2));
}
