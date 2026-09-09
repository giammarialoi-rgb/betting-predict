/**
 * Real-lab baselines — simple, transparent, market-adversarial.
 */

import type { HistoricalEvaluationSample } from "@/domain/eval/lab/sample";
import type { RealLabEvent } from "@/domain/eval/real-lab/load-pack";
import type { OutcomeProbabilities } from "@/domain/eval/baselines";
import {
  baselineElo,
  baselineHistoricalFrequency,
  baselineMarketImplied,
} from "@/domain/eval/baselines";

function normalize(probs: Record<string, number>): Record<string, number> {
  const sum = Object.values(probs).reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    return { HOME: 1 / 3, DRAW: 1 / 3, AWAY: 1 / 3 };
  }
  return Object.fromEntries(
    Object.entries(probs).map(([k, v]) => [k, v / sum]),
  );
}

export function baselineHomeAdvantage(): OutcomeProbabilities {
  return {
    marketType: "result",
    probabilities: normalize({ HOME: 0.46, DRAW: 0.26, AWAY: 0.28 }),
    modelId: "baseline_home_advantage",
    modelVersion: "v1",
  };
}

export function baselineForm(
  sample: HistoricalEvaluationSample,
): OutcomeProbabilities {
  const form = sample.decisionContext.availableFeatures.find(
    (f) => f.featureKey === "form_5",
  );
  const pts = typeof form?.value === "number" ? form.value : 7.5;
  const homeBoost = (pts / 15) * 0.5 + 0.2;
  return {
    marketType: "result",
    probabilities: normalize({
      HOME: homeBoost,
      DRAW: 0.25,
      AWAY: 1 - homeBoost - 0.25,
    }),
    modelId: "baseline_form",
    modelVersion: "v1",
  };
}

export function baselineMarketConsensus(
  sample: HistoricalEvaluationSample,
): OutcomeProbabilities {
  return {
    ...baselineMarketImplied(sample),
    modelId: "baseline_market_consensus",
  };
}

export function baselineEloPlusForm(
  sample: HistoricalEvaluationSample,
): OutcomeProbabilities {
  const e = baselineElo(sample).probabilities;
  const f = baselineForm(sample).probabilities;
  return {
    marketType: "result",
    probabilities: normalize({
      HOME: 0.5 * (e.HOME ?? 0) + 0.5 * (f.HOME ?? 0),
      DRAW: 0.5 * (e.DRAW ?? 0) + 0.5 * (f.DRAW ?? 0),
      AWAY: 0.5 * (e.AWAY ?? 0) + 0.5 * (f.AWAY ?? 0),
    }),
    modelId: "baseline_elo_form",
    modelVersion: "v1",
  };
}

export function baselineMarketPlusElo(
  sample: HistoricalEvaluationSample,
): OutcomeProbabilities {
  const m = baselineMarketImplied(sample).probabilities;
  const e = baselineElo(sample).probabilities;
  return {
    marketType: "result",
    probabilities: normalize({
      HOME: 0.7 * (m.HOME ?? 0) + 0.3 * (e.HOME ?? 0),
      DRAW: 0.7 * (m.DRAW ?? 0) + 0.3 * (e.DRAW ?? 0),
      AWAY: 0.7 * (m.AWAY ?? 0) + 0.3 * (e.AWAY ?? 0),
    }),
    modelId: "baseline_market_elo",
    modelVersion: "v1",
  };
}

export function baselineMarketEloForm(
  sample: HistoricalEvaluationSample,
): OutcomeProbabilities {
  const m = baselineMarketImplied(sample).probabilities;
  const e = baselineElo(sample).probabilities;
  const f = baselineForm(sample).probabilities;
  return {
    marketType: "result",
    probabilities: normalize({
      HOME: 0.55 * (m.HOME ?? 0) + 0.25 * (e.HOME ?? 0) + 0.2 * (f.HOME ?? 0),
      DRAW: 0.55 * (m.DRAW ?? 0) + 0.25 * (e.DRAW ?? 0) + 0.2 * (f.DRAW ?? 0),
      AWAY: 0.55 * (m.AWAY ?? 0) + 0.25 * (e.AWAY ?? 0) + 0.2 * (f.AWAY ?? 0),
    }),
    modelId: "baseline_market_elo_form",
    modelVersion: "v1",
  };
}

export type RealLabBaselineId =
  | "frequency"
  | "home_advantage"
  | "elo"
  | "market_implied"
  | "market_consensus"
  | "form"
  | "elo_form"
  | "market_elo"
  | "market_elo_form";

export function runRealLabBaseline(
  id: RealLabBaselineId,
  sample: HistoricalEvaluationSample,
  training: readonly RealLabEvent[],
): OutcomeProbabilities {
  switch (id) {
    case "frequency":
      return baselineHistoricalFrequency({
        trainingMatches: training.map((e) => ({
          eventId: e.eventId,
          sportId: e.sportId,
          competitionId: e.competitionId,
          season: e.season,
          homeTeamId: e.homeTeamId,
          awayTeamId: e.awayTeamId,
          scheduledStartAt: e.scheduledStartAt,
          resultAvailableAt: e.resultAvailableAt,
          homeScore: e.homeScore,
          awayScore: e.awayScore,
          resultCode: e.resultCode,
        })),
      });
    case "home_advantage":
      return baselineHomeAdvantage();
    case "elo":
      return baselineElo(sample);
    case "market_implied":
      return baselineMarketImplied(sample);
    case "market_consensus":
      return baselineMarketConsensus(sample);
    case "form":
      return baselineForm(sample);
    case "elo_form":
      return baselineEloPlusForm(sample);
    case "market_elo":
      return baselineMarketPlusElo(sample);
    case "market_elo_form":
      return baselineMarketEloForm(sample);
  }
}
