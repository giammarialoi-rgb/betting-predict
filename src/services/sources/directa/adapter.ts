/**
 * DirectaAdapter — event catalog source (independent from odds).
 * Default: DISABLED_BY_POLICY. Never bypasses protections.
 */

import {
  resolveDirectaPolicy054,
  type DirectaPolicyStatus054,
} from "@/services/sources/directa/compliance";

export type DirectaSport054 =
  | "SOCCER"
  | "TENNIS"
  | "BASKETBALL"
  | "VOLLEYBALL"
  | "HOCKEY"
  | "BASEBALL"
  | "HANDBALL"
  | "RUGBY"
  | "AMERICAN_FOOTBALL"
  | "TABLE_TENNIS"
  | "DARTS"
  | "MOTORSPORT"
  | "CYCLING"
  | "OTHER";

export type DirectaSportStatus054 =
  | "ACTIVE"
  | "EMPTY"
  | "UNAVAILABLE"
  | "BLOCKED"
  | "DISABLED_BY_POLICY"
  | "ERROR";

export type DirectaCatalogEvent054 = {
  source: "DIRECTA";
  source_event_id: string;
  sport: DirectaSport054;
  country: string | null;
  competition: string | null;
  league: string | null;
  season: string | null;
  round: string | null;
  event_name: string;
  participant_1: string;
  participant_2: string;
  kickoff_utc: string | null;
  event_status: string;
  ingested_at: string;
  available_at: string;
  source_published_at: string | null;
  content_hash: string;
};

export type DirectaHealth054 = {
  source: "DIRECTA";
  policy_status: DirectaPolicyStatus054;
  status: DirectaSportStatus054;
  enabled: boolean;
  scraping_enabled: boolean;
  last_success_at: string | null;
  last_request_at: string | null;
  last_error: string | null;
  reason: string;
  events_discovered: number;
  rate_limit: {
    min_interval_ms: number;
    max_concurrency: number;
    max_retries: number;
    timeout_ms: number;
  };
};

export type DirectaAdapter054 = {
  name: "DirectaAdapter";
  health(): DirectaHealth054;
  discoverSports(): Promise<{
    sports: { sport: DirectaSport054; status: DirectaSportStatus054; note: string | null }[];
    error: string | null;
  }>;
  discoverCompetitions(sport: DirectaSport054): Promise<{ competitions: string[]; error: string | null }>;
  discoverEvents(input?: {
    sport?: DirectaSport054;
    horizon?: "TODAY" | "NEXT_24H" | "NEXT_72H" | "NEXT_7D";
  }): Promise<{ events: DirectaCatalogEvent054[]; error: string | null; status: DirectaSportStatus054 }>;
  discoverEventDetails(sourceEventId: string): Promise<{ detail: Record<string, unknown> | null; error: string | null }>;
  discoverMarkets(sourceEventId: string): Promise<{ markets: unknown[]; error: string | null }>;
  discoverOdds(sourceEventId: string): Promise<{ odds: unknown[]; error: string | null }>;
  discoverAnalysis(sourceEventId: string): Promise<{ analysis: unknown[]; error: string | null }>;
};

export function createDirectaAdapter054(): DirectaAdapter054 {
  const policy = resolveDirectaPolicy054();
  // Compliance: never invoke network scrape while policy denies.

  const health = (): DirectaHealth054 => ({
    source: "DIRECTA",
    policy_status: policy.policy_status,
    status: policy.policy_status === "DISABLED_BY_POLICY" ? "DISABLED_BY_POLICY" : "BLOCKED",
    enabled: policy.enabled,
    scraping_enabled: policy.scraping_enabled,
    last_success_at: null,
    last_request_at: null,
    last_error: null,
    reason: policy.reason,
    events_discovered: 0,
    rate_limit: {
      min_interval_ms: policy.min_interval_ms,
      max_concurrency: policy.max_concurrency,
      max_retries: policy.max_retries,
      timeout_ms: policy.timeout_ms,
    },
  });

  const disabledSports = (): { sport: DirectaSport054; status: DirectaSportStatus054; note: string | null }[] =>
    (
      [
        "SOCCER",
        "TENNIS",
        "BASKETBALL",
        "VOLLEYBALL",
        "HOCKEY",
        "BASEBALL",
        "HANDBALL",
        "RUGBY",
        "AMERICAN_FOOTBALL",
        "TABLE_TENNIS",
        "DARTS",
        "MOTORSPORT",
        "CYCLING",
        "OTHER",
      ] as DirectaSport054[]
    ).map((sport) => ({
      sport,
      status: "DISABLED_BY_POLICY" as const,
      note: policy.reason,
    }));

  return {
    name: "DirectaAdapter",
    health,
    async discoverSports() {
      if (!policy.enabled || !policy.scraping_enabled) {
        return { sports: disabledSports(), error: null };
      }
      return {
        sports: disabledSports().map((s) => ({ ...s, status: "BLOCKED" as const })),
        error: "DIRECTA live fetch not authorized — compliance firewall",
      };
    },
    async discoverCompetitions() {
      return { competitions: [], error: policy.reason };
    },
    async discoverEvents() {
      // No network scrape while DISABLED_BY_POLICY — lab continues with other adapters
      return {
        events: [],
        error: null,
        status: "DISABLED_BY_POLICY",
      };
    },
    async discoverEventDetails() {
      return { detail: null, error: policy.reason };
    },
    async discoverMarkets() {
      return { markets: [], error: policy.reason };
    },
    async discoverOdds() {
      return { odds: [], error: policy.reason };
    },
    async discoverAnalysis() {
      return { analysis: [], error: policy.reason };
    },
  };
}
