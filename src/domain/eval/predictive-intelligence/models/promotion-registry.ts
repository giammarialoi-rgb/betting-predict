/**
 * Model promotion ledger — CANDIDATE → TRAINED → VALIDATED → OOS → PROMOTED | REJECTED.
 * Never auto-promotes live inference. Writes filesystem only.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";

export type ModelStage =
  | "CANDIDATE"
  | "TRAINED"
  | "VALIDATED"
  | "OOS"
  | "PROMOTED"
  | "REJECTED"
  | "SHADOW";

export type ModelRegistryEntry = {
  model_id: string;
  version: string;
  stage: ModelStage;
  train_n: number;
  validate_n: number;
  oos_n: number;
  metrics: Record<string, number | null>;
  leakage_pass: boolean;
  odds_in_features: false;
  reasons: string[];
  created_at: string;
  updated_at: string;
  auto_promotion: false;
  production: boolean;
};

export type Phase8ModelRegistry = {
  neon_in_use: false;
  updated_at: string;
  entries: ModelRegistryEntry[];
};

export function modelRegistryPath(root = permanentRoot044()): string {
  return join(root, "manifests", "phase8-model-registry.json");
}

export function loadPhase8ModelRegistry(root = permanentRoot044()): Phase8ModelRegistry {
  const p = modelRegistryPath(root);
  if (!existsSync(p)) {
    return { neon_in_use: false, updated_at: new Date(0).toISOString(), entries: [] };
  }
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Phase8ModelRegistry;
  } catch {
    return { neon_in_use: false, updated_at: new Date(0).toISOString(), entries: [] };
  }
}

export function savePhase8ModelRegistry(reg: Phase8ModelRegistry, root = permanentRoot044()): void {
  mkdirSync(join(root, "manifests"), { recursive: true });
  writeFileSync(modelRegistryPath(root), JSON.stringify({ ...reg, neon_in_use: false }, null, 2));
}

export function recordModelStage(input: {
  root?: string;
  model_id: string;
  version: string;
  stage: ModelStage;
  train_n?: number;
  validate_n?: number;
  oos_n?: number;
  metrics?: Record<string, number | null>;
  leakage_pass: boolean;
  reasons: string[];
  nowIso?: string;
}): ModelRegistryEntry {
  const root = input.root ?? permanentRoot044();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const reg = loadPhase8ModelRegistry(root);
  const prev = reg.entries.find((e) => e.model_id === input.model_id && e.version === input.version);
  const entry: ModelRegistryEntry = {
    model_id: input.model_id,
    version: input.version,
    stage: input.stage,
    train_n: input.train_n ?? prev?.train_n ?? 0,
    validate_n: input.validate_n ?? prev?.validate_n ?? 0,
    oos_n: input.oos_n ?? prev?.oos_n ?? 0,
    metrics: input.metrics ?? prev?.metrics ?? {},
    leakage_pass: input.leakage_pass,
    odds_in_features: false,
    reasons: input.reasons,
    created_at: prev?.created_at ?? nowIso,
    updated_at: nowIso,
    auto_promotion: false,
    production: input.stage === "PROMOTED" ? false : false,
  };
  if (!input.leakage_pass && input.stage !== "REJECTED") {
    entry.stage = "REJECTED";
    entry.reasons = [...new Set([...entry.reasons, "LEAKAGE_FAILED"])];
  }
  const others = reg.entries.filter((e) => !(e.model_id === input.model_id && e.version === input.version));
  savePhase8ModelRegistry({ neon_in_use: false, updated_at: nowIso, entries: [...others, entry] }, root);
  return entry;
}

export function decidePromotionStage(input: {
  leakage_pass: boolean;
  train_n: number;
  validate_n: number;
  oos_n: number;
  beat_naive: boolean;
  beat_market: boolean | null;
  min_train: number;
}): { stage: ModelStage; reasons: string[] } {
  const reasons: string[] = [];
  if (!input.leakage_pass) return { stage: "REJECTED", reasons: ["LEAKAGE_FAILED"] };
  if (input.train_n < input.min_train) {
    return { stage: "CANDIDATE", reasons: ["INSUFFICIENT_TRAIN_N"] };
  }
  reasons.push("TRAINED");
  if (input.validate_n < 20) return { stage: "TRAINED", reasons: [...reasons, "VALIDATE_N_LOW"] };
  reasons.push("VALIDATED");
  if (input.oos_n < 20) return { stage: "VALIDATED", reasons: [...reasons, "OOS_N_LOW"] };
  reasons.push("OOS");
  if (!input.beat_naive) return { stage: "REJECTED", reasons: [...reasons, "DOES_NOT_BEAT_NAIVE"] };
  if (input.beat_market === false) {
    return { stage: "SHADOW", reasons: [...reasons, "DOES_NOT_BEAT_MARKET", "NO_AUTO_PROMOTION"] };
  }
  return { stage: "SHADOW", reasons: [...reasons, "METRICS_PASS_NO_AUTO_PROMOTION"] };
}
