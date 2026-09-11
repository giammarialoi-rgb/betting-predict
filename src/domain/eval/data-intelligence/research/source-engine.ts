/**
 * Operational source engine: capabilities, fallback, health from real research-status.
 * HTTP 200 homepage is never HEALTHY. Missing adapter stays missing.
 */
import { existsSync, readFileSync } from "node:fs";
import { RESEARCH_SOURCE_CATALOGUE } from "@/domain/eval/data-intelligence/research/source-catalogue";
import { researchStatusPath, type ResearchStatusRow } from "@/domain/eval/data-intelligence/research/status";
import { FEATURE_SOURCE_PRIORITY, type FeatureFamilyId } from "@/domain/eval/data-intelligence/research/data-priority";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";

export type SourceCapability =
  | "fixtures"
  | "scores"
  | "lineups"
  | "injuries"
  | "statistics"
  | "xg"
  | "historical"
  | "elo"
  | "weather"
  | "news"
  | "market_odds"
  | "team_stats";

export type SourceEngineEntry = {
  source_id: string;
  name: string;
  sport: string;
  capabilities: SourceCapability[];
  adapter: string;
  scraping_enabled: boolean;
  api_enabled: boolean;
  market_layer: boolean;
  enabled_in_production: boolean;
  missing_adapter: boolean;
  policy_disabled: boolean;
  priority: number;
  last_attempt: string | null;
  last_success: string | null;
  last_failure: string | null;
  events_found: number;
  observations_found: number;
  blocked_count: number;
  no_event_count: number;
  parser_error_count: number;
  success_rate: number | null;
  last_event_label: string | null;
  status: "ACTIVE" | "DEGRADED" | "BLOCKED" | "MISSING_ADAPTER" | "NO_EVENT" | "IDLE";
};

export const SOURCE_CAPABILITIES: Record<string, SourceCapability[]> = {
  "api-sports": ["fixtures", "lineups", "injuries", "statistics"],
  "open-meteo": ["weather"],
  "football-data-co-uk": ["historical", "scores", "statistics"],
  clubelo: ["elo"],
  openligadb: ["fixtures", "scores", "historical"],
  thesportsdb: ["fixtures"],
  espn: ["fixtures", "scores"],
  openfootball: ["historical"],
  "bbc-sport": ["news"],
  "guardian-football": ["news"],
  gazzetta: ["news"],
  statsbomb: ["xg", "historical"],
  "football-data-org": ["fixtures", "scores", "historical"],
  "the-odds-api": ["market_odds", "fixtures"],
  "api-football": ["fixtures", "lineups", "injuries"],
  fbref: ["historical", "team_stats", "xg"],
  understat: ["xg", "historical"],
  uefa: ["fixtures", "lineups"],
  sofascore: ["fixtures", "scores", "lineups", "injuries", "statistics"],
  directa: ["fixtures", "scores", "lineups"],
  flashscore: ["fixtures", "scores"],
  soccerway: ["fixtures", "historical"],
  "club-football-match-data": ["historical"],
  whoscored: ["statistics", "xg"],
  opta: ["statistics", "xg"],
  "the-analyst": ["xg", "team_stats"],
  "sky-sport": ["news"],
  ansa: ["news"],
};

function loadRecentStatus(root: string, maxLines = 8000): ResearchStatusRow[] {
  const p = researchStatusPath(root);
  if (!existsSync(p)) return [];
  const lines = readFileSync(p, "utf8").split(/\n/).filter(Boolean);
  const slice = lines.slice(Math.max(0, lines.length - maxLines));
  const out: ResearchStatusRow[] = [];
  for (const line of slice) {
    try {
      out.push(JSON.parse(line.replace(/^\uFEFF/, "")) as ResearchStatusRow);
    } catch {
      /* skip */
    }
  }
  return out;
}

function typedObservation(row: ResearchStatusRow): boolean {
  const fields = row.fields_extracted ?? [];
  if (!row.ok && row.phase !== "OK") return false;
  if (fields.some((f) => f === "page_mentions_both_teams" || f === "page_mentions_xg")) {
    return false;
  }
  return fields.length > 0 && row.ok;
}

