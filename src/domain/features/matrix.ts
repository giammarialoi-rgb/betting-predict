import { computeFormBundle } from "@/domain/features/form";
import {
  computeRestDays,
  computeTeamHistoricalStats,
  sumLaggedStat,
} from "@/domain/features/historical";
import { buildEloFeatures } from "@/domain/features/elo";
import { buildMarketFeatureCells, type AsOfBookQuote } from "@/domain/features/market";
import { assertFeatureAvailableAsOf } from "@/domain/features/gates";
import type {
  EloSnapshot,
  FeatureCell,
  FeatureEventContext,
  HistoricalMatch,
} from "@/domain/features/types";
import { candidateFeaturesForMarket } from "@/domain/markets/feature-map";

export type FeatureSnapshot = {
  event: FeatureEventContext;
  asOf: Date;
  marketId: string;
  cells: Record<string, FeatureCell>;
  candidateFeatureIds: readonly string[];
  temporalMeta: {
    asOf: string;
    kickoff: string;
    policy: "available_at <= asOf";
  };
};

export function buildFeatureSnapshot(input: {
  event: FeatureEventContext;
  asOf: Date;
  marketId?: string;
  history: readonly HistoricalMatch[];
  eloSnapshots?: readonly EloSnapshot[];
  homeClubKey?: string;
  awayClubKey?: string;
  quotes?: readonly AsOfBookQuote[];
  allowClosing?: boolean;
}): FeatureSnapshot {
  if (input.asOf.getTime() > input.event.scheduledStartAt.getTime()) {
    // Allowed for post-event research, but mark in meta; prematch callers should pass asOf <= kickoff.
  }

  const marketId = input.marketId ?? "result";
  const cells: Record<string, FeatureCell> = {};

  const homeForm = computeFormBundle({
    history: input.history,
    teamId: input.event.homeTeamId,
    asOf: input.asOf,
    excludeMatchId: input.event.eventId,
  });
  const awayForm = computeFormBundle({
    history: input.history,
    teamId: input.event.awayTeamId,
    asOf: input.asOf,
    excludeMatchId: input.event.eventId,
  });
  for (const [k, v] of Object.entries(homeForm)) {
    cells[`home_${k}`] = { ...v, featureId: `home_${k}` };
  }
  for (const [k, v] of Object.entries(awayForm)) {
    cells[`away_${k}`] = { ...v, featureId: `away_${k}` };
  }

  cells.home_stats = computeTeamHistoricalStats({
    history: input.history,
    teamId: input.event.homeTeamId,
    asOf: input.asOf,
    excludeMatchId: input.event.eventId,
    window: 5,
  });
  cells.away_stats = computeTeamHistoricalStats({
    history: input.history,
    teamId: input.event.awayTeamId,
    asOf: input.asOf,
    excludeMatchId: input.event.eventId,
    window: 5,
  });

  cells.home_goals_for_5 = sumLaggedStat({
    history: input.history,
    teamId: input.event.homeTeamId,
    asOf: input.asOf,
    excludeMatchId: input.event.eventId,
    window: 5,
    featureId: "home_goals_for_5",
    pick: (m, teamId) =>
      m.homeTeamId === teamId ? m.ftHome : m.ftAway,
  });
  cells.home_goals_against_5 = sumLaggedStat({
    history: input.history,
    teamId: input.event.homeTeamId,
    asOf: input.asOf,
    excludeMatchId: input.event.eventId,
    window: 5,
    featureId: "home_goals_against_5",
    pick: (m, teamId) =>
      m.homeTeamId === teamId ? m.ftAway : m.ftHome,
  });
  cells.home_shots_for_5 = sumLaggedStat({
    history: input.history,
    teamId: input.event.homeTeamId,
    asOf: input.asOf,
    excludeMatchId: input.event.eventId,
    window: 5,
    featureId: "home_shots_for_5",
    pick: (m, teamId) =>
      m.homeTeamId === teamId ? m.homeShots : m.awayShots,
  });

  cells.home_rest_days = computeRestDays({
    history: input.history,
    teamId: input.event.homeTeamId,
    asOf: input.asOf,
    eventKickoff: input.event.scheduledStartAt,
    excludeMatchId: input.event.eventId,
  });
  cells.away_rest_days = computeRestDays({
    history: input.history,
    teamId: input.event.awayTeamId,
    asOf: input.asOf,
    eventKickoff: input.event.scheduledStartAt,
    excludeMatchId: input.event.eventId,
  });

  cells.home_advantage_flag = {
    featureId: "home_advantage_flag",
    value: true,
    source: "event_identity",
    availableAt: input.asOf,
    temporalPrecision: "exact",
    status: "STRICT",
    notes: "venue designation known at decision time; not kickoff-as-availability",
  };

  if (input.eloSnapshots && input.homeClubKey && input.awayClubKey) {
    const elo = buildEloFeatures({
      snapshots: input.eloSnapshots,
      homeClubKey: input.homeClubKey,
      awayClubKey: input.awayClubKey,
      asOf: input.asOf,
    });
    cells.home_elo = elo.homeElo;
    cells.away_elo = elo.awayElo;
    cells.elo_difference = elo.eloDifference;
    cells.elo_expected_probability = elo.eloExpectedProbability;
  } else {
    cells.home_elo = {
      featureId: "home_elo",
      value: null,
      source: "clubelo",
      availableAt: null,
      temporalPrecision: "unknown",
      status: "BLOCKED",
      notes: "ClubElo snapshots not provided",
    };
  }

  const market = buildMarketFeatureCells({
    asOf: input.asOf,
    quotes: input.quotes ?? [],
    allowClosing: input.allowClosing ?? false,
  });
  cells.market_implied_probability = market.marketImplied;
  cells.market_overround = market.marketOverround;
  cells.bookmaker_disagreement = market.bookmakerDisagreement;
  cells.bookmaker_count = market.bookmakerCount;

  for (const cell of Object.values(cells)) {
    if (cell.status !== "MISSING" && cell.availableAt) {
      assertFeatureAvailableAsOf(input.asOf, cell);
    }
  }

  return {
    event: input.event,
    asOf: input.asOf,
    marketId,
    cells,
    candidateFeatureIds: candidateFeaturesForMarket(marketId),
    temporalMeta: {
      asOf: input.asOf.toISOString(),
      kickoff: input.event.scheduledStartAt.toISOString(),
      policy: "available_at <= asOf",
    },
  };
}
