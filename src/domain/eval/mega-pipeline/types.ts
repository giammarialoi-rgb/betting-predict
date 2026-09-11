/**
 * Mega pipeline types — operational cycle truth, no invented metrics.
 */

export type PipelineVerdict = "PASS" | "PARTIAL" | "FAIL";

export type SourceRole =
  | "MODEL"
  | "CONTEXT"
  | "MARKET"
  | "LIVE_RESULT"
  | "ARCHIVE"
  | "DISCOVERY";

export type ObservedSourceStatus =
  | "OK"
  | "PARTIAL"
  | "NO_EVENT"
  | "NO_DATA"
  | "BLOCKED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "CHALLENGE"
  | "HTTP_ERROR"
  | "NOT_FOUND"
  | "MISSING_ADAPTER"
  | "NETWORK_ERROR"
  | "UNVERIFIED";

export type ResearchJobStatus =
  | "DISCOVERED"
  | "QUEUED"
  | "RESEARCHING"
  | "RESEARCHED"
  | "ANALYZED"
  | "LIVE"
  | "FINISHED"
  | "SETTLED";

export type PredictionCaseStatus =
  | "OPEN"
  | "LIVE"
  | "WON"
  | "LOST"
  | "VOID"
  | "PUSH"
  | "CANCELLED";

export type DataCategory =
  | "FORM"
  | "ATTACK"
  | "DEFENCE"
  | "XG"
  | "SHOTS"
  | "CORNERS"
  | "CARDS"
  | "H2H"
  | "ELO"
  | "INJURIES"
  | "LINEUPS"
  | "REFEREE"
  | "WEATHER"
  | "TACTICS"
  | "NEWS"
  | "MARKET"
  | "LIVE";

export type FreeFixtureCandidate = {
  source: string;
  source_event_id: string;
  sport: string;
  competition: string;
  home: string;
  away: string;
  kickoff_utc: string | null;
  kickoff_precision: "exact" | "date_only" | "unknown";
  finished: boolean;
  home_score: number | null;
  away_score: number | null;
  live: boolean;
  minute: number | null;
  source_url: string;
};

export type FreeDiscoverResult = {
  sources_tried: string[];
  fixtures_seen: number;
  events_inserted: number;
  events_updated: number;
  duplicates: number;
  identity_uncertain: number;
  by_source: Record<string, { seen: number; inserted: number; blocked?: boolean; http?: number | null }>;
  sample_event_ids: string[];
};

export type FreeSettleResult = {
  sources_tried: string[];
  candidates: number;
  settled: number;
  prediction_cases_updated: number;
  learning_cases: number;
  by_source: Record<string, number>;
  unresolved: number;
};

export type SourceProbeRow = {
  source_id: string;
  title: string;
  method: string;
  role: SourceRole;
  status: ObservedSourceStatus;
  http_status: number | null;
  url: string;
  bytes: number;
  events_found: number;
  fields_extracted: string[];
  latency_ms: number;
  observed_at: string;
  note: string;
  note_it: string;
};

export type SelfTestCheck = {
  id: string;
  verdict: PipelineVerdict;
  detail: string;
  detail_it: string;
};

export type SelfTestReport = {
  at: string;
  overall: PipelineVerdict;
  checks: SelfTestCheck[];
};
