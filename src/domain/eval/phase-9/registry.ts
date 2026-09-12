/**
 * Versioned Phase 9 registry.
 * Statuses: EXPERIMENTAL / VALIDATED / CANDIDATE / PROMOTED / RETIRED / INSUFFICIENT_EVIDENCE
 * Code never writes PROMOTED. CURRENT_PRODUCTION stays Poisson until human criteria.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  CURRENT_PRODUCTION_MODEL_ID,
  MAX_CALIBRATION_FOR_CANDIDATE,
  MIN_PROMOTE_OOS,
  MIN_PROMOTE_TRAIN,
  MIN_PROMOTE_VAL,
  PHASE9_PROMOTION_POLICY,
  phase9LabRoot,
} from "@/domain/eval/phase-9/config";
import type { Phase9ModelId, Phase9QualityMetrics, Phase9RegistryStatus } from "@/domain/eval/phase-9/types";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";

export type Phase9RegistryEntry = {
  model_id: Phase9ModelId | string;
  version: string;
  status: Phase9RegistryStatus;
  production: boolean;
  auto_promotion: false;
  leakage_pass: boolean;
  odds_in_features: false;
  train_n: number;
  validate_n: number;
  oos_n: number;
  windows_beat_naive: number;
  windows_total: number;
  metrics_oos: Record<string, number | null>;
  reasons: string[];
  created_at: string;
  updated_at: string;
};

export type Phase9Registry = {
  neon_in_use: false;
  updated_at: string;
  current_production: {
    model_id: typeof CURRENT_PRODUCTION_MODEL_ID;
    status_note: string;
    unchanged: true;
  };
  policy: typeof PHASE9_PROMOTION_POLICY;
  promoted_count: number;
  entries: Phase9RegistryEntry[];
};

export function phase9RegistryPath(root = permanentRoot044()): string {
  return join(root, "manifests", "phase9-model-registry.json");
}

export function loadPhase9Registry(root = phase9LabRoot()): Phase9Registry {
  const p = phase9RegistryPath(root);
  if (!existsSync(p)) {
    return emptyRegistry(new Date(0).toISOString());
  }
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Phase9Registry;
  } catch {
    return emptyRegistry(new Date(0).toISOString());
  }
}

function emptyRegistry(nowIso: string): Phase9Registry {
  return {
    neon_in_use: false,
    updated_at: nowIso,
    current_production: {
      model_id: CURRENT_PRODUCTION_MODEL_ID,
      status_note: "Live pointer unchanged. Phase 9 does not swap production.",
      unchanged: true,
    },
    policy: PHASE9_PROMOTION_POLICY,
    promoted_count: 0,
    entries: [],
  };
}

export function decidePhase9Status(input: {
  leakage_pass: boolean;
  train_n: number;
  validate_n: number;
  oos_n: number;
  supported: boolean;
  windows_total: number;
  windows_beat_naive: number;
  oos_log_loss: number | null;
  naive_log_loss: number | null;
  oos_brier: number | null;
  naive_brier: number | null;
  calibration_error: number | null;
  min_train: number;
}): { status: Phase9RegistryStatus; reasons: string[] } {
  const reasons: string[] = [];
  if (!input.leakage_pass) {
    return { status: "RETIRED", reasons: ["LEAKAGE_FAILED"] };
  }
  if (!input.supported || input.train_n < input.min_train) {
    return { status: "INSUFFICIENT_EVIDENCE", reasons: ["DATA_REQUIREMENTS_NOT_MET"] };
  }
  if (input.oos_n < 20 || input.windows_total < 1) {
    return { status: "EXPERIMENTAL", reasons: ["OOS_N_LOW_OR_NO_WINDOW"] };
  }
  const beatNaive =
    input.oos_log_loss != null &&
    input.naive_log_loss != null &&
    input.oos_brier != null &&
    input.naive_brier != null &&
    input.oos_log_loss < input.naive_log_loss &&
    input.oos_brier <= input.naive_brier;
  if (!beatNaive) {
    reasons.push("DOES_NOT_BEAT_NAIVE_ON_POOLED_OOS");
    return { status: "EXPERIMENTAL", reasons: [...reasons, "TRAINED_BUT_NOT_VALIDATED"] };
  }
  reasons.push("BEATS_NAIVE_POOLED_OOS");
  if (input.validate_n < 20) {
    return { status: "EXPERIMENTAL", reasons: [...reasons, "VALIDATE_N_LOW"] };
  }
  if (
    input.train_n < MIN_PROMOTE_TRAIN ||
    input.validate_n < MIN_PROMOTE_VAL ||
    input.oos_n < MIN_PROMOTE_OOS
  ) {
    return { status: "VALIDATED", reasons: [...reasons, "N_BELOW_CANDIDATE_MINIMA"] };
  }
  if (input.calibration_error != null && input.calibration_error >= MAX_CALIBRATION_FOR_CANDIDATE) {
    return { status: "VALIDATED", reasons: [...reasons, "CALIBRATION_ABOVE_CANDIDATE"] };
  }
  if (input.windows_total < 2 || input.windows_beat_naive < input.windows_total) {
    return { status: "VALIDATED", reasons: [...reasons, "NOT_STABLE_ACROSS_ALL_OOS_WINDOWS"] };
  }
  reasons.push("CANDIDATE_GATES_MET");
  reasons.push("NO_AUTO_PROMOTION");
  reasons.push("SINGLE_POSITIVE_ROI_INSUFFICIENT");
  return { status: "CANDIDATE", reasons };
}

export function recordPhase9Entry(input: {
  root?: string;
  nowIso?: string;
  model_id: Phase9ModelId | string;
  version: string;
  leakage_pass: boolean;
  train_n: number;
  validate_n: number;
  oos_n: number;
  windows_beat_naive: number;
  windows_total: number;
  metrics_oos?: Record<string, number | null>;
  quality?: Phase9QualityMetrics | null;
  supported: boolean;
  min_train: number;
}): Phase9RegistryEntry {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const root = input.root ?? phase9LabRoot();
  const decided = decidePhase9Status({
    leakage_pass: input.leakage_pass,
    train_n: input.train_n,
    validate_n: input.validate_n,
    oos_n: input.oos_n,
    supported: input.supported,
    windows_total: input.windows_total,
    windows_beat_naive: input.windows_beat_naive,
    oos_log_loss: input.quality?.log_loss ?? input.metrics_oos?.log_loss ?? null,
    naive_log_loss: input.metrics_oos?.naive_log_loss ?? null,
    oos_brier: input.quality?.brier ?? input.metrics_oos?.brier ?? null,
    naive_brier: input.metrics_oos?.naive_brier ?? null,
    calibration_error: input.quality?.calibration_error ?? input.metrics_oos?.calibration_error ?? null,
    min_train: input.min_train,
  });
  const entry: Phase9RegistryEntry = {
    model_id: input.model_id,
    version: input.version,
    status: decided.status,
    production: false,
    auto_promotion: false,
    leakage_pass: input.leakage_pass,
    odds_in_features: false,
    train_n: input.train_n,
    validate_n: input.validate_n,
    oos_n: input.oos_n,
    windows_beat_naive: input.windows_beat_naive,
    windows_total: input.windows_total,
    metrics_oos: input.metrics_oos ?? {},
    reasons: decided.reasons,
    created_at: nowIso,
    updated_at: nowIso,
  };
  const reg = loadPhase9Registry(root);
  const others = reg.entries.filter((e) => !(e.model_id === entry.model_id && e.version === entry.version));
  const next: Phase9Registry = {
    ...reg,
    updated_at: nowIso,
    promoted_count: 0,
    current_production: {
      model_id: CURRENT_PRODUCTION_MODEL_ID,
      status_note: "Live pointer unchanged. Phase 9 does not swap production.",
      unchanged: true,
    },
    policy: PHASE9_PROMOTION_POLICY,
    entries: [...others, entry],
    neon_in_use: false,
  };
  mkdirSync(join(root, "manifests"), { recursive: true });
  writeFileSync(phase9RegistryPath(root), JSON.stringify(next, null, 2));
  return entry;
}

export function assertNeverAutoPromote(entry: Phase9RegistryEntry): void {
  if (entry.status === "PROMOTED") {
    throw new Error("PROMOTION_CRITERIA: code must not assign PROMOTED");
  }
  if (entry.auto_promotion !== false || entry.production !== false) {
    throw new Error("PROMOTION_CRITERIA: auto_promotion/production must stay false");
  }
}
