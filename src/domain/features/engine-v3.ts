/**
 * Feature Engine V3 — team / match / market / player / external interfaces.
 * Missing stays MISSING. No invented values.
 */

import { buildFeatureEngineV2 } from "@/domain/features/engine-v2";
import type {
  RealHistoricalDataset,
  RealLabEvent,
  RealLabQuote,
} from "@/domain/eval/real-lab/load-pack";
import type { DecisionFeatureEntry } from "@/domain/eval/contexts";
import { deVigProportional } from "@/domain/markets/consensus-engine";
import { analyzeCrossBookmaker } from "@/domain/markets/consensus-engine";

export type FeatureCategory =
  | "team"
  | "match"
  | "market"
  | "player"
  | "external";

export type FeatureV3Bundle = {
  features: DecisionFeatureEntry[];
  excluded: string[];
  byCategory: Record<FeatureCategory, string[]>;
};

export function buildFeatureEngineV3(input: {
  event: RealLabEvent;
  asOf: Date;
  dataset: RealHistoricalDataset;
  marketQuotes: readonly RealLabQuote[];
}): FeatureV3Bundle {
  const v2 = buildFeatureEngineV2(input);
  const features = [...v2.features];
  const excluded = [...v2.excluded];

  // Match context
  const homeElo = features.find((f) => f.featureKey === "home_elo");
  const awayElo = features.find((f) => f.featureKey === "away_elo");
  if (
    typeof homeElo?.value === "number" &&
    typeof awayElo?.value === "number"
  ) {
    features.push({
      featureKey: "strength_differential",
      value: homeElo.value - awayElo.value,
      availableAt:
        homeElo.availableAt && awayElo.availableAt
          ? new Date(
              Math.max(
                homeElo.availableAt.getTime(),
                awayElo.availableAt.getTime(),
              ),
            )
          : null,
      temporalPrecision: "dataset_window",
      featureStatus: "VALID",
      source: "clubelo",
    });
  } else {
    excluded.push("strength_differential");
  }

  features.push({
    featureKey: "historical_matchup",
    value: null,
    availableAt: null,
    temporalPrecision: "exact",
    featureStatus: "MISSING",
    source: "not_in_pack",
  });
  excluded.push("historical_matchup_unavailable");

  // Market de-vig when full 1X2 present
  const byBook = new Map<string, Record<string, number>>();
  for (const q of input.marketQuotes) {
    if (q.observation.marketType !== "result") continue;
    if (q.availableAt.getTime() > input.asOf.getTime()) continue;
    const row = byBook.get(q.bookmakerSlug) ?? {};
    row[q.observation.selection] = q.oddsDecimal;
    byBook.set(q.bookmakerSlug, row);
  }
  for (const [slug, row] of byBook) {
    if (row.HOME && row.DRAW && row.AWAY) {
      const odds = [row.HOME, row.DRAW, row.AWAY];
      const d = deVigProportional(odds);
      features.push({
        featureKey: `devig_proportional_${slug}`,
        value: {
          HOME: d.output_probabilities[0],
          DRAW: d.output_probabilities[1],
          AWAY: d.output_probabilities[2],
          method: d.method,
        },
        availableAt: input.asOf,
        temporalPrecision: "unknown",
        featureStatus: "TEMPORAL_UNKNOWN",
        source: "market_snapshots",
      });
      break;
    }
  }

  const homeQuotes = input.marketQuotes
    .filter(
      (q) =>
        q.observation.marketType === "result" &&
        q.observation.selection === "HOME" &&
        q.availableAt.getTime() <= input.asOf.getTime(),
    )
    .map((q) => ({
      bookmakerSlug: q.bookmakerSlug,
      oddsDecimal: q.oddsDecimal,
    }));
  const cross = analyzeCrossBookmaker({
    marketType: "result",
    line: null,
    selection: "HOME",
    quotes: homeQuotes,
  });
  if (cross.number_of_bookmakers > 0) {
    features.push({
      featureKey: "market_dispersion_v3",
      value: cross.stddev,
      availableAt: input.asOf,
      temporalPrecision: "unknown",
      featureStatus: "TEMPORAL_UNKNOWN",
      source: "market_snapshots",
    });
  }

  // Player / external — interfaces only (MISSING)
  for (const key of [
    "player_availability",
    "player_injuries",
    "player_suspension",
    "player_minutes",
    "player_form",
    "weather",
    "news",
    "lineups",
    "injuries_external",
  ] as const) {
    features.push({
      featureKey: key,
      value: null,
      availableAt: null,
      temporalPrecision: "exact",
      featureStatus: "MISSING",
      source: "future_provider",
    });
    excluded.push(`${key}_not_connected`);
  }

  const byCategory: Record<FeatureCategory, string[]> = {
    team: features
      .filter((f) =>
        [
          "form_3",
          "form_5",
          "form_10",
          "goals_for",
          "goals_against",
          "home_elo",
          "away_elo",
          "rest_days",
          "shots",
          "corners",
          "cards",
        ].includes(f.featureKey),
      )
      .map((f) => f.featureKey),
    match: features
      .filter((f) =>
        [
          "home_advantage",
          "strength_differential",
          "historical_matchup",
        ].includes(f.featureKey),
      )
      .map((f) => f.featureKey),
    market: features
      .filter(
        (f) =>
          f.featureKey.includes("market") ||
          f.featureKey.includes("devig") ||
          f.featureKey.includes("implied") ||
          f.featureKey.includes("overround") ||
          f.featureKey.includes("dispersion") ||
          f.featureKey.includes("disagreement"),
      )
      .map((f) => f.featureKey),
    player: features
      .filter((f) => f.featureKey.startsWith("player_"))
      .map((f) => f.featureKey),
    external: features
      .filter((f) =>
        ["weather", "news", "lineups", "injuries_external"].includes(
          f.featureKey,
        ),
      )
      .map((f) => f.featureKey),
  };

  return { features, excluded, byCategory };
}
