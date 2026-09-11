/**
 * OpenLigaDB — free German football API. No key. Continue-on-fail.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { acquisitionGet } from "@/domain/eval/acquisition-engine/http";
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import { matchEventPair, pickUniqueTeam } from "@/domain/eval/data-intelligence/research/identity-match";
import { ensureAcquisitionDataSource } from "@/domain/eval/acquisition-engine/persist";
import type {
  AcquisitionCycleInput,
  AcquisitionRecord,
  SourceLaneResult,
} from "@/domain/eval/acquisition-engine/types";

export type OpenLigaMatch = {
  matchID?: number;
  matchDateTimeUTC?: string;
  matchDateTime?: string;
  matchIsFinished?: boolean;
  leagueName?: string;
  team1?: { teamName?: string; shortName?: string };
  team2?: { teamName?: string; shortName?: string };
  matchResults?: Array<{ resultTypeID?: number; pointsTeam1?: number; pointsTeam2?: number }>;
};

export function parseOpenLigaMatches(jsonText: string): OpenLigaMatch[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((row) => row && typeof row === "object") as OpenLigaMatch[];
}

function kickoffIso(m: OpenLigaMatch): string | null {
  const raw = m.matchDateTimeUTC || m.matchDateTime;
  if (!raw) return null;
  const t = Date.parse(raw.endsWith("Z") || raw.includes("+") ? raw : `${raw}Z`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export async function runOpenLigaDbLane(input: {
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
      sourceId: "openligadb",
      minIntervalMs: 1_000,
      fetchImpl: input.fetchImpl,
      maxRetries: input.maxRetries,
    });
    text = got.text;
    http = got.status;
    retries = got.retries;
    url = got.url;
    if (!got.ok) {
      return emptyLane({
        source_id: "openligadb",
        url,
        status: http === 403 ? "BLOCKED" : http === 429 ? "RATE_LIMITED" : "NETWORK_ERROR",
        http_status: http || null,
        retries,
        reason: got.error ?? `HTTP_${http}`,
        reason_it:
          http === 403
            ? "OpenLigaDB ha restituito HTTP 403. Nessun dato utilizzato."
            : `OpenLigaDB non disponibile (HTTP ${http || "?"}). Nessun dato inventato.`,
      });
    }
  }

  const matches = parseOpenLigaMatches(text);
  if (!matches.length) {
    return emptyLane({
      source_id: "openligadb",
      url,
      status: "PARSE_ERROR",
      http_status: http,
      retries,
      reason: "EMPTY_OR_INVALID_JSON",
      reason_it: "OpenLigaDB ha risposto senza partite interpretabili. Nessun dato inventato.",
    });
  }

  const cacheDir = join(input.cwd, "data", "acquisition", "openligadb");
  mkdirSync(cacheDir, { recursive: true });
  const cachePath = join(cacheDir, "bl1.json");
  writeFileSync(cachePath, text, "utf8");

  const records: AcquisitionRecord[] = [
    {
      source_id: "openligadb",
      kind: "fixtures",
      feature_key: "openligadb_matches_parsed",
      value: matches.length,
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
      extraction_method: "openligadb_getmatchdata",
      source_url: url,
      identity_status: "UNBOUND",
      reason_it: `${matches.length} partite Bundesliga lette da OpenLigaDB.`,
    },
  ];

  const teamNames = matches.flatMap((m) => [m.team1?.teamName, m.team2?.teamName].filter(Boolean) as string[]);

  for (const ev of input.labEvents ?? []) {
    const pairHits = matches.filter((m) => {
      const h = m.team1?.teamName;
      const a = m.team2?.teamName;
      if (!h || !a) return false;
      return matchEventPair(ev.home, ev.away, h, a).matched;
    });
    if (pairHits.length !== 1) {
      const homePick = pickUniqueTeam(ev.home, teamNames);
      if (!homePick.matched && (homePick.status === "SHORT_NAME_BLOCKED" || homePick.status === "AMBIGUOUS")) {
        records.push({
          source_id: "openligadb",
          kind: "fixtures",
          feature_key: "identity_fail_closed",
          value: null,
          event_id: ev.event_id,
          home: ev.home,
          away: ev.away,
          kickoff_iso: ev.kickoff_utc ?? null,
          team_name: ev.home,
          observed_at: input.nowIso,
          available_at: null,
          temporal_precision: "unknown",
          feature_status: "NOT_ELIGIBLE",
          enters_independent_model: false,
          extraction_method: "openligadb_getmatchdata",
          source_url: url,
          identity_status: homePick.status,
          reason_it: homePick.reason_it,
        });
      }
      continue;
    }
    const m = pairHits[0]!;
    const kick = kickoffIso(m);
    const finished = Boolean(m.matchIsFinished);
    records.push({
      source_id: "openligadb",
      kind: finished ? "results" : "fixtures",
      feature_key: finished ? "openligadb_finished" : "openligadb_fixture",
      value: m.matchID ?? null,
      event_id: ev.event_id,
      home: m.team1?.teamName ?? ev.home,
      away: m.team2?.teamName ?? ev.away,
      kickoff_iso: kick,
      team_name: null,
      observed_at: input.nowIso,
      available_at: finished ? null : input.nowIso,
      temporal_precision: finished ? "unknown" : "exact",
      feature_status: finished ? "NOT_ELIGIBLE" : "CONTEXT",
      enters_independent_model: false,
      extraction_method: "openligadb_getmatchdata",
      source_url: url,
      identity_status: "EXACT",
      reason_it: finished
        ? "Risultato OpenLigaDB: available_at del risultato non dimostrato, escluso dal modello pre-match."
        : "Fixture OpenLigaDB osservata ora (contesto calendario).",
    });
  }

  let neon = { source_registered: false, elo_stored: 0, features_stored: 0, reason: null as string | null };
  if (input.persistNeon) {
    try {
      const id = await ensureAcquisitionDataSource({
        slug: "openligadb",
        name: "OpenLigaDB",
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
    source_id: "openligadb",
    ok: true,
    fetched: true,
    status: "OK",
    http_status: http,
    url,
    records,
    fields_extracted: [...new Set(records.map((r) => r.feature_key))],
    reason: `matches=${matches.length}`,
    reason_it: `OpenLigaDB: ${matches.length} partite Bundesliga lette. Identità fail-closed.`,
    retries,
    cache_path: cachePath,
    neon,
  };
}
