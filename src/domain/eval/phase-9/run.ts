/**
 * Phase 9 orchestrator: fetch → temporal dataset → walk-forward → evaluate →
 * value → markets → robustness → registry → learning → artifacts.
 * NEON NON UTILIZZATO. No auto-promote.
 */
import { NEON_IN_USE, assertNeonBanned } from "@/domain/storage";
import { buildFeatureVectorPi } from "@/domain/eval/predictive-intelligence/features/engine";
import { buildPhase9Dataset } from "@/domain/eval/phase-9/dataset";
import { assertWindowsTemporal, buildWalkForwardWindows, rowsForSeasons } from "@/domain/eval/phase-9/splits";
import { leakageAuditReport } from "@/domain/eval/phase-9/firewall";
import {
  ALL_MODELS,
  evaluateBaselines,
  evaluatePreds,
  predictPartition,
  trainBundle,
} from "@/domain/eval/phase-9/evaluate";
import { chooseThresholdOnVal, verifyThresholdOnOos } from "@/domain/eval/phase-9/value";
import { robustnessReport } from "@/domain/eval/phase-9/robustness";
import { evaluateMarketsForModel, modelMarketMatrix } from "@/domain/eval/phase-9/comparison";
import { recordPhase9Entry, type Phase9RegistryEntry } from "@/domain/eval/phase-9/registry";
import {
  errorAnalysis,
  featureQualityReport,
  gbmImportance,
  gradeBatch,
  logisticImportance,
} from "@/domain/eval/phase-9/learning";
import { buildItalianCopy } from "@/domain/eval/phase-9/copy";
import { writePhase9Json, loadPhase9Bundle } from "@/domain/eval/phase-9/persist";
import {
  CURRENT_PRODUCTION_MODEL_ID,
  MIN_TRAIN_DC,
  MIN_TRAIN_GBM,
  MIN_TRAIN_LOGISTIC,
  MIN_TRAIN_NEGBIN,
  MIN_TRAIN_POISSON,
  PHASE9_PROMOTION_POLICY,
  phase9LabRoot,
} from "@/domain/eval/phase-9/config";
import type { Phase9Match, Phase9ModelId, Phase9PredRow, Phase9QualityMetrics } from "@/domain/eval/phase-9/types";
import { PHASE9_NON_DETERMINABILE } from "@/domain/eval/phase-9/types";

function minTrain(id: Phase9ModelId): number {
  if (id === "INDEPENDENT_POISSON_v1") return MIN_TRAIN_POISSON;
  if (id === "DIXON_COLES_v1") return MIN_TRAIN_DC;
  if (id === "NEGBIN_v1") return MIN_TRAIN_NEGBIN;
  if (id === "INDEPENDENT_LOGISTIC_v1") return MIN_TRAIN_LOGISTIC;
  return MIN_TRAIN_GBM;
}

