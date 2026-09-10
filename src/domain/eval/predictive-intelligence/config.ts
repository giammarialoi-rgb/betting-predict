import { createHash } from "node:crypto";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";

export const PI_FEATURES_VERSION = "features_pi_v1";
export const PI_DATASET_VERSION = "dataset_pi_v1";
export const PI_MODEL_INDEPENDENT_ID = "INDEPENDENT_POISSON_v1";
export const PI_MODEL_CHALLENGER_ID = "INDEPENDENT_LOGISTIC_v1";
export const PI_MODEL_NAIVE_ID = "NAIVE_LEAGUE_FREQ_v1";
export const PI_MARKET_BASELINE_ID = "MARKET_DEVIG_BASELINE";
export const PI_RANDOM_SEED = 42;
export const PI_HOLDOUT_SEASON = "2324";

/** Major top-flight divisions × seasons (plan-locked). */
export const PI_DIVISIONS = ["E0", "SP1", "D1", "I1", "F1"] as const;
export const PI_SEASONS = [
  "1920",
  "2021",
  "2122",
  "2223",
  "2324",
  "2425",
] as const;

export type PiDivision = (typeof PI_DIVISIONS)[number];
export type PiSeason = (typeof PI_SEASONS)[number];

export function piRoot(labBRoot?: string): string {
  return join(labBRoot ?? permanentRoot044(), "predictive-intelligence");
}

export function piDatasetsRoot(labBRoot?: string): string {
  return join(piRoot(labBRoot), "datasets");
}

export function piModelsRoot(labBRoot?: string): string {
  return join(piRoot(labBRoot), "models");
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}
