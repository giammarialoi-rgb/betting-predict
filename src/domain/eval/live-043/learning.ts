import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { artifactStore043 } from "@/domain/eval/live-043/config";
import type { AutopsyRecord043, ModelRegistry043 } from "@/domain/eval/live-043/types";
import { loadModelRegistry043, saveModelRegistry043 } from "@/domain/eval/live-043/store";

export function appendLearningCandidate043(autopsy: AutopsyRecord043, root = artifactStore043()): void {
  mkdirSync(root, { recursive: true });
  appendFileSync(join(root, "learning-candidates.jsonl"), `${JSON.stringify(autopsy)}\n`, "utf8");
}

/** Register a learning candidate; does NOT promote a new production model. */
export function registerLearningCandidate043(
  autopsy: AutopsyRecord043,
  root?: string,
): { registered: boolean; registry: ModelRegistry043 } {
  const dir = root ?? artifactStore043();
  const reg = loadModelRegistry043(dir);
  if (!autopsy.learning_candidate) return { registered: false, registry: reg };
  appendLearningCandidate043(autopsy, dir);
  saveModelRegistry043(reg, dir);
  return { registered: true, registry: reg };
}

/** Propose MODEL_vN+1 for FUTURE events only — never production by default. */
export function proposeNextModel043(input: {
  registry: ModelRegistry043;
  trainingCutoff: string;
  trainingEvents: number;
  validationEvents: number;
  features: string[];
  fingerprint: string;
}): ModelRegistry043 {
  const n = input.registry.versions.length + 1;
  const version = `MODEL_v${n}`;
  return {
    ...input.registry,
    versions: [
      ...input.registry.versions,
      {
        version,
        training_cutoff: input.trainingCutoff,
        training_events: input.trainingEvents,
        validation_events: input.validationEvents,
        features_used: input.features,
        hyperparameters: { kind: "PROPOSED_NOT_PRODUCTION" },
        creation_timestamp: new Date().toISOString(),
        dataset_fingerprint: input.fingerprint || createHash("sha256").update(version).digest("hex").slice(0, 16),
        production: false,
      },
    ],
  };
}
