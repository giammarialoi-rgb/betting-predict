/**
 * Discover upcoming football events from ESPN public scoreboard JSON.
 * Uses only real ESPN event IDs. Dedupes by date+teams identity.
 */
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";
import { canonicalEventId044 } from "@/domain/eval/permanent-044/normalize";
import { appendEvent044, appendJsonl044, type Store044 } from "@/domain/eval/permanent-044/store";
import { eventIdentityKey, eventsShareIdentity } from "@/domain/eval/data-intelligence/research/event-identity";
import {
  ESPN_LEAGUES,
  fetchEspnScoreboard,
  type EspnEvent,
} from "@/domain/eval/data-intelligence/research/espn-scoreboard";

function sha(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function eventIdFromEspn(espnEventId: string): string {
  return `espn_${sha(`espn|${espnEventId}`).slice(0, 20)}`;
}

export function espnEventToPermanent(ev: EspnEvent, collectedAt: string): PermanentEvent044 {
  const sport = "soccer";
  const canonical = canonicalEventId044({
    sport,
    competition: ev.competition,
    home: ev.home,
    away: ev.away,
    kickoff_utc: ev.kickoff_utc,
  });
  return {
    event_id: eventIdFromEspn(ev.espn_event_id),
    canonical_event_id: canonical,
    source: "espn",
    source_event_id: ev.espn_event_id,
    source_event_ids: [ev.espn_event_id],
    sport,
    competition: ev.competition,
    country: ev.country,
    home_or_a: ev.home,
    away_or_b: ev.away,
    kickoff_utc: ev.kickoff_utc,
    collected_at_utc: collectedAt,
    available_at_utc: collectedAt,
    semantic_level: "STRICT",
    data_quality: 0.75,
    fingerprint: sha(["event", "espn", ev.espn_event_id, canonical, ev.kickoff_utc].join("|")),
    status: "OK",
    origin: "DISCOVERED_LIVE",
    first_seen_at: collectedAt,
    last_seen_at: collectedAt,
    canonicalization_status: "MATCH_EXACT",
    espn_event_id: ev.espn_event_id,
  };
}

function findExisting(store: Store044, candidate: PermanentEvent044): PermanentEvent044 | null {
  for (const e of store.events) {
    if (e.source_event_id === candidate.source_event_id) return e;
    if (e.espn_event_id && e.espn_event_id === candidate.espn_event_id) return e;
    if (eventsShareIdentity(e, candidate)) return e;
  }
  return null;
}

function yyyymmddUtc(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

export type DiscoverEspnResult = {
  leagues_queried: number;
  days_queried: number;
  events_seen: number;
  events_inserted: number;
  duplicates: number;
  http_errors: number;
};

export async function runEspnDiscover(input: {
  store: Store044;
  nowIso: string;
  fetchImpl?: typeof fetch;
  daysAhead?: number;
}): Promise<DiscoverEspnResult> {
  const result: DiscoverEspnResult = {
    leagues_queried: 0,
    days_queried: 0,
    events_seen: 0,
    events_inserted: 0,
    duplicates: 0,
    http_errors: 0,
  };
  const seen = new Set<string>();
  const start = Date.parse(input.nowIso);
  const days = input.daysAhead ?? 8;
  const dates: string[] = [];
  for (let i = 0; i < days; i += 1) {
    dates.push(yyyymmddUtc(new Date(start + i * 86400000).toISOString()));
  }

  for (const lg of ESPN_LEAGUES) {
    result.leagues_queried += 1;
    for (const day of dates) {
      result.days_queried += 1;
      const board = await fetchEspnScoreboard({
        slug: lg.slug,
        yyyymmdd: day,
        competition: lg.competition,
        country: lg.country,
        fetchImpl: input.fetchImpl,
      });
      if (board.error || board.http_status == null || board.http_status >= 400) {
        result.http_errors += 1;
        continue;
      }
      for (const raw of board.events) {
        if (seen.has(raw.espn_event_id)) continue;
        seen.add(raw.espn_event_id);
        result.events_seen += 1;
        const pev = espnEventToPermanent(raw, input.nowIso);
        const existing = findExisting(input.store, pev);
        if (existing) {
          result.duplicates += 1;
          if (!existing.espn_event_id) existing.espn_event_id = raw.espn_event_id;
          if (!existing.source_event_ids) existing.source_event_ids = [existing.source_event_id];
          if (!existing.source_event_ids.includes(raw.espn_event_id)) {
            existing.source_event_ids.push(raw.espn_event_id);
          }
          appendJsonl044(join(input.store.root, "event-identity.jsonl"), {
            at: input.nowIso,
            identity_key: eventIdentityKey({
              home: pev.home_or_a,
              away: pev.away_or_b,
              kickoff: pev.kickoff_utc,
            }),
            event_id: existing.event_id,
            espn_event_id: raw.espn_event_id,
            source: "espn",
            merged: true,
          });
          continue;
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
            espn_event_id: raw.espn_event_id,
            source: "espn",
            merged: false,
          });
        } else result.duplicates += 1;
      }
    }
  }
  return result;
}
