/**
 * Always-on free acquisition engine types.
 * Research-layer observations never claim independent-model entry.
 */

export type AcquisitionJobStatus =
  | "OK"
  | "PARTIAL"
  | "BLOCKED"
  | "RATE_LIMITED"
  | "NO_DATA"
  | "NO_EVENT"
  | "AUTH_REQUIRED"
  | "PARSE_ERROR"
  | "NETWORK_ERROR"
  | "SKIPPED";

export type AcquisitionKind =
  | "ratings"
  | "fixtures"
  | "results"
  | "research_dataset"
  | "meta"
  | "news"
  | "catalog"
  | "market";

export type AcquisitionTemporalPrecision =
  | "exact"
  | "date_only"
  | "unknown"
  | "dataset_window";

export type AcquisitionFeatureStatus =
  | "VALID"
  | "NOT_ELIGIBLE"
  | "TEMPORAL_UNKNOWN"
  | "CONTEXT";

export type AcquisitionJob = {
  source_id: string;
  kind: AcquisitionKind;
  url: string;
  label: string;
  league?: string | null;
};

export type AcquisitionRecord = {
  source_id: string;
  kind: AcquisitionKind;
  feature_key: string;
  value: number | string | null;
  event_id: string | null;
  home: string | null;
  away: string | null;
  kickoff_iso: string | null;
  team_name: string | null;
  observed_at: string;
  available_at: string | null;
  temporal_precision: AcquisitionTemporalPrecision;
  feature_status: AcquisitionFeatureStatus;
  enters_independent_model: false;
  extraction_method: string;
  source_url: string;
  identity_status: string;
  reason_it: string | null;
};

export type SourceLaneResult = {
  source_id: string;
  ok: boolean;
  fetched: boolean;
  status: AcquisitionJobStatus;
  http_status: number | null;
  url: string;
  records: AcquisitionRecord[];
  fields_extracted: string[];
  reason: string;
  reason_it: string;
  retries: number;
  cache_path: string | null;
  neon: {
    source_registered: boolean;
    elo_stored: number;
    features_stored: number;
    reason: string | null;
  };
  /** Optional honest coverage (leagues/sports parsed). Never invented. */
  coverage?: {
    leagues: string[];
    sports?: string[];
    market_quotes?: number;
  };
};

export type AcquisitionCycleInput = {
  nowIso?: string;
  cwd?: string;
  persistNeon?: boolean;
  /** Persist compare-only quotes into Lab B quotes.jsonl (never MODEL). */
  persistLabB?: boolean;
  labBRoot?: string;
  fetchImpl?: typeof fetch;
  /** Skip live HTTP; adapters use fixtures when provided. */
  fixtures?: AcquisitionFixtures;
  maxRetries?: number;
  labEvents?: Array<{
    event_id: string;
    home: string;
    away: string;
    kickoff_utc?: string | null;
    competition?: string | null;
  }>;
};

export type AcquisitionFixtures = {
  clubeloCsv?: string;
  openligaJson?: string;
  theSportsDbJson?: string;
  statsbombJson?: string;
  footballDataCoUkCsv?: string;
  rssXml?: string;
  espnJson?: string;
  openFootballJson?: string;
  apiFootballJson?: string;
  oddsApiJson?: string;
};

export type AcquisitionCycleResult = {
  at: string;
  sources_ok: number;
  sources_failed: number;
  sources_blocked: number;
  records: number;
  neon_sources: string[];
  lanes: SourceLaneResult[];
  blocked_audit: Array<{
    source_id: string;
    status: string;
    reason_it: string;
  }>;
  coverage: {
    sources_ok: string[];
    sources_failed: string[];
    sources_auth_required: string[];
    sources_blocked: string[];
    leagues: string[];
    sports: string[];
    market_quotes: number;
  };
};
