/** Predictive Intelligence — shared types (no odds in prediction features). */

export type PiSport =
  | "SOCCER"
  | "TENNIS"
  | "BASKETBALL"
  | "HOCKEY"
  | "VOLLEYBALL";

export type PiLabel = "HOME" | "DRAW" | "AWAY";

export type PiOddsTriple = {
  home: number | null;
  draw: number | null;
  away: number | null;
};

export type PiMatchRow = {
  canonical_id: string;
  source: "football-data-co-uk";
  season: string;
  league: string;
  match_date: string; // YYYY-MM-DD UTC date
  event_time: string; // ISO — kickoff if Time present else start-of-day UTC
  home_team: string;
  away_team: string;
  home_team_id: string;
  away_team_id: string;
  fthg: number;
  ftag: number;
  ftr: PiLabel;
  hthg: number | null;
  htag: number | null;
  htr: PiLabel | null;
  hs: number | null;
  as: number | null;
  hst: number | null;
  ast: number | null;
  hc: number | null;
  ac: number | null;
  hy: number | null;
  ay: number | null;
  hr: number | null;
  ar: number | null;
  /** Post-match xG from Football-Data when the CSV column exists. DATE_ONLY prior. */
  hxg?: number | null;
  axg?: number | null;
  /** Pre-match / DATE_ONLY open odds (allowed for market baseline eval only). */
  odds_open: {
    B365: PiOddsTriple;
    PS: PiOddsTriple;
    Avg: PiOddsTriple;
  };
  /** Closing odds — RESEARCH / CLV only. NEVER in prediction features. */
  research_odds_close: {
    B365C: PiOddsTriple;
    PSC: PiOddsTriple;
  };
  label_time: string; // result available (= event_time end-of-match proxy = next day 00:00 UTC for DATE_ONLY)
  result_available_at: string;
};

export type PiTemporalExample = {
  canonical_id: string;
  event_time: string;
  feature_cutoff: string;
  feature_source_time: string;
  label_time: string;
  label: PiLabel;
  league: string;
  season: string;
};

export type PiProb3 = { HOME: number; DRAW: number; AWAY: number };

/** Pre-match feature datum with temporal semantics (DATE_ONLY for Football-Data). */
export type FeatureDatumStatus = "ELIGIBLE" | "NOT_ELIGIBLE" | "UNAVAILABLE";
export type FeatureTemporalPrecision = "DATE_ONLY" | "STRICT_AS_OF" | "UNKNOWN";

export type FeatureOriginKind =
  | "LIVE_RESEARCH"
  | "HISTORICAL_ARCHIVE"
  | "DERIVED"
  | "STATIC"
  | "MARKET";

export type FeatureDatum = {
  key: string;
  source: string;
  event_id?: string;
  available_at: string | null;
  feature_time: string;
  value: number | null;
  quality: number | null;
  status: FeatureDatumStatus;
  temporal_precision: FeatureTemporalPrecision;
  /** Prior match canonical ids used to compute this feature (target excluded). */
  derived_from?: string[];
  calculation?: string | null;
  origin?: FeatureOriginKind;
  entered_model?: boolean;
};

export type PiFeatureVector = {
  example: PiTemporalExample;
  values: Record<string, number | null>;
  missing_keys: string[];
  closing_odds_used: false;
  features_version: string;
  /** Contractual feature rows — only ELIGIBLE values may drive MODEL. */
  feature_data: FeatureDatum[];
  data_coverage: number;
  feature_coverage: number;
  data_quality: number;
};

export type PiModelArtifact = {
  model_id: string;
  version: string;
  training_cutoff: string;
  features_version: string;
  dataset_version: string;
  parameters: Record<string, unknown>;
  metrics: Record<string, number | null>;
  created_at: string;
  random_seed: number;
  role: "INDEPENDENT_BASELINE" | "INDEPENDENT_CHALLENGER" | "NAIVE" | "MARKET_BASELINE";
  production: boolean;
  auto_promotion: false;
};

export type PiMetricsBundle = {
  log_loss: number;
  brier: number;
  calibration_error: number;
  accuracy: number;
  balanced_accuracy: number;
  roc_auc_ovr: number | null;
  n: number;
};

export type PiPromotionDecision = "PROMOTE" | "REJECT" | "SHADOW";
