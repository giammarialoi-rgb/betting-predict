/**
 * Feature lineage metadata — reconstructability contract (not reliability scores).
 */

export type FeatureAllowedMode = "STRICT_AS_OF" | "RESEARCH" | "BENCHMARK";

export type FeatureLineage = {
  featureKey: string;
  sources: readonly string[];
  dependencies: readonly string[];
  calculationMethod: string;
  lookback: number | null;
  minimumHistory: number | null;
  temporalRequirement: string;
  allowedModes: readonly FeatureAllowedMode[];
  forbiddenConditions: readonly string[];
};

export const FEATURE_LINEAGE: readonly FeatureLineage[] = Object.freeze([
  {
    featureKey: "form_3_overall",
    sources: ["event_outcomes", "reconstructed_results"],
    dependencies: ["previous completed matches with available_at <= asOf"],
    calculationMethod: "sum_points_last_k_prior_matches",
    lookback: 3,
    minimumHistory: 3,
    temporalRequirement: "only matches with available_at <= decision_as_of; exclude current event",
    allowedModes: ["STRICT_AS_OF", "RESEARCH"],
    forbiddenConditions: [
      "post-match data of decision event",
      "future results",
      "match_date < event alone without available_at check",
    ],
  },
  {
    featureKey: "form_5_overall",
    sources: ["event_outcomes", "reconstructed_results"],
    dependencies: ["previous completed matches with available_at <= asOf"],
    calculationMethod: "sum_points_last_k_prior_matches",
    lookback: 5,
    minimumHistory: 5,
    temporalRequirement: "only matches with available_at <= decision_as_of; exclude current event",
    allowedModes: ["STRICT_AS_OF", "RESEARCH"],
    forbiddenConditions: [
      "post-match data of decision event",
      "future results",
      "kickoff used as result available_at without source proof",
    ],
  },
  {
    featureKey: "form_10_overall",
    sources: ["event_outcomes", "reconstructed_results"],
    dependencies: ["previous completed matches with available_at <= asOf"],
    calculationMethod: "sum_points_last_k_prior_matches",
    lookback: 10,
    minimumHistory: 10,
    temporalRequirement: "only matches with available_at <= decision_as_of; exclude current event",
    allowedModes: ["STRICT_AS_OF", "RESEARCH"],
    forbiddenConditions: ["post-match data of decision event", "future results"],
  },
  {
    featureKey: "home_elo",
    sources: ["clubelo"],
    dependencies: ["elo_snapshots for home team"],
    calculationMethod: "latest_official_snapshot_available_at_le_asof",
    lookback: null,
    minimumHistory: 1,
    temporalRequirement: "elo.available_at <= asOf; provenance=official_clubelo",
    allowedModes: ["STRICT_AS_OF", "RESEARCH"],
    forbiddenConditions: ["provisional_blocked", "future snapshots", "unknown provenance in STRICT"],
  },
  {
    featureKey: "away_elo",
    sources: ["clubelo"],
    dependencies: ["elo_snapshots for away team"],
    calculationMethod: "latest_official_snapshot_available_at_le_asof",
    lookback: null,
    minimumHistory: 1,
    temporalRequirement: "elo.available_at <= asOf; provenance=official_clubelo",
    allowedModes: ["STRICT_AS_OF", "RESEARCH"],
    forbiddenConditions: ["provisional_blocked", "future snapshots"],
  },
]);

export function getFeatureLineage(featureKey: string): FeatureLineage | undefined {
  return FEATURE_LINEAGE.find((f) => f.featureKey === featureKey);
}
