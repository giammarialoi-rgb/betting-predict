/**
 * football-data.org free tier — token required. Honest AUTH_REQUIRED otherwise.
 */
import { getFootballDataOrgToken } from "@/providers/football-data-org/adapter";
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import { registerAcquisitionSource } from "@/domain/eval/acquisition-engine/persist";
import { acquisitionGet } from "@/domain/eval/acquisition-engine/http";
import { FOOTBALL_DATA_ORG_COMPETITIONS } from "@/domain/eval/acquisition-engine/catalog";
import type { SourceLaneResult } from "@/domain/eval/acquisition-engine/types";

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
