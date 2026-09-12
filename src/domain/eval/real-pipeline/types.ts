/**
 * Unified vertical-slice types. Statuses are honest; never map UNAVAILABLE → ACTIVE.
 */

export const SOURCE_RESULT_STATUSES = [
  "ACTIVE",
  "PARTIAL",
  "UNAVAILABLE",
  "BLOCKED",
  "NOT_CONFIGURED",
  "ERROR",
] as const;

export type SourceResultStatus = (typeof SOURCE_RESULT_STATUSES)[number];

export type SourceResult = {
  source_id: string;
  status: SourceResultStatus;
  fetched: boolean;
  http_status: number | null;
  fields_extracted: string[];
  records: number;
  reason: string;
  configured: boolean;
  env_var: string | null;
  enters_independent_model: false | true;
  role: "IDENTITY" | "MODEL_FEATURE" | "MARKET_COMPARE" | "CONTEXT";
};

export type SnapshotFieldProvenance = {
  source_id: string;
  observed_at: string | null;
  available_at: string | null;
  extraction_method: string;
  epistemic_kind: "FACT" | "QUANTITATIVE_EVIDENCE" | "INFERENCE" | "MODEL_JUDGMENT";
};

export type AsOfSnapshotField = {
  key: string;
  value: number | string | boolean | null;
  provenance: SnapshotFieldProvenance;
  enters_model: boolean;
  temporal_precision: "exact" | "date_only" | "unknown";
};

export type AsOfSnapshot = {
  event_id: string;
  asOf: string;
  kickoff_utc: string;
  home: string;
  away: string;
  competition: string;
  fields: AsOfSnapshotField[];
  market_fields: AsOfSnapshotField[];
  blockedByTemporal: AsOfSnapshotField[];
  ft_score: null;
};

export type SliceDecision = "BET" | "WATCH" | "NO BET" | "INSUFFICIENT DATA";

export type SlicePublishStatus =
  | "LOCAL_OK"
  | "REMOTE_OK"
  | "DOSSIER_NOT_MIRRORED"
  | "BLOB_NOT_CONFIGURED"
  | "PUBLISH_ERROR";

export type RealPipelineReport = {
  at: string;
  neon_in_use: false;
  event: {
    event_id: string;
    home: string;
    away: string;
    competition: string;
    kickoff_utc: string | null;
    sport: string;
    source: string;
    status: string;
    future: boolean;
  } | null;
  source_coverage: SourceResult[];
  feature_coverage: number | null;
  data_coverage: number | null;
  model: {
    version: string;
    ok: boolean;
    reason_codes: string[];
  };
  probs: Record<string, number> | null;
  market: Record<string, number> | null;
  edge: number | null;
  decision: SliceDecision;
  decision_raw: string | null;
  dossier_id: string | null;
  dossier_state: "ok" | "local_only" | "missing";
  publish: {
    status: SlicePublishStatus;
    local_verified: boolean;
    remote_verified: boolean;
    reason: string | null;
    backend: "vercel_blob" | "memory" | "none";
  };
  remote_board: "OK" | "DOSSIER_NOT_MIRRORED" | "BLOB_NOT_CONFIGURED" | "ERROR";
  blocked_by: Array<{ env_var?: string; service: string; code: string; detail: string }>;
  errors: string[];
};