export function fallbackChainFor(family: FeatureFamilyId): string[] {
  return FEATURE_SOURCE_PRIORITY[family] ?? [];
}

export function nextFallbackSource(family: FeatureFamilyId, failedSourceId: string): string | null {
  const chain = fallbackChainFor(family);
  const i = chain.indexOf(failedSourceId);
  if (i < 0) return chain[0] ?? null;
  return chain[i + 1] ?? null;
}

export function buildOperationalSourceEngine(input?: {
  labBRoot?: string;
  eventLabels?: Map<string, string>;
}): SourceEngineEntry[] {
  const root = input?.labBRoot ?? permanentRoot044();
  const rows = loadRecentStatus(root);
  const bySource = new Map<string, ResearchStatusRow[]>();
  for (const r of rows) {
    const list = bySource.get(r.source_id) ?? [];
    list.push(r);
    bySource.set(r.source_id, list);
  }

  return RESEARCH_SOURCE_CATALOGUE.map((cat, idx) => {
    const attempts = bySource.get(cat.source_id) ?? [];
    const last = attempts[attempts.length - 1];
    let last_success: string | null = null;
    let last_failure: string | null = null;
    let events_found = 0;
    let observations_found = 0;
    let blocked_count = 0;
    let no_event_count = 0;
    let parser_error_count = 0;
    let last_event_label: string | null = null;
    for (const a of attempts) {
      if (a.phase === "BLOCKED" || a.parser_status === "BLOCKED") blocked_count += 1;
      if (
        a.parser_status === "NO_EVENT" ||
        (a.phase === "UNAVAILABLE" && /NO_EVENT|not contain both/i.test(a.reason ?? ""))
      ) {
        no_event_count += 1;
      }
      if (/PARSE|parser/i.test(a.parser_status ?? "") || a.phase === "PARSE") parser_error_count += 1;
      if (typedObservation(a) || (a.ok && a.phase === "OK" && (a.fields_extracted?.length ?? 0) > 0)) {
        events_found += 1;
        observations_found += a.fields_extracted?.length ?? 0;
        last_success = a.at;
        const label = input?.eventLabels?.get(a.event_id);
        if (label) last_event_label = label;
      } else if (!a.ok) {
        last_failure = a.at;
      }
    }
    const missing_adapter = cat.adapter === "MISSING_ADAPTER";
    const policy_disabled = cat.adapter === "POLICY_DENIED";
    const n = attempts.length;
    const success_rate = n === 0 ? null : events_found / n;
    let status: SourceEngineEntry["status"] = "IDLE";
    if (missing_adapter) status = "MISSING_ADAPTER";
    else if (policy_disabled) status = "MISSING_ADAPTER";
    else if (blocked_count > 0 && events_found === 0 && n > 0) status = "BLOCKED";
    else if (events_found > 0) status = success_rate != null && success_rate < 0.2 ? "DEGRADED" : "ACTIVE";
    else if (no_event_count > 0) status = "NO_EVENT";
    else if (n > 0) status = "DEGRADED";

    return {
      source_id: cat.source_id,
      name: cat.title,
      sport: cat.sport,
      capabilities: SOURCE_CAPABILITIES[cat.source_id] ?? [],
      adapter: cat.adapter,
      scraping_enabled: cat.adapter === "TEST_PROBE" || cat.adapter === "PRODUCTION_ADAPTER",
      api_enabled: cat.adapter === "PRODUCTION_ADAPTER" || cat.source_id === "api-sports" || cat.source_id === "the-odds-api",
      market_layer: cat.market_layer,
      enabled_in_production: !missing_adapter && !policy_disabled,
      missing_adapter,
      policy_disabled,
      priority: idx,
      last_attempt: last?.at ?? null,
      last_success,
      last_failure,
      events_found,
      observations_found,
      blocked_count,
      no_event_count,
      parser_error_count,
      success_rate,
      last_event_label,
      status,
    };
  });
}

export function sourceHealthScore(entry: SourceEngineEntry): number {
  if (entry.missing_adapter || entry.policy_disabled) return 0;
  if (entry.status === "BLOCKED") return 0.1;
  if (entry.status === "IDLE") return 0.3;
  const rate = entry.success_rate ?? 0;
  return Math.max(0, Math.min(1, rate));
}