export async function runPhase9Backtest(input?: {
  labBRoot?: string;
  fetchImpl?: typeof fetch;
  forceDownload?: boolean;
  nowIso?: string;
  skipFetch?: boolean;
  matches?: Phase9Match[];
}): Promise<{ ok: true; neon_in_use: false; rows: number; windows: number; promoted: 0 }> {
  assertNeonBanned("phase-9-backtest");
  if (NEON_IN_USE) throw new Error("NEON_BANNED");
  const nowIso = input?.nowIso ?? new Date().toISOString();
  const labB = phase9LabRoot(input?.labBRoot);

  const built = input?.matches
    ? { matches: input.matches, manifest: null }
    : await buildPhase9Dataset({
        labBRoot: labB,
        fetchImpl: input?.fetchImpl,
        forceDownload: input?.forceDownload,
        nowIso,
        skipFetch: input?.skipFetch,
      });
  const matches = built.matches.slice().sort((a, b) => a.event_time.localeCompare(b.event_time));
  const windows = buildWalkForwardWindows(matches, "walk_forward");
  assertWindowsTemporal(windows);
  writePhase9Json("windows.json", { neon_in_use: false, windows });

  const sampleFeat =
    matches.length > 10
      ? [matches[Math.floor(matches.length / 3)]!, matches[Math.floor((2 * matches.length) / 3)]!]
      : matches.slice(0, 2);
  const leakage = leakageAuditReport({
    matches,
    sampleFeatures: sampleFeat.map((t) => ({
      target: t,
      keys: Object.keys(buildFeatureVectorPi(t, matches).values),
    })),
    splitMethod: "walk_forward",
  });
  writePhase9Json("leakage-audit.json", { ...leakage, at: nowIso, n_matches: matches.length });

  type ModelAcc = {
    model_id: Phase9ModelId;
    support_reason: string;
    supported: boolean;
    val: Phase9PredRow[];
    oos: Phase9PredRow[];
    per_window: {
      window_id: string;
      oos_metrics: Phase9QualityMetrics;
      val_metrics: Phase9QualityMetrics;
      beat_naive: boolean | null;
    }[];
    lastBundle: ReturnType<typeof trainBundle> | null;
  };
  const acc: Record<Phase9ModelId, ModelAcc> = {
    INDEPENDENT_POISSON_v1: {
      model_id: "INDEPENDENT_POISSON_v1",
      support_reason: "",
      supported: false,
      val: [],
      oos: [],
      per_window: [],
      lastBundle: null,
    },
    DIXON_COLES_v1: {
      model_id: "DIXON_COLES_v1",
      support_reason: "",
      supported: false,
      val: [],
      oos: [],
      per_window: [],
      lastBundle: null,
    },
    NEGBIN_v1: {
      model_id: "NEGBIN_v1",
      support_reason: "",
      supported: false,
      val: [],
      oos: [],
      per_window: [],
      lastBundle: null,
    },
    INDEPENDENT_LOGISTIC_v1: {
      model_id: "INDEPENDENT_LOGISTIC_v1",
      support_reason: "",
      supported: false,
      val: [],
      oos: [],
      per_window: [],
      lastBundle: null,
    },
    GBM_STUMPS_v1: {
      model_id: "GBM_STUMPS_v1",
      support_reason: "",
      supported: false,
      val: [],
      oos: [],
      per_window: [],
      lastBundle: null,
    },
  };

  let lastNaiveOos: Phase9QualityMetrics | null = null;
  let lastMarketOos: Phase9QualityMetrics | null = null;
  let lastBaselines: Record<string, Phase9QualityMetrics> = {};
  let lastTrainN = 0;
  let lastValN = 0;

  for (const w of windows) {
    const train = rowsForSeasons(matches, w.train_seasons);
    const val = rowsForSeasons(matches, w.val_seasons);
    const oos = rowsForSeasons(matches, w.oos_seasons);
    lastTrainN = train.length;
    lastValN = val.length;
    const bundle = trainBundle({ train, universe: matches });
    const baselinesOos = evaluateBaselines({ rows: oos, universe: matches });
    lastBaselines = { ...lastBaselines, ...baselinesOos };
    lastNaiveOos = baselinesOos.LEAGUE_FREQ ?? lastNaiveOos;
    lastMarketOos = baselinesOos.MARKET_DEVIG_OPEN ?? lastMarketOos;

    for (const id of ALL_MODELS) {
      const sup = bundle.support[id];
      acc[id].support_reason = sup.reason;
      acc[id].supported = acc[id].supported || sup.supported;
      acc[id].lastBundle = bundle;
      if (!sup.supported) continue;
      const valPreds = predictPartition({ model_id: id, rows: val, universe: matches, bundle });
      const oosPreds = predictPartition({ model_id: id, rows: oos, universe: matches, bundle });
      acc[id].val.push(...valPreds);
      acc[id].oos.push(...oosPreds);
      const oosM = evaluatePreds(oosPreds);
      const valM = evaluatePreds(valPreds);
      const naive = baselinesOos.LEAGUE_FREQ;
      const beat =
        naive && !oosM.insufficient && !naive.insufficient
          ? oosM.log_loss < naive.log_loss && oosM.brier <= naive.brier
          : null;
      acc[id].per_window.push({
        window_id: w.window_id,
        oos_metrics: oosM,
        val_metrics: valM,
        beat_naive: beat,
      });
    }
  }

  const modelComparison: Record<string, unknown>[] = [];
  const registryEntries: Phase9RegistryEntry[] = [];
  const calibration: Record<string, unknown>[] = [];
  const marketBlocks: { model_id: Phase9ModelId; quality: Phase9QualityMetrics | null; markets: ReturnType<typeof evaluateMarketsForModel> }[] = [];
  const learningAll = [];
  let chosen_threshold: number | null = null;
  let oos_yield: number | null = null;
  let oos_bets: number | null = null;
  let championValue: ReturnType<typeof verifyThresholdOnOos> | null = null;

  for (const id of ALL_MODELS) {
    const a = acc[id];
    const oosQ = a.oos.length ? evaluatePreds(a.oos) : null;
    const valQ = a.val.length ? evaluatePreds(a.val) : null;
    const naiveQ = lastNaiveOos;
    const choice = a.val.length ? chooseThresholdOnVal(a.val) : { threshold: null, val_grid: [], reason: "no val" };
    const verified = a.oos.length ? verifyThresholdOnOos(a.oos, choice.threshold) : { oos_grid: [], chosen: null };
    if (id === CURRENT_PRODUCTION_MODEL_ID) {
      chosen_threshold = choice.threshold;
      oos_yield = verified.chosen?.yield ?? null;
      oos_bets = verified.chosen?.n_bets ?? null;
      championValue = verified;
    }
    const robust = a.oos.length
      ? robustnessReport({ rows: a.oos, threshold: choice.threshold })
      : null;
    const markets = a.oos.length
      ? evaluateMarketsForModel({
          model_id: id,
          matches: matches.filter((m) => a.oos.some((p) => p.canonical_id === m.canonical_id)),
          preds: a.oos,
        })
      : [];
    marketBlocks.push({ model_id: id, quality: oosQ, markets });
    const windows_beat = a.per_window.filter((w) => w.beat_naive === true).length;
    const entry = recordPhase9Entry({
      root: labB,
      nowIso,
      model_id: id,
      version: "phase9-1.0.0",
      leakage_pass: leakage.temporal_pass && leakage.odds_pass && leakage.target_pass,
      train_n: lastTrainN,
      validate_n: lastValN,
      oos_n: a.oos.length,
      windows_beat_naive: windows_beat,
      windows_total: a.per_window.length,
      supported: a.supported,
      min_train: minTrain(id),
      quality: oosQ,
      metrics_oos: {
        log_loss: oosQ?.log_loss ?? null,
        brier: oosQ?.brier ?? null,
        accuracy: oosQ?.accuracy ?? null,
        calibration_error: oosQ?.calibration_error ?? null,
        naive_log_loss: naiveQ?.log_loss ?? null,
        naive_brier: naiveQ?.brier ?? null,
      },
    });
    registryEntries.push(entry);
    modelComparison.push({
      model_id: id,
      status: entry.status,
      supported: a.supported,
      reason: a.support_reason,
      train_n: lastTrainN,
      val_n: a.val.length,
      oos_n: a.oos.length,
      oos_metrics: oosQ,
      val_metrics: valQ,
      windows: a.per_window.map((w) => ({
        window_id: w.window_id,
        oos_n: w.oos_metrics.n,
        oos_log_loss: w.oos_metrics.log_loss,
        oos_brier: w.oos_metrics.brier,
        beat_naive: w.beat_naive,
      })),
      value_val_grid: choice.val_grid,
      value_threshold_reason: choice.reason,
      value_oos_chosen: verified.chosen,
      value_oos_grid: verified.oos_grid,
      robustness: robust,
      versions: { model: "phase9-1.0.0", features: "features_pi_v1" },
      auto_promotion: false,
      role: id === CURRENT_PRODUCTION_MODEL_ID ? "CURRENT_PRODUCTION" : "CHALLENGER",
    });
    calibration.push({
      model_id: id,
      oos_calibration_error: oosQ?.calibration_error ?? null,
      n: oosQ?.n ?? 0,
      insufficient: oosQ?.insufficient ?? true,
    });
    if (a.oos.length) learningAll.push(...gradeBatch({ model_id: id, rows: a.oos }));
  }

  const matrix = modelMarketMatrix({ models: marketBlocks });
  const err = errorAnalysis(learningAll.filter((r) => r.model_id === CURRENT_PRODUCTION_MODEL_ID));
  const champBundle = acc[CURRENT_PRODUCTION_MODEL_ID].lastBundle;
  const featSample =
    matches.length > 50 ? buildFeatureVectorPi(matches[Math.floor(matches.length / 2)]!, matches).feature_data : null;

  writePhase9Json("backtest-results.json", {
    at: nowIso,
    neon_in_use: false,
    current_production: CURRENT_PRODUCTION_MODEL_ID,
    rows: matches.length,
    windows,
    baselines_last_oos: lastBaselines,
    models: modelComparison,
    policy: PHASE9_PROMOTION_POLICY,
    note: "Model quality is separate from betting profitability. PROMOTED=0 is valid.",
  });
  writePhase9Json("model-comparison.json", {
    at: nowIso,
    neon_in_use: false,
    auto_promotion: false,
    models: modelComparison,
    baselines: lastBaselines,
  });
  writePhase9Json("market-comparison.json", {
    at: nowIso,
    neon_in_use: false,
    cells: matrix,
    by_model: marketBlocks,
    note: "ROI only where historical prices exist; otherwise " + PHASE9_NON_DETERMINABILE,
  });
  writePhase9Json("promotion-candidates.json", {
    at: nowIso,
    neon_in_use: false,
    auto_promotion: false,
    promoted_count: 0,
    current_production_unchanged: true,
    current_production: CURRENT_PRODUCTION_MODEL_ID,
    policy: PHASE9_PROMOTION_POLICY,
    entries: registryEntries,
    candidates: registryEntries.filter((e) => e.status === "CANDIDATE"),
  });
  writePhase9Json("calibration-report.json", {
    at: nowIso,
    neon_in_use: false,
    models: calibration,
  });
  writePhase9Json("error-analysis.json", {
    at: nowIso,
    neon_in_use: false,
    auto_applied: false,
    champion: CURRENT_PRODUCTION_MODEL_ID,
    analysis: err,
    learning_n: learningAll.length,
    feature_importance: {
      logistic: logisticImportance(champBundle?.logistic ?? null),
      gbm: gbmImportance(champBundle?.gbm ?? null),
      causal_claim: false,
    },
    feature_quality: featureQualityReport(featSample),
    value_champion: championValue,
  });

  const copy = buildItalianCopy({
    date_min: matches[0]?.match_date ?? null,
    date_max: matches[matches.length - 1]?.match_date ?? null,
    total_rows: matches.length,
    windows: windows.length,
    neon: false,
    current_production: CURRENT_PRODUCTION_MODEL_ID,
    promoted: 0,
    models: ALL_MODELS.map((id) => ({
      id,
      status: registryEntries.find((e) => e.model_id === id)?.status ?? "INSUFFICIENT_EVIDENCE",
      oos_n: acc[id].oos.length,
      log_loss: acc[id].oos.length ? evaluatePreds(acc[id].oos).log_loss : null,
      brier: acc[id].oos.length ? evaluatePreds(acc[id].oos).brier : null,
      accuracy: acc[id].oos.length ? evaluatePreds(acc[id].oos).accuracy : null,
      supported: acc[id].supported,
      reason: acc[id].support_reason || "not trained",
    })),
    naive_log_loss: lastNaiveOos?.log_loss ?? null,
    market_log_loss: lastMarketOos?.log_loss ?? null,
    chosen_threshold,
    oos_yield,
    oos_bets,
    hypotheses: err.hypotheses.map((h) => h.text),
  });
  writePhase9Json("ui-copy.json", copy);

  if (built.manifest) {
    writePhase9Json("dataset-manifest.json", built.manifest);
  }

  return { ok: true, neon_in_use: false, rows: matches.length, windows: windows.length, promoted: 0 };
}

export function runPhase9ReportOnly(): Record<string, unknown> {
  return loadPhase9Bundle();
}
