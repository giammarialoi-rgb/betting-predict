import { mkdirSync, writeFileSync, existsSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import {
  PI_DATASET_VERSION,
  PI_FEATURES_VERSION,
  PI_MODEL_INDEPENDENT_ID,
  PI_RANDOM_SEED,
  piModelsRoot,
  piRoot,
  sha256Hex,
} from "@/domain/eval/predictive-intelligence/config";
import { fitPoissonRho, type PoissonParamsPi } from "@/domain/eval/predictive-intelligence/models/poisson-independent";
import { buildFeatureVectorPi } from "@/domain/eval/predictive-intelligence/features/engine";
import { loadPiMatches } from "@/domain/eval/predictive-intelligence/dataset/loader";
import type { PiModelArtifact, PiPromotionDecision } from "@/domain/eval/predictive-intelligence/types";
import type { WalkForwardReport } from "@/domain/eval/predictive-intelligence/validation/walk-forward";

export type PiLearningCase = {
  case_id: string;
  created_at: string;
  event_id: string;
  prediction: Record<string, number> | null;
  actual: string | null;
  probability_error: number | null;
  calibration_note: string;
  market_comparison: string;
  decision_correctness: string;
  stake_outcome: string | null;
  category: "SUCCESS" | "FAILURE" | "NEUTRAL";
  auto_applied: false;
};

export function createLearningCasePi(input: {
  event_id: string;
  prediction: Record<string, number> | null;
  actual: string | null;
  market_prob: Record<string, number> | null;
  decision: string;
  stake_result: string | null;
  nowIso: string;
}): PiLearningCase {
  const sel = input.prediction
    ? Object.entries(input.prediction).sort((a, b) => b[1]! - a[1]!)[0]
    : null;
  const predLabel = sel?.[0] ?? null;
  const p = sel?.[1] ?? null;
  const correct = predLabel != null && input.actual != null && predLabel === input.actual;
  const probability_error =
    p != null && input.actual && input.prediction
      ? Math.abs((input.prediction[input.actual] ?? 0) - 1)
      : null;
  return {
    case_id: sha256Hex(`${input.event_id}|${input.nowIso}`).slice(0, 24),
    created_at: input.nowIso,
    event_id: input.event_id,
    prediction: input.prediction,
    actual: input.actual,
    probability_error,
    calibration_note: correct ? "outcome_matched_argmax" : "outcome_mismatch_or_unknown",
    market_comparison:
      input.market_prob && input.prediction
        ? "MODEL_VS_MARKET_RECORDED"
        : "INSUFFICIENT_COMPARISON",
    decision_correctness: correct ? "PREDICTION_HIT" : "PREDICTION_MISS_OR_NA",
    stake_outcome: input.stake_result,
    category: correct ? "SUCCESS" : input.actual ? "FAILURE" : "NEUTRAL",
    auto_applied: false,
  };
}

export function appendLearningCasePi(labBRoot: string | undefined, c: PiLearningCase): void {
  const dir = join(piRoot(labBRoot), "learning");
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, "cases.jsonl"), JSON.stringify(c) + "\n");
}

/** Retrain/recalibrate offline — writes NEW version; never mutates past artifacts. */
export function retrainIndependentModelPi(input?: {
  labBRoot?: string;
  nowIso?: string;
  version?: string;
}): PiModelArtifact {
  const nowIso = input?.nowIso ?? new Date().toISOString();
  const version = input?.version ?? `1.${Date.now()}.0`;
  const matches = loadPiMatches(input?.labBRoot);
  const holdout = "2324";
  const train = matches.filter((m) => m.season !== holdout);
  const rows = train.map((m) => ({ features: buildFeatureVectorPi(m, matches), label: m.ftr }));
  const usable = rows.filter((r) => r.features.missing_keys.length < 40);
  const params: PoissonParamsPi = fitPoissonRho(usable, PI_RANDOM_SEED);
  const training_cutoff = train.map((m) => m.event_time).sort().at(-1) ?? nowIso;

  const artifact: PiModelArtifact = {
    model_id: PI_MODEL_INDEPENDENT_ID,
    version,
    training_cutoff,
    features_version: PI_FEATURES_VERSION,
    dataset_version: PI_DATASET_VERSION,
    parameters: params as unknown as Record<string, unknown>,
    metrics: { train_n: usable.length },
    created_at: nowIso,
    random_seed: PI_RANDOM_SEED,
    role: "INDEPENDENT_BASELINE",
    production: false,
    auto_promotion: false,
  };

  const dir = piModelsRoot(input?.labBRoot);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${PI_MODEL_INDEPENDENT_ID}__${version}.json`);
  writeFileSync(path, JSON.stringify(artifact, null, 2));
  // Do not overwrite the canonical production pointer here — promotion gate owns that.
  return artifact;
}

export function evaluatePromotionGate(input: {
  report: WalkForwardReport;
  leakage_tests_pass: boolean;
}): { decision: PiPromotionDecision; reasons: string[]; model_edge: "UNKNOWN" | "CANDIDATE" } {
  const reasons: string[] = [];
  if (!input.leakage_tests_pass) {
    reasons.push("LEAKAGE_TESTS_FAILED");
    return { decision: "REJECT", reasons, model_edge: "UNKNOWN" };
  }
  if (!input.report.holdout.evaluated) {
    reasons.push("HOLDOUT_NOT_EVALUATED");
    return { decision: "SHADOW", reasons, model_edge: "UNKNOWN" };
  }
  if (input.report.holdout_touched_during_train) {
    reasons.push("HOLDOUT_CONTAMINATED");
    return { decision: "REJECT", reasons, model_edge: "UNKNOWN" };
  }
  const ind = input.report.holdout.metrics?.independent;
  const mkt = input.report.holdout.metrics?.market;
  const naive = input.report.holdout.metrics?.naive;
  if (!ind || !mkt || !naive) {
    reasons.push("MISSING_HOLDOUT_METRICS");
    return { decision: "SHADOW", reasons, model_edge: "UNKNOWN" };
  }
  const beatMarket = ind.log_loss < mkt.log_loss;
  const beatNaive = ind.brier <= naive.brier;
  if (!beatMarket || !beatNaive) {
    reasons.push("DOES_NOT_BEAT_BENCHMARKS");
    return { decision: "REJECT", reasons, model_edge: "UNKNOWN" };
  }
  reasons.push("METRICS_PASS_BUT_NO_AUTO_PROMOTION");
  reasons.push("SETTLED_GATE_REQUIRES_100_FOR_OPERATIONAL_EDGE");
  // Never auto-promote — human must flip production flag
  return { decision: "SHADOW", reasons, model_edge: "UNKNOWN" };
}

export function writeLearningReport(input: {
  labBRoot?: string;
  gate: ReturnType<typeof evaluatePromotionGate>;
  retrain?: PiModelArtifact | null;
  nowIso?: string;
}): void {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const casesPath = join(piRoot(input.labBRoot), "learning", "cases.jsonl");
  let n = 0;
  if (existsSync(casesPath)) {
    n = readFileSync(casesPath, "utf8").split(/\n/).filter(Boolean).length;
  }
  writeFileSync(
    join(piRoot(input.labBRoot), "learning-report.json"),
    JSON.stringify(
      {
        at: nowIso,
        learning_cases: n,
        auto_applied: false,
        auto_promotion: false,
        last_retrain: input.retrain ?? null,
        promotion_gate: input.gate,
        model_edge: "UNKNOWN",
      },
      null,
      2,
    ),
  );
}
