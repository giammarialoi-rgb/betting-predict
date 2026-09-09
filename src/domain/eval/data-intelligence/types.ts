export type DataSourceRole =
  | "MODEL_FEATURE"
  | "MARKET_COMPARE"
  | "CONTEXT"
  | "DISABLED";

export type DataSourceStatus =
  | "ACTIVE"
  | "ACTIVE_ASOF"
  | "TEMPORALLY_CAUTIOUS"
  | "FOUNDATION"
  | "PLAN_LIMITED"
  | "UNAVAILABLE"
  | "DISABLED_BY_POLICY"
  | "RESEARCH_TEST"
  | "CANDIDATE";

export type DataSourceTemporalPrecision = "DATE_ONLY" | "STRICT_AS_OF" | "UNKNOWN" | "N/A";

export type SourceLegalStatus = "public" | "licensed" | "research_test" | "forbidden" | "unknown";

export type SourceEntry = {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  role: DataSourceRole;
  temporal_precision: DataSourceTemporalPrecision;
  status: DataSourceStatus;
  reason: string;
  enters_independent_model: boolean;
  legal_status?: SourceLegalStatus;
  last_error?: string | null;
};

export type SourceObservation = {
  source_id: string;
  event_id: string;
  event_time: string | null;
  available_at: string | null;
  retrieved_at: string;
  key: string;
  value: number | string | boolean | null;
  quality: "official" | "research" | "low" | "unknown";
  legal_status: SourceLegalStatus;
  timestamp_precision: "datetime" | "date" | "unknown";
  status: "ELIGIBLE" | "NOT_ELIGIBLE" | "UNAVAILABLE" | "BLOCKED";
  /** Scrape/meteo stay false; official prematch may be true when clock-proven. */
  enters_independent_model: boolean;
};

/**
 * Unified pre-match feature observation (report data contract).
 * available_at must be demonstrable — never invent EXACT clocks.
 */
export type PrematchFeatureObservation = {
  event_id: string;
  event_time: string | null;
  decision_time?: string | null;
  source_id: string;
  feature_name: string;
  feature_value: number | string | boolean | null;
  source_published_at: string | null;
  retrieved_at: string;
  available_at: string | null;
  feature_time: string | null;
  quality: "ok" | "confirmed" | "conflict" | "missing" | "low_confidence" | "not_eligible" | "unknown";
  timestamp_precision: "datetime" | "date" | "unknown";
  enters_independent_model: boolean;
  legal_status?: SourceLegalStatus;
};

export type SynthesisResult = {
  event_id: string;
  source_count: number;
  source_agreement: number;
  status: "AGREE" | "CONFLICT" | "SINGLE_SOURCE" | "INSUFFICIENT";
  feature_quality: "HIGH" | "MEDIUM" | "LOW";
  reason_codes: string[];
  conflicts: Array<{ field: string; sources: string[]; detail: string }>;
  timestamp_quality: number;
  data_coverage: number | null;
  real_money: false;
};

export type DataIntelligenceAuditResult = {
  at: string;
  labBRoot: string;
  sample_n: number;
  clubelo_cache_present: boolean;
  test_scrape_enabled: boolean;
  scrape_enters_model: false;
  real_money: false;
  independent_markets: "1X2_ONLY";
  scraping_disabled: boolean;
  paths: Record<string, string>;
};
