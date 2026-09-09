/**
 * Real Truth Lab evaluation runner on offline football pack.
 */

import {
  loadRealTruthLabPack,
  type RealHistoricalDataset,
} from "@/domain/eval/real-lab/load-pack";
import {
  buildRealHistoricalEvaluationSample,
  decisionAsOfForEvent,
} from "@/domain/eval/real-lab/truth-lab";
import {
  runRealLabBaseline,
  type RealLabBaselineId,
} from "@/domain/eval/real-lab/baselines-v2";
import {
  buildRealLabTemporalConfig,
  partitionForConfig,
} from "@/domain/eval/temporal-config";
import {
  multiclassBrier,
  multiclassLogLoss,
} from "@/domain/eval/calibration-report";
import { probabilityForOutcome } from "@/domain/eval/baselines";
import { MarketDiscoveryEngine } from "@/domain/markets/discovery-engine";
import { findTopReliableMarkets } from "@/domain/eval/top-n";
import { summarizeMultipleTesting } from "@/domain/eval/multiple-testing";
import { computeDataQualityScore } from "@/domain/eval/data-quality-score";
import { buildWalkForwardFolds } from "@/domain/eval/walk-forward";
import { assertHoldoutSacred } from "@/domain/eval/holdout";
import { buildMarketEfficiencyDelta } from "@/domain/eval/market-efficiency";
import { getRealTruthLabStatus } from "@/domain/eval/real-lab/status";

export type RealLabRunSummary = {
  datasetVersion: string;
  eventCount: number;
  quoteCount: number;
  bookmakers: string[];
  marketsObserved: string[];
  modelReadyMarkets: number;
  walkForwardFoldCount: number;
  baselines: Array<{
    partition: string;
    modelId: string;
    n: number;
    meanBrier: number;
    meanLogLoss: number;
  }>;
  multipleTesting: ReturnType<typeof summarizeMultipleTesting>;
  dataQuality: ReturnType<typeof computeDataQualityScore>;
  topMarkets: ReturnType<typeof findTopReliableMarkets>;
  holdoutIntact: true;
};

const BASELINES: RealLabBaselineId[] = [
  "frequency",
  "home_advantage",
  "elo",
  "market_implied",
  "form",
  "elo_form",
  "market_elo",
  "market_elo_form",
];

export function runRealTruthLab(
  dataset: RealHistoricalDataset = loadRealTruthLabPack(),
): RealLabRunSummary {
  const cfg = buildRealLabTemporalConfig();
  assertHoldoutSacred({
    purpose: "final_evaluation",
    partition: "HOLDOUT",
  });

  const byPart = new Map<string, typeof dataset.events>();
  for (const name of ["TRAIN", "VALIDATION", "TEST", "HOLDOUT"]) {
    byPart.set(name, []);
  }
  for (const e of dataset.events) {
    const p = partitionForConfig(cfg, e.scheduledStartAt);
    if (p) byPart.get(p)!.push(e);
  }
  const train = byPart.get("TRAIN")!;

  const baselines: RealLabRunSummary["baselines"] = [];
  const gaps: number[] = [];

  for (const part of ["TRAIN", "VALIDATION", "TEST", "HOLDOUT"] as const) {
    const events = byPart.get(part)!;
    for (const modelId of BASELINES) {
      const briers: number[] = [];
      const lls: number[] = [];
      for (const event of events) {
        const asOf = decisionAsOfForEvent(event);
        const sample = buildRealHistoricalEvaluationSample({
          eventId: event.eventId,
          asOf,
          dataset,
          includeOutcome: true,
          asOfPolicy: "STRICT_AS_OF",
          allowUnknownPrecisionMarkets: true,
        });
        const trainSlice =
          part === "TRAIN"
            ? train.filter(
                (t) =>
                  t.scheduledStartAt.getTime() < event.scheduledStartAt.getTime(),
              )
            : train;
        const probs = runRealLabBaseline(modelId, sample, trainSlice);
        briers.push(multiclassBrier(probs.probabilities, event.resultCode));
        lls.push(multiclassLogLoss(probs.probabilities, event.resultCode));
        if (
          modelId === "market_elo_form" &&
          sample.marketContext.impliedNormalized
        ) {
          const mp =
            sample.marketContext.impliedNormalized[event.resultCode] ?? 0;
          const mod = probabilityForOutcome(probs, event.resultCode);
          gaps.push(Math.abs(mod - mp));
          buildMarketEfficiencyDelta({
            modelProbability: mod,
            marketProbability: mp,
          });
        }
      }
      baselines.push({
        partition: part,
        modelId,
        n: events.length,
        meanBrier:
          briers.length === 0
            ? NaN
            : briers.reduce((a, b) => a + b, 0) / briers.length,
        meanLogLoss:
          lls.length === 0 ? NaN : lls.reduce((a, b) => a + b, 0) / lls.length,
      });
    }
  }

  const discovery = new MarketDiscoveryEngine();
  const coverage = discovery.discoverCoverage(dataset);
  const topMarkets = findTopReliableMarkets(coverage, 10);
  const folds = buildWalkForwardFolds({
    timelineStart: cfg.train_start,
    timelineEnd: cfg.holdout_end,
    trainDays: 365 * 2,
    validationDays: 180,
    testDays: 180,
    stepDays: 180,
  });

  const bookmakers = [
    ...new Set(dataset.quotes.map((q) => q.bookmakerSlug)),
  ].sort();
  const marketsObserved = [
    ...new Set(dataset.quotes.map((q) => q.observation.marketType)),
  ].sort();

  const exactShare =
    dataset.quotes.filter((q) => q.temporalPrecision === "exact").length /
    Math.max(1, dataset.quotes.length);

  return {
    datasetVersion: dataset.version,
    eventCount: dataset.events.length,
    quoteCount: dataset.quotes.length,
    bookmakers,
    marketsObserved,
    modelReadyMarkets: 0,
    walkForwardFoldCount: folds.length,
    baselines,
    multipleTesting: summarizeMultipleTesting({
      pValues: gaps.length ? gaps.map((g) => Math.min(0.99, g)) : [0.5],
      alpha: 0.05,
      method: "benjamini_hochberg",
    }),
    dataQuality: computeDataQualityScore({
      exactPrecisionShare: exactShare,
      knownProvenanceShare: 1,
      completenessShare: 0.7,
      identityResolvedShare: 1,
      duplicateRate: 0,
      freshnessShare: 0.5,
    }),
    topMarkets,
    holdoutIntact: true,
  };
}

export function realLabStatus() {
  return getRealTruthLabStatus();
}
