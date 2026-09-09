/**
 * Normalize API-Sports fixture payloads into Lab-common event shape.
 */

import { createHash } from "node:crypto";
import type { ApiSportsNormalizedEvent057 } from "@/domain/data-sources/api-sports/types";
import { API_SPORTS_SOURCE } from "@/domain/data-sources/api-sports/types";

type FixtureRow = {
  fixture?: {
    id?: number;
    date?: string;
    status?: { short?: string };
  };
  league?: { id?: number; name?: string; season?: number };
  teams?: {
    home?: { id?: number; name?: string };
    away?: { id?: number; name?: string };
  };
  goals?: { home?: number | null; away?: number | null };
};

export function normalizeFixtures057(
  payload: unknown,
  observedAt = new Date().toISOString(),
): ApiSportsNormalizedEvent057[] {
  const response = (payload as { response?: FixtureRow[] })?.response;
  if (!Array.isArray(response)) return [];
  const out: ApiSportsNormalizedEvent057[] = [];
  for (const row of response) {
    const id = row.fixture?.id;
    if (id == null) continue;
    const home = row.teams?.home?.name ?? "UNKNOWN";
    const away = row.teams?.away?.name ?? "UNKNOWN";
    const ref = createHash("sha256")
      .update(`api-sports|fixture|${id}`)
      .digest("hex")
      .slice(0, 16);
    out.push({
      source: API_SPORTS_SOURCE,
      provider_event_id: String(id),
      sport: "football",
      league: row.league?.name ?? null,
      league_id: row.league?.id ?? null,
      season: row.league?.season ?? null,
      home_team: home,
      away_team: away,
      home_team_id: row.teams?.home?.id ?? null,
      away_team_id: row.teams?.away?.id ?? null,
      event_time: row.fixture?.date ?? null,
      status_short: row.fixture?.status?.short ?? null,
      score_home: row.goals?.home ?? null,
      score_away: row.goals?.away ?? null,
      raw_reference: ref,
      observed_at: observedAt,
      schema_version: "057",
    });
  }
  return out;
}

export function topLevelFields057(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const keys = Object.keys(payload as object);
  const resp = (payload as { response?: unknown }).response;
  if (Array.isArray(resp) && resp[0] && typeof resp[0] === "object") {
    return [...keys, ...Object.keys(resp[0] as object).map((k) => `response[].${k}`)];
  }
  if (resp && typeof resp === "object" && !Array.isArray(resp)) {
    return [...keys, ...Object.keys(resp as object).map((k) => `response.${k}`)];
  }
  return keys;
}
