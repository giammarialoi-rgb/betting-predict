/**
 * Live probe of currently configured Fonti — observed status only.
 * HTTP 200 without event data = NO_DATA / PARTIAL, never SUCCESS theater.
 */
import { ACTIVE_FONTI_SOURCE_IDS } from "@/domain/eval/acquisition-engine/active-fonti";
import {
  FREE_SOURCE_CATALOG,
  OPEN_METEO_PING_URL,
  freeSourceById,
  understatSeasonYear,
} from "@/domain/eval/acquisition-engine/catalog";
import { RSS_FEEDS } from "@/domain/eval/data-intelligence/research/rss-news";
import { upsertSourceRuntime } from "@/domain/eval/mega-pipeline/neon-runtime";
import type {
  ObservedSourceStatus,
  SourceProbeRow,
  SourceRole,
} from "@/domain/eval/mega-pipeline/types";

function roleFor(sourceId: string): SourceRole {
  if (["openligadb", "espn", "thesportsdb", "openfootball"].includes(sourceId)) return "DISCOVERY";
  if (["football-data-co-uk", "statsbomb", "club-football-match-data", "openfootball"].includes(sourceId))
    return "ARCHIVE";
  if (sourceId === "understat") return "CONTEXT";
  if (sourceId === "open-meteo") return "CONTEXT";
  if (
    [
      "ansa",
      "bbc-sport",
      "guardian-football",
      "gazzetta",
      "sky-sports",
      "espn-soccer-news",
      "corriere-sport",
      "il-messaggero",
    ].includes(sourceId)
  )
    return "CONTEXT";
  return "CONTEXT";
}

function methodFor(sourceId: string): string {
  if (RSS_FEEDS[sourceId as keyof typeof RSS_FEEDS]) return "RSS";
  if (sourceId === "football-data-co-uk" || sourceId === "club-football-match-data") return "DATASET_CSV";
  if (sourceId === "statsbomb" || sourceId === "openfootball") return "DATASET_JSON";
  if (sourceId === "understat") return "HTML_XHR";
  return "API";
}

function classifyHttp(status: number, text: string): ObservedSourceStatus {
  if (status === 403) return "BLOCKED";
  if (status === 429) return "RATE_LIMITED";
  if (status === 404) return "NOT_FOUND";
  if (status === 0) return "TIMEOUT";
  if (/just a moment|cf-challenge|attention required|access denied/i.test(text.slice(0, 800))) {
    return status === 200 ? "CHALLENGE" : "BLOCKED";
  }
  if (status >= 500) return "HTTP_ERROR";
  if (status >= 400) return "HTTP_ERROR";
  return "OK";
}

async function probeUrl(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: number; text: string; bytes: number; latency_ms: number }> {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 18_000);
    const res = await fetchImpl(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "BetMindSourceProbe/1.0", accept: "*/*" },
      redirect: "follow",
    });
    clearTimeout(timer);
    const text = await res.text();
    return { status: res.status, text, bytes: text.length, latency_ms: Date.now() - t0 };
  } catch {
    return { status: 0, text: "", bytes: 0, latency_ms: Date.now() - t0 };
  }
}

function probeUrlForSource(sourceId: string): string | null {
  if (RSS_FEEDS[sourceId as keyof typeof RSS_FEEDS]) {
    return RSS_FEEDS[sourceId as keyof typeof RSS_FEEDS];
  }
  const def = freeSourceById(sourceId) ?? FREE_SOURCE_CATALOG.find((s) => s.source_id === sourceId);
  if (def?.url) return def.url;
  if (sourceId === "open-meteo") return OPEN_METEO_PING_URL;
  if (sourceId === "understat") {
    const y = understatSeasonYear(new Date().toISOString().slice(0, 10));
    // Prefer current European season; callers may fall back to y-1 on 404.
    return `https://understat.com/league/EPL/${y}`;
  }
  return null;
}

