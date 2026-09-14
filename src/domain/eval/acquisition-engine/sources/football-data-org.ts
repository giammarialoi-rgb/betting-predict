/**
 * football-data.org free tier — token required. Honest AUTH_REQUIRED otherwise.
 */
import { createHash } from "node:crypto";
import { getFootballDataOrgToken } from "@/providers/football-data-org/adapter";
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import { registerAcquisitionSource } from "@/domain/eval/acquisition-engine/persist";
import { acquisitionGet } from "@/domain/eval/acquisition-engine/http";
import { FOOTBALL_DATA_ORG_COMPETITIONS } from "@/domain/eval/acquisition-engine/catalog";
import type { SourceLaneResult } from "@/domain/eval/acquisition-engine/types";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";

type FootballDataOrgMatch = {
  id: number;
  utcDate: string;
  status: string;
  competition: { name: string };
  area: { name: string } | null;
  homeTeam: { name: string | null } | null;
  awayTeam: { name: string | null } | null;
};

function fp(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 24);
}

/**
 * Real fixture discovery — one HTTP GET per competition (per-competition
 * endpoint returns the full season; the combined /v4/matches endpoint only
 * returns a few days, so it is not used here). Free tier: 10 req/min,
 * respected via acquisitionGet's minIntervalMs.
 */
export async function discoverFootballDataOrgFixtures(input: {
  nowIso: string;
  windowDays?: number;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  token?: string;
}): Promise<{ events: PermanentEvent044[]; competitions_ok: string[]; competitions_failed: string[] }> {
  const token = input.token !== undefined ? input.token : getFootballDataOrgToken();
  const events: PermanentEvent044[] = [];
  const competitions_ok: string[] = [];
  const competitions_failed: string[] = [];
  if (!token) return { events, competitions_ok, competitions_failed };

  const nowMs = Date.parse(input.nowIso);
  const windowMs = (input.windowDays ?? 21) * 24 * 3600_000;

  for (const comp of FOOTBALL_DATA_ORG_COMPETITIONS) {
    const url = `https://api.football-data.org/v4/competitions/${comp}/matches?status=SCHEDULED`;
    const got = await acquisitionGet({
      url,
      sourceId: "football-data-org",
      minIntervalMs: input.fetchImpl ? 0 : 7_000,
      headers: { "X-Auth-Token": token },
      fetchImpl: input.fetchImpl,
      maxRetries: input.maxRetries,
    });
    if (!got.ok) {
      competitions_failed.push(comp);
      continue;
    }
    try {
      const body = JSON.parse(got.text) as { matches?: FootballDataOrgMatch[] };
      const matches = Array.isArray(body.matches) ? body.matches : [];
      competitions_ok.push(comp);
      for (const m of matches) {
        const home = m.homeTeam?.name;
        const away = m.awayTeam?.name;
        if (!home || !away || !m.utcDate) continue;
        const ko = Date.parse(m.utcDate);
        if (!Number.isFinite(ko) || ko < nowMs || ko > nowMs + windowMs) continue;
        const event_id = fp(`fdorg|${m.id}`);
        events.push({
          event_id,
          canonical_event_id: event_id,
          source: "football-data-org",
          source_event_id: String(m.id),
          sport: "soccer",
          competition: m.competition.name,
          country: m.area?.name ?? null,
          home_or_a: home,
          away_or_b: away,
          kickoff_utc: new Date(ko).toISOString(),
          collected_at_utc: input.nowIso,
          available_at_utc: input.nowIso,
          semantic_level: "RESEARCH",
          data_quality: 0.6,
          fingerprint: event_id,
          status: "UPCOMING",
          origin: "DISCOVERED_LIVE",
        });
      }
    } catch {
      competitions_failed.push(comp);
    }
  }

  return { events, competitions_ok, competitions_failed };
}

export async function runFootballDataOrgLane(input: {
  url: string;
  nowIso: string;
  persistNeon: boolean;
  fetchImpl?: typeof fetch;
  token?: string;
  maxRetries?: number;
}): Promise<SourceLaneResult> {
  const token = input.token !== undefined ? input.token : getFootballDataOrgToken();
  if (!token) {
    return emptyLane({
      source_id: "football-data-org",
      url: input.url,
      status: "AUTH_REQUIRED",
      reason: "FOOTBALL_DATA_ORG_TOKEN is not set",
      reason_it:
        "football-data.org richiede un token gratuito (FOOTBALL_DATA_ORG_TOKEN). Nessun accesso non autorizzato. Rate limit del piano free rispettato.",
    });
  }

  const got = await acquisitionGet({
    url: input.url,
    sourceId: "football-data-org",
    minIntervalMs: input.fetchImpl ? 0 : 7_000,
    headers: { "X-Auth-Token": token },
    fetchImpl: input.fetchImpl,
    maxRetries: input.maxRetries,
  });

  if (!got.ok) {
    return emptyLane({
      source_id: "football-data-org",
      url: got.url,
      status: got.status === 429 ? "RATE_LIMITED" : got.status === 403 ? "BLOCKED" : "NETWORK_ERROR",
      http_status: got.status || null,
      retries: got.retries,
      reason: got.error ?? `HTTP_${got.status}`,
      reason_it:
        got.status === 429
          ? "football-data.org ha limitato le richieste (HTTP 429). Riprovo al ciclo successivo, senza martellare."
          : `football-data.org non disponibile (HTTP ${got.status || "?"}). Nessun dato inventato.`,
    });
  }

  let count = 0;
  try {
    const body = JSON.parse(got.text) as { matches?: unknown[] };
    count = Array.isArray(body.matches) ? body.matches.length : 0;
  } catch {
    return emptyLane({
      source_id: "football-data-org",
      url: got.url,
      status: "PARSE_ERROR",
      http_status: got.status,
      retries: got.retries,
      reason: "INVALID_JSON",
      reason_it: "La risposta di football-data.org non e interpretabile.",
    });
  }

  let neon = { source_registered: false, elo_stored: 0, features_stored: 0, reason: null as string | null };
  if (input.persistNeon) {
    neon = await registerAcquisitionSource({
      slug: "football-data-org",
      name: "football-data.org",
      licenseClass: "official_api",
    });
  }

  return {
    source_id: "football-data-org",
    ok: count >= 0,
    fetched: true,
    status: count > 0 ? "OK" : "NO_DATA",
    http_status: got.status,
    url: got.url,
    records: [
      {
        source_id: "football-data-org",
        kind: "fixtures",
        feature_key: "football_data_org_matches",
        value: count,
        event_id: null,
        home: null,
        away: null,
        kickoff_iso: null,
        team_name: null,
        observed_at: input.nowIso,
        available_at: input.nowIso,
        temporal_precision: "exact",
        feature_status: "CONTEXT",
        enters_independent_model: false,
        extraction_method: "football_data_org_v4_matches",
        source_url: got.url,
        identity_status: "UNBOUND",
        reason_it: `${count} partite football-data.org (calendario).`,
      },
    ],
    fields_extracted: count > 0 ? ["football_data_org_matches"] : [],
    reason: `matches=${count}; competitions=${FOOTBALL_DATA_ORG_COMPETITIONS.join(",")}`,
    reason_it: `football-data.org: ${count} partite (${FOOTBALL_DATA_ORG_COMPETITIONS.join(", ")}). Rate limit rispettato.`,
    retries: got.retries,
    cache_path: null,
    neon,
    coverage: { leagues: [...FOOTBALL_DATA_ORG_COMPETITIONS], sports: ["football"] },
  };
}
