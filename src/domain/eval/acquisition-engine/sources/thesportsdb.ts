/**
 * TheSportsDB free test API — upcoming events / badges. CONTEXT meta only.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { acquisitionGet } from "@/domain/eval/acquisition-engine/http";
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import { matchEventPair } from "@/domain/eval/data-intelligence/research/identity-match";
import { ensureAcquisitionDataSource } from "@/domain/eval/acquisition-engine/persist";
import type {
  AcquisitionCycleInput,
  AcquisitionRecord,
  SourceLaneResult,
} from "@/domain/eval/acquisition-engine/types";

export type TheSportsDbEvent = {
  idEvent?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  dateEvent?: string;
  strTime?: string;
  strLeague?: string;
  strThumb?: string | null;
  strBadge?: string | null;
};

export function parseTheSportsDbEvents(jsonText: string): TheSportsDbEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const events = (parsed as { events?: unknown }).events;
  if (!Array.isArray(events)) return [];
  return events.filter((row) => row && typeof row === "object") as TheSportsDbEvent[];
}

function eventKickoff(e: TheSportsDbEvent): string | null {
  if (!e.dateEvent) return null;
  const time = (e.strTime && e.strTime !== "00:00:00" ? e.strTime : "00:00:00").slice(0, 8);
  const t = Date.parse(`${e.dateEvent}T${time}Z`);
  return Number.isFinite(t) ? new Date(t).toISOString() : `${e.dateEvent}T00:00:00.000Z`;
}

export async function runTheSportsDbLane(input: {
  url: string;
  nowIso: string;
  cwd: string;
  persistNeon: boolean;
  jsonText?: string;
  fetchImpl?: typeof fetch;
  labEvents?: AcquisitionCycleInput["labEvents"];
  maxRetries?: number;
}): Promise<SourceLaneResult> {
  let text = input.jsonText;
  let http = 200;
  let retries = 0;
  let url = input.url;

  if (text == null) {
    const got = await acquisitionGet({
      url: input.url,
      sourceId: "thesportsdb",
      minIntervalMs: 1_500,
      fetchImpl: input.fetchImpl,
      maxRetries: input.maxRetries,
    });
    text = got.text;
    http = got.status;
    retries = got.retries;
    url = got.url;
    if (!got.ok) {
      return emptyLane({
        source_id: "thesportsdb",
        url,
        status: http === 401 ? "AUTH_REQUIRED" : http === 403 ? "BLOCKED" : http === 429 ? "RATE_LIMITED" : "NETWORK_ERROR",
        http_status: http || null,
        retries,
        reason: got.error ?? `HTTP_${http}`,
        reason_it: `TheSportsDB non disponibile (HTTP ${http || "?"}). Nessun dato inventato.`,
      });
    }
  }

  const events = parseTheSportsDbEvents(text);
  if (!events.length) {
    return emptyLane({
      source_id: "thesportsdb",
      url,
      status: "NO_DATA",
      http_status: http,
      retries,
      reason: "EMPTY_EVENTS",
      reason_it: "TheSportsDB non ha restituito eventi. Nessun dato inventato.",
    });
  }

  const cacheDir = join(input.cwd, "data", "acquisition", "thesportsdb");
  mkdirSync(cacheDir, { recursive: true });
  const cachePath = join(cacheDir, "eventsnext-4328.json");
  writeFileSync(cachePath, text, "utf8");

  const records: AcquisitionRecord[] = [
    {
      source_id: "thesportsdb",
      kind: "meta",
      feature_key: "thesportsdb_events_parsed",
      value: events.length,
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
      extraction_method: "thesportsdb_eventsnextleague",
      source_url: url,
      identity_status: "UNBOUND",
      reason_it: `${events.length} eventi TheSportsDB (meta/stemmi).`,
    },
  ];

  for (const ev of input.labEvents ?? []) {
    const hits = events.filter((e) => {
      if (!e.strHomeTeam || !e.strAwayTeam) return false;
      return matchEventPair(ev.home, ev.away, e.strHomeTeam, e.strAwayTeam).matched;
    });
    if (hits.length !== 1) continue;
    const e = hits[0]!;
    records.push({
      source_id: "thesportsdb",
      kind: "meta",
      feature_key: "thesportsdb_thumb",
      value: e.strThumb ?? e.idEvent ?? null,
      event_id: ev.event_id,
      home: e.strHomeTeam ?? ev.home,
      away: e.strAwayTeam ?? ev.away,
      kickoff_iso: eventKickoff(e),
      team_name: null,
      observed_at: input.nowIso,
      available_at: input.nowIso,
      temporal_precision: e.strTime && e.strTime !== "00:00:00" ? "exact" : "date_only",
      feature_status: "CONTEXT",
      enters_independent_model: false,
      extraction_method: "thesportsdb_eventsnextleague",
      source_url: url,
      identity_status: "EXACT",
      reason_it: "Meta TheSportsDB (stemma/evento). Solo contesto.",
    });
  }

  let neon = { source_registered: false, elo_stored: 0, features_stored: 0, reason: null as string | null };
  if (input.persistNeon) {
    try {
      const id = await ensureAcquisitionDataSource({
        slug: "thesportsdb",
        name: "TheSportsDB",
        licenseClass: "public_endpoint",
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
    source_id: "thesportsdb",
    ok: true,
    fetched: true,
    status: "OK",
    http_status: http,
    url,
    records,
    fields_extracted: [...new Set(records.map((r) => r.feature_key))],
    reason: `events=${events.length}`,
    reason_it: `TheSportsDB: ${events.length} eventi in calendario. Solo meta/contesto.`,
    retries,
    cache_path: cachePath,
    neon,
  };
}
