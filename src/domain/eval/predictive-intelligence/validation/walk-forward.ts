import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PI_DATASET_VERSION,
  PI_FEATURES_VERSION,
  PI_HOLDOUT_SEASON,
  PI_MODEL_CHALLENGER_ID,
  PI_MODEL_INDEPENDENT_ID,
  PI_MODEL_NAIVE_ID,
  PI_MARKET_BASELINE_ID,
  PI_RANDOM_SEED,
  piModelsRoot,
  piRoot,
  sha256Hex,
} from "@/domain/eval/predictive-intelligence/config";
import { buildFeatureVectorPi, featureManifestPi } from "@/domain/eval/predictive-intelligence/features/engine";
import { fitPoissonRho, predictPoissonIndependent } from "@/domain/eval/predictive-intelligence/models/poisson-independent";
import { trainLogisticChallenger, predictLogisticChallenger, type LogisticWeightsPi } from "@/domain/eval/predictive-intelligence/models/logistic-challenger";
import { fitTemperatureOnValidation } from "@/domain/eval/predictive-intelligence/models/temperature";
import { predictNaiveLeagueFreq } from "@/domain/eval/predictive-intelligence/models/naive";
import { marketBaselineFromOpenOdds, researchCloseMarket } from "@/domain/eval/predictive-intelligence/models/market-baseline";
import { assertProbSumsToOne } from "@/domain/eval/predictive-intelligence/models/normalize-probs";
import { computeMetrics, paperRoiFromPreds } from "@/domain/eval/predictive-intelligence/validation/metrics";
import type { PiMatchRow, PiModelArtifact, PiProb3 } from "@/domain/eval/predictive-intelligence/types";
import { loadPiMatches } from "@/domain/eval/predictive-intelligence/dataset/loader";

export type WalkForwardFold = {
  fold_id: string;
  train_seasons: string[];
  validate_season: string;
  train_n: number;
  validate_n: number;
  metrics: {
    independent: ReturnType<typeof computeMetrics>;
    challenger: ReturnType<typeof computeMetrics>;
    naive: ReturnType<typeof computeMetrics>;
    market: ReturnType<typeof computeMetrics>;
  };
};

export type WalkForwardReport = {
  holdout_season: string;
  holdout_blind_until_eval: true;
  holdout_touched_during_train: false;
  folds: WalkForwardFold[];
  holdout: {
    evaluated: boolean;
    n: number;
    metrics: WalkForwardFold["metrics"] | null;
    paper: ReturnType<typeof paperRoiFromPreds> | null;
    clv_available_n: number;
    independent_beats_market_logloss: boolean | null;
    independent_beats_naive_brier: boolean | null;
  };
  artifacts: {
    poisson_params: unknown;
    logistic_path: string;
    model_manifest_path: string;
  };
};

function seasonsInOrder(matches: PiMatchRow[]): string[] {
  return [...new Set(matches.map((m) => m.season))].sort();
}

function rowPreds(
  matches: PiMatchRow[],
  universe: PiMatchRow[],
  poissonParams: ReturnType<typeof fitPoissonRho>,
  logistic: LogisticWeightsPi | null,
): {
  independent: { p: PiProb3; y: PiMatchRow["ftr"] }[];
  challenger: { p: PiProb3; y: PiMatchRow["ftr"] }[];
  naive: { p: PiProb3; y: PiMatchRow["ftr"] }[];
  market: { p: PiProb3; y: PiMatchRow["ftr"] }[];
  paperRows: Parameters<typeof paperRoiFromPreds>[0];
  clv_n: number;
} {
  const independent: { p: PiProb3; y: PiMatchRow["ftr"] }[] = [];
  const challenger: { p: PiProb3; y: PiMatchRow["ftr"] }[] = [];
  const naive: { p: PiProb3; y: PiMatchRow["ftr"] }[] = [];
  const market: { p: PiProb3; y: PiMatchRow["ftr"] }[] = [];
  const paperRows: Parameters<typeof paperRoiFromPreds>[0] = [];
  let clv_n = 0;

  for (const m of matches) {
    const feat = buildFeatureVectorPi(m, universe);
    const pInd = predictPoissonIndependent({ features: feat, params: poissonParams });
    assertProbSumsToOne(pInd);
    independent.push({ p: pInd, y: m.ftr });

    const pN = predictNaiveLeagueFreq({ target: m, universe });
    assertProbSumsToOne(pN);
    naive.push({ p: pN, y: m.ftr });

    if (logistic) {
      const pC = predictLogisticChallenger({ features: feat, weights: logistic });
      assertProbSumsToOne(pC);
      challenger.push({ p: pC, y: m.ftr });
    }

    const pM = marketBaselineFromOpenOdds(m);
    if (pM) {
      assertProbSumsToOne(pM);
      market.push({ p: pM, y: m.ftr });
    }
    if (researchCloseMarket(m)) clv_n += 1;

    const edge =
      pM != null ? Math.max(pInd.HOME - pM.HOME, pInd.DRAW - pM.DRAW, pInd.AWAY - pM.AWAY) : 0;
    paperRows.push({
      p: pInd,
      y: m.ftr,
      odds: m.odds_open.B365.home != null ? m.odds_open.B365 : m.odds_open.Avg,
      bet: pM != null && edge >= 0.03,
    });
  }

  return { independent, challenger, naive, market, paperRows, clv_n };
}

