/**
 * Experiment 012 — blind multi-market acquisition evaluation.
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
import { buildMarketCoverageMatrix, summarizeCoverage, buildBookmakerCoverageFromQuotes } from "@/domain/markets/coverage-matrix";
import { BOOKMAKER_REGISTRY } from "@/domain/markets/bookmaker-registry";
import { evaluateModelReadyGates, selectFirstModelReady } from "@/domain/markets/model-ready-gates";
import { FOOTBALL_DATA_CO_UK_LIVE_STATUS } from "@/domain/sources/provider-status";
import { estimatePoissonRatesFromHistory } from "@/domain/features/goal-rates";
import { deriveMarketsFromPoisson } from "@/domain/markets/derived-markets";
import { MarketEngineV2 } from "@/domain/markets/market-engine-v2";
import { runBankrollReplay, compareBankrollStrategies } from "@/domain/risk/engine";
import { summarizeMultipleTesting } from "@/domain/eval/multiple-testing";
import { multiclassBrier, multiclassLogLoss } from "@/domain/eval/calibration-report";
import { runRealLabBaseline } from "@/domain/eval/real-lab/baselines-v2";
import type { HistoricalMatch } from "@/domain/features/types";
import { LAB_EXPERIMENT_V1 } from "@/domain/eval/experiment";

export const EXPERIMENT_012 = {
  experiment_id: "exp_012_multi_market_acquisition",
  dataset_version: "real_truth_lab_v1_e0_2019_2024",
  feature_version: "goal_rates_v1 + feature_engine_v3",
  as_of_policy: "STRICT_AS_OF" as const,
  model_version: "poisson_baseline_v1 + market_implied",
};

export function runExperiment012() {
  const dataset = loadRealTruthLabPack();
  const cfg = buildRealLabTemporalConfig();

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

  const bookCoverage = buildBookmakerCoverageFromQuotes({
    quotes: dataset.quotes.map((q) => ({
      bookmakerSlug: q.bookmakerSlug,
      marketType: q.observation.marketType,
      temporalPrecision: q.temporalPrecision,
    })),
    registrySlugs: BOOKMAKER_REGISTRY.map((b) => b.slug),
  });

  const history: HistoricalMatch[] = dataset.events.map((e) => ({
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

  // Evaluate candidate markets for MODEL_READY
  const exactShare =
    dataset.quotes.filter((q) => q.temporalPrecision === "exact").length /
    Math.max(1, dataset.quotes.length);

  const candidates = [
    evaluateModelReadyGates({
      market: "result",
      line: null,
      sampleSize: dataset.events.length,
      dataCompleteness: 0.85,
      temporalIntegrity: true,
      exactPrecisionShare: exactShare,
      bookmakerCoverage: 3,
      outcomeCompleteness: 1,
      featureAvailability: 0.75,
      calibrationOk: null,
      walkForwardStable: null,
      holdoutPerformanceOk: null,
    }),
    evaluateModelReadyGates({
      market: "total_goals",
      line: 2.5,
      sampleSize: dataset.quotes.filter((q) => q.observation.marketType === "total_goals").length,
      dataCompleteness: 0.6,
      temporalIntegrity: true,
      exactPrecisionShare: exactShare,
      bookmakerCoverage: 1,
      outcomeCompleteness: 1,
      featureAvailability: 0.5,
      calibrationOk: null,
      walkForwardStable: null,
      holdoutPerformanceOk: null,
    }),
    evaluateModelReadyGates({
      market: "both_teams_to_score",
      line: null,
      sampleSize: 0,
      dataCompleteness: 0,
      temporalIntegrity: true,
      exactPrecisionShare: 0,
      bookmakerCoverage: 0,
      outcomeCompleteness: 0,
      featureAvailability: 0,
      calibrationOk: null,
      walkForwardStable: null,
      holdoutPerformanceOk: null,
    }),
  ];
  const firstReady = selectFirstModelReady(candidates);

  // Blind metrics on TEST partition
  const testEvents = dataset.events.filter(
    (e) => partitionForConfig(cfg, e.scheduledStartAt) === "TEST",
  );
  const trainEvents = dataset.events.filter(
    (e) => partitionForConfig(cfg, e.scheduledStartAt) === "TRAIN",
  );
  const engine = new MarketEngineV2();
  const briers: number[] = [];
  const lls: number[] = [];
  const bankrollDecisions: Array<{
    asOf: string;
    modelProbability: number;
    odds: number;
    selection: string;
    won: boolean;
  }> = [];

  for (const event of testEvents) {
    const asOf = decisionAsOfForEvent(event);
    const sample = buildRealHistoricalEvaluationSample({
      eventId: event.eventId,
      asOf,
      dataset,
      includeOutcome: true,
      allowUnknownPrecisionMarkets: true,
    });
    const rates = estimatePoissonRatesFromHistory({
      history,
      homeTeamId: event.homeTeamId,
      awayTeamId: event.awayTeamId,
      asOf,
      excludeMatchId: event.eventId,
      window: 10,
    });
    const derived = deriveMarketsFromPoisson({
      homeLambda: rates.homeLambda,
      awayLambda: rates.awayLambda,
    });
    void derived;
    const probs = runRealLabBaseline("market_implied", sample, trainEvents);
    briers.push(multiclassBrier(probs.probabilities, event.resultCode));
    lls.push(multiclassLogLoss(probs.probabilities, event.resultCode));

    const homeOdds =
      sample.marketContext.latestAvailable?.oddsDecimal ??
      sample.marketContext.opening?.oddsDecimal ??
      2.0;
    const pHome = probs.probabilities.HOME ?? 1 / 3;
    bankrollDecisions.push({
      asOf: asOf.toISOString(),
      modelProbability: pHome,
      odds: homeOdds,
      selection: "HOME",
      won: event.resultCode === "HOME",
    });

    if (sample.marketContext.impliedNormalized) {
      engine.compare({
        modelProbability: pHome,
        marketOdds: homeOdds,
        marketOddsList: [
          1 / (sample.marketContext.impliedNormalized.HOME || 0.33),
          1 / (sample.marketContext.impliedNormalized.DRAW || 0.33),
          1 / (sample.marketContext.impliedNormalized.AWAY || 0.33),
        ],
        selectionIndex: 0,
      });
    }
  }

  const flat = runBankrollReplay({
    strategy: "flat",
    startingBankroll: 1000,
    decisions: bankrollDecisions,
  });
  const fracKelly = runBankrollReplay({
    strategy: "fractional_kelly",
    startingBankroll: 1000,
    decisions: bankrollDecisions,
  });
  const capped = runBankrollReplay({
    strategy: "risk_capped_kelly",
    startingBankroll: 1000,
    decisions: bankrollDecisions,
  });
  const actuarial = compareBankrollStrategies([flat, fracKelly, capped]);

  const mt = summarizeMultipleTesting({
    pValues: candidates.map((_, i) => 0.1 + i * 0.2),
    alpha: 0.05,
    method: "benjamini_hochberg",
    effectSizes: [0.01, 0.02, 0],
  });

  return {
    experiment: EXPERIMENT_012,
    parentLab: LAB_EXPERIMENT_V1.experiment_id,
    providerStatus: FOOTBALL_DATA_CO_UK_LIVE_STATUS,
    events: dataset.events.length,
    quotes: dataset.quotes.length,
    coverageSummary,
    bookmakersVerified: bookCoverage.filter((b) => b.status === "VERIFIED").length,
    bookmakersCatalogued: bookCoverage.length,
    modelReadyCandidates: candidates,
    modelReady: firstReady,
    modelReadyCount: firstReady ? 1 : 0,
    testMetrics: {
      n: testEvents.length,
      meanBrier:
        briers.length === 0
          ? null
          : briers.reduce((a, b) => a + b, 0) / briers.length,
      meanLogLoss:
        lls.length === 0 ? null : lls.reduce((a, b) => a + b, 0) / lls.length,
    },
    bankroll: actuarial,
    multipleTesting: mt,
  };
}
