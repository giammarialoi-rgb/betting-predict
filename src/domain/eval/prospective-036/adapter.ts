export type AdapterEvent036 = {
  source_event_id: string;
  competition: string;
  season: string | null;
  home_team: string;
  away_team: string;
  kickoff_at_utc: string;
};

export type AdapterQuote036 = {
  source_event_id: string;
  market: string;
  selection: string;
  odds_decimal: number;
  bookmaker: string;
  source_record_id: string;
  source_timestamp_utc: string | null;
};

export type AdapterPull036 = {
  source: string;
  status: "ok" | "SOURCE_UNAVAILABLE" | "error";
  error: string | null;
  requested_at_utc: string;
  received_at_utc: string | null;
  events: AdapterEvent036[];
  quotes: AdapterQuote036[];
  provenance: string;
  raw_hash?: string | null;
  raw_bytes?: number | null;
  raw_json?: unknown;
};

export type OddsSourceAdapter = {
  id: string;
  configured(): boolean;
  discoverEvents(): Promise<AdapterEvent036[]>;
  getEvent(sourceEventId: string): Promise<AdapterEvent036 | null>;
  getMarkets(sourceEventId: string): Promise<string[]>;
  getQuotes(sourceEventId?: string): Promise<AdapterQuote036[]>;
  getTimestamp(quote: AdapterQuote036): string | null;
  getKickoff(event: AdapterEvent036): string;
  getProvenance(): string;
  pull(input: { requestedAtUtc: string }): Promise<AdapterPull036>;
};

export function unavailablePull(source: string, requestedAtUtc: string, why: string): AdapterPull036 {
  return {
    source,
    status: "SOURCE_UNAVAILABLE",
    error: why,
    requested_at_utc: requestedAtUtc,
    received_at_utc: null,
    events: [],
    quotes: [],
    provenance: why,
  };
}
