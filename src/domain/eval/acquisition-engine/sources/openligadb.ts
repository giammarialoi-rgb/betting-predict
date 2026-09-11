/**
 * OpenLigaDB — free German football API. No key. Continue-on-fail per league.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { acquisitionGet } from "@/domain/eval/acquisition-engine/http";
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import { matchEventPair, pickUniqueDatedPair, pickUniqueTeam } from "@/domain/eval/data-intelligence/research/identity-match";
import { registerAcquisitionSource } from "@/domain/eval/acquisition-engine/persist";
import { OPENLIGA_LEAGUES, openLigaMatchUrl } from "@/domain/eval/acquisition-engine/catalog";
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
  const cacheDir = join(input.cwd, "data", "acquisition", "openligadb");
  mkdirSync(cacheDir, { recursive: true });

  const byLeague: Array<{ shortcut: string; matches: OpenLigaMatch[]; url: string; http: number }> = [];
  let retries = 0;
  let lastHttp = 200;
  let lastUrl = input.url;
  let lastError: string | null = null;

  if (input.jsonText != null) {
    const matches = parseOpenLigaMatches(input.jsonText);
    writeFileSync(join(cacheDir, "bl1.json"), input.jsonText, "utf8");
    byLeague.push({ shortcut: "bl1", matches, url: input.url, http: 200 });
  } else {
    for (const league of OPENLIGA_LEAGUES) {
      const url = openLigaMatchUrl(league.shortcut);
      const got = await acquisitionGet({
        url,
        sourceId: "openligadb",
        minIntervalMs: input.fetchImpl ? 0 : 1_000,
        fetchImpl: input.fetchImpl,
        maxRetries: input.maxRetries,
      });
      retries += got.retries;
      lastHttp = got.status;
      lastUrl = got.url;
      if (!got.ok) {
        lastError = got.error ?? `HTTP_${got.status}`;
        continue;
      }
      const matches = parseOpenLigaMatches(got.text);
      if (!matches.length) continue;
      writeFileSync(join(cacheDir, `${league.shortcut}.json`), got.text, "utf8");
      byLeague.push({ shortcut: league.shortcut, matches, url: got.url, http: got.status });
    }
  }

  const matches = byLeague.flatMap((l) => l.matches);
  const leagues = byLeague.filter((l) => l.matches.length > 0).map((l) => l.shortcut);
  if (!matches.length) {
    return emptyLane({
      source_id: "openligadb",
      url: lastUrl,
      status: lastHttp === 403 ? "BLOCKED" : lastHttp === 429 ? "RATE_LIMITED" : lastError ? "NETWORK_ERROR" : "PARSE_ERROR",
      http_status: lastHttp || null,
      retries,
      reason: lastError ?? "EMPTY_OR_INVALID_JSON",
      reason_it:
        lastHttp === 403
          ? "OpenLigaDB ha restituito HTTP 403. Nessun dato utilizzato."
          : "OpenLigaDB non ha restituito partite interpretabili. Nessun dato inventato.",
    });
  }

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
      source_url: lastUrl,
      identity_status: "UNBOUND",
      reason_it: `${matches.length} partite OpenLigaDB (${leagues.join(", ")}).`,
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
    const picked = pickUniqueDatedPair(pairHits, (row) => kickoffIso(row), ev.kickoff_utc);
    if (!picked) {
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
          source_url: lastUrl,
          identity_status: homePick.status,
          reason_it: homePick.reason_it,
        });
      }
      continue;
    }
    const m = picked;
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
      source_url: lastUrl,
      identity_status: "EXACT",
      reason_it: finished
        ? "Risultato OpenLigaDB: available_at del risultato non dimostrato, escluso dal modello pre-match."
        : "Fixture OpenLigaDB osservata ora (contesto calendario).",
    });
  }

  let neon = { source_registered: false, elo_stored: 0, features_stored: 0, reason: null as string | null };
  if (input.persistNeon) {
    neon = await registerAcquisitionSource({
      slug: "openligadb",
      name: "OpenLigaDB",
      licenseClass: "public_endpoint",
    });
  }

  return {
    source_id: "openligadb",
    ok: true,
    fetched: true,
    status: leagues.length > 1 ? "OK" : "OK",
    http_status: lastHttp,
    url: lastUrl,
    records,
    fields_extracted: [...new Set(records.map((r) => r.feature_key))],
    reason: `matches=${matches.length}; leagues=${leagues.join(",")}`,
    reason_it: `OpenLigaDB: ${matches.length} partite (${leagues.join(", ")}). Identità fail-closed.`,
    retries,
    cache_path: join(cacheDir, `${leagues[0] ?? "bl1"}.json`),
    neon,
    coverage: { leagues, sports: ["football"] },
  };
}
