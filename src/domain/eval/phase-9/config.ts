import { join } from "node:path";
import { PI_MODEL_INDEPENDENT_ID } from "@/domain/eval/predictive-intelligence/config";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";

export const PHASE9_ARTIFACTS_DIR_DEFAULT = join(process.cwd(), "artifacts", "phase-9");

export function phase9ArtifactsDir(): string {
  return process.env.PHASE9_ARTIFACTS_DIR ?? PHASE9_ARTIFACTS_DIR_DEFAULT;
}
export const PHASE9_DATASET_VERSION = "dataset_phase9_v1";
export const PHASE9_FEATURES_VERSION = "features_pi_v1";
export const PHASE9_RANDOM_SEED = 42;
export const CURRENT_PRODUCTION_MODEL_ID = PI_MODEL_INDEPENDENT_ID;

export const EDGE_THRESHOLDS = [0.01, 0.02, 0.03, 0.05, 0.07, 0.1] as const;

export const MIN_N_QUALITY = 30;
export const MIN_N_ROI = 50;
export const MIN_N_AUC = 20;
export const MIN_N_THRESHOLD_CHOICE = 20;
export const MIN_TRAIN_POISSON = 20;
export const MIN_TRAIN_DC = 40;
export const MIN_TRAIN_LOGISTIC = 40;
export const MIN_TRAIN_NEGBIN = 80;
export const MIN_TRAIN_GBM = 200;
export const MIN_PROMOTE_TRAIN = 200;
export const MIN_PROMOTE_VAL = 80;
export const MIN_PROMOTE_OOS = 80;
export const MAX_CALIBRATION_FOR_CANDIDATE = 0.08;

export function phase9LabRoot(override?: string): string {
  return override ?? permanentRoot044();
}

/**
 * Promotion policy (code-enforced).
 *
 * PROMOTED is never assigned by this pipeline.
 * A single positive OOS ROI is not a promotion criterion.
 * Market baseline is a non-independent benchmark, not a feature.
 * CURRENT_PRODUCTION stays INDEPENDENT_POISSON_v1 until a human
 * records an explicit promotion after all gates below.
 */
export const PHASE9_PROMOTION_POLICY = {
  auto_promotion: false as const,
  promoted_by_code: false as const,
  single_positive_roi_insufficient: true as const,
  current_production_until_criteria: CURRENT_PRODUCTION_MODEL_ID,
  required_for_candidate: [
    "leakage_pass",
    "odds_not_in_features",
    `train_n>=${MIN_PROMOTE_TRAIN}`,
    `val_n>=${MIN_PROMOTE_VAL}`,
    `oos_n>=${MIN_PROMOTE_OOS}`,
    "beats_naive_logloss_and_brier_on_every_oos_window",
    `calibration_error<${MAX_CALIBRATION_FOR_CANDIDATE}`,
    "threshold_chosen_on_val_only",
  ],
  required_for_promoted: [
    "all_candidate_criteria",
    "human_approval",
    "no_regression_vs_current_production",
    "not_a_single_window_result",
  ],
  note: "PROMOTED=0 is a valid and expected outcome.",
};
