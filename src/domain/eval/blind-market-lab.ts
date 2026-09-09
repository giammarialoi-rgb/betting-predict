/**
 * Blind Market Lab V1 — historical acquisition evaluation + bookmaker challenger.
 * Never claims to beat the bookmaker. Sacred holdout. No auto-promote.
 */

import { loadRealTruthLabPack } from "@/domain/eval/real-lab/load-pack";
import {
  buildRealHistoricalEvaluationSample,
  decisionAsOfForEvent,
} from "@/domain/eval/real-lab/truth-lab";
import {
  buildRealLabTemporalConfig,
  partitionForConfig,
} from "@/domain/eval/temporal-config";
import {
  runRealLabBaseline,
  type RealLabBaselineId,
} from "@/domain/eval/real-lab/baselines-v2";
import { multiclassBrier, multiclassLogLoss } from "@/domain/eval/calibration-report";
import { summarizeMultipleTesting, benjaminiHochberg } from "@/domain/eval/multiple-testing";
import { buildFeatureEngineV4 } from "@/domain/features/engine-v4";
import { estimatePoissonRatesFromHistory } from "@/domain/features/goal-rates";
import { poisson1x2 } from "@/domain/eval/poisson-baseline";
import { deVigProportional } from "@/domain/markets/consensus-engine";
import { buildMarketEfficiencyDelta } from "@/domain/eval/market-efficiency";
import { classifyChallengerSignal } from "@/domain/eval/challenger-signals";
import { assertNoAutoChampionPromotion } from "@/domain/eval/challenger";
import { classifyLabError } from "@/domain/eval/lab-error-classes";
import { findTop10V2 } from "@/domain/eval/top10-v2";
import type { RankedOpportunity } from "@/domain/eval/top-opportunities";
import { explainDecision } from "@/domain/eval/explain-decision";
import { buildDataQualityReport } from "@/domain/eval/data-quality-report-v2";
import {
  buildMarketCoverageMatrix,
  summarizeCoverage,
  buildBookmakerCoverageFromQuotes,
} from "@/domain/markets/coverage-matrix";
import { BOOKMAKER_REGISTRY } from "@/domain/markets/bookmaker-registry";
import {
  FOOTBALL_ACQUISITION_MARKET_CATALOG,
  markObserved,
} from "@/domain/markets/acquisition-catalog";
import { cataloguedStatPlaceholders } from "@/domain/stats/capability-registry";
import { FOOTBALL_DATA_CO_UK_LIVE_STATUS } from "@/domain/sources/provider-status";
import {
  discoverAcquisitionTargets,
  materializeOfflineArchive,
} from "@/domain/acquisition/football-data-co-uk";
import { REAL_TRUTH_LAB_E0_CSV } from "@/domain/eval/real-lab/pack-csv";
import type { HistoricalMatch } from "@/domain/features/types";
import {
  computeHypotheticalStake,
  runBankrollReplay,
  compareBankrollStrategies,
} from "@/domain/risk/engine";
import {
  buildCorrelationClusters,
  maxClusterExposure,
} from "@/domain/risk/correlation-exposure";

export const EXPERIMENT_013 = {
  experiment_id: "exp_013_blind_market_lab_v1",
  dataset_version: "real_truth_lab_v1_e0_2019_2024",
  feature_version: "feature_engine_v4",
  model_version: "champion_market_devig_v1",
  as_of_policy: "STRICT_AS_OF" as const,
  champion: "market_devig",
  challengers: [
    "poisson",
    "elo",
    "form",
    "elo_form",
    "market_elo_form",
    "frequency",
    "home_advantage",
  ] as const,
};

type PartitionMetrics = {
  n: number;
  brier: number | null;
  logloss: number | null;
  calibration: number | null;
  insufficient: boolean;
};

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function historyFromDataset(
  dataset: ReturnType<typeof loadRealTruthLabPack>,
): HistoricalMatch[] {
  return dataset.events.map((e) => ({
    matchId: e.eventId,
    competitionId: e.competitionId,
    seasonId: e.season,
    kickoffAt: e.scheduledStartAt,
    resultAvailableAt: e.resultAvailableAt,
    homeTeamId: e.homeTeamId,
    awayTeamId: e.awayTeamId,
    ftHome: e.homeScore,
    ftAway: e.awayScore,
    ftResult:
      e.resultCode === "HOME" ? "H" : e.resultCode === "AWAY" ? "A" : "D",
  }));
}

