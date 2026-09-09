import { createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { FROZEN_031_SHA256_044 } from "@/domain/eval/permanent-044/types";

export function exp046Path(): string {
  return join(process.cwd(), "experiments", "exp_046_live_control_center.json");
}

export function experimentSha046(): string {
  return createHash("sha256").update(readFileSync(exp046Path())).digest("hex");
}

export function loadExp046Config() {
  const raw = JSON.parse(readFileSync(exp046Path(), "utf8")) as {
    experiment_id: string;
    winner: null;
    auto_promotion: false;
    real_money: false;
    capital_gate: false;
    open_task_047: false;
    modify_lab_a: false;
    modify_frozen_031: false;
    synthetic_data: false;
    ui_odds_api_calls: false;
    legacy_dataset_sha256: string;
  };
  if (raw.experiment_id !== "exp_046_live_control_center") throw new ExperimentIntegrityError("bad experiment_id");
  if (
    raw.winner !== null ||
    raw.auto_promotion !== false ||
    raw.real_money !== false ||
    raw.open_task_047 !== false ||
    raw.modify_lab_a !== false ||
    raw.modify_frozen_031 !== false ||
    raw.synthetic_data !== false ||
    raw.ui_odds_api_calls !== false ||
    raw.capital_gate !== false ||
    raw.legacy_dataset_sha256 !== FROZEN_031_SHA256_044
  ) {
    throw new ExperimentIntegrityError("frozen TASK 046 flags violated");
  }
  return raw;
}

export function artifactsRoot046(): string {
  return join(process.cwd(), "artifacts", "task-046");
}

export function ensureArtifacts046(): string {
  const root = artifactsRoot046();
  mkdirSync(root, { recursive: true });
  return root;
}

export function writeArtifact046(name: string, payload: unknown): void {
  const root = ensureArtifacts046();
  writeFileSync(join(root, name), typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
}

export function fileExists046(p: string): boolean {
  return existsSync(p);
}
