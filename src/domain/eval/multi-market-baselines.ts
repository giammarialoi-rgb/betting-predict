/**
 * Multi-market model baselines — market-agnostic outputs P(selection).
 */

import type { OutcomeProbabilities } from "@/domain/eval/baselines";
import {
  poisson1x2,
  poissonOverProbability,
  poissonUnderProbability,
  type PoissonGoalRates,
} from "@/domain/eval/poisson-baseline";
import { deVigProportional } from "@/domain/markets/consensus-engine";

function normalize(probs: Record<string, number>): Record<string, number> {
  const sum = Object.values(probs).reduce((a, b) => a + b, 0);
  if (sum <= 0) return probs;
  return Object.fromEntries(
    Object.entries(probs).map(([k, v]) => [k, v / sum]),
  );
}

export function marketImpliedBaseline(input: {
  oddsBySelection: Record<string, number>;
}): OutcomeProbabilities {
  const selections = Object.keys(input.oddsBySelection);
  const odds = selections.map((s) => input.oddsBySelection[s]!);
  if (odds.length < 2) {
    return {
      marketType: "generic",
      probabilities: normalize(
        Object.fromEntries(selections.map((s) => [s, 1])),
      ),
      modelId: "MarketImpliedBaseline",
      modelVersion: "v1",
    };
  }
  const d = deVigProportional(odds);
  const probs = Object.fromEntries(
    selections.map((s, i) => [s, d.output_probabilities[i]!]),
  );
  return {
    marketType: "generic",
    probabilities: probs,
    modelId: "MarketImpliedBaseline",
    modelVersion: "v1",
  };
}

export function frequencyBaseline(input: {
  counts: Record<string, number>;
}): OutcomeProbabilities {
  return {
    marketType: "generic",
    probabilities: normalize(input.counts),
    modelId: "FrequencyBaseline",
    modelVersion: "v1",
  };
}

export function homeBaseline(): OutcomeProbabilities {
  return {
    marketType: "result",
    probabilities: normalize({ HOME: 0.46, DRAW: 0.26, AWAY: 0.28 }),
    modelId: "HomeBaseline",
    modelVersion: "v1",
  };
}

export function eloBaseline(input: {
  pHome: number;
}): OutcomeProbabilities {
  const pHome = Math.min(0.85, Math.max(0.1, input.pHome));
  const rem = 1 - pHome;
  return {
    marketType: "result",
    probabilities: normalize({
      HOME: pHome,
      DRAW: rem * 0.4,
      AWAY: rem * 0.6,
    }),
    modelId: "EloBaseline",
    modelVersion: "v1",
  };
}

export function formBaseline(input: { formPoints: number }): OutcomeProbabilities {
  const homeBoost = (input.formPoints / 15) * 0.5 + 0.2;
  return {
    marketType: "result",
    probabilities: normalize({
      HOME: homeBoost,
      DRAW: 0.25,
      AWAY: Math.max(0.05, 1 - homeBoost - 0.25),
    }),
    modelId: "FormBaseline",
    modelVersion: "v1",
  };
}

export function poissonBaseline(input: {
  rates: PoissonGoalRates;
  market: "result" | "total_goals";
  line?: number;
}): OutcomeProbabilities {
  if (input.market === "result") {
    return {
      marketType: "result",
      probabilities: poisson1x2(input.rates),
      modelId: "PoissonBaseline",
      modelVersion: "v1",
    };
  }
  const line = input.line ?? 2.5;
  const over = poissonOverProbability(input.rates, line);
  const under = poissonUnderProbability(input.rates, line);
  return {
    marketType: "total_goals",
    probabilities: normalize({ OVER: over, UNDER: under }),
    modelId: "PoissonBaseline",
    modelVersion: "v1",
  };
}
