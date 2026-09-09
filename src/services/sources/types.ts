/**
 * Shared SportsSourceAdapter — multi-source discovery contract.
 * Catalog sources ≠ odds sources. Never bypass anti-bot / CAPTCHA / login.
 */

export type SourceRuntimeStatus055 =
  | "ACTIVE"
  | "DISABLED_BY_POLICY"
  | "UNAVAILABLE"
  | "RATE_LIMITED"
  | "EMPTY"
  | "ERROR";

export type SportsSourceId055 =
  | "THE_ODDS_API"
  | "SOFASCORE"
  | "FLASHSCORE"
  | "SOCCERWAY"
  | "DIRECTA"
  | "OTHER";

export type Horizon055 = "TODAY" | "NEXT_24H" | "NEXT_72H" | "NEXT_7D" | "NEXT_30D";

export type SourceEvent055 = {
  source_id: SportsSourceId055;
  source_event_id: string;
  sport: string;
  competition: string | null;
  country: string | null;
  home: string;
  away: string;
  commence_time: string | null;
  event_status: string | null;
  ingested_at: string;
  available_at: string;
  source_published_at: string | null;
  content_hash: string;
  raw_ref?: string | null;
};

export type ProvenanceField055<T = unknown> = {
  field: string;
  value: T;
  source: SportsSourceId055 | string;
  observed_at: string;
  available_at: string;
  confidence: number | null;
};

export type SourceHealth055 = {
  sourceId: SportsSourceId055;
  status: SourceRuntimeStatus055;
  enabled: boolean;
  last_success_at: string | null;
  last_error: string | null;
  events_discovered: number;
  events_matched: number;
  quotes: number;
  markets: number;
  api_calls: number;
  rate_limit_note: string | null;
  last_update: string | null;
  reason: string | null;
};

export type SportsSourceAdapter = {
  sourceId: SportsSourceId055;
  enabled(): boolean;
  health(): SourceHealth055;
  discoverEvents(input?: {
    sport?: string;
    horizon?: Horizon055;
  }): Promise<{
    events: SourceEvent055[];
    status: SourceRuntimeStatus055;
    error: string | null;
  }>;
  fetchEventDetails(sourceEventId: string): Promise<{
    detail: Record<string, ProvenanceField055> | null;
    status: SourceRuntimeStatus055;
    error: string | null;
  }>;
  fetchMarkets(sourceEventId: string): Promise<{
    markets: ProvenanceField055[];
    status: SourceRuntimeStatus055;
    error: string | null;
  }>;
  fetchStatistics(sourceEventId: string): Promise<{
    statistics: ProvenanceField055[];
    status: SourceRuntimeStatus055;
    error: string | null;
  }>;
  fetchResults(sourceEventId: string): Promise<{
    result: ProvenanceField055 | null;
    status: SourceRuntimeStatus055;
    error: string | null;
  }>;
};

export function envFlagTrue055(name: string): boolean {
  const v = (process.env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
