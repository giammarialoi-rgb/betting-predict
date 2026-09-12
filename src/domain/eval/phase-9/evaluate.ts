/**
 * OOS model evaluation — only if each model's data requirements are met.
 * Odds never enter independent feature vectors.
 */
import { buildFeatureVectorPi } from "@/domain/eval/predictive-intelligence/features/engine";
import { fitPoissonRho, predictPoissonIndependentDetailed, teamLambdasFromHistory } from "@/domain/eval/predictive-intelligence/models/poisson-independent";
import { dataSupportsDixonColes, fitDixonColesRho, predictDixonColes } from "@/domain/eval/predictive-intelligence/models/dixon-coles";
import { dataSupportsNegBin, goalOverdispersion, predictNegBin } from "@/domain/eval/predictive-intelligence/models/negbin";
import { trainLogisticChallenger, predictLogisticChallenger, type LogisticWeightsPi } from "@/domain/eval/predictive-intelligence/models/logistic-challenger";
import { dataSupportsGbm, trainGbmStumps, predictGbmStumps, type GbmParams } from "@/domain/eval/predictive-intelligence/models/gbm-stumps";
import { assertProbSumsToOne } from "@/domain/eval/predictive-intelligence/models/normalize-probs";
import { PI_RANDOM_SEED } from "@/domain/eval/predictive-intelligence/config";
import type { PiFeatureVector, PiProb3 } from "@/domain/eval/predictive-intelligence/types";
import { assertFeatureVectorFirewall } from "@/domain/eval/phase-9/firewall";
import {
  MIN_TRAIN_DC,
  MIN_TRAIN_GBM,
  MIN_TRAIN_LOGISTIC,
  MIN_TRAIN_NEGBIN,
  MIN_TRAIN_POISSON,
  PHASE9_RANDOM_SEED,
} from "@/domain/eval/phase-9/config";
import { qualityMetrics1x2 } from "@/domain/eval/phase-9/metrics";
import { predictBaseline, INDEPENDENT_BASELINES, MARKET_BASELINE_ID } from "@/domain/eval/phase-9/baselines";
import type { Phase9Match, Phase9ModelId, Phase9PredRow, Phase9QualityMetrics } from "@/domain/eval/phase-9/types";
import { marketBaselineFromOpenOdds } from "@/domain/eval/predictive-intelligence/models/market-baseline";

export type TrainedBundle = {
  poisson: ReturnType<typeof fitPoissonRho> | null;
  dixon: ReturnType<typeof fitDixonColesRho> | null;
  logistic: LogisticWeightsPi | null;
  gbm: GbmParams | null;
  featureKeys: string[];
  trainGoals: number[];
  trainN: number;
  support: Record<Phase9ModelId, { supported: boolean; reason: string }>;
};

function featureKeysFrom(feat: PiFeatureVector): string[] {
  return Object.keys(feat.values)
    .filter((k) => feat.values[k] != null && Number.isFinite(feat.values[k]))
    .sort();
}

export function trainBundle(input: {
  train: Phase9Match[];
  universe: readonly Phase9Match[];
}): TrainedBundle {
  const rows: { features: PiFeatureVector; label: Phase9Match["ftr"]; lambdas: { homeLambda: number; awayLambda: number } }[] = [];
  const goals: number[] = [];
  for (const m of input.train) {
    const features = buildFeatureVectorPi(m, input.universe);
    assertFeatureVectorFirewall(features, m);
    if (features.missing_keys.length >= 40) continue;
    rows.push({
      features,
      label: m.ftr,
      lambdas: teamLambdasFromHistory(m, input.universe),
    });
    goals.push(m.fthg, m.ftag);
  }
  const trainN = rows.length;
  const keys = rows[0] ? featureKeysFrom(rows[0].features) : [];
  const support: TrainedBundle["support"] = {
    INDEPENDENT_POISSON_v1: {
      supported: trainN >= MIN_TRAIN_POISSON,
      reason: trainN >= MIN_TRAIN_POISSON ? "lambdas from historical goals" : "INSUFFICIENT_TRAIN_N",
    },
    DIXON_COLES_v1: {
      supported: dataSupportsDixonColes(trainN),
      reason: dataSupportsDixonColes(trainN) ? "rho fit on TRAIN goals" : "INSUFFICIENT_TRAIN_N",
    },
    NEGBIN_v1: {
      supported: dataSupportsNegBin({ trainN, goals }),
      reason: dataSupportsNegBin({ trainN, goals })
        ? "overdispersed goals"
        : `DATA_NOT_OVERDISPERSED_OR_N_LOW mean/var=${JSON.stringify(goalOverdispersion(goals))}`,
    },
    INDEPENDENT_LOGISTIC_v1: {
      supported: trainN >= MIN_TRAIN_LOGISTIC && keys.length >= 4,
      reason: trainN >= MIN_TRAIN_LOGISTIC && keys.length >= 4 ? "trained weights" : "NO_LOGISTIC_WEIGHTS_OR_N_LOW",
    },
    GBM_STUMPS_v1: {
      supported: dataSupportsGbm({ trainN, keyCount: keys.length }),
      reason: dataSupportsGbm({ trainN, keyCount: keys.length }) ? "stumps trained" : "GBM_NOT_SUPPORTED_BY_DATA",
    },
  };

  const poisson = support.INDEPENDENT_POISSON_v1.supported
    ? fitPoissonRho(
        rows.map((r) => ({ features: r.features, label: r.label })),
        PHASE9_RANDOM_SEED,
      )
    : null;
  const dixon = support.DIXON_COLES_v1.supported
    ? fitDixonColesRho(rows.map((r) => ({ ...r.lambdas, label: r.label })))
    : null;
  const logistic = support.INDEPENDENT_LOGISTIC_v1.supported
    ? trainLogisticChallenger({
        rows: rows.map((r) => ({ features: r.features, label: r.label })),
        keys,
        seed: PI_RANDOM_SEED,
        epochs: trainN > 4000 ? 25 : 50,
        lr: 0.02,
      })
    : null;
  const gbm = support.GBM_STUMPS_v1.supported
    ? trainGbmStumps({
        rows: rows.map((r) => ({ features: r.features, label: r.label })),
        keys,
        rounds: 8,
      })
    : null;

  return { poisson, dixon, logistic, gbm, featureKeys: keys, trainGoals: goals, trainN, support };
}

