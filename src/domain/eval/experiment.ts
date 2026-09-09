/**
 * Experiment versioning — file/JSON first (no migration).
 */

export type ExperimentManifest = {
  experiment_id: string;
  dataset_version: string;
  feature_policy_version: string;
  model_version: string;
  as_of_policy: "STRICT_AS_OF" | "RESEARCH" | "ANY";
  created_at: string;
  notes: string;
};

export function createExperimentManifest(input: {
  experimentId: string;
  datasetVersion: string;
  featurePolicyVersion: string;
  modelVersion: string;
  asOfPolicy: ExperimentManifest["as_of_policy"];
  notes?: string;
}): ExperimentManifest {
  return {
    experiment_id: input.experimentId,
    dataset_version: input.datasetVersion,
    feature_policy_version: input.featurePolicyVersion,
    model_version: input.modelVersion,
    as_of_policy: input.asOfPolicy,
    created_at: new Date().toISOString(),
    notes: input.notes ?? "",
  };
}

export const LAB_EXPERIMENT_V1: ExperimentManifest = {
  experiment_id: "exp_009_lab_v1",
  dataset_version: "lab_v1_2019_2024",
  feature_policy_version: "feature_policy_v1_strict",
  model_version: "baselines_v1",
  as_of_policy: "STRICT_AS_OF",
  created_at: "2026-04-06T00:00:00.000Z",
  notes: "TASK 009 historical evaluation lab — measurement only, no staking",
};