/**
 * Walk-forward temporal validation.
 * FINAL HOLDOUT = last season (2324) — blind until evaluateHoldout=true.
 */
export function runWalkForwardValidation(input?: {
  labBRoot?: string;
  matches?: PiMatchRow[];
  evaluateHoldout?: boolean;
  nowIso?: string;
}): WalkForwardReport {
  const nowIso = input?.nowIso ?? new Date().toISOString();
  const all = (input?.matches ?? loadPiMatches(input?.labBRoot)).slice().sort((a, b) =>
    a.event_time < b.event_time ? -1 : 1,
  );
  if (!all.length) {
    throw new Error("No PI matches loaded — run import first");
  }

  const seasons = seasonsInOrder(all);
  const holdoutSeason = seasons.includes(PI_HOLDOUT_SEASON)
    ? PI_HOLDOUT_SEASON
    : seasons[seasons.length - 1]!;
  const trainValSeasons = seasons.filter((s) => s !== holdoutSeason);

  // Blind: never use holdout rows during train/val
  const nonHoldout = all.filter((m) => m.season !== holdoutSeason);
  const holdoutRows = all.filter((m) => m.season === holdoutSeason);

  const folds: WalkForwardFold[] = [];
  let lastPoisson = fitPoissonRho([]);
  let lastLogistic: LogisticWeightsPi | null = null;
  let featureKeys: string[] = [];

  for (let i = 0; i < trainValSeasons.length - 1; i += 1) {
    const validate_season = trainValSeasons[i + 1]!;
    const train_seasons = trainValSeasons.slice(0, i + 1);
    const trainRows = nonHoldout.filter((m) => train_seasons.includes(m.season));
    const valRows = nonHoldout.filter((m) => m.season === validate_season);

    // Universe for features = all matches (priors gated by as-of); holdout still in universe
    // but feature cutoff prevents leakage. For honesty during WF, use only matches with
    // event_time before validate end — still as-of safe via priorMatchesAsOf.
    const trainFeat = trainRows.map((m) => ({
      features: buildFeatureVectorPi(m, all),
      label: m.ftr,
    }));
    // skip early-season insufficient
    const usable = trainFeat.filter((r) => r.features.missing_keys.length < 40);
    lastPoisson = fitPoissonRho(usable, PI_RANDOM_SEED);
    featureKeys = Object.keys(usable[0]?.features.values ?? {}).sort();
    lastLogistic = trainLogisticChallenger({
      rows: usable,
      keys: featureKeys,
      seed: PI_RANDOM_SEED,
      epochs: 50,
      lr: 0.02,
    });

    // Temperature calibration on VALIDATION only (never holdout)
    const valRaw = valRows.map((m) => {
      const feat = buildFeatureVectorPi(m, all);
      return {
        p: predictPoissonIndependent({ features: feat, params: { ...lastPoisson, temperature: 1 } }),
        y: m.ftr,
      };
    });
    const T = fitTemperatureOnValidation(valRaw);
    lastPoisson = { ...lastPoisson, temperature: T };

    const preds = rowPreds(valRows, all, lastPoisson, lastLogistic);
    folds.push({
      fold_id: `wf_${train_seasons.join("+")}_val_${validate_season}`,
      train_seasons,
      validate_season,
      train_n: trainRows.length,
      validate_n: valRows.length,
      metrics: {
        independent: computeMetrics(preds.independent),
        challenger: computeMetrics(preds.challenger),
        naive: computeMetrics(preds.naive),
        market: computeMetrics(preds.market),
      },
    });
  }

  // Final train on all non-holdout for artifacts — keep temperature from last validation fold
  const temperatureFromVal = lastPoisson.temperature ?? 1;
  const finalTrain = nonHoldout.map((m) => ({
    features: buildFeatureVectorPi(m, all),
    label: m.ftr,
  }));
  const usableFinal = finalTrain.filter((r) => r.features.missing_keys.length < 40);
  lastPoisson = { ...fitPoissonRho(usableFinal, PI_RANDOM_SEED), temperature: temperatureFromVal };
  featureKeys = Object.keys(usableFinal[0]?.features.values ?? {}).sort();
  lastLogistic = trainLogisticChallenger({
    rows: usableFinal,
    keys: featureKeys,
    seed: PI_RANDOM_SEED,
    epochs: 60,
    lr: 0.02,
  });

  const modelsDir = piModelsRoot(input?.labBRoot);
  mkdirSync(modelsDir, { recursive: true });
  const logisticPath = join(modelsDir, `${PI_MODEL_CHALLENGER_ID}.json`);
  writeFileSync(logisticPath, JSON.stringify(lastLogistic, null, 2));
  writeFileSync(join(modelsDir, `${PI_MODEL_INDEPENDENT_ID}.json`), JSON.stringify(lastPoisson, null, 2));

  let holdoutBlock: WalkForwardReport["holdout"] = {
    evaluated: false,
    n: holdoutRows.length,
    metrics: null,
    paper: null,
    clv_available_n: 0,
    independent_beats_market_logloss: null,
    independent_beats_naive_brier: null,
  };

  if (input?.evaluateHoldout) {
    const preds = rowPreds(holdoutRows, all, lastPoisson, lastLogistic);
    const metrics = {
      independent: computeMetrics(preds.independent),
      challenger: computeMetrics(preds.challenger),
      naive: computeMetrics(preds.naive),
      market: computeMetrics(preds.market),
    };
    holdoutBlock = {
      evaluated: true,
      n: holdoutRows.length,
      metrics,
      paper: paperRoiFromPreds(preds.paperRows),
      clv_available_n: preds.clv_n,
      independent_beats_market_logloss:
        metrics.market.n > 0 ? metrics.independent.log_loss < metrics.market.log_loss : null,
      independent_beats_naive_brier: metrics.independent.brier < metrics.naive.brier,
    };
  }

  const training_cutoff = nonHoldout.map((m) => m.event_time).sort().at(-1) ?? nowIso;
  const artifacts: PiModelArtifact[] = [
    {
      model_id: PI_MODEL_INDEPENDENT_ID,
      version: "1.0.0",
      training_cutoff,
      features_version: PI_FEATURES_VERSION,
      dataset_version: PI_DATASET_VERSION,
      parameters: lastPoisson as unknown as Record<string, unknown>,
      metrics: holdoutBlock.metrics?.independent
        ? {
            log_loss: holdoutBlock.metrics.independent.log_loss,
            brier: holdoutBlock.metrics.independent.brier,
          }
        : {},
      created_at: nowIso,
      random_seed: PI_RANDOM_SEED,
      role: "INDEPENDENT_BASELINE",
      production: false,
      auto_promotion: false,
    },
    {
      model_id: PI_MODEL_CHALLENGER_ID,
      version: "1.0.0",
      training_cutoff,
      features_version: PI_FEATURES_VERSION,
      dataset_version: PI_DATASET_VERSION,
      parameters: { path: logisticPath, seed: PI_RANDOM_SEED },
      metrics: {},
      created_at: nowIso,
      random_seed: PI_RANDOM_SEED,
      role: "INDEPENDENT_CHALLENGER",
      production: false,
      auto_promotion: false,
    },
    {
      model_id: PI_MODEL_NAIVE_ID,
      version: "1.0.0",
      training_cutoff,
      features_version: PI_FEATURES_VERSION,
      dataset_version: PI_DATASET_VERSION,
      parameters: {},
      metrics: {},
      created_at: nowIso,
      random_seed: PI_RANDOM_SEED,
      role: "NAIVE",
      production: false,
      auto_promotion: false,
    },
    {
      model_id: PI_MARKET_BASELINE_ID,
      version: "1.0.0",
      training_cutoff,
      features_version: PI_FEATURES_VERSION,
      dataset_version: PI_DATASET_VERSION,
      parameters: { note: "OPEN odds only; closing forbidden in prediction" },
      metrics: {},
      created_at: nowIso,
      random_seed: PI_RANDOM_SEED,
      role: "MARKET_BASELINE",
      production: false,
      auto_promotion: false,
    },
  ];

  const modelManifestPath = join(piRoot(input?.labBRoot), "model-manifest.json");
  writeFileSync(
    modelManifestPath,
    JSON.stringify(
      {
        created_at: nowIso,
        models: artifacts,
        content_sha256: sha256Hex(JSON.stringify(artifacts)),
        auto_promotion: false,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(piRoot(input?.labBRoot), "feature-manifest.json"),
    JSON.stringify(featureManifestPi(featureKeys), null, 2),
  );

  const report: WalkForwardReport = {
    holdout_season: holdoutSeason,
    holdout_blind_until_eval: true,
    holdout_touched_during_train: false,
    folds,
    holdout: holdoutBlock,
    artifacts: {
      poisson_params: lastPoisson,
      logistic_path: logisticPath,
      model_manifest_path: modelManifestPath,
    },
  };

  writeFileSync(join(piRoot(input?.labBRoot), "validation-report.json"), JSON.stringify(report, null, 2));
  return report;
}

export function loadLogisticWeights(labBRoot?: string): LogisticWeightsPi | null {
  const p = join(piModelsRoot(labBRoot), `${PI_MODEL_CHALLENGER_ID}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as LogisticWeightsPi;
}
