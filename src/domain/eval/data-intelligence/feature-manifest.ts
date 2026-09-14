/** P0 feature manifest — readiness vs independent MODEL (honest). */

export type FeatureManifestReadiness =
  | "ACTIVE"
  | "STUB"
  | "CONTEXT_ONLY"
  | "MISSING";

export type FeatureManifestEntry = {
  family: string;
  key: string;
  preferred_source: string;
  temporal_precision: "DATE_ONLY" | "STRICT_AS_OF" | "UNKNOWN" | "N/A";
  enters_independent_model: boolean;
  readiness: FeatureManifestReadiness;
  note: string;
};

export const FEATURE_MANIFEST_P0: readonly FeatureManifestEntry[] = [
  {
    family: "team_strength",
    key: "home_elo",
    preferred_source: "clubelo",
    temporal_precision: "DATE_ONLY",
    enters_independent_model: true,
    readiness: "ACTIVE",
    note: "Local ClubElo CSV only; rating_date < match_date",
  },
  {
    family: "team_strength",
    key: "away_elo",
    preferred_source: "clubelo",
    temporal_precision: "DATE_ONLY",
    enters_independent_model: true,
    readiness: "ACTIVE",
    note: "Local ClubElo CSV only; rating_date < match_date",
  },
  {
    family: "team_strength",
    key: "elo_diff",
    preferred_source: "clubelo",
    temporal_precision: "DATE_ONLY",
    enters_independent_model: true,
    readiness: "ACTIVE",
    note: "Derived when both Elo ELIGIBLE",
  },
  {
    family: "form",
    key: "home_gf_l5",
    preferred_source: "football-data-co-uk",
    temporal_precision: "DATE_ONLY",
    enters_independent_model: true,
    readiness: "ACTIVE",
    note: "Lagged form windows L3/L5/L10 in PI engine",
  },
  {
    family: "form",
    key: "away_gf_l5",
    preferred_source: "football-data-co-uk",
    temporal_precision: "DATE_ONLY",
    enters_independent_model: true,
    readiness: "ACTIVE",
    note: "Lagged form windows L3/L5/L10 in PI engine",
  },
  {
    family: "stats",
    key: "home_shots_l5",
    preferred_source: "football-data-co-uk",
    temporal_precision: "DATE_ONLY",
    enters_independent_model: true,
    readiness: "ACTIVE",
    note: "Shots / SoT / corners / cards lagged",
  },
  {
    family: "h2h",
    key: "h2h_home_win_rate",
    preferred_source: "football-data-co-uk",
    temporal_precision: "DATE_ONLY",
    enters_independent_model: true,
    readiness: "ACTIVE",
    note: "Historical H2H priors",
  },
  {
    family: "context",
    key: "home_rest_days",
    preferred_source: "football-data-co-uk",
    temporal_precision: "DATE_ONLY",
    enters_independent_model: true,
    readiness: "ACTIVE",
    note: "Days rest from calendar",
  },
  {
    family: "context",
    key: "home_advantage",
    preferred_source: "football-data-co-uk",
    temporal_precision: "DATE_ONLY",
    enters_independent_model: true,
    readiness: "ACTIVE",
    note: "Constant 1 for home side",
  },
  {
    family: "xg",
    key: "home_xg_prematch",
    preferred_source: "understat",
    temporal_precision: "DATE_ONLY",
    enters_independent_model: true,
    readiness: "ACTIVE",
    note: "Understat getLeagueData L5 rolling prior; available_at reconstructed as day-after-most-recent-prior-match (same rule as football-data.co.uk), gated by STRICT_AS_OF against the target's own cutoff",
  },
  {
    family: "xg",
    key: "away_xg_prematch",
    preferred_source: "understat",
    temporal_precision: "DATE_ONLY",
    enters_independent_model: true,
    readiness: "ACTIVE",
    note: "Understat getLeagueData L5 rolling prior; available_at reconstructed as day-after-most-recent-prior-match (same rule as football-data.co.uk), gated by STRICT_AS_OF against the target's own cutoff",
  },
  {
    family: "injuries",
    key: "home_injuries_n",
    preferred_source: "api-sports",
    temporal_precision: "STRICT_AS_OF",
    enters_independent_model: true,
    readiness: "ACTIVE",
    note: "MODEL only when available_at demonstrable < decision_time",
  },
  {
    family: "injuries",
    key: "away_injuries_n",
    preferred_source: "api-sports",
    temporal_precision: "STRICT_AS_OF",
    enters_independent_model: true,
    readiness: "ACTIVE",
    note: "MODEL only when available_at demonstrable < decision_time",
  },
  {
    family: "lineups",
    key: "home_lineup_confirmed",
    preferred_source: "api-sports",
    temporal_precision: "STRICT_AS_OF",
    enters_independent_model: true,
    readiness: "ACTIVE",
    note: "1/0 confirmed; NOT_ELIGIBLE without published clock",
  },
  {
    family: "lineups",
    key: "away_lineup_confirmed",
    preferred_source: "api-sports",
    temporal_precision: "STRICT_AS_OF",
    enters_independent_model: true,
    readiness: "ACTIVE",
    note: "1/0 confirmed; NOT_ELIGIBLE without published clock",
  },
  {
    family: "weather",
    key: "weather_temp_c",
    preferred_source: "open-meteo",
    temporal_precision: "STRICT_AS_OF",
    enters_independent_model: false,
    readiness: "CONTEXT_ONLY",
    note: "Open-Meteo CONTEXT — never MODEL bag",
  },
  {
    family: "referee",
    key: "referee_cards_avg",
    preferred_source: "none",
    temporal_precision: "N/A",
    enters_independent_model: false,
    readiness: "MISSING",
    note: "Not wired this phase",
  },
  {
    family: "coach",
    key: "coach_statements_sentiment",
    preferred_source: "none",
    temporal_precision: "N/A",
    enters_independent_model: false,
    readiness: "MISSING",
    note: "News/coach out of scope Phase 2",
  },
  {
    family: "ppda",
    key: "ppda_home",
    preferred_source: "none",
    temporal_precision: "UNKNOWN",
    enters_independent_model: false,
    readiness: "STUB",
    note: "Placeholder UNAVAILABLE in PI engine",
  },
];

