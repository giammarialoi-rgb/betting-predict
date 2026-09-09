import { priorMatchesForTeam } from "@/domain/features/form";
import type { FeatureCell, HistoricalMatch } from "@/domain/features/types";

function goalsFor(match: HistoricalMatch, teamId: string): number {
  return match.homeTeamId === teamId ? match.ftHome : match.ftAway;
}

function goalsAgainst(match: HistoricalMatch, teamId: string): number {
  return match.homeTeamId === teamId ? match.ftAway : match.ftHome;
}

export type TeamHistoricalStats = {
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  winRate: number | null;
  drawRate: number | null;
  lossRate: number | null;
  pointsPerGame: number | null;
  goalsPerGame: number | null;
  concededPerGame: number | null;
};

export function computeTeamHistoricalStats(input: {
  history: readonly HistoricalMatch[];
  teamId: string;
  asOf: Date;
  excludeMatchId?: string;
  side?: "overall" | "home" | "away";
  window?: number;
}): FeatureCell<TeamHistoricalStats> {
  let prior = priorMatchesForTeam({
    history: input.history,
    teamId: input.teamId,
    asOf: input.asOf,
    excludeMatchId: input.excludeMatchId,
    side: input.side ?? "overall",
  });
  if (input.window !== undefined) {
    prior = prior.slice(-input.window);
  }
  if (prior.length === 0) {
    return {
      featureId: "team_historical_stats",
      value: null,
      source: "reconstructed_results",
      availableAt: null,
      temporalPrecision: "exact",
      status: "MISSING",
    };
  }

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let points = 0;
  let gf = 0;
  let ga = 0;
  for (const m of prior) {
    const home = m.homeTeamId === input.teamId;
    gf += goalsFor(m, input.teamId);
    ga += goalsAgainst(m, input.teamId);
    if (m.ftResult === "D") {
      draws++;
      points += 1;
    } else if (
      (m.ftResult === "H" && home) ||
      (m.ftResult === "A" && !home)
    ) {
      wins++;
      points += 3;
    } else {
      losses++;
    }
  }
  const n = prior.length;
  const rate = (x: number) => x / n;
  const stats: TeamHistoricalStats = {
    matchesPlayed: n,
    wins,
    draws,
    losses,
    points,
    goalsFor: gf,
    goalsAgainst: ga,
    goalDifference: gf - ga,
    winRate: rate(wins),
    drawRate: rate(draws),
    lossRate: rate(losses),
    pointsPerGame: points / n,
    goalsPerGame: gf / n,
    concededPerGame: ga / n,
  };
  return {
    featureId: "team_historical_stats",
    value: stats,
    source: "reconstructed_results",
    availableAt: prior[prior.length - 1]!.resultAvailableAt,
    temporalPrecision: "exact",
    status: "RECONSTRUCTED_STRICT",
  };
}

export function sumLaggedStat(input: {
  history: readonly HistoricalMatch[];
  teamId: string;
  asOf: Date;
  excludeMatchId?: string;
  window: number;
  pick: (match: HistoricalMatch, teamId: string) => number | null | undefined;
  featureId: string;
}): FeatureCell<number> {
  const prior = priorMatchesForTeam({
    history: input.history,
    teamId: input.teamId,
    asOf: input.asOf,
    excludeMatchId: input.excludeMatchId,
  }).slice(-input.window);

  let sum = 0;
  let used = 0;
  for (const m of prior) {
    const v = input.pick(m, input.teamId);
    if (v === null || v === undefined) continue;
    sum += v;
    used++;
  }
  if (used === 0) {
    return {
      featureId: input.featureId,
      value: null,
      source: "reconstructed_results",
      availableAt: null,
      temporalPrecision: "exact",
      status: "MISSING",
      notes: "missing≠0",
    };
  }
  return {
    featureId: input.featureId,
    value: sum,
    source: "reconstructed_results",
    availableAt: prior[prior.length - 1]!.resultAvailableAt,
    temporalPrecision: "exact",
    status: "RECONSTRUCTED_STRICT",
    notes: `used=${used}/${input.window}`,
  };
}

export function computeRestDays(input: {
  history: readonly HistoricalMatch[];
  teamId: string;
  asOf: Date;
  eventKickoff: Date;
  excludeMatchId?: string;
}): FeatureCell<number> {
  const prior = priorMatchesForTeam({
    history: input.history,
    teamId: input.teamId,
    asOf: input.asOf,
    excludeMatchId: input.excludeMatchId,
  });
  if (prior.length === 0) {
    return {
      featureId: "rest_days",
      value: null,
      source: "reconstructed_results",
      availableAt: null,
      temporalPrecision: "exact",
      status: "MISSING",
    };
  }
  const last = prior[prior.length - 1]!;
  const ms = input.eventKickoff.getTime() - last.kickoffAt.getTime();
  const days = Math.floor(ms / 86_400_000);
  return {
    featureId: "rest_days",
    value: days,
    source: "reconstructed_results",
    availableAt: last.resultAvailableAt,
    temporalPrecision: "exact",
    status: "RECONSTRUCTED_STRICT",
    notes: "ignores cups outside provided history",
  };
}
