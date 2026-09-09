/**
 * SportAdapter — multi-sport discovery without rewriting DecisionEngine.
 * Provider status must never collapse UNAVAILABLE into silent zero events.
 */

import {
  SPORT_FAMILY_ADAPTERS_049,
  type SportFamilyAdapter049,
} from "@/domain/eval/factory-049/adapters";
import { ODDS_API_ADAPTER_NAME_053 } from "@/domain/eval/bankroll-053/source-adapter";

export type SportAdapterStatus053 =
  | "AVAILABLE"
  | "EMPTY_WINDOW"
  | "PROVIDER_UNAVAILABLE"
  | "RATE_LIMITED"
  | "BUDGET_BLOCKED"
  | "ERROR";

export type SportAdapter053 = {
  sport: string;
  provider: string;
  availability: SportAdapterStatus053;
  supportedMarkets: string[];
  costEstimate: "LOW" | "MEDIUM" | "HIGH";
  rateLimit: string;
  status: SportAdapterStatus053;
  keyPrefixes: string[];
  discoverEvents(): Promise<{ events: unknown[]; status: SportAdapterStatus053; note: string | null }>;
  fetchMarkets(): Promise<{ markets: string[]; status: SportAdapterStatus053 }>;
  fetchScores(): Promise<{ scores: unknown[]; status: SportAdapterStatus053; note: string | null }>;
  normalizeEvent(raw: Record<string, unknown>): Record<string, unknown>;
  normalizeMarket(raw: Record<string, unknown>): Record<string, unknown>;
};

function marketsList(adapter: SportFamilyAdapter049): string[] {
  return adapter.marketsRequest.split(",").map((s) => s.trim()).filter(Boolean);
}

export function createSportAdapter053(
  family: SportFamilyAdapter049,
  runtime: {
    availability: SportAdapterStatus053;
    note?: string | null;
    keysActive?: number;
  },
): SportAdapter053 {
  const markets = marketsList(family);
  const status = runtime.availability;
  return {
    sport: family.family.toUpperCase(),
    provider: ODDS_API_ADAPTER_NAME_053,
    availability: status,
    supportedMarkets: markets,
    costEstimate: family.family === "soccer" ? "MEDIUM" : "LOW",
    rateLimit: "budget_governor_049",
    status,
    keyPrefixes: family.keyPrefixes,
    async discoverEvents() {
      return {
        events: [],
        status,
        note:
          runtime.note ??
          (status === "PROVIDER_UNAVAILABLE"
            ? `${family.family}_PROVIDER_UNAVAILABLE`
            : status === "EMPTY_WINDOW"
              ? "provider_ok_no_events_in_window"
              : null),
      };
    },
    async fetchMarkets() {
      return { markets, status };
    },
    async fetchScores() {
      return {
        scores: [],
        status: status === "AVAILABLE" || status === "EMPTY_WINDOW" ? "EMPTY_WINDOW" : status,
        note: "scores_via_settlement_pipeline_only",
      };
    },
    normalizeEvent(raw) {
      return {
        sport: family.family,
        home: raw.home_team ?? raw.home ?? raw.home_or_a ?? null,
        away: raw.away_team ?? raw.away ?? raw.away_or_b ?? null,
        kickoff: raw.commence_time ?? raw.kickoff_utc ?? null,
        source: ODDS_API_ADAPTER_NAME_053,
        provider_key: raw.sport_key ?? null,
      };
    },
    normalizeMarket(raw) {
      return {
        market: raw.market ?? raw.key ?? null,
        selection: raw.name ?? raw.selection ?? null,
        price: raw.price ?? null,
        bookmaker: raw.bookmaker ?? null,
        source: ODDS_API_ADAPTER_NAME_053,
      };
    },
  };
}

/** Build adapters for core sports + extensibility families. */
export function buildSportAdapters053(input: {
  familyStatus: Record<string, SportAdapterStatus053>;
  notes?: Record<string, string | null>;
}): SportAdapter053[] {
  const core = [...SPORT_FAMILY_ADAPTERS_049];
  // Extensibility stubs (no Odds key prefixes yet → PROVIDER_UNAVAILABLE, not silent 0)
  const extensible: SportFamilyAdapter049[] = [
    {
      family: "baseball",
      keyPrefixes: ["baseball_"],
      groupHints: ["Baseball"],
      marketsRequest: "h2h,spreads,totals",
      priority: 90,
    },
    {
      family: "american_football",
      keyPrefixes: ["americanfootball_"],
      groupHints: ["American Football"],
      marketsRequest: "h2h,spreads,totals",
      priority: 91,
    },
    {
      family: "rugby",
      keyPrefixes: ["rugby_"],
      groupHints: ["Rugby"],
      marketsRequest: "h2h,totals",
      priority: 92,
    },
    {
      family: "handball",
      keyPrefixes: ["handball_"],
      groupHints: ["Handball"],
      marketsRequest: "h2h,totals",
      priority: 93,
    },
    {
      family: "table_tennis",
      keyPrefixes: ["tabletennis_"],
      groupHints: ["Table Tennis"],
      marketsRequest: "h2h",
      priority: 94,
    },
    {
      family: "mma",
      keyPrefixes: ["mma_"],
      groupHints: ["MMA"],
      marketsRequest: "h2h",
      priority: 95,
    },
  ];

  return [...core, ...extensible].map((f) =>
    createSportAdapter053(f, {
      availability: input.familyStatus[f.family] ?? "PROVIDER_UNAVAILABLE",
      note: input.notes?.[f.family] ?? null,
    }),
  );
}

export function mapDiagToAdapterStatus053(
  diag:
    | "ACTIVE_DATA"
    | "ACTIVE_EMPTY"
    | "INACTIVE"
    | "UNAVAILABLE"
    | "BUDGET_BLOCKED"
    | "RATE_LIMITED"
    | "ERROR"
    | "UNKNOWN",
): SportAdapterStatus053 {
  switch (diag) {
    case "ACTIVE_DATA":
      return "AVAILABLE";
    case "ACTIVE_EMPTY":
      return "EMPTY_WINDOW";
    case "UNAVAILABLE":
    case "INACTIVE":
    case "UNKNOWN":
      return "PROVIDER_UNAVAILABLE";
    case "BUDGET_BLOCKED":
      return "BUDGET_BLOCKED";
    case "RATE_LIMITED":
      return "RATE_LIMITED";
    case "ERROR":
      return "ERROR";
    default:
      return "PROVIDER_UNAVAILABLE";
  }
}