export function featureManifestP0Summary(): {
  by_readiness: Record<FeatureManifestReadiness, string[]>;
  model_keys: string[];
  stub_or_missing_families: string[];
} {
  const by_readiness: Record<FeatureManifestReadiness, string[]> = {
    ACTIVE: [],
    STUB: [],
    CONTEXT_ONLY: [],
    MISSING: [],
  };
  for (const e of FEATURE_MANIFEST_P0) {
    by_readiness[e.readiness].push(e.key);
  }
  const model_keys = FEATURE_MANIFEST_P0.filter((e) => e.enters_independent_model).map(
    (e) => e.key,
  );
  const stub_or_missing_families = [
    ...new Set(
      FEATURE_MANIFEST_P0.filter(
        (e) => e.readiness === "STUB" || e.readiness === "MISSING",
      ).map((e) => e.family),
    ),
  ];
  return { by_readiness, model_keys, stub_or_missing_families };
}

/** Keys allowed to merge from DI synthesis into independent MODEL bag. */
export const DI_MODEL_MERGE_KEYS = new Set(
  FEATURE_MANIFEST_P0.filter((e) => e.enters_independent_model && e.readiness === "ACTIVE")
    .map((e) => e.key)
    .filter((k) =>
      [
        "home_injuries_n",
        "away_injuries_n",
        "home_lineup_confirmed",
        "away_lineup_confirmed",
        "home_elo",
        "away_elo",
        "elo_diff",
      ].includes(k),
    ),
);
