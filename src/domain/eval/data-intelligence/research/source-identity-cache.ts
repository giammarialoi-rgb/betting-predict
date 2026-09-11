/**
 * Persist observed source event IDs / URLs. Never invent IDs.
 * Reuse across cycles so discovery is not repeated.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";

export type SourceEventIdentity = {
  event_id: string;
  api_sports_fixture_id: number | null;
  api_sports_home_id: number | null;
  api_sports_away_id: number | null;
  understat_match_id: string | null;
  fbref_match_url: string | null;
  sofascore_event_id: string | null;
  source_event_url: Record<string, string>;
  source_team_ids: Record<string, { home: string | null; away: string | null }>;
  source_competition_id: Record<string, string | null>;
  referee_name: string | null;
  venue_name: string | null;
  retrieved_at: string;
};

type CacheFile = { updated_at: string; events: Record<string, SourceEventIdentity> };

export function sourceIdentityPath(root = permanentRoot044()): string {
  return join(root, "identity", "source-events.json");
}

function empty(eventId: string): SourceEventIdentity {
  return {
    event_id: eventId,
    api_sports_fixture_id: null,
    api_sports_home_id: null,
    api_sports_away_id: null,
    understat_match_id: null,
    fbref_match_url: null,
    sofascore_event_id: null,
    source_event_url: {},
    source_team_ids: {},
    source_competition_id: {},
    referee_name: null,
    venue_name: null,
    retrieved_at: new Date(0).toISOString(),
  };
}

export function loadSourceIdentityCache(root = permanentRoot044()): CacheFile {
  const p = sourceIdentityPath(root);
  if (!existsSync(p)) return { updated_at: new Date(0).toISOString(), events: {} };
  try {
    return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")) as CacheFile;
  } catch {
    return { updated_at: new Date(0).toISOString(), events: {} };
  }
}

function save(file: CacheFile, root: string): void {
  mkdirSync(join(root, "identity"), { recursive: true });
  file.updated_at = new Date().toISOString();
  writeFileSync(sourceIdentityPath(root), JSON.stringify(file, null, 2), "utf8");
}

export function getSourceEventIdentity(eventId: string, root = permanentRoot044()): SourceEventIdentity | null {
  const file = loadSourceIdentityCache(root);
  return file.events[eventId] ?? null;
}

export function mergeSourceEventIdentity(
  eventId: string,
  patch: Partial<SourceEventIdentity>,
  root = permanentRoot044(),
): SourceEventIdentity {
  const file = loadSourceIdentityCache(root);
  const prev = file.events[eventId] ?? empty(eventId);
  const next: SourceEventIdentity = {
    ...prev,
    ...patch,
    event_id: eventId,
    source_event_url: { ...prev.source_event_url, ...(patch.source_event_url ?? {}) },
    source_team_ids: { ...prev.source_team_ids, ...(patch.source_team_ids ?? {}) },
    source_competition_id: { ...prev.source_competition_id, ...(patch.source_competition_id ?? {}) },
    retrieved_at: patch.retrieved_at ?? new Date().toISOString(),
  };
  // Never overwrite a known id with null
  if (patch.api_sports_fixture_id == null && prev.api_sports_fixture_id != null) {
    next.api_sports_fixture_id = prev.api_sports_fixture_id;
  }
  if (patch.understat_match_id == null && prev.understat_match_id != null) {
    next.understat_match_id = prev.understat_match_id;
  }
  file.events[eventId] = next;
  save(file, root);
  return next;
}