function countUseful(sourceId: string, status: ObservedSourceStatus, text: string): {
  events: number;
  fields: string[];
  finalStatus: ObservedSourceStatus;
} {
  if (status !== "OK") return { events: 0, fields: [], finalStatus: status };
  if (RSS_FEEDS[sourceId as keyof typeof RSS_FEEDS]) {
    const items = (text.match(/<item[\s>]/gi) ?? []).length;
    if (items === 0) return { events: 0, fields: [], finalStatus: "NO_DATA" };
    return { events: items, fields: ["rss_item"], finalStatus: items > 0 ? "OK" : "NO_DATA" };
  }
  if (sourceId === "openligadb") {
    try {
      const arr = JSON.parse(text);
      const n = Array.isArray(arr) ? arr.length : 0;
      return {
        events: n,
        fields: n ? ["matchID", "team1", "team2", "matchDateTime", "matchIsFinished"] : [],
        finalStatus: n ? "OK" : "NO_DATA",
      };
    } catch {
      return { events: 0, fields: [], finalStatus: "NO_DATA" };
    }
  }
  if (sourceId === "thesportsdb") {
    try {
      const parsed = JSON.parse(text) as { events?: unknown[] };
      const n = Array.isArray(parsed.events) ? parsed.events.length : 0;
      return {
        events: n,
        fields: n ? ["idEvent", "strHomeTeam", "strAwayTeam", "dateEvent"] : [],
        finalStatus: n ? "OK" : "NO_DATA",
      };
    } catch {
      return { events: 0, fields: [], finalStatus: "NO_DATA" };
    }
  }
  if (sourceId === "espn") {
    try {
      const parsed = JSON.parse(text) as { events?: unknown[] };
      const n = Array.isArray(parsed.events) ? parsed.events.length : 0;
      return {
        events: n,
        fields: n ? ["id", "competitors", "date", "status"] : [],
        finalStatus: n ? "OK" : "NO_DATA",
      };
    } catch {
      return { events: 0, fields: [], finalStatus: "NO_DATA" };
    }
  }
  if (sourceId === "football-data-co-uk") {
    const lines = text.split(/\n/).filter((l) => l.trim()).length;
    return {
      events: Math.max(0, lines - 1),
      fields: lines > 1 ? ["Div", "Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG"] : [],
      finalStatus: lines > 1 ? "OK" : "NO_DATA",
    };
  }
  if (sourceId === "openfootball" || sourceId === "statsbomb") {
    try {
      JSON.parse(text);
      return { events: 1, fields: ["json"], finalStatus: "OK" };
    } catch {
      return { events: 0, fields: [], finalStatus: "NO_DATA" };
    }
  }
  if (sourceId === "understat") {
    const has = /teamsData|datesData|playersData|understat/i.test(text);
    if (status === "OK" && text.length > 5_000) {
      return {
        events: has ? 1 : 1,
        fields: has ? ["teamsData"] : ["html"],
        finalStatus: has ? "PARTIAL" : "PARTIAL",
      };
    }
    return {
      events: 0,
      fields: [],
      finalStatus: status === "OK" ? "NO_DATA" : status,
    };
  }
  if (sourceId === "open-meteo") {
    const has = /current_weather|"temperature"/.test(text);
    return {
      events: has ? 1 : 0,
      fields: has ? ["temperature", "windspeed"] : [],
      finalStatus: has ? "OK" : "NO_DATA",
    };
  }
  if (sourceId === "club-football-match-data") {
    return {
      events: 0,
      fields: [],
      finalStatus: "OK",
      // local dataset — probe URL may be N/A; treat as archive present if catalogued
    };
  }
  return { events: text.length > 100 ? 1 : 0, fields: text.length > 100 ? ["body"] : [], finalStatus: text.length > 100 ? "PARTIAL" : "NO_DATA" };
}

export async function probeActiveFonti(input: {
  nowIso?: string;
  fetchImpl?: typeof fetch;
  persistNeon?: boolean;
  sourceIds?: readonly string[];
} = {}): Promise<SourceProbeRow[]> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const ids = input.sourceIds ?? ACTIVE_FONTI_SOURCE_IDS;
  const rows: SourceProbeRow[] = [];

  for (const sourceId of ids) {
    const def = freeSourceById(sourceId);
    const title = def?.title ?? sourceId;
    const url = probeUrlForSource(sourceId);

    if (sourceId === "club-football-match-data") {
      const row: SourceProbeRow = {
        source_id: sourceId,
        title,
        method: "DATASET_CSV",
        role: "ARCHIVE",
        status: "OK",
        http_status: null,
        url: "local:data/club-football-match-data",
        bytes: 0,
        events_found: 0,
        fields_extracted: ["local_csv"],
        latency_ms: 0,
        observed_at: nowIso,
        note: "Local archive dataset — not an HTTP probe.",
        note_it: "Dataset locale in archivio — non e un probe HTTP.",
      };
      rows.push(row);
      if (input.persistNeon !== false) {
        await upsertSourceRuntime({
          ...row,
          ok: true,
        });
      }
      continue;
    }

    if (!url) {
      const row: SourceProbeRow = {
        source_id: sourceId,
        title,
        method: methodFor(sourceId),
        role: roleFor(sourceId),
        status: "MISSING_ADAPTER",
        http_status: null,
        url: "",
        bytes: 0,
        events_found: 0,
        fields_extracted: [],
        latency_ms: 0,
        observed_at: nowIso,
        note: "No probe URL configured.",
        note_it: "Nessun URL di probe configurato.",
      };
      rows.push(row);
      continue;
    }

    const got = await probeUrl(url, input.fetchImpl);
    const httpStatus = classifyHttp(got.status, got.text);
    const useful = countUseful(sourceId, httpStatus, got.text);
    const row: SourceProbeRow = {
      source_id: sourceId,
      title,
      method: methodFor(sourceId),
      role: roleFor(sourceId),
      status: useful.finalStatus,
      http_status: got.status || null,
      url,
      bytes: got.bytes,
      events_found: useful.events,
      fields_extracted: useful.fields,
      latency_ms: got.latency_ms,
      observed_at: nowIso,
      note: `http=${got.status}; events=${useful.events}; status=${useful.finalStatus}`,
      note_it:
        useful.finalStatus === "BLOCKED"
          ? `${title}: accesso bloccato (HTTP ${got.status}). Nessun bypass.`
          : useful.finalStatus === "OK"
            ? `${title}: dati osservati (${useful.events}).`
            : useful.finalStatus === "PARTIAL"
              ? `${title}: risposta parziale.`
              : `${title}: ${useful.finalStatus} (HTTP ${got.status}).`,
    };
    rows.push(row);
    if (input.persistNeon !== false) {
      await upsertSourceRuntime({
        ...row,
        ok: useful.finalStatus === "OK" || useful.finalStatus === "PARTIAL",
      });
    }
  }

  return rows;
}
