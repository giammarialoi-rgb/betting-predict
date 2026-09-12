/**
 * Audit EXISTING adapters only. No SofaScore/WAF revive. KEY_PRESENT/KEY_MISSING only.
 */
import { BLOCKED_PROTECTED_SOURCES, OPEN_METEO_PING_URL, openLigaMatchUrl } from "@/domain/eval/acquisition-engine/catalog";
import { RESEARCH_SOURCE_CATALOGUE } from "@/domain/eval/data-intelligence/research/source-catalogue";
import { fetchText } from "@/domain/eval/betmind-runtime/golden-e2e/discover";
import type { SourceAuditRow, SourceRuntimeStatus } from "@/domain/eval/betmind-runtime/golden-e2e/types";

function keyStatus(envName: string | null): SourceAuditRow["key"] {
  if (!envName) return "NOT_REQUIRED";
  return process.env[envName]?.trim() ? "KEY_PRESENT" : "KEY_MISSING";
}

function classifyHttp(status: number, extracted: number): SourceRuntimeStatus {
  if (status === 403 || status === 401) return "BLOCKED";
  if (status === 429) return "BLOCKED";
  if (status >= 500) return "FAILED";
  if (status === 0) return "UNAVAILABLE";
  if (status === 200 && extracted > 0) return "WORKING";
  if (status === 200) return "PARTIAL";
  return "FAILED";
}

const PROBEABLE: Array<{
  source_id: string;
  url: string;
  keyEnv: string | null;
  extract: (text: string) => string[];
}> = [
  {
    source_id: "openligadb",
    url: openLigaMatchUrl("bl1"),
    keyEnv: null,
    extract: (text) => {
      try {
        const arr = JSON.parse(text) as unknown[];
        return Array.isArray(arr) && arr.length ? ["matchID", "team1", "team2", "matchDateTimeUTC"] : [];
      } catch {
        return [];
      }
    },
  },
  {
    source_id: "espn",
    url: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard",
    keyEnv: null,
    extract: (text) => {
      try {
        const rec = JSON.parse(text) as { events?: unknown[] };
        return Array.isArray(rec.events) && rec.events.length ? ["events", "competitions"] : [];
      } catch {
        return [];
      }
    },
  },
  {
    source_id: "thesportsdb",
    url: "https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4328",
    keyEnv: null,
    extract: (text) => {
      try {
        const rec = JSON.parse(text) as { events?: unknown[] };
        return Array.isArray(rec.events) && rec.events.length ? ["idEvent", "strHomeTeam", "strAwayTeam"] : [];
      } catch {
        return [];
      }
    },
  },
  {
    source_id: "clubelo",
    url: `http://api.clubelo.com/${new Date().toISOString().slice(0, 10)}`,
    keyEnv: null,
    extract: (text) => (text.includes("Club") && text.includes("Elo") ? ["Club", "Elo"] : []),
  },
  {
    source_id: "open-meteo",
    url: OPEN_METEO_PING_URL,
    keyEnv: null,
    extract: (text) => {
      try {
        const rec = JSON.parse(text) as { current_weather?: unknown };
        return rec.current_weather ? ["current_weather"] : [];
      } catch {
        return [];
      }
    },
  },
];

export async function auditExistingSources(): Promise<SourceAuditRow[]> {
  const rows: SourceAuditRow[] = [];
  const seen = new Set<string>();

  for (const blocked of BLOCKED_PROTECTED_SOURCES) {
    seen.add(blocked.source_id);
    rows.push({
      source_id: blocked.source_id,
      status: "BLOCKED",
      http_status: 403,
      extractable_fields: [],
      reason: blocked.reason,
      key: "NOT_REQUIRED",
      probed: false,
    });
  }

  for (const probe of PROBEABLE) {
    seen.add(probe.source_id);
    try {
      const { status, text } = await fetchText(probe.url);
      const fields = status === 200 ? probe.extract(text) : [];
      rows.push({
        source_id: probe.source_id,
        status: classifyHttp(status, fields.length),
        http_status: status,
        extractable_fields: fields,
        reason: status === 200 ? (fields.length ? "http_200_extracted" : "http_200_no_extractable_fields") : `http_${status}`,
        key: keyStatus(probe.keyEnv),
        probed: true,
      });
    } catch (e) {
      rows.push({
        source_id: probe.source_id,
        status: "UNAVAILABLE",
        http_status: null,
        extractable_fields: [],
        reason: e instanceof Error ? e.message : String(e),
        key: keyStatus(probe.keyEnv),
        probed: true,
      });
    }
  }

  for (const src of RESEARCH_SOURCE_CATALOGUE) {
    if (seen.has(src.source_id)) continue;
    seen.add(src.source_id);
    const tokenEnv =
      src.source_id === "the-odds-api"
        ? "ODDS_API_KEY"
        : src.source_id === "api-sports" || src.source_id === "api-football"
          ? "API_SPORTS_KEY"
          : null;
    const key = keyStatus(tokenEnv);
    let status: SourceRuntimeStatus = "UNAVAILABLE";
    let reason = src.notes;
    if (src.adapter === "POLICY_DENIED") {
      status = "BLOCKED";
      reason = "policy_denied — not revived";
    } else if (src.adapter === "MISSING_ADAPTER") {
      status = "UNAVAILABLE";
      reason = "missing_adapter";
    } else if (src.adapter === "CACHE_ONLY") {
      status = "PARTIAL";
      reason = "cache_only — no live probe";
    } else if (tokenEnv && key === "KEY_MISSING") {
      status = "UNAVAILABLE";
      reason = "KEY_MISSING";
    } else {
      status = "PARTIAL";
      reason = "catalogued_not_probed_this_cycle";
    }
    rows.push({
      source_id: src.source_id,
      status,
      http_status: null,
      extractable_fields: [],
      reason,
      key,
      probed: false,
    });
  }

  return rows;
}
