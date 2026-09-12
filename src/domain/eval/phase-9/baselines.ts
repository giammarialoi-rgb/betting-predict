import { normalizeProb3 } from "@/domain/eval/predictive-intelligence/models/normalize-probs";
import { predictNaiveLeagueFreq } from "@/domain/eval/predictive-intelligence/models/naive";
import { marketBaselineFromOpenOdds } from "@/domain/eval/predictive-intelligence/models/market-baseline";
import { featureCutoffForMatch, priorMatchesAsOf } from "@/domain/eval/predictive-intelligence/features/asof";
import type { PiProb3 } from "@/domain/eval/predictive-intelligence/types";
import type { Phase9BaselineId, Phase9Match } from "@/domain/eval/phase-9/types";

export function predictUniform1x2(): PiProb3 {
  return normalizeProb3(1, 1, 1);
}

export function predictHistoricalHda(target: Phase9Match, universe: readonly Phase9Match[]): PiProb3 {
  const cut = featureCutoffForMatch(target);
  const priors = priorMatchesAsOf(universe, cut);
  if (!priors.length) return normalizeProb3(0.45, 0.27, 0.28);
  let h = 0;
  let d = 0;
  let a = 0;
  for (const m of priors) {
    if (m.ftr === "HOME") h += 1;
    else if (m.ftr === "DRAW") d += 1;
    else a += 1;
  }
  return normalizeProb3(h, d, a);
}

export function predictHomeAdvantage(target: Phase9Match, universe: readonly Phase9Match[]): PiProb3 {
  const hist = predictHistoricalHda(target, universe);
  const cut = featureCutoffForMatch(target);
  const priors = priorMatchesAsOf(universe, cut);
  const homeRate = priors.length ? priors.filter((m) => m.ftr === "HOME").length / priors.length : 0.45;
  const boost = Math.min(0.12, Math.max(0, homeRate - 1 / 3));
  return normalizeProb3(hist.HOME + boost, hist.DRAW, hist.AWAY);
}

export function predictBaseline(input: {
  id: Phase9BaselineId;
  target: Phase9Match;
  universe: readonly Phase9Match[];
}): PiProb3 | null {
  switch (input.id) {
    case "UNIFORM_1X2":
      return predictUniform1x2();
    case "HISTORICAL_HDA":
      return predictHistoricalHda(input.target, input.universe);
    case "LEAGUE_FREQ":
      return predictNaiveLeagueFreq({ target: input.target, universe: input.universe });
    case "HOME_ADVANTAGE":
      return predictHomeAdvantage(input.target, input.universe);
    case "MARKET_DEVIG_OPEN":
      return marketBaselineFromOpenOdds(input.target);
    default:
      return null;
  }
}

export const INDEPENDENT_BASELINES: Phase9BaselineId[] = [
  "UNIFORM_1X2",
  "HISTORICAL_HDA",
  "LEAGUE_FREQ",
  "HOME_ADVANTAGE",
];

export const MARKET_BASELINE_ID: Phase9BaselineId = "MARKET_DEVIG_OPEN";
