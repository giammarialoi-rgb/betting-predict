/**
 * Feature Engine V2 — lagged historical features for real lab.
 */

import { computeFormPoints } from "@/domain/features/form";
import {
  computeRestDays,
  computeTeamHistoricalStats,
} from "@/domain/features/historical";
import {
  buildEloFeatures,
  eloExpectedHomeProbability,
} from "@/domain/features/elo";
import type { EloSnapshot, HistoricalMatch } from "@/domain/features/types";
import type {
  RealHistoricalDataset,
  RealLabEvent,
  RealLabQuote,
} from "@/domain/eval/real-lab/load-pack";
import {
  computeOverround,
  normalizeMarketProbabilities,
} from "@/domain/odds/math";
import type { DecisionFeatureEntry } from "@/domain/eval/contexts";

function toHistory(events: readonly RealLabEvent[]): HistoricalMatch[] {
  return events.map((e) => ({
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

function toElo(dataset: RealHistoricalDataset): EloSnapshot[] {
  return dataset.elo.map((e) => ({
    clubKey: e.teamId,
    elo: e.rating,
    snapshotDate: e.snapshotAt,
    provenance: e.provenance,
    availableAt: e.availableAt,
  }));
}

function statusMap(status: string): string {
  const m: Record<string, string> = {
    RECONSTRUCTED_STRICT: "VALID",
    STRICT: "VALID",
    DATASET_WINDOW: "VALID",
    MISSING: "MISSING",
    BLOCKED: "FORBIDDEN",
    REJECTED_LEAKAGE: "FORBIDDEN",
    UNKNOWN: "TEMPORAL_UNKNOWN",
  };
  return m[status] ?? status;
}

export function buildFeatureEngineV2(input: {
  event: RealLabEvent;
  asOf: Date;
  dataset: RealHistoricalDataset;
  /** Quotes already filtered to asOf-legal (and policy). */
  marketQuotes: readonly RealLabQuote[];
}): {
  features: DecisionFeatureEntry[];
  excluded: string[];
} {
  const history = toHistory(input.dataset.events);
  const features: DecisionFeatureEntry[] = [];
  const excluded: string[] = [];
  const { event, asOf } = input;

  for (const window of [3, 5, 10] as const) {
    const cell = computeFormPoints({
      history,
      teamId: event.homeTeamId,
      asOf,
      window,
      excludeMatchId: event.eventId,
    });
    features.push({
      featureKey: `form_${window}`,
      value: cell.value,
      availableAt: cell.availableAt,
      temporalPrecision: cell.temporalPrecision,
      featureStatus: statusMap(cell.status),
      source: cell.source,
    });
  }

  const hist = computeTeamHistoricalStats({
    history,
    teamId: event.homeTeamId,
    asOf,
    excludeMatchId: event.eventId,
    window: 10,
  });
  features.push({
    featureKey: "goals_for",
    value: hist.value?.goalsFor ?? null,
    availableAt: hist.availableAt,
    temporalPrecision: hist.temporalPrecision,
    featureStatus: statusMap(hist.status),
    source: hist.source,
  });
  features.push({
    featureKey: "goals_against",
    value: hist.value?.goalsAgainst ?? null,
    availableAt: hist.availableAt,
    temporalPrecision: hist.temporalPrecision,
    featureStatus: statusMap(hist.status),
    source: hist.source,
  });
  features.push({
    featureKey: "goal_difference",
    value: hist.value?.goalDifference ?? null,
    availableAt: hist.availableAt,
    temporalPrecision: hist.temporalPrecision,
    featureStatus: statusMap(hist.status),
    source: hist.source,
  });

  // Shots/corners/cards — missing unless pack provides (explicit MISSING ≠ 0)
  for (const key of ["shots", "shots_on_target", "corners", "cards"] as const) {
    features.push({
      featureKey: key,
      value: null,
      availableAt: null,
      temporalPrecision: "exact",
      featureStatus: "MISSING",
      source: "not_in_primary_pack",
    });
    excluded.push(`${key}_unavailable_in_primary`);
  }

  const rest = computeRestDays({
    history,
    teamId: event.homeTeamId,
    asOf,
    eventKickoff: event.scheduledStartAt,
    excludeMatchId: event.eventId,
  });
  features.push({
    featureKey: "rest_days",
    value: rest.value,
    availableAt: rest.availableAt,
    temporalPrecision: rest.temporalPrecision,
    featureStatus: statusMap(rest.status),
    source: rest.source,
  });

  features.push({
    featureKey: "home_advantage",
    value: 1,
    availableAt: asOf,
    temporalPrecision: "exact",
    featureStatus: "VALID",
    source: "schedule",
  });

  const elo = buildEloFeatures({
    snapshots: toElo(input.dataset),
    homeClubKey: event.homeTeamId,
    awayClubKey: event.awayTeamId,
    asOf,
  });
  for (const cell of [
    elo.homeElo,
    elo.awayElo,
    elo.eloDifference,
    elo.eloExpectedProbability,
  ]) {
    const key =
      cell.featureId === "home_elo"
        ? "home_elo"
        : cell.featureId === "away_elo"
          ? "away_elo"
          : cell.featureId === "elo_difference"
            ? "elo_difference"
            : "elo_expected_probability";
    if (cell.status === "BLOCKED") {
      excluded.push(key);
      continue;
    }
    features.push({
      featureKey: key,
      value: cell.value,
      availableAt: cell.availableAt,
      temporalPrecision: cell.temporalPrecision,
      featureStatus: statusMap(cell.status),
      source: cell.source,
    });
  }

  // Market features — only from asOf-legal quotes; unknown precision may be empty under STRICT
  const resultQuotes = input.marketQuotes.filter(
    (q) => q.observation.marketType === "result",
  );
  const byBook = new Map<string, Record<string, number>>();
  for (const q of resultQuotes) {
    if (q.observationKind === "dataset_close") continue;
    const row = byBook.get(q.bookmakerSlug) ?? {};
    row[q.observation.selection] = q.oddsDecimal;
    byBook.set(q.bookmakerSlug, row);
  }
  const complete = [...byBook.entries()].filter(
    ([, r]) => r.HOME && r.DRAW && r.AWAY,
  );
  if (complete.length > 0) {
    const [, first] = complete[0]!;
    const odds = [first.HOME!, first.DRAW!, first.AWAY!];
    const norm = normalizeMarketProbabilities(odds);
    const over = computeOverround(odds).overround;
    const latest = resultQuotes.reduce(
      (m, q) => (q.availableAt > m ? q.availableAt : m),
      resultQuotes[0]!.availableAt,
    );
    features.push({
      featureKey: "implied_probability",
      value: { HOME: norm[0], DRAW: norm[1], AWAY: norm[2] },
      availableAt: latest,
      temporalPrecision: resultQuotes[0]!.temporalPrecision,
      featureStatus:
        resultQuotes[0]!.temporalPrecision === "unknown"
          ? "TEMPORAL_UNKNOWN"
          : "VALID",
      source: "market_snapshots",
    });
    features.push({
      featureKey: "overround",
      value: over,
      availableAt: latest,
      temporalPrecision: resultQuotes[0]!.temporalPrecision,
      featureStatus:
        resultQuotes[0]!.temporalPrecision === "unknown"
          ? "TEMPORAL_UNKNOWN"
          : "VALID",
      source: "market_snapshots",
    });
    const homeOdds = complete.map(([, r]) => r.HOME!);
    const mean = homeOdds.reduce((a, b) => a + b, 0) / homeOdds.length;
    const disp = Math.sqrt(
      homeOdds.reduce((a, b) => a + (b - mean) ** 2, 0) / homeOdds.length,
    );
    features.push({
      featureKey: "market_dispersion",
      value: disp,
      availableAt: latest,
      temporalPrecision: "unknown",
      featureStatus: "TEMPORAL_UNKNOWN",
      source: "market_snapshots",
    });
    features.push({
      featureKey: "bookmaker_disagreement",
      value: Math.max(...homeOdds) - Math.min(...homeOdds),
      availableAt: latest,
      temporalPrecision: "unknown",
      featureStatus: "TEMPORAL_UNKNOWN",
      source: "market_snapshots",
    });
    features.push({
      featureKey: "market_consensus",
      value: { HOME: norm[0], DRAW: norm[1], AWAY: norm[2] },
      availableAt: latest,
      temporalPrecision: "unknown",
      featureStatus: "TEMPORAL_UNKNOWN",
      source: "market_snapshots",
    });
  } else {
    excluded.push("market_implied_unavailable");
  }

  void eloExpectedHomeProbability;
  return { features, excluded };
}
