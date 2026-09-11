/**
 * Discover upcoming football events from TheSportsDB (no Odds API credits).
 * Uses only real provider IDs returned by the API. Dedupes by date+teams identity.
 */
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";
import { canonicalEventId044 } from "@/domain/eval/permanent-044/normalize";
import { appendEvent044, appendJsonl044, type Store044 } from "@/domain/eval/permanent-044/store";
import { eventIdentityKey, eventsShareIdentity } from "@/domain/eval/data-intelligence/research/event-identity";
import {
  THESPORTSDB_LEAGUES,
  eventsNextLeagueSportsDb,
  eventsNextTeamSportsDb,
  searchSportsDbTeam,
  sportsDbKickoffIso,
  type SportsDbEvent,
} from "@/domain/eval/data-intelligence/research/thesportsdb";
import { fetchWikipediaLeaguePage } from "@/domain/eval/data-intelligence/research/wikipedia-league";

function sha(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function eventIdFromSportsDb(idEvent: string): string {
  return `tsdb_${sha(`thesportsdb|${idEvent}`).slice(0, 20)}`;
}

export function sportsDbEventToPermanent(ev: SportsDbEvent, collectedAt: string): PermanentEvent044 | null {
  const kickoff = sportsDbKickoffIso(ev);
  if (!kickoff) return null;
  const sport = "soccer";
  const competition = ev.strLeague ?? ev.idLeague ?? "unknown";
  const canonical = canonicalEventId044({
    sport,
    competition,
    home: ev.strHomeTeam,
    away: ev.strAwayTeam,
    kickoff_utc: kickoff,
  });
  const fixture =
    ev.idAPIfootball && /^\d+$/.test(ev.idAPIfootball) ? Number(ev.idAPIfootball) : null;
  return {
    event_id: eventIdFromSportsDb(ev.idEvent),
    canonical_event_id: canonical,
    source: "thesportsdb",
    source_event_id: ev.idEvent,
    source_event_ids: [ev.idEvent],
    sport,
    competition,
    country: ev.strCountry,
    home_or_a: ev.strHomeTeam,
    away_or_b: ev.strAwayTeam,
    kickoff_utc: kickoff,
    collected_at_utc: collectedAt,
    available_at_utc: collectedAt,
    semantic_level: "STRICT",
    data_quality: 0.7,
    fingerprint: sha(["event", "thesportsdb", ev.idEvent, canonical, kickoff].join("|")),
    status: "OK",
    origin: "DISCOVERED_LIVE",
    first_seen_at: collectedAt,
    last_seen_at: collectedAt,
    canonicalization_status: "MATCH_EXACT",
    thesportsdb_event_id: ev.idEvent,
    api_football_fixture_id: ev.idAPIfootball,
    fixture_id: fixture,
  };
}

function findExisting(store: Store044, candidate: PermanentEvent044): PermanentEvent044 | null {
  for (const e of store.events) {
    if (e.source_event_id === candidate.source_event_id) return e;
    if (e.thesportsdb_event_id && e.thesportsdb_event_id === candidate.thesportsdb_event_id) return e;
    if (eventsShareIdentity(e, candidate)) return e;
  }
  return null;
}

export type DiscoverTheSportsDbResult = {
  leagues_queried: number;
  events_seen: number;
  events_inserted: number;
  duplicates: number;
  http_errors: number;
  truncated_responses: number;
  team_lookups: number;
  wikipedia_teams: number;
};

export async function runTheSportsDbDiscover(input: {
  store: Store044;
  nowIso: string;
  fetchImpl?: typeof fetch;
  maxTeamNext?: number;
}): Promise<DiscoverTheSportsDbResult> {
  const result: DiscoverTheSportsDbResult = {
    leagues_queried: 0,
    events_seen: 0,
    events_inserted: 0,
    duplicates: 0,
    http_errors: 0,
    truncated_responses: 0,
    team_lookups: 0,
    wikipedia_teams: 0,
  };
  const seenIds = new Set<string>();
  const teamIds = new Set<string>();
  const deps = input.fetchImpl ? { fetchImpl: input.fetchImpl } : undefined;

  const ingest = (raw: SportsDbEvent) => {
    if (seenIds.has(raw.idEvent)) return;
    seenIds.add(raw.idEvent);
    result.events_seen += 1;
    if (raw.idHomeTeam) teamIds.add(raw.idHomeTeam);
    if (raw.idAwayTeam) teamIds.add(raw.idAwayTeam);
    const pev = sportsDbEventToPermanent(raw, input.nowIso);
    if (!pev) return;
    const existing = findExisting(input.store, pev);
    if (existing) {
      result.duplicates += 1;
      appendJsonl044(join(input.store.root, "event-identity.jsonl"), {
        at: input.nowIso,
        identity_key: eventIdentityKey({
          home: pev.home_or_a,
          away: pev.away_or_b,
          kickoff: pev.kickoff_utc,
        }),
        event_id: existing.event_id,
        thesportsdb_event_id: raw.idEvent,
        api_football_fixture_id: raw.idAPIfootball,
        source: "thesportsdb",
        merged: true,
      });
      if (!existing.thesportsdb_event_id) existing.thesportsdb_event_id = raw.idEvent;
      if (!existing.api_football_fixture_id && raw.idAPIfootball) {
        existing.api_football_fixture_id = raw.idAPIfootball;
      }
      if (existing.fixture_id == null && pev.fixture_id != null) existing.fixture_id = pev.fixture_id;
      if (!existing.source_event_ids) existing.source_event_ids = [existing.source_event_id];
      if (!existing.source_event_ids.includes(raw.idEvent)) existing.source_event_ids.push(raw.idEvent);
      return;
    }
    const r = appendEvent044(input.store, pev);
    if (r === "ok") {
      result.events_inserted += 1;
      appendJsonl044(join(input.store.root, "event_catalog", "catalog.jsonl"), {
        ...pev,
        scheduled_start_utc: pev.kickoff_utc,
        discovered_at: input.nowIso,
      });
      appendJsonl044(join(input.store.root, "event-identity.jsonl"), {
        at: input.nowIso,
        identity_key: eventIdentityKey({
          home: pev.home_or_a,
          away: pev.away_or_b,
          kickoff: pev.kickoff_utc,
        }),
        event_id: pev.event_id,
        thesportsdb_event_id: raw.idEvent,
        api_football_fixture_id: raw.idAPIfootball,
        source: "thesportsdb",
        merged: false,
      });
    } else result.duplicates += 1;
  };

  for (const lg of THESPORTSDB_LEAGUES) {
    result.leagues_queried += 1;
    const next = await eventsNextLeagueSportsDb({ leagueId: lg.id, deps });
    if (next.error || next.http_status == null || next.http_status >= 400) {
      result.http_errors += 1;
      continue;
    }
    if (next.truncated) result.truncated_responses += 1;
    for (const ev of next.events) ingest(ev);
  }

  try {
    const wiki = await fetchWikipediaLeaguePage({
      division: "E0",
      nowIso: input.nowIso,
      fetchImpl: input.fetchImpl,
    });
    result.wikipedia_teams = wiki.teams.length;
    const seed = wiki.teams.slice(0, 24);
    for (const name of seed) {
      if (teamIds.size >= (input.maxTeamNext ?? 48)) break;
      result.team_lookups += 1;
      const t = await searchSportsDbTeam({ name, deps });
      if (t.team?.idTeam) teamIds.add(t.team.idTeam);
    }
  } catch {
    /* Wikipedia seed optional */
  }

  let teamNext = 0;
  const cap = input.maxTeamNext ?? 40;
  for (const tid of teamIds) {
    if (teamNext >= cap) break;
    teamNext += 1;
    const nxt = await eventsNextTeamSportsDb({ teamId: tid, deps });
    if (nxt.error || nxt.http_status == null || nxt.http_status >= 400) {
      result.http_errors += 1;
      continue;
    }
    if (nxt.truncated) result.truncated_responses += 1;
    for (const ev of nxt.events) ingest(ev);
  }

  return result;
}