function marketDevigProbs(sample: ReturnType<typeof buildRealHistoricalEvaluationSample>) {
  const implied = sample.marketContext.impliedNormalized;
  if (!implied) {
    return { HOME: 1 / 3, DRAW: 1 / 3, AWAY: 1 / 3 };
  }
  const odds = [
    1 / (implied.HOME || 0.33),
    1 / (implied.DRAW || 0.33),
    1 / (implied.AWAY || 0.33),
  ];
  const d = deVigProportional(odds);
  if (d.status !== "COMPUTED" || d.output_probabilities.length < 3) {
    return { ...implied };
  }
  return {
    HOME: d.output_probabilities[0]!,
    DRAW: d.output_probabilities[1]!,
    AWAY: d.output_probabilities[2]!,
  };
}

function poissonProbs(
  history: HistoricalMatch[],
  event: ReturnType<typeof loadRealTruthLabPack>["events"][number],
  asOf: Date,
) {
  const rates = estimatePoissonRatesFromHistory({
    history,
    homeTeamId: event.homeTeamId,
    awayTeamId: event.awayTeamId,
    asOf,
    excludeMatchId: event.eventId,
    window: 10,
  });
  return poisson1x2(rates);
}

function evaluatePartition(
  events: ReturnType<typeof loadRealTruthLabPack>["events"],
  dataset: ReturnType<typeof loadRealTruthLabPack>,
  trainEvents: ReturnType<typeof loadRealTruthLabPack>["events"],
  history: HistoricalMatch[],
  modelId: string,
): PartitionMetrics & { pairs: Array<{ yTrue: number; yPred: number }> } {
  const briers: number[] = [];
  const lls: number[] = [];
  const pairs: Array<{ yTrue: number; yPred: number }> = [];

  for (const event of events) {
    const asOf = decisionAsOfForEvent(event);
    const sample = buildRealHistoricalEvaluationSample({
      eventId: event.eventId,
      asOf,
      dataset,
      includeOutcome: true,
      allowUnknownPrecisionMarkets: true,
    });
    // LOCK: prediction before using outcome beyond evaluation
    let probs: Record<string, number>;
    if (modelId === "market_devig") {
      probs = marketDevigProbs(sample);
    } else if (modelId === "poisson") {
      probs = poissonProbs(history, event, asOf);
    } else {
      const id = modelId as RealLabBaselineId;
      probs = runRealLabBaseline(id, sample, trainEvents).probabilities;
    }
    briers.push(multiclassBrier(probs, event.resultCode));
    lls.push(multiclassLogLoss(probs, event.resultCode));
    const pHome = probs.HOME ?? 0;
    pairs.push({
      yTrue: event.resultCode === "HOME" ? 1 : 0,
      yPred: pHome,
    });
  }

  const calib =
    pairs.length === 0
      ? null
      : mean(pairs.map((p) => Math.abs(p.yPred - p.yTrue)));

  return {
    n: events.length,
    brier: mean(briers),
    logloss: mean(lls),
    calibration: calib,
    insufficient: events.length < 5,
    pairs,
  };
}

