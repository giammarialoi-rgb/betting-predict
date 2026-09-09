import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { FROZEN_031_SHA256_044 } from "@/domain/eval/permanent-044/types";

export function exp052Path(): string {
  return join(process.cwd(), "experiments", "exp_052_duplicate_keys_ui.json");
}

export function loadExp052Config() {
  const parsed = JSON.parse(readFileSync(exp052Path(), "utf8")) as {
    experiment_id: string;
    winner: null;
    auto_promotion: false;
    real_money: false;
    capital_gate: false;
    open_task_053: false;
    modify_lab_a: false;
    modify_frozen_031: false;
    synthetic_data: false;
    modify_predictor: false;
    modify_collector: false;
  };
  if (parsed.experiment_id !== "exp_052_duplicate_keys_ui") {
    throw new ExperimentIntegrityError("bad experiment_id");
  }
  if (
    parsed.winner !== null ||
    parsed.auto_promotion !== false ||
    parsed.real_money !== false ||
    parsed.open_task_053 !== false ||
    parsed.modify_lab_a !== false ||
    parsed.modify_predictor !== false ||
    parsed.modify_collector !== false ||
    parsed.capital_gate !== false
  ) {
    throw new ExperimentIntegrityError("frozen TASK 052 flags violated");
  }
  void FROZEN_031_SHA256_044;
  return parsed;
}

export function experimentSha052(): string {
  return createHash("sha256").update(readFileSync(exp052Path())).digest("hex");
}

export function writeArtifact052(name: string, payload: unknown): void {
  const root = join(process.cwd(), "artifacts", "task-052");
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, name), typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
}

export function artifactExists052(name: string): boolean {
  return existsSync(join(process.cwd(), "artifacts", "task-052", name));
}
