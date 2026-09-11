/**
 * StatsBomb Open Data — historical competitions catalogue. Not live.
 * available_at unknown → NOT_ELIGIBLE. Never used as pre-match xG.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { acquisitionGet } from "@/domain/eval/acquisition-engine/http";
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import { ensureAcquisitionDataSource } from "@/domain/eval/acquisition-engine/persist";
import type { AcquisitionRecord, SourceLaneResult } from "@/domain/eval/acquisition-engine/types";

export type StatsBombCompetition = {
  competition_id?: number;
  season_id?: number;
  country_name?: string;
  competition_name?: string;
  season_name?: string;
  match_available?: string | null;
};

export function parseStatsBombCompetitions(jsonText: string): StatsBombCompetition[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((row) => row && typeof row === "object") as StatsBombCompetition[];
}

export async function runStatsBombLane(input: {
  url: string;
  nowIso: string;
  cwd: string;
  persistNeon: boolean;
  jsonText?: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
}): Promise<SourceLaneResult> {
  let text = input.jsonText;
  let http = 200;
  let retries = 0;
  let url = input.url;

  if (text == null) {
    const got = await acquisitionGet({
      url: input.url,
      sourceId: "statsbomb",
      minIntervalMs: input.fetchImpl ? 0 : 800,
      fetchImpl: input.fetchImpl,
      maxRetries: input.maxRetries,
    });
    text = got.text;
    http = got.status;
    retries = got.retries;
    url = got.url;
    if (!got.ok) {
      return emptyLane({
        source_id: "statsbomb",
        url,
        status: http === 403 ? "BLOCKED" : http === 429 ? "RATE_LIMITED" : "NETWORK_ERROR",
        http_status: http || null,
        retries,
        reason: got.error ?? `HTTP_${http}`,
        reason_it: `StatsBomb Open Data non raggiungibile (HTTP ${http || "?"}). Nessun xG inventato.`,
      });
    }
  }

  const comps = parseStatsBombCompetitions(text);
  if (!comps.length) {
    return emptyLane({
      source_id: "statsbomb",
      url,
      status: "PARSE_ERROR",
      http_status: http,
      retries,
      reason: "EMPTY_COMPETITIONS",
      reason_it: "Il JSON StatsBomb non contiene competizioni. Nessun dato inventato.",
    });
  }

  const cacheDir = join(input.cwd, "data", "acquisition", "statsbomb");
  mkdirSync(cacheDir, { recursive: true });
  const cachePath = join(cacheDir, "competitions.json");
  writeFileSync(cachePath, text, "utf8");

  const records: AcquisitionRecord[] = [
    {
      source_id: "statsbomb",
      kind: "research_dataset",
      feature_key: "statsbomb_competitions",
      value: comps.length,
      event_id: null,
      home: null,
      away: null,
      kickoff_iso: null,
      team_name: null,
      observed_at: input.nowIso,
      available_at: null,
      temporal_precision: "unknown",
      feature_status: "NOT_ELIGIBLE",
      enters_independent_model: false,
      extraction_method: "statsbomb_open_data_competitions",
      source_url: url,
      identity_status: "UNBOUND",
      reason_it:
        `Catalogo storico StatsBomb (${comps.length} competizioni). Non live; available_at sconosciuto; escluso dal modello pre-match.`,
    },
  ];

  let neon = { source_registered: false, elo_stored: 0, features_stored: 0, reason: null as string | null };
  if (input.persistNeon) {
    try {
      const id = await ensureAcquisitionDataSource({
        slug: "statsbomb",
        name: "StatsBomb Open Data",
        licenseClass: "dataset",
      });
      neon = {
        source_registered: Boolean(id),
        elo_stored: 0,
        features_stored: 0,
        reason: id ? null : "DATABASE_URL not set or insert failed",
      };
    } catch (e) {
      neon.reason = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    source_id: "statsbomb",
    ok: true,
    fetched: true,
    status: "OK",
    http_status: http,
    url,
    records,
    fields_extracted: ["statsbomb_competitions"],
    reason: `competitions=${comps.length}; seasons=${new Set(comps.map((c) => `${c.competition_id}:${c.season_id}`)).size}; NOT_ELIGIBLE historical`,
    reason_it: `StatsBomb Open Data: ${comps.length} pacchetti storici (non live). available_at sconosciuto; esclusi dal modello pre-match.`,
    retries,
    cache_path: cachePath,
    neon,
    coverage: {
      leagues: [...new Set(comps.map((c) => c.competition_name).filter(Boolean) as string[])].slice(0, 24),
      sports: ["football"],
    },
  };
}
