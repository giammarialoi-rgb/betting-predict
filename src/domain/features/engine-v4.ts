/**
 * Feature Engine V4 — expands V3 with lagged goals, home/away, market microstructure.
 * Only features with available_at ≤ asOf.
 */

import { buildFeatureEngineV3 } from "@/domain/features/engine-v3";
import {
  computeLaggedGoalRates,
  estimatePoissonRatesFromHistory,
} from "@/domain/features/goal-rates";
import type {
  RealHistoricalDataset,
  RealLabEvent,
  RealLabQuote,
} from "@/domain/eval/real-lab/load-pack";
import type { DecisionFeatureEntry } from "@/domain/eval/contexts";
import type { HistoricalMatch } from "@/domain/features/types";
import { MarketEngineV2 } from "@/domain/markets/market-engine-v2";
import { buildDataQualityReport } from "@/domain/eval/data-quality-report-v2";

export type FeatureV4Bundle = {
  features: DecisionFeatureEntry[];
  excluded: string[];
  quality: ReturnType<typeof buildDataQualityReport>;
  distributions: {
    poisson_home_lambda: number | null;
    poisson_away_lambda: number | null;
  };
};

function toHistory(dataset: RealHistoricalDataset): HistoricalMatch[] {
  return dataset.events.map((e) => ({
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

function pushRate(
  features: DecisionFeatureEntry[],
  excluded: string[],
  key: string,
  cell: ReturnType<typeof computeLaggedGoalRates>,
): void {
  if (cell.status === "MISSING" || cell.value == null) {
    excluded.push(key);
    features.push({
      featureKey: key,
      value: null,
      availableAt: null,
      temporalPrecision: "exact",
      featureStatus: "MISSING",
      source: "reconstructed_results",
    });
    return;
  }
  features.push({
    featureKey: key,
    value: cell.value.goals_for_pg,
    availableAt: cell.availableAt,
    temporalPrecision: cell.temporalPrecision,
    featureStatus: "VALID",
    source: cell.source,
  });
}

export function buildFeatureEngineV4(input: {
  event: RealLabEvent;
  asOf: Date;
  dataset: RealHistoricalDataset;
  marketQuotes: readonly RealLabQuote[];
}): FeatureV4Bundle {
  const v3 = buildFeatureEngineV3(input);
  const features = [...v3.features];
  const excluded = [...v3.excluded];
  const history = toHistory(input.dataset);

  for (const window of [3, 5, 10] as const) {
    pushRate(
      features,
      excluded,
      `home_goals_for_r${window}`,
      computeLaggedGoalRates({
        history,
        teamId: input.event.homeTeamId,
        asOf: input.asOf,
        excludeMatchId: input.event.eventId,
        window,
        side: "home",
      }),
    );
    pushRate(
      features,
      excluded,
      `away_goals_against_r${window}`,
      computeLaggedGoalRates({
        history,
        teamId: input.event.awayTeamId,
        asOf: input.asOf,
        excludeMatchId: input.event.eventId,
        window,
        side: "away",
      }),
    );
  }

  const rates = estimatePoissonRatesFromHistory({
    history,
    homeTeamId: input.event.homeTeamId,
    awayTeamId: input.event.awayTeamId,
    asOf: input.asOf,
    excludeMatchId: input.event.eventId,
    window: 10,
  });
  features.push({
    featureKey: "goal_environment",
    value: rates.homeLambda + rates.awayLambda,
    availableAt: input.asOf,
    temporalPrecision: "exact",
    featureStatus: rates.sampleSize > 0 ? "VALID" : "MISSING",
    source: "poisson_rates_v1",
  });

  const resultQuotes = input.marketQuotes.filter(
    (q) =>
      q.observation.marketType === "result" &&
      q.availableAt.getTime() <= input.asOf.getTime(),
  );
  const eng = new MarketEngineV2();
  if (resultQuotes.length >= 2) {
    const bySel = new Map<string, number[]>();
    for (const q of resultQuotes) {
      const arr = bySel.get(q.observation.selection) ?? [];
      arr.push(q.oddsDecimal);
      bySel.set(q.observation.selection, arr);
    }
    const homeOdds = bySel.get("HOME") ?? [];
    if (homeOdds.length >= 2) {
      const c = eng.consensus(
        homeOdds.map((oddsDecimal, i) => ({
          bookmakerSlug: `b${i}`,
          oddsDecimal,
        })),
      );
      features.push({
        featureKey: "market_dispersion_home",
        value: c.dispersion,
        availableAt: input.asOf,
        temporalPrecision: "unknown",
        featureStatus: "VALID",
        source: "market_engine_v2",
      });
      features.push({
        featureKey: "number_of_books_home",
        value: c.number_of_bookmakers,
        availableAt: input.asOf,
        temporalPrecision: "unknown",
        featureStatus: "VALID",
        source: "market_engine_v2",
      });
    }
  } else {
    excluded.push("market_dispersion_home");
  }

  const exactShare =
    input.marketQuotes.filter((q) => q.temporalPrecision === "exact").length /
    Math.max(1, input.marketQuotes.length);
  const quality = buildDataQualityReport({
    completeness: features.filter((f) => f.featureStatus === "VALID").length /
      Math.max(1, features.length),
    exactPrecisionShare: exactShare,
    sourceAuthorityShare: 0.7,
    crossSourceAgreementShare: 0.5,
    entityResolutionShare: 0.9,
    duplicateRate: 0,
    missingRate: excluded.length / Math.max(1, features.length + excluded.length),
  });

  features.push({
    featureKey: "data_quality_score",
    value: quality.quality_score,
    availableAt: input.asOf,
    temporalPrecision: "unknown",
    featureStatus: quality.quality_score == null ? "MISSING" : "VALID",
    source: "data_quality_report_v2",
  });

  return {
    features,
    excluded,
    quality,
    distributions: {
      poisson_home_lambda: rates.sampleSize > 0 ? rates.homeLambda : null,
      poisson_away_lambda: rates.sampleSize > 0 ? rates.awayLambda : null,
    },
  };
}
