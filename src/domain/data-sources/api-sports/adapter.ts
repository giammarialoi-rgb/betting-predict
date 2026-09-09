/**
 * API-Sports source adapter — data foundation only.
 * Does not feed DecisionEngine / MODEL_v2.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { apiSportsGet057 } from "@/domain/data-sources/api-sports/client";
import { apiSportsRoot057, getApiSportsKey057 } from "@/domain/data-sources/api-sports/config";
import { normalizeFixtures057 } from "@/domain/data-sources/api-sports/normalize";
import { buildApiSportsHealth057 } from "@/domain/data-sources/api-sports/health";
import { emptyIndependentContract057 } from "@/domain/data-sources/api-sports/contract";
import type { ApiSportsNormalizedEvent057 } from "@/domain/data-sources/api-sports/types";

export type ApiSportsAdapter057 = {
  sourceId: "API_SPORTS";
  enabled(): boolean;
  health(): ReturnType<typeof buildApiSportsHealth057>;
  /** Fetch a small window of fixtures — budget-aware; never bulk. */
  fetchFixturesSample(input?: { leagueId?: number; next?: number }): Promise<{
    events: ApiSportsNormalizedEvent057[];
    status: string;
    error: string | null;
    requests_charged: number;
  }>;
  /** Explicit: does not produce bets */
  decisionContract(): ReturnType<typeof emptyIndependentContract057>;
};

export function createApiSportsAdapter057(): ApiSportsAdapter057 {
  return {
    sourceId: "API_SPORTS",
    enabled() {
      return Boolean(getApiSportsKey057());
    },
    health() {
      return buildApiSportsHealth057();
    },
    async fetchFixturesSample(input = {}) {
      if (!getApiSportsKey057()) {
        return { events: [], status: "NOT_CONFIGURED", error: "API_KEY_NOT_CONFIGURED", requests_charged: 0 };
      }
      const leagueId = input.leagueId ?? 39;
      const season = 2024; // Free plan seasons 2022–2024
      const path = `/fixtures?league=${leagueId}&season=${season}`;
      const res = await apiSportsGet057(path, { useCacheMs: 6 * 3600_000 });
      if (!res.ok) {
        return {
          events: [],
          status: res.error ?? "ERROR",
          error: res.error,
          requests_charged: res.requests_charged,
        };
      }
      const all = normalizeFixtures057(res.body);
      const events = all.slice(0, Math.min(input.next ?? 3, 5));
      const root = apiSportsRoot057();
      mkdirSync(root, { recursive: true });
      writeFileSync(
        join(root, "normalized-events-sample.json"),
        JSON.stringify(
          {
            at: new Date().toISOString(),
            note: "sample_only",
            total_in_response: all.length,
            events,
          },
          null,
          2,
        ),
      );
      return {
        events,
        status: events.length ? "AVAILABLE" : "EMPTY_WINDOW",
        error: null,
        requests_charged: res.requests_charged,
      };
    },
    decisionContract() {
      return emptyIndependentContract057();
    },
  };
}
