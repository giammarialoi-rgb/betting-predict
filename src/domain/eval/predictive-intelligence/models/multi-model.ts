/**
 * Multi-model runner — only models whose data-support gate passes.
 * Live champion remains Independent Poisson unless a registry entry is PROMOTED
 * (this codebase never auto-promotes).
 */
import { PI_MODEL_INDEPENDENT_ID } from "@/domain/eval/predictive-intelligence/config";
import { predictPoissonIndependent, teamLambdasFromHistory } from "@/domain/eval/predictive-intelligence/models/poisson-independent";
import { dataSupportsDixonColes, predictDixonColes } from "@/domain/eval/predictive-intelligence/models/dixon-coles";
import { dataSupportsNegBin, predictNegBin } from "@/domain/eval/predictive-intelligence/models/negbin";
import {
  predictLogisticChallenger,
  type LogisticWeightsPi,
} from "@/domain/eval/predictive-intelligence/models/logistic-challenger";
import { dataSupportsGbm, predictGbmStumps, type GbmParams } from "@/domain/eval/predictive-intelligence/models/gbm-stumps";
import type { PiFeatureVector, PiMatchRow, PiProb3 } from "@/domain/eval/predictive-intelligence/types";

export type ImplementableModelId =
  | typeof PI_MODEL_INDEPENDENT_ID
  | "DIXON_COLES_v1"
  | "NEGBIN_v1"
  | "INDEPENDENT_LOGISTIC_v1"
  | "GBM_STUMPS_v1";

export type ModelSupport = {
  model_id: ImplementableModelId;
  supported: boolean;
  reason: string;
};

export function listImplementableModels(input: {
  trainN: number;
  goals: number[];
  featureKeys: string[];
  logistic?: LogisticWeightsPi | null;
  gbm?: GbmParams | null;
}): ModelSupport[] {
  return [
    {
      model_id: PI_MODEL_INDEPENDENT_ID,
      supported: input.trainN >= 20,
      reason: input.trainN >= 20 ? "lambdas from historical goals" : "INSUFFICIENT_TRAIN_N",
    },
    {
      model_id: "DIXON_COLES_v1",
      supported: dataSupportsDixonColes(input.trainN),
      reason: dataSupportsDixonColes(input.trainN) ? "rho fit on TRAIN goals" : "INSUFFICIENT_TRAIN_N",
    },
    {
      model_id: "NEGBIN_v1",
      supported: dataSupportsNegBin({ trainN: input.trainN, goals: input.goals }),
      reason: dataSupportsNegBin({ trainN: input.trainN, goals: input.goals })
        ? "overdispersed goals"
        : "DATA_NOT_OVERDISPERSED_OR_N_LOW",
    },
    {
      model_id: "INDEPENDENT_LOGISTIC_v1",
      supported: Boolean(input.logistic) && input.trainN >= 40,
      reason: input.logistic ? "trained weights present" : "NO_LOGISTIC_WEIGHTS",
    },
    {
      model_id: "GBM_STUMPS_v1",
      supported: Boolean(input.gbm) && dataSupportsGbm({ trainN: input.trainN, keyCount: input.featureKeys.length }),
      reason:
        input.gbm && dataSupportsGbm({ trainN: input.trainN, keyCount: input.featureKeys.length })
          ? "stumps trained"
          : "GBM_NOT_SUPPORTED_BY_DATA",
    },
  ];
}

export function predictImplementable(input: {
  model_id: ImplementableModelId;
  features: PiFeatureVector;
  target: PiMatchRow;
  universe: readonly PiMatchRow[];
  logistic?: LogisticWeightsPi | null;
  gbm?: GbmParams | null;
}): PiProb3 | null {
  const lambdas = teamLambdasFromHistory(input.target, input.universe);
  switch (input.model_id) {
    case PI_MODEL_INDEPENDENT_ID:
      return predictPoissonIndependent({ features: input.features });
    case "DIXON_COLES_v1":
      return predictDixonColes(lambdas);
    case "NEGBIN_v1":
      return predictNegBin(lambdas);
    case "INDEPENDENT_LOGISTIC_v1":
      return input.logistic
        ? predictLogisticChallenger({ features: input.features, weights: input.logistic })
        : null;
    case "GBM_STUMPS_v1":
      return input.gbm ? predictGbmStumps({ features: input.features, params: input.gbm }) : null;
    default:
      return null;
  }
}
