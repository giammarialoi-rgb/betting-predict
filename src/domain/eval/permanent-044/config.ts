import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { storeRoot039 } from "@/domain/eval/live-039/config";
import { FROZEN_031_SHA256_044 } from "@/domain/eval/permanent-044/types";

export function exp044Path(): string {
  return join(process.cwd(), "experiments", "exp_044_permanent_live.json");
}

export function experimentSha044(): string {
  return createHash("sha256").update(readFileSync(exp044Path())).digest("hex");
}

export function loadExp044Config() {
  const raw = JSON.parse(readFileSync(exp044Path(), "utf8")) as {
    experiment_id: string;
    winner: null;
    auto_promotion: false;
    real_money: false;
    capital_gate: false;
    open_task_045: false;
    modify_lab_a_locks: false;
    contaminate_lab_a: false;
    synthetic_data: false;
    retro_recalculate: false;
    modify_frozen_031: false;
    historical_hunt: false;
    legacy_dataset_sha256: string;
    baseline: string;
    model_version: string;
  };
  if (raw.experiment_id !== "exp_044_permanent_live") throw new ExperimentIntegrityError("bad experiment_id");
  if (
    raw.winner !== null ||
    raw.auto_promotion !== false ||
    raw.real_money !== false ||
    raw.open_task_045 !== false ||
    raw.modify_lab_a_locks !== false ||
    raw.contaminate_lab_a !== false ||
    raw.synthetic_data !== false ||
    raw.retro_recalculate !== false ||
    raw.modify_frozen_031 !== false ||
    raw.capital_gate !== false ||
    raw.historical_hunt !== false ||
    raw.legacy_dataset_sha256 !== FROZEN_031_SHA256_044 ||
    raw.baseline !== "MARKET_DEVIG"
  ) {
    throw new ExperimentIntegrityError("frozen TASK 044 flags violated");
  }
  return raw;
}

/** Lab A scientific store — READ ONLY for locks/decisions. */
export function labAStore044(override?: string): string {
  return override ?? storeRoot039();
}

export function permanentRoot044(override?: string): string {
  /** Unified Lab B: task-044 ≡ permanent-live intelligence store */
  return override ?? join(process.cwd(), "audit", "external", "task-044");
}

export function permanentLiveAlias044(): string {
  return join(process.cwd(), "audit", "external", "permanent-live");
}

export function ensurePermanentDirs044(root = permanentRoot044()): void {
  for (const d of ["", "schema", "manifests", "checkpoints", "daily-reports", "event_catalog"]) {
    mkdirSync(d ? join(root, d) : root, { recursive: true });
  }
  const alias = permanentLiveAlias044();
  mkdirSync(alias, { recursive: true });
  const pointer = join(alias, "README.md");
  if (!existsSync(pointer)) {
    writeFileSync(
      pointer,
      [
        "# Permanent Live Lab (alias)",
        "",
        "Canonical append-only store: `audit/external/task-044/`.",
        "Lab A (`task-039`) is READ_ONLY — never rewritten by TASK 044.",
        "",
      ].join("\n"),
    );
  }
  const schema = join(root, "schema", "README.md");
  if (!existsSync(schema)) {
    writeFileSync(
      schema,
      [
        "# TASK 044 / Permanent Live schema",
        "",
        "Append-only JSONL. Lab A locks never rewritten.",
        "Clocks: available_at ≠ collected_at. POST_EVENT never mutates LOCK.",
        "",
      ].join("\n"),
    );
  }
}

export function artifactsRoot044(): string {
  return join(process.cwd(), "artifacts", "task-044");
}

export function sportKind044(sportKey: string): string {
  if (sportKey.startsWith("soccer_")) return "soccer";
  if (sportKey.startsWith("tennis_")) return "tennis";
  if (sportKey.startsWith("basketball_")) return "basketball";
  if (sportKey.startsWith("baseball_")) return "baseball";
  if (sportKey.startsWith("icehockey_") || sportKey.startsWith("hockey_")) return "hockey";
  if (sportKey.startsWith("volleyball_")) return "volleyball";
  return "other";
}
