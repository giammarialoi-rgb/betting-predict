/**
 * Prediction precedence — prevent stale / weaker producers from overwriting
 * a valid independent inference with NO_INDEPENDENT / null probability_model.
 *
 * Does not delete history. Downgrades are blocked at append time and logged.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { PermanentPrediction044 } from "@/domain/eval/permanent-044/types";
import { PI_MODEL_INDEPENDENT_ID } from "@/domain/eval/predictive-intelligence/config";

/** Bump when live-resolve / independent path changes materially. */
export const ANALYSIS_RUNTIME_VERSION = "phase-8-xg-acquisition-v1";

export type PredictionAppendDecision =
  | { action: "allow"; reason: string }
  | { action: "block"; reason: string };

export function hasIndependentModel(
  p: Pick<PermanentPrediction044, "probability_model" | "model_version" | "reason_codes">,
): boolean {
  if (!p.probability_model || typeof p.probability_model !== "object") return false;
  const mv = String(p.model_version ?? "");
  if (mv.includes("NO_INDEPENDENT")) return false;
  if (mv.includes(PI_MODEL_INDEPENDENT_ID) || mv.includes("INDEPENDENT_POISSON")) return true;
  const codes = p.reason_codes ?? [];
  return codes.includes("INDEPENDENT_MODEL") || codes.includes(PI_MODEL_INDEPENDENT_ID);
}

function isNoIndependentPlaceholder(
  p: Pick<PermanentPrediction044, "probability_model" | "model_version" | "reason_codes">,
): boolean {
  if (p.probability_model && typeof p.probability_model === "object") return false;
  const mv = String(p.model_version ?? "");
  if (mv.includes("NO_INDEPENDENT")) return true;
  const codes = p.reason_codes ?? [];
  return codes.includes("NO_INDEPENDENT_MODEL") || codes.includes("FEATURES_TOO_SPARSE");
}

/** Higher = stronger / more informative independent result. */
export function predictionPrecedenceScore(
  p: Pick<PermanentPrediction044, "probability_model" | "model_version" | "reason_codes">,
): number {
  if (hasIndependentModel(p)) return 100;
  if (p.probability_model && typeof p.probability_model === "object") return 40;
  if (isNoIndependentPlaceholder(p)) return 10;
  return 0;
}

/**
 * Block append when the candidate would downgrade a stronger independent result
 * for the same event (typical stale-worker race).
 */
export function decidePredictionAppend(input: {
  existing: readonly PermanentPrediction044[];
  candidate: PermanentPrediction044;
}): PredictionAppendDecision {
  const sameEvent = input.existing.filter((p) => p.event_id === input.candidate.event_id);
  if (sameEvent.length === 0) {
    return { action: "allow", reason: "first_prediction_for_event" };
  }

  const latest = [...sameEvent].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp < b.timestamp ? 1 : -1;
    return b.prediction_seq - a.prediction_seq;
  })[0]!;

  const bestIndep = [...sameEvent]
    .filter((p) => hasIndependentModel(p))
    .sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp < b.timestamp ? 1 : -1;
      return b.prediction_seq - a.prediction_seq;
    })[0];

  const candScore = predictionPrecedenceScore(input.candidate);
  const latestScore = predictionPrecedenceScore(latest);
  const bestIndepScore = bestIndep ? predictionPrecedenceScore(bestIndep) : 0;

  if (bestIndep && isNoIndependentPlaceholder(input.candidate)) {
    return {
      action: "block",
      reason: `BLOCKED_DOWNGRADE — refuse NO_INDEPENDENT overwrite of ${bestIndep.model_version} (${bestIndep.prediction_id})`,
    };
  }

  // Only true independent inferences (score 100) are protected from weaker appends.
  // Stale MODEL_v1 rows with a probability object must be replaceable by honest INSUFFICIENT.
  if (latestScore >= 100 && candScore < latestScore) {
    return {
      action: "block",
      reason: `BLOCKED_PRECEDENCE — candidate_score=${candScore} < latest_score=${latestScore} (${latest.model_version})`,
    };
  }

  if (candScore >= 100) {
    return { action: "allow", reason: "independent_inference" };
  }

  if (bestIndepScore < 100) {
    return { action: "allow", reason: "no_prior_independent" };
  }

  return { action: "allow", reason: "non_downgrade" };
}

export function logPredictionBlocked(
  root: string,
  row: {
    event_id: string;
    candidate_model_version: string;
    reason: string;
    at: string;
    analysis_runtime_version: string;
    worker_pid: number | null;
  },
): void {
  mkdirSync(join(root), { recursive: true });
  appendFileSync(
    join(root, "prediction-blocked.jsonl"),
    `${JSON.stringify({ ...row, kind: "PREDICTION_APPEND_BLOCKED" })}\n`,
    "utf8",
  );
}