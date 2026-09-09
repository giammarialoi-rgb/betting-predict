/**
 * Lagged team goal statistics for Poisson / derived markets.
 */

import { priorMatchesForTeam } from "@/domain/features/form";
import type { FeatureCell, HistoricalMatch } from "@/domain/features/types";

export type TeamGoalRates = {
  matches: number;
  goals_for: number;
  goals_against: number;
  home_goals: number;
  away_goals: number;
  goals_for_pg: number | null;
  goals_against_pg: number | null;
};

function emptyRates(): TeamGoalRates {
  return {
    matches: 0,
    goals_for: 0,
    goals_against: 0,
    home_goals: 0,
    away_goals: 0,
    goals_for_pg: null,
    goals_against_pg: null,
  };
}

export function computeLaggedGoalRates(input: {
  history: readonly HistoricalMatch[];
  teamId: string;
  asOf: Date;
  excludeMatchId?: string;
  window?: number;
  side?: "overall" | "home" | "away";
}): FeatureCell<TeamGoalRates> {
  let prior = priorMatchesForTeam({
    history: input.history,
    teamId: input.teamId,
    asOf: input.asOf,
    excludeMatchId: input.excludeMatchId,
    side: input.side ?? "overall",
  });
  if (input.window !== undefined) prior = prior.slice(-input.window);
  if (prior.length === 0) {
    return {
      featureId: `goals_rolling_${input.window ?? "all"}`,
      value: emptyRates(),
      source: "reconstructed_results",
      availableAt: null,
      temporalPrecision: "exact",
      status: "MISSING",
    };
  }

  let gf = 0;
  let ga = 0;
  let homeGoals = 0;
  let awayGoals = 0;
  for (const m of prior) {
    const home = m.homeTeamId === input.teamId;
    const scored = home ? m.ftHome : m.ftAway;
    const conceded = home ? m.ftAway : m.ftHome;
    gf += scored;
    ga += conceded;
    if (home) homeGoals += scored;
    else awayGoals += scored;
  }
  const n = prior.length;
  return {
    featureId: `goals_rolling_${input.window ?? "all"}`,
    value: {
      matches: n,
      goals_for: gf,
      goals_against: ga,
      home_goals: homeGoals,
      away_goals: awayGoals,
      goals_for_pg: gf / n,
      goals_against_pg: ga / n,
    },
    source: "reconstructed_results",
    availableAt: prior[prior.length - 1]!.resultAvailableAt,
    temporalPrecision: "exact",
    status: "RECONSTRUCTED_STRICT",
  };
}

export function estimatePoissonRatesFromHistory(input: {
  history: readonly HistoricalMatch[];
  homeTeamId: string;
  awayTeamId: string;
  asOf: Date;
  excludeMatchId?: string;
  window?: number;
}): { homeLambda: number; awayLambda: number; sampleSize: number } {
  const home = computeLaggedGoalRates({
    history: input.history,
    teamId: input.homeTeamId,
    asOf: input.asOf,
    excludeMatchId: input.excludeMatchId,
    window: input.window ?? 10,
  });
  const away = computeLaggedGoalRates({
    history: input.history,
    teamId: input.awayTeamId,
    asOf: input.asOf,
    excludeMatchId: input.excludeMatchId,
    window: input.window ?? 10,
  });
  const hf = home.value?.goals_for_pg ?? 1.2;
  const ha = home.value?.goals_against_pg ?? 1.2;
  const af = away.value?.goals_for_pg ?? 1.1;
  const aa = away.value?.goals_against_pg ?? 1.1;
  // Simple attack/defense blend
  const homeLambda = Math.max(0.2, (hf + aa) / 2);
  const awayLambda = Math.max(0.2, (af + ha) / 2);
  const sampleSize = (home.value?.matches ?? 0) + (away.value?.matches ?? 0);
  return { homeLambda, awayLambda, sampleSize };
}
