/**
 * Standard per-source research attempt. Homepage HTTP 200 is never SUCCESS.
 */
export type SourceAttemptStatus =
  | "SUCCESS"
  | "PARTIAL"
  | "NO_EVENT"
  | "WRONG_EVENT"
  | "AMBIGUOUS_EVENT"
  | "BLOCKED"
  | "AUTH_REQUIRED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "MISSING_ADAPTER"
  | "DYNAMIC_CONTENT_UNAVAILABLE"
  | "NO_DATA"
  | "POLICY_DISABLED";

export type SourceAttempt = {
  source: string;
  event_id: string;
  attempted_at: string;
  status: SourceAttemptStatus;
  url: string | null;
  http_status: number | null;
  event_matched: boolean;
  fields_found: string[];
  fields_missing: string[];
  observations_count: number;
  error: string | null;
  available_at: string | null;
  confidence: number | null;
};

export function isTypedSuccess(fields: string[]): boolean {
  return fields.some(
    (f) => f !== "page_mentions_both_teams" && f !== "page_mentions_xg" && !f.startsWith("page_mentions_"),
  );
}
