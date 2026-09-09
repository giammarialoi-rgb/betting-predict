/**
 * Capability discovery — minimal API-Sports requests.
 * Free plan constraints (verified): seasons 2022–2024; no `next` on fixtures.
 * Never invent AVAILABLE; PLAN_LIMITED is success-path for Free gaps.
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { apiSportsGet057 } from "@/domain/data-sources/api-sports/client";
import { apiSportsRoot057, getApiSportsKey057, redactSecrets057 } from "@/domain/data-sources/api-sports/config";
import { canSpend057, loadBudget057 } from "@/domain/data-sources/api-sports/budget";
import { normalizeFixtures057, topLevelFields057 } from "@/domain/data-sources/api-sports/normalize";
import type {
  ApiSportsCapabilityRow057,
  ApiSportsCapabilityStatus057,
  ApiSportsEndpointId057,
} from "@/domain/data-sources/api-sports/types";

/** Free plan verified window */
const FREE_SEASON_057 = 2024;
const FREE_LEAGUE_057 = 39; // Premier League

function classifyResult(input: {
  http: number | null;
  error: string | null;
  errors_api: string[];
}): ApiSportsCapabilityStatus057 {
  if (input.error === "API_KEY_NOT_CONFIGURED") return "UNAVAILABLE";
  if (input.error === "DAY_BUDGET_EXHAUSTED" || input.error === "MINUTE_RATE_LIMIT" || input.error === "SKIPPED_BUDGET") {
    return "SKIPPED_BUDGET";
  }
  if (input.error === "RATE_LIMITED" || input.http === 429) return "RATE_LIMITED";
  if (input.error === "PLAN_LIMITED" || input.errors_api.some((e) => /plan|subscription|upgrade|not available/i.test(e))) {
    return "PLAN_LIMITED";
  }
  if (input.error === "TIMEOUT") return "ERROR";
  if (input.http != null && input.http >= 500) return "ERROR";
  if (input.http != null && input.http >= 400) return "ERROR";
  if (input.http === 200) return "AVAILABLE";
  if (input.error) return "ERROR";
  return "UNAVAILABLE";
}

async function probe(
  id: ApiSportsEndpointId057,
  path: string,
  opts: { forceNetwork?: boolean; useCacheMs?: number } = {},
): Promise<ApiSportsCapabilityRow057 & { body?: unknown }> {
  const spend = canSpend057(1);
  if (!spend.ok) {
    return {
      endpoint: id,
      path,
      sport: "football",
      status: "SKIPPED_BUDGET",
      tested_at: new Date().toISOString(),
      http_status: null,
      requests_used: 0,
      error: spend.reason,
      fields_available: [],
    };
  }
  const res = await apiSportsGet057(path, {
    forceNetwork: opts.forceNetwork,
    useCacheMs: opts.useCacheMs ?? 6 * 3600_000,
  });
  const status = classifyResult({
    http: res.http_status,
    error: res.error,
    errors_api: res.errors_api,
  });
  return {
    endpoint: id,
    path,
    sport: "football",
    status,
    tested_at: new Date().toISOString(),
    http_status: res.http_status,
    requests_used: res.requests_charged,
    error: res.error ? redactSecrets057(res.error) : null,
    fields_available: topLevelFields057(res.body),
    body: res.body,
  };
}

export type CapabilityDiscoveryReport057 = {
  at: string;
  source: "API_SPORTS";
  key_configured: boolean;
  requests_this_run: number;
  budget: ReturnType<typeof loadBudget057>;
  capabilities: ApiSportsCapabilityRow057[];
  normalized_events: number;
  sample_fixture_id: string | null;
  free_season_used: number;
  open_task_058: false;
  real_money: false;
};

/**
 * Minimal discovery (~8–12 charged requests if cache cold).
 * Uses Free-compatible season 2024 + league 39.
 */