export function predictModel(input: {
  model_id: Phase9ModelId;
  target: Phase9Match;
  universe: readonly Phase9Match[];
  bundle: TrainedBundle;
}): { p: PiProb3; lambda_home: number | null; lambda_away: number | null } | null {
  const feat = buildFeatureVectorPi(input.target, input.universe);
  assertFeatureVectorFirewall(feat, input.target);
  const lambdas = teamLambdasFromHistory(input.target, input.universe);
  switch (input.model_id) {
    case "INDEPENDENT_POISSON_v1": {
      if (!input.bundle.poisson) return null;
      const d = predictPoissonIndependentDetailed({ features: feat, params: input.bundle.poisson });
      assertProbSumsToOne(d.probability);
      return { p: d.probability, lambda_home: d.lambda_home, lambda_away: d.lambda_away };
    }
    case "DIXON_COLES_v1": {
      if (!input.bundle.dixon || input.bundle.trainN < MIN_TRAIN_DC) return null;
      const p = predictDixonColes({
        lambda_home: lambdas.homeLambda,
        lambda_away: lambdas.awayLambda,
        params: input.bundle.dixon,
      });
      assertProbSumsToOne(p);
      return { p, lambda_home: lambdas.homeLambda, lambda_away: lambdas.awayLambda };
    }
    case "NEGBIN_v1": {
      if (!input.bundle.support.NEGBIN_v1.supported || input.bundle.trainN < MIN_TRAIN_NEGBIN) return null;
      const p = predictNegBin({
        lambda_home: lambdas.homeLambda,
        lambda_away: lambdas.awayLambda,
      });
      assertProbSumsToOne(p);
      return { p, lambda_home: lambdas.homeLambda, lambda_away: lambdas.awayLambda };
    }
    case "INDEPENDENT_LOGISTIC_v1": {
      if (!input.bundle.logistic || input.bundle.trainN < MIN_TRAIN_LOGISTIC) return null;
      const p = predictLogisticChallenger({ features: feat, weights: input.bundle.logistic });
      assertProbSumsToOne(p);
      return { p, lambda_home: null, lambda_away: null };
    }
    case "GBM_STUMPS_v1": {
      if (!input.bundle.gbm || input.bundle.trainN < MIN_TRAIN_GBM) return null;
      const p = predictGbmStumps({ features: feat, params: input.bundle.gbm });
      assertProbSumsToOne(p);
      return { p, lambda_home: null, lambda_away: null };
    }
    default:
      return null;
  }
}

export function openOddsTriple(m: Phase9Match): { home: number | null; draw: number | null; away: number | null } | null {
  const t =
    m.odds_open.B365.home != null
      ? m.odds_open.B365
      : m.odds_open.PS.home != null
        ? m.odds_open.PS
        : m.odds_open.Avg;
  if (t.home == null && t.draw == null && t.away == null) return null;
  return t;
}

export function predictPartition(input: {
  model_id: Phase9ModelId;
  rows: Phase9Match[];
  universe: readonly Phase9Match[];
  bundle: TrainedBundle;
}): Phase9PredRow[] {
  const out: Phase9PredRow[] = [];
  for (const m of input.rows) {
    const pred = predictModel({
      model_id: input.model_id,
      target: m,
      universe: input.universe,
      bundle: input.bundle,
    });
    if (!pred) continue;
    out.push({
      canonical_id: m.canonical_id,
      season: m.season,
      league: m.league,
      match_date: m.match_date,
      y: m.ftr,
      fthg: m.fthg,
      ftag: m.ftag,
      p: pred.p,
      market_p: marketBaselineFromOpenOdds(m),
      odds: openOddsTriple(m),
      lambda_home: pred.lambda_home,
      lambda_away: pred.lambda_away,
    });
  }
  return out;
}

export function evaluatePreds(rows: Phase9PredRow[]): Phase9QualityMetrics {
  return qualityMetrics1x2(
    rows.map((r) => ({
      p: r.p,
      y: r.y,
      lambda_home: r.lambda_home,
      lambda_away: r.lambda_away,
      fthg: r.fthg,
      ftag: r.ftag,
    })),
  );
}

export function evaluateBaselines(input: {
  rows: Phase9Match[];
  universe: readonly Phase9Match[];
}): Record<string, Phase9QualityMetrics> {
  const out: Record<string, Phase9QualityMetrics> = {};
  for (const id of [...INDEPENDENT_BASELINES, MARKET_BASELINE_ID]) {
    const scored: { p: PiProb3; y: Phase9Match["ftr"] }[] = [];
    for (const m of input.rows) {
      const p = predictBaseline({ id, target: m, universe: input.universe });
      if (!p) continue;
      scored.push({ p, y: m.ftr });
    }
    out[id] = qualityMetrics1x2(scored);
  }
  return out;
}

export const ALL_MODELS: Phase9ModelId[] = [
  "INDEPENDENT_POISSON_v1",
  "DIXON_COLES_v1",
  "NEGBIN_v1",
  "INDEPENDENT_LOGISTIC_v1",
  "GBM_STUMPS_v1",
];
