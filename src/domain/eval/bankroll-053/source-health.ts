/**
 * Source registry health — candidates documented, not assumed scrapable.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { ODDS_API_ADAPTER_NAME_053 } from "@/domain/eval/bankroll-053/source-adapter";
import { buildApiSportsHealth057 } from "@/domain/data-sources/api-sports/health";

export type SourceHealthRow053 = {
  source: string;
  sport: string;
  type: "API" | "CATALOG_CANDIDATE" | "STATS_CANDIDATE";
  availability: "AVAILABLE" | "EMPTY_WINDOW" | "PROVIDER_UNAVAILABLE" | "DISABLED_BY_POLICY" | "ERROR";
  last_success: string | null;
  last_error: string | null;
  events_found: number;
  markets_found: number;
  request_count: number;
  estimated_cost: string | null;
  legal_access_status: "ALLOWED_API" | "CANDIDATE_REVIEW_REQUIRED" | "DENIED_BY_POLICY";
};

const CANDIDATES: Omit<SourceHealthRow053, "last_success" | "last_error" | "events_found" | "markets_found" | "request_count">[] = [
  {
    source: ODDS_API_ADAPTER_NAME_053,
    sport: "MULTI",
    type: "API",
    availability: "AVAILABLE",
    estimated_cost: "credits",
    legal_access_status: "ALLOWED_API",
  },
  {
    source: "Diretta",
    sport: "MULTI",
    type: "CATALOG_CANDIDATE",
    availability: "DISABLED_BY_POLICY",
    estimated_cost: null,
    legal_access_status: "DENIED_BY_POLICY",
  },
  {
    source: "SofaScore",
    sport: "MULTI",
    type: "CATALOG_CANDIDATE",
    availability: "DISABLED_BY_POLICY",
    estimated_cost: null,
    legal_access_status: "DENIED_BY_POLICY",
  },
  {
    source: "SoccerVista",
    sport: "SOCCER",
    type: "STATS_CANDIDATE",
    availability: "DISABLED_BY_POLICY",
    estimated_cost: null,
    legal_access_status: "CANDIDATE_REVIEW_REQUIRED",
  },
  {
    source: "SoccerVital",
    sport: "SOCCER",
    type: "STATS_CANDIDATE",
    availability: "DISABLED_BY_POLICY",
    estimated_cost: null,
    legal_access_status: "CANDIDATE_REVIEW_REQUIRED",
  },
  {
    source: "OddsPedia",
    sport: "MULTI",
    type: "CATALOG_CANDIDATE",
    availability: "DISABLED_BY_POLICY",
    estimated_cost: null,
    legal_access_status: "CANDIDATE_REVIEW_REQUIRED",
  },
  {
    source: "WhoScored",
    sport: "SOCCER",
    type: "STATS_CANDIDATE",
    availability: "DISABLED_BY_POLICY",
    estimated_cost: null,
    legal_access_status: "CANDIDATE_REVIEW_REQUIRED",
  },
  {
    source: "Understat",
    sport: "SOCCER",
    type: "STATS_CANDIDATE",
    availability: "DISABLED_BY_POLICY",
    estimated_cost: null,
    legal_access_status: "CANDIDATE_REVIEW_REQUIRED",
  },
  {
    source: "FBref",
    sport: "SOCCER",
    type: "STATS_CANDIDATE",
    availability: "DISABLED_BY_POLICY",
    estimated_cost: null,
    legal_access_status: "CANDIDATE_REVIEW_REQUIRED",
  },
  {
    source: "Tennis Explorer",
    sport: "TENNIS",
    type: "STATS_CANDIDATE",
    availability: "DISABLED_BY_POLICY",
    estimated_cost: null,
    legal_access_status: "CANDIDATE_REVIEW_REQUIRED",
  },
];

export function writeSourceHealth053(input: {
  root?: string;
  oddsEvents: number;
  oddsMarkets: number;
  oddsAvailability: SourceHealthRow053["availability"];
  nowIso?: string;
}): SourceHealthRow053[] {
  const root = input.root ?? permanentRoot044();
  const now = input.nowIso ?? new Date().toISOString();
  const rows: SourceHealthRow053[] = CANDIDATES.map((c) => {
    if (c.source === ODDS_API_ADAPTER_NAME_053) {
      return {
        ...c,
        availability: input.oddsAvailability,
        last_success: input.oddsEvents > 0 ? now : null,
        last_error: input.oddsEvents === 0 ? "EMPTY_OR_NO_LAB_B_EVENTS" : null,
        events_found: input.oddsEvents,
        markets_found: input.oddsMarkets,
        request_count: 0,
      };
    }
    return {
      ...c,
      last_success: null,
      last_error: "not_authorized_no_scrape",
      events_found: 0,
      markets_found: 0,
      request_count: 0,
    };
  });

  // TASK 057 — API-Sports real API (stats/fixtures), not a scrape candidate
  try {
    const h = buildApiSportsHealth057();
    const avail: SourceHealthRow053["availability"] =
      h.status === "AVAILABLE"
        ? "AVAILABLE"
        : h.status === "NOT_CONFIGURED"
          ? "PROVIDER_UNAVAILABLE"
          : h.status === "ERROR"
            ? "ERROR"
            : "PROVIDER_UNAVAILABLE";
    rows.push({
      source: "API-Sports",
      sport: "SOCCER",
      type: "API",
      availability: avail,
      estimated_cost: "100_req_day_free",
      legal_access_status: "ALLOWED_API",
      last_success: h.last_success,
      last_error: h.last_error ?? (h.key_configured ? null : "API_KEY_NOT_CONFIGURED"),
      events_found: h.data_types.includes("fixtures") ? 1 : 0,
      markets_found: h.data_types.includes("odds") ? 1 : 0,
      request_count: h.requests_today,
    });
  } catch {
    rows.push({
      source: "API-Sports",
      sport: "SOCCER",
      type: "API",
      availability: "PROVIDER_UNAVAILABLE",
      estimated_cost: "100_req_day_free",
      legal_access_status: "ALLOWED_API",
      last_success: null,
      last_error: "health_unavailable",
      events_found: 0,
      markets_found: 0,
      request_count: 0,
    });
  }

  mkdirSync(join(root, "manifests"), { recursive: true });
  writeFileSync(join(root, "manifests", "source-health.json"), JSON.stringify({ at: now, sources: rows }, null, 2));
  return rows;
}

export function loadSourceHealth053(root = permanentRoot044()): SourceHealthRow053[] {
  const p = join(root, "manifests", "source-health.json");
  if (!existsSync(p)) return [];
  try {
    const j = JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")) as { sources?: SourceHealthRow053[] };
    return j.sources ?? [];
  } catch {
    return [];
  }
}