export async function runCapabilityDiscovery057(input: {
  force?: boolean;
  maxRequests?: number;
} = {}): Promise<CapabilityDiscoveryReport057> {
  const root = apiSportsRoot057();
  mkdirSync(root, { recursive: true });
  const keyConfigured = Boolean(getApiSportsKey057());
  const caps: ApiSportsCapabilityRow057[] = [];
  let charged = 0;
  const maxReq = input.maxRequests ?? 12;
  const season = FREE_SEASON_057;
  const leagueId = FREE_LEAGUE_057;

  const push = async (row: ApiSportsCapabilityRow057 & { body?: unknown }) => {
    const { body: _b, ...pub } = row;
    caps.push(pub);
    charged += row.requests_used;
    return row;
  };

  if (!keyConfigured) {
    const empty: CapabilityDiscoveryReport057 = {
      at: new Date().toISOString(),
      source: "API_SPORTS",
      key_configured: false,
      requests_this_run: 0,
      budget: loadBudget057(root),
      capabilities: [
        {
          endpoint: "status",
          path: "/status",
          sport: "football",
          status: "UNAVAILABLE",
          tested_at: new Date().toISOString(),
          http_status: null,
          requests_used: 0,
          error: "API_KEY_NOT_CONFIGURED",
          fields_available: [],
        },
      ],
      normalized_events: 0,
      sample_fixture_id: null,
      free_season_used: season,
      open_task_058: false,
      real_money: false,
    };
    writeFileSync(join(root, "capabilities.json"), JSON.stringify(empty, null, 2));
    return empty;
  }

  await push(await probe("status", "/status", { forceNetwork: input.force, useCacheMs: input.force ? 0 : 3600_000 }));
  if (charged >= maxReq) return finalize(root, caps, charged, 0, null, season);

  await push(await probe("leagues", "/leagues?current=true", { useCacheMs: 12 * 3600_000 }));
  if (charged >= maxReq) return finalize(root, caps, charged, 0, null, season);

  // Free: no `next` param — use season window (2022–2024)
  const fixPath = `/fixtures?league=${leagueId}&season=${season}`;
  const fixRow = await push(
    await probe("fixtures", fixPath, { useCacheMs: input.force ? 0 : 6 * 3600_000 }),
  );

  let sampleFixtureId: string | null = null;
  let homeId: number | null = null;
  let awayId: number | null = null;
  let normalized = 0;

  if (fixRow.body) {
    const events = normalizeFixtures057(fixRow.body);
    const sample = events.slice(0, 5);
    normalized = sample.length;
    if (sample[0]) {
      sampleFixtureId = sample[0].provider_event_id;
      homeId = sample[0].home_team_id;
      awayId = sample[0].away_team_id;
      writeFileSync(
        join(root, "normalized-events-sample.json"),
        JSON.stringify(
          {
            at: new Date().toISOString(),
            note: "sample_only_not_full_season",
            season,
            league_id: leagueId,
            total_in_response: events.length,
            events: sample,
          },
          null,
          2,
        ),
      );
    }
  }

  if (homeId != null && charged < maxReq) {
    await push(await probe("teams", `/teams?id=${homeId}`, { useCacheMs: 24 * 3600_000 }));
  } else {
    caps.push({
      endpoint: "teams",
      path: "/teams",
      sport: "football",
      status: "NOT_TESTED",
      tested_at: null,
      http_status: null,
      requests_used: 0,
      error: "no_team_id_from_fixture",
      fields_available: [],
    });
  }

  if (charged < maxReq) {
    await push(
      await probe("standings", `/standings?league=${leagueId}&season=${season}`, {
        useCacheMs: 12 * 3600_000,
      }),
    );
  }

  if (homeId != null && charged < maxReq) {
    await push(
      await probe(
        "teams_statistics",
        `/teams/statistics?league=${leagueId}&season=${season}&team=${homeId}`,
        { useCacheMs: 12 * 3600_000 },
      ),
    );
  } else {
    caps.push({
      endpoint: "teams_statistics",
      path: "/teams/statistics",
      sport: "football",
      status: "NOT_TESTED",
      tested_at: null,
      http_status: null,
      requests_used: 0,
      error: "no_team_id",
      fields_available: [],
    });
  }

  if (homeId != null && awayId != null && charged < maxReq) {
    await push(
      await probe("headtohead", `/fixtures/headtohead?h2h=${homeId}-${awayId}`, {
        useCacheMs: 12 * 3600_000,
      }),
    );
  } else {
    caps.push({
      endpoint: "headtohead",
      path: "/fixtures/headtohead",
      sport: "football",
      status: "NOT_TESTED",
      tested_at: null,
      http_status: null,
      requests_used: 0,
      error: "no_h2h_ids",
      fields_available: [],
    });
  }

  if (homeId != null && charged < maxReq) {
    await push(
      await probe("players_statistics", `/players?team=${homeId}&season=${season}`, {
        useCacheMs: 24 * 3600_000,
      }),
    );
  }

  if (charged < maxReq) {
    await push(
      await probe("injuries", `/injuries?league=${leagueId}&season=${season}`, { useCacheMs: 6 * 3600_000 }),
    );
  }

  if (sampleFixtureId && charged < maxReq) {
    await push(await probe("odds", `/odds?fixture=${sampleFixtureId}`, { useCacheMs: 6 * 3600_000 }));
  } else {
    caps.push({
      endpoint: "odds",
      path: "/odds",
      sport: "football",
      status: "NOT_TESTED",
      tested_at: null,
      http_status: null,
      requests_used: 0,
      error: "no_fixture_id",
      fields_available: [],
    });
  }

  if (sampleFixtureId && charged < maxReq) {
    await push(
      await probe("fixtures_events", `/fixtures/events?fixture=${sampleFixtureId}`, {
        useCacheMs: 6 * 3600_000,
      }),
    );
  } else {
    caps.push({
      endpoint: "fixtures_events",
      path: "/fixtures/events",
      sport: "football",
      status: "NOT_TESTED",
      tested_at: null,
      http_status: null,
      requests_used: 0,
      error: "no_fixture_id",
      fields_available: [],
    });
  }

  const fixCap = caps.find((c) => c.endpoint === "fixtures");
  if (fixCap) {
    fixCap.sample_ids = {
      fixture_id: sampleFixtureId,
      home_id: homeId,
      away_id: awayId,
      league_id: leagueId,
      season,
    };
  }

  return finalize(root, caps, charged, normalized, sampleFixtureId, season);
}

function finalize(
  root: string,
  caps: ApiSportsCapabilityRow057[],
  charged: number,
  normalized: number,
  sampleFixtureId: string | null,
  season: number,
): CapabilityDiscoveryReport057 {
  const report: CapabilityDiscoveryReport057 = {
    at: new Date().toISOString(),
    source: "API_SPORTS",
    key_configured: true,
    requests_this_run: charged,
    budget: loadBudget057(root),
    capabilities: caps,
    normalized_events: normalized,
    sample_fixture_id: sampleFixtureId,
    free_season_used: season,
    open_task_058: false,
    real_money: false,
  };
  writeFileSync(join(root, "capabilities.json"), JSON.stringify(report, null, 2));
  return report;
}

export function loadCapabilities057(root = apiSportsRoot057()): CapabilityDiscoveryReport057 | null {
  const p = join(root, "capabilities.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")) as CapabilityDiscoveryReport057;
  } catch {
    return null;
  }
}