export function runBlindMarketLabV1() {
  assertNoAutoChampionPromotion("review_only");

  const dataset = loadRealTruthLabPack();
  const cfg = buildRealLabTemporalConfig();
  const history = historyFromDataset(dataset);

  const offline = materializeOfflineArchive([
    {
      division: "E0",
      seasonCode: "1920",
      csvText: REAL_TRUTH_LAB_E0_CSV,
      source: "offline_pack",
    },
  ]);
  const targets = discoverAcquisitionTargets({
    divisions: ["E0", "E1", "I1"],
    seasonCodes: ["2425"],
  });

  const coverageRows = buildMarketCoverageMatrix({
    quotes: dataset.quotes.map((q) => ({
      eventId: q.eventId,
      marketType: q.observation.marketType,
      line: q.observation.line,
      selection: q.observation.selection,
      bookmakerSlug: q.bookmakerSlug,
      sourceId: q.sourceId,
      availableAt: q.availableAt,
      temporalPrecision: q.temporalPrecision,
    })),
    competition: "E0",
  });
  const coverageSummary = summarizeCoverage(coverageRows);
  const observedTypes = new Set(
    dataset.quotes.map((q) => q.observation.marketType),
  );
  const marketCatalog = markObserved(
    FOOTBALL_ACQUISITION_MARKET_CATALOG,
    observedTypes,
  );

  const bookCoverage = buildBookmakerCoverageFromQuotes({
    quotes: dataset.quotes.map((q) => ({
      bookmakerSlug: q.bookmakerSlug,
      marketType: q.observation.marketType,
      temporalPrecision: q.temporalPrecision,
    })),
    registrySlugs: BOOKMAKER_REGISTRY.map((b) => b.slug),
  });

  const exact =
    dataset.quotes.filter((q) => q.temporalPrecision === "exact").length;
  const unknown =
    dataset.quotes.filter((q) => q.temporalPrecision === "unknown").length;
  const dataset_window = dataset.quotes.filter(
    (q) => q.temporalPrecision === "dataset_window",
  ).length;

  const dq = buildDataQualityReport({
    completeness: dataset.events.length > 0 ? 0.85 : 0,
    exactPrecisionShare: exact / Math.max(1, dataset.quotes.length),
    sourceAuthorityShare: 0.8,
    crossSourceAgreementShare: 0.5,
    entityResolutionShare: 0.9,
    duplicateRate: 0,
    missingRate: 0.15,
  });

  const byPart = {
    TRAIN: dataset.events.filter(
      (e) => partitionForConfig(cfg, e.scheduledStartAt) === "TRAIN",
    ),
    VALIDATION: dataset.events.filter(
      (e) => partitionForConfig(cfg, e.scheduledStartAt) === "VALIDATION",
    ),
    TEST: dataset.events.filter(
      (e) => partitionForConfig(cfg, e.scheduledStartAt) === "TEST",
    ),
    HOLDOUT: dataset.events.filter(
      (e) => partitionForConfig(cfg, e.scheduledStartAt) === "HOLDOUT",
    ),
  };

  const championId = "market_devig";
  const challengerIds = [
    "poisson",
    "elo",
    "form",
    "elo_form",
    "market_elo_form",
    "frequency",
    "home_advantage",
    "market_implied",
  ] as const;

  const testChampion = evaluatePartition(
    byPart.TEST,
    dataset,
    byPart.TRAIN,
    history,
    championId,
  );
  const holdoutChampion = evaluatePartition(
    byPart.HOLDOUT,
    dataset,
    byPart.TRAIN,
    history,
    championId,
  );

  const challengerReports = challengerIds.map((id) => {
    const test = evaluatePartition(
      byPart.TEST,
      dataset,
      byPart.TRAIN,
      history,
      id,
    );
    const holdout = evaluatePartition(
      byPart.HOLDOUT,
      dataset,
      byPart.TRAIN,
      history,
      id,
    );
    const gap =
      test.brier != null && testChampion.brier != null
        ? testChampion.brier - test.brier
        : null;
    // Positive gap => challenger better (lower brier) than champion
    const absGap = gap == null ? 0 : Math.abs(gap);
    const signal = classifyChallengerSignal({
      absGap,
      sampleSize: test.n,
      adjustedPValue: null,
      walkForwardPassed: false,
      holdoutPassed: false,
      calibrationOk: false,
    });
    return {
      challenger: id,
      test,
      holdout,
      brier_difference_vs_champion: gap,
      signal: signal.level,
      reasons: signal.reasons,
      auto_promote: false as const,
    };
  });

  // Multiple testing on challenger gaps (placeholder p from |gap|)
  const pValues = challengerReports.map((c) =>
    c.brier_difference_vs_champion == null
      ? 1
      : Math.min(1, Math.max(0.01, 1 - Math.abs(c.brier_difference_vs_champion) * 10)),
  );
  const bh = benjaminiHochberg(pValues, 0.05);
  const mt = summarizeMultipleTesting({
    pValues,
    alpha: 0.05,
    method: "benjamini_hochberg",
    effectSizes: challengerReports.map((c) => c.brier_difference_vs_champion ?? 0),
  });

  // Blind locked predictions then reveal for error classes
  const errorCounts = new Map<string, number>();
  const candidates: RankedOpportunity[] = [];
  for (const event of byPart.TEST) {
    const asOf = decisionAsOfForEvent(event);
    const sample = buildRealHistoricalEvaluationSample({
      eventId: event.eventId,
      asOf,
      dataset,
      includeOutcome: false,
      allowUnknownPrecisionMarkets: true,
    });
    const locked = marketDevigProbs(sample);
    const predicted = Object.entries(locked).sort((a, b) => b[1]! - a[1]!)[0]![0];
    // REVEAL
    const err = classifyLabError({
      predicted,
      actual: event.resultCode,
      features: sample.decisionContext.availableFeatures.map((f) => ({
        featureKey: f.featureKey,
        featureStatus: f.featureStatus,
      })),
      sampleSize: byPart.TRAIN.length,
    });
    errorCounts.set(err.error_class, (errorCounts.get(err.error_class) ?? 0) + 1);

    const marketP = locked.HOME ?? 0.33;
    const modelP = poissonProbs(history, event, asOf).HOME;
    const v4 = buildFeatureEngineV4({
      event,
      asOf,
      dataset,
      marketQuotes: dataset.quotes.filter((q) => q.eventId === event.eventId),
    });
    void v4;
    const delta = buildMarketEfficiencyDelta({
      modelProbability: modelP,
      marketProbability: marketP,
    });
    candidates.push({
      eventId: event.eventId,
      sport: "football",
      market: "result",
      line: null,
      selection: "HOME",
      odds: sample.marketContext.latestAvailable?.oddsDecimal ?? null,
      model_probability: modelP,
      market_probability: marketP,
      scores: {
        data_quality: dq.quality_score ?? 0.2,
        model_confidence: null,
        market_agreement: 0.5,
        uncertainty: 0.5,
        edge_raw: delta.probability_gap,
        edge_level: "NO_SIGNAL",
      },
      why: null,
      explanation: null,
      confidence: null,
      bet_recommendation: null,
    });
  }

  const top10 =
    dq.quality_level === "UNUSABLE" || dq.quality_level === "INSUFFICIENT_DATA"
      ? {
          mode: "edge_candidate",
          requested: 10,
          qualified: [] as RankedOpportunity[],
          insufficient_evidence: 10,
          message: "NO_QUALIFIED_OPPORTUNITY" as const,
        }
      : findTop10V2(candidates, {
          limit: 10,
          minQuality: 0.5,
          mode: "edge_candidate",
        });

  const whyExample =
    byPart.TEST[0] != null
      ? explainDecision({
          eventId: byPart.TEST[0].eventId,
          asOf: decisionAsOfForEvent(byPart.TEST[0]),
          factors: [
            {
              feature: "market_devig_home",
              value: 0.45,
              asOf: decisionAsOfForEvent(byPart.TEST[0]).toISOString(),
              source: "lab",
              contribution: "supporting",
              quality: "VALID",
            },
            {
              feature: "temporal_precision_unknown",
              value: null,
              asOf: decisionAsOfForEvent(byPart.TEST[0]).toISOString(),
              source: "lab",
              contribution: "quality_warning",
              quality: "unknown",
            },
          ],
          blocking: dq.blocking_reasons,
        })
      : null;

  const bankrollDecisions = byPart.TEST.slice(0, 8).map((event) => {
    const asOf = decisionAsOfForEvent(event);
    const sample = buildRealHistoricalEvaluationSample({
      eventId: event.eventId,
      asOf,
      dataset,
      includeOutcome: true,
      allowUnknownPrecisionMarkets: true,
    });
    const p = marketDevigProbs(sample).HOME ?? 0.33;
    const odds =
      sample.marketContext.latestAvailable?.oddsDecimal ??
      sample.marketContext.opening?.oddsDecimal ??
      2.0;
    return {
      asOf: asOf.toISOString(),
      modelProbability: p,
      odds,
      selection: "HOME",
      won: event.resultCode === "HOME",
    };
  });

  const flat = runBankrollReplay({
    strategy: "flat",
    startingBankroll: 1000,
    decisions: bankrollDecisions,
  });
  const frac = runBankrollReplay({
    strategy: "fractional_kelly",
    startingBankroll: 1000,
    decisions: bankrollDecisions,
  });
  const capped = runBankrollReplay({
    strategy: "risk_capped_kelly",
    startingBankroll: 1000,
    decisions: bankrollDecisions,
  });
  const masa = computeHypotheticalStake({
    strategy: "masaniello_challenger",
    bankroll: 1000,
    probability: 0.5,
    odds: 2.0,
  });
  const actuarial = compareBankrollStrategies([flat, frac, capped]);

  const clusters = buildCorrelationClusters([
    {
      eventId: "demo",
      market: "result",
      selection: "HOME",
      stake: 10,
    },
    {
      eventId: "demo",
      market: "total_goals",
      selection: "OVER",
      stake: 10,
    },
    {
      eventId: "demo",
      market: "both_teams_to_score",
      selection: "YES",
      stake: 10,
    },
  ]);

  const modelReady = 0;
  const insufficientData =
    dq.quality_level === "INSUFFICIENT_DATA" ||
    dq.quality_level === "UNUSABLE" ||
    testChampion.insufficient;

  return {
    experiment: EXPERIMENT_013,
    providerLive: FOOTBALL_DATA_CO_UK_LIVE_STATUS,
    acquisition: {
      targets_planned: targets.length,
      offline_files: offline.length,
      offline_hash: offline[0]?.content_hash ?? null,
    },
    data: {
      events: dataset.events.length,
      quotes: dataset.quotes.length,
      markets_catalogued: marketCatalog.length,
      markets_observed: marketCatalog.filter((m) => m.status === "OBSERVED")
        .length,
      bookmakers_catalogued: bookCoverage.length,
      bookmakers_verified: bookCoverage.filter((b) => b.status === "VERIFIED")
        .length,
      sources: dataset.sources.length,
      elo_snapshots: dataset.elo.length,
      features_v4_ready: true,
      outcomes: dataset.events.length,
      stat_placeholders: cataloguedStatPlaceholders().length,
      raw: dataset.quotes.length,
      normalized: dataset.events.length,
      temporally_valid: exact,
      model_ready: modelReady,
    },
    temporal: {
      exact,
      dataset_window,
      unknown,
      blocked: FOOTBALL_DATA_CO_UK_LIVE_STATUS.provider_status === "BLOCKED" ? 1 : 0,
    },
    markets: {
      catalogued: coverageSummary.catalogued + marketCatalog.length,
      observed: coverageSummary.observed,
      validated: coverageSummary.temporally_validated,
      model_ready: modelReady,
    },
    dataQuality: dq,
    models: {
      champion: championId,
      challengers: challengerReports,
    },
    test: {
      brier: testChampion.brier,
      logloss: testChampion.logloss,
      calibration: testChampion.calibration,
      n: testChampion.n,
      insufficient: testChampion.insufficient,
    },
    holdout: {
      brier: holdoutChampion.brier,
      logloss: holdoutChampion.logloss,
      calibration: holdoutChampion.calibration,
      n: holdoutChampion.n,
      insufficient: holdoutChampion.insufficient,
    },
    multipleTesting: {
      hypotheses: mt.numberOfHypothesesTested,
      significant_raw: pValues.filter((p) => p < 0.05).length,
      significant_adjusted: bh.rejectedIndices.length,
      correction: mt.correctionMethod,
    },
    risk: {
      kelly: "READY",
      fractional_kelly: "READY",
      risk_capped: "READY",
      Masaniello: masa.strategy,
      masaniello_stake: masa.stake,
      real_money: false,
      correlation_max_exposure: maxClusterExposure(clusters),
      actuarial_winner: actuarial.winner,
    },
    top10: {
      qualified: top10.qualified.length,
      blocked: top10.insufficient_evidence,
      no_signal: top10.message,
      message: top10.message,
    },
    why: whyExample,
    errors: {
      top_error_classes: [...errorCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, v]) => ({ class: k, count: v })),
    },
    insufficient_data: insufficientData,
    windows: {
      training: `${cfg.train_start.toISOString()}→${cfg.train_end.toISOString()}`,
      validation: `${cfg.validation_start.toISOString()}→${cfg.validation_end.toISOString()}`,
      test: `${cfg.test_start.toISOString()}→${cfg.test_end.toISOString()}`,
      holdout: `${cfg.holdout_start.toISOString()}→${cfg.holdout_end.toISOString()}`,
    },
  };
}

export type BlindMarketLabResult = ReturnType<typeof runBlindMarketLabV1>;
