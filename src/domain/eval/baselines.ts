/**
 * Extremely simple baseline models for the evaluation lab.
 * Not optimized — measurement infrastructure only.
 */

import type { HistoricalEvaluationSample } from "@/domain/eval/lab/sample";
import type { LabMatch } from "@/domain/eval/lab/dataset";

export type OutcomeProbabilities = {
  marketType: string;
  /** Generic P(selection) — for 1X2 uses HOME/DRAW/AWAY. */
  probabilities: Record<string, number>;
  modelId: string;
  modelVersion: string;
};

export type BaselineExplanation = {
  modelId: string;
  modelVersion: string;
  featuresUsed: string[];
  featuresExcluded: string[];
  marketUsed: string | null;
  sources: string[];
  asOf: string;
  trainingPeriod: string | null;
  dataQualityNotes: string[];
};

function normalize(probs: Record<string, number>): Record<string, number> {
  const sum = Object.values(probs).reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const keys = Object.keys(probs);
    const u = 1 / Math.max(keys.length, 1);
    return Object.fromEntries(keys.map((k) => [k, u]));
  }
  return Object.fromEntries(
    Object.entries(probs).map(([k, v]) => [k, v / sum]),
  );
}

/** Baseline A — market implied (normalized). */
export function baselineMarketImplied(
  sample: HistoricalEvaluationSample,
): OutcomeProbabilities {
  const implied = sample.marketContext.impliedNormalized;
  if (!implied) {
    return {
      marketType: "result",
      probabilities: normalize({ HOME: 1, DRAW: 1, AWAY: 1 }),
      modelId: "baseline_market_implied",
      modelVersion: "v1",
    };
  }
  return {
    marketType: "result",
    probabilities: { ...implied },
    modelId: "baseline_market_implied",
    modelVersion: "v1",
  };
}

/** Baseline B — historical frequency from training matches only. */
export function baselineHistoricalFrequency(input: {
  trainingMatches: readonly LabMatch[];
}): OutcomeProbabilities {
  let home = 0;
  let draw = 0;
  let away = 0;
  for (const m of input.trainingMatches) {
    if (m.resultCode === "HOME") home++;
    else if (m.resultCode === "DRAW") draw++;
    else away++;
  }
  const n = home + draw + away;
  if (n === 0) {
    return {
      marketType: "result",
      probabilities: normalize({ HOME: 1, DRAW: 1, AWAY: 1 }),
      modelId: "baseline_historical_frequency",
      modelVersion: "v1",
    };
  }
  return {
    marketType: "result",
    probabilities: {
      HOME: home / n,
      DRAW: draw / n,
      AWAY: away / n,
    },
    modelId: "baseline_historical_frequency",
    modelVersion: "v1",
  };
}

/** Baseline C — Elo expected home vs rest split simply. */
export function baselineElo(
  sample: HistoricalEvaluationSample,
): OutcomeProbabilities {
  const elo = sample.decisionContext.availableFeatures.find(
    (f) => f.featureKey === "elo",
  );
  const pHome =
    typeof elo?.value === "number" && Number.isFinite(elo.value)
      ? Math.min(0.85, Math.max(0.1, elo.value))
      : 1 / 3;
  const rem = 1 - pHome;
  return {
    marketType: "result",
    probabilities: normalize({
      HOME: pHome,
      DRAW: rem * 0.4,
      AWAY: rem * 0.6,
    }),
    modelId: "baseline_elo",
    modelVersion: "v1",
  };
}

/**
 * Baseline D — transparent blend of a few validated features.
 * Weights are fixed (not tuned).
 */
export function baselineSimpleFeature(
  sample: HistoricalEvaluationSample,
  trainingMatches: readonly LabMatch[],
): OutcomeProbabilities {
  const market = baselineMarketImplied(sample).probabilities;
  const freq = baselineHistoricalFrequency({ trainingMatches }).probabilities;
  const elo = baselineElo(sample).probabilities;
  const form = sample.decisionContext.availableFeatures.find(
    (f) => f.featureKey === "form_5",
  );
  const formPts = typeof form?.value === "number" ? form.value : 7.5;
  const formHomeBoost = (formPts / 15 - 0.5) * 0.1;

  return {
    marketType: "result",
    probabilities: normalize({
      HOME:
        0.5 * (market.HOME ?? 0) +
        0.2 * (freq.HOME ?? 0) +
        0.2 * (elo.HOME ?? 0) +
        0.1 * ((market.HOME ?? 0) + formHomeBoost),
      DRAW:
        0.5 * (market.DRAW ?? 0) +
        0.25 * (freq.DRAW ?? 0) +
        0.25 * (elo.DRAW ?? 0),
      AWAY:
        0.5 * (market.AWAY ?? 0) +
        0.2 * (freq.AWAY ?? 0) +
        0.2 * (elo.AWAY ?? 0) +
        0.1 * Math.max(0, (market.AWAY ?? 0) - formHomeBoost),
    }),
    modelId: "baseline_simple_feature",
    modelVersion: "v1",
  };
}

export function explainBaseline(
  sample: HistoricalEvaluationSample,
  modelId: string,
  trainingPeriod: string | null,
): BaselineExplanation {
  return {
    modelId,
    modelVersion: "v1",
    featuresUsed: sample.featureContext.usedKeys,
    featuresExcluded: sample.featureContext.excludedKeys,
    marketUsed: sample.marketContext.impliedNormalized ? "result" : null,
    sources: [
      ...new Set(
        sample.decisionContext.availableFeatures
          .map((f) => f.source)
          .filter((s): s is string => Boolean(s)),
      ),
    ],
    asOf: sample.asOf.toISOString(),
    trainingPeriod,
    dataQualityNotes: [
      `features_available=${sample.dataQuality.featuresAvailable}`,
      `features_missing=${sample.dataQuality.featuresMissing}`,
      `markets_rejected=${sample.dataQuality.marketsRejected}`,
    ],
  };
}

export function probabilityForOutcome(
  probs: OutcomeProbabilities,
  resultCode: "HOME" | "DRAW" | "AWAY",
): number {
  return probs.probabilities[resultCode] ?? 0;
}
