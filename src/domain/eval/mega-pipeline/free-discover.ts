/**
 * Free-source fixture discovery → Lab B events + research jobs.
 * Does NOT invent IDs. Does NOT require The Odds API.
 * ESPN may be BLOCKED (403) — continue with OpenLigaDB / TheSportsDB.
 */
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  ESPN_SCOREBOARDS,
  OPENLIGA_LEAGUES,
  THESPORTSDB_LEAGUES,
  espnScoreboardUrl,
  openLigaMatchUrl,
  theSportsDbNextUrl,
} from "@/domain/eval/acquisition-engine/catalog";
import { acquisitionGet } from "@/domain/eval/acquisition-engine/http";
import {
  parseEspnScoreboard,
  type EspnEvent,
} from "@/domain/eval/acquisition-engine/sources/espn";
import {
  parseOpenLigaMatches,
  type OpenLigaMatch,
} from "@/domain/eval/acquisition-engine/sources/openligadb";
import {
  parseTheSportsDbEvents,
  type TheSportsDbEvent,
} from "@/domain/eval/acquisition-engine/sources/thesportsdb";
import { ensurePermanentDirs044, permanentRoot044, sportKind044 } from "@/domain/eval/permanent-044/config";
import { canonicalEventId044 } from "@/domain/eval/permanent-044/normalize";
import {
  appendEvent044,
  appendJsonl044,
  appendJournal044,
  loadStore044,
} from "@/domain/eval/permanent-044/store";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";
import { enqueueUpcomingEvents } from "@/domain/eval/data-intelligence/research/queue";
import { upsertResearchJob } from "@/domain/eval/mega-pipeline/neon-runtime";
import type { FreeDiscoverResult, FreeFixtureCandidate } from "@/domain/eval/mega-pipeline/types";

function sha(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function eventIdFromSource(source: string, sourceEventId: string): string {
  return `mega_${sha(`${source}|${sourceEventId}`).slice(0, 20)}`;
}

function openLigaKickoff(m: OpenLigaMatch): string | null {
  const raw = m.matchDateTimeUTC || m.matchDateTime;
  if (!raw) return null;
  const t = Date.parse(raw.endsWith("Z") || raw.includes("+") ? raw : `${raw}Z`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function openLigaScore(m: OpenLigaMatch): { home: number | null; away: number | null } {
  const results = m.matchResults ?? [];
  // Prefer end result (resultTypeID 2) when present
  const end = results.find((r) => r.resultTypeID === 2) ?? results[results.length - 1];
  if (!end) return { home: null, away: null };
  return {
    home: typeof end.pointsTeam1 === "number" ? end.pointsTeam1 : null,
    away: typeof end.pointsTeam2 === "number" ? end.pointsTeam2 : null,
  };
}

function theSportsKickoff(e: TheSportsDbEvent): string | null {
  if (!e.dateEvent) return null;
  const time = (e.strTime && e.strTime !== "00:00:00" ? e.strTime : "12:00:00").slice(0, 8);
  const t = Date.parse(`${e.dateEvent}T${time}Z`);
  return Number.isFinite(t) ? new Date(t).toISOString() : `${e.dateEvent}T12:00:00.000Z`;
}

function toCandidateFromOpenLiga(m: OpenLigaMatch, url: string): FreeFixtureCandidate | null {
  const home = m.team1?.teamName?.trim();
  const away = m.team2?.teamName?.trim();
  if (!home || !away || m.matchID == null) return null;
  const score = openLigaScore(m);
  return {
    source: "openligadb",
    source_event_id: String(m.matchID),
    sport: "football",
    competition: m.leagueName ?? "openligadb",
    home,
    away,
    kickoff_utc: openLigaKickoff(m),
    kickoff_precision: openLigaKickoff(m) ? "exact" : "unknown",
    finished: Boolean(m.matchIsFinished),
    home_score: score.home,
    away_score: score.away,
    live: !m.matchIsFinished && Boolean(m.matchDateTime),
    minute: null,
    source_url: url,
  };
}

function toCandidateFromTheSports(e: TheSportsDbEvent, url: string): FreeFixtureCandidate | null {
  const home = e.strHomeTeam?.trim();
  const away = e.strAwayTeam?.trim();
  if (!home || !away || !e.idEvent) return null;
  const kick = theSportsKickoff(e);
  const dateOnly = !e.strTime || e.strTime === "00:00:00";
  return {
    source: "thesportsdb",
    source_event_id: e.idEvent,
    sport: "football",
    competition: e.strLeague ?? "thesportsdb",
    home,
    away,
    kickoff_utc: kick,
    kickoff_precision: dateOnly ? "date_only" : "exact",
    finished: false,
    home_score: null,
    away_score: null,
    live: false,
    minute: null,
    source_url: url,
  };
}

function toCandidateFromEspn(e: EspnEvent, url: string): FreeFixtureCandidate | null {
  if (!e.home || !e.away || !e.id) return null;
  return {
    source: "espn",
    source_event_id: e.id,
    sport: e.sport ?? "football",
    competition: e.league ?? "espn",
    home: e.home,
    away: e.away,
    kickoff_utc: e.date ?? null,
    kickoff_precision: e.date ? "exact" : "unknown",
    finished: Boolean(e.completed),
    home_score: null,
    away_score: null,
    live: !e.completed,
    minute: null,
    source_url: url,
  };
}

function candidateToPermanent(c: FreeFixtureCandidate, nowIso: string): PermanentEvent044 | null {
  if (!c.home || !c.away) return null;
  if (c.home.length < 2 || c.away.length < 2) return null;
  const sport = sportKind044(c.sport);
  const kickOk = Boolean(c.kickoff_utc && Number.isFinite(Date.parse(c.kickoff_utc)));
  const canonical = canonicalEventId044({
    sport,
    competition: c.competition,
    home: c.home,
    away: c.away,
    kickoff_utc: kickOk ? c.kickoff_utc : null,
  });
  const event_id = eventIdFromSource(c.source, c.source_event_id);
  const fingerprint = sha(
    ["event", c.source, c.source_event_id, canonical, c.kickoff_utc ?? "", c.home, c.away].join("|"),
  );
  const semantic =
    c.kickoff_precision === "exact" && kickOk
      ? "STRICT"
      : c.kickoff_precision === "date_only"
        ? "RESEARCH"
        : "PARTIAL";
  return {
    event_id,
    canonical_event_id: canonical,
    source: c.source,
    source_event_id: c.source_event_id,
    source_event_ids: [c.source_event_id],
    sport,
    competition: c.competition,
    country: null,
    home_or_a: c.home,
    away_or_b: c.away,
    kickoff_utc: kickOk ? c.kickoff_utc : null,
    collected_at_utc: nowIso,
    available_at_utc: null,
    semantic_level: semantic,
    data_quality: semantic === "STRICT" ? 0.7 : semantic === "RESEARCH" ? 0.45 : 0.3,
    fingerprint,
    status: kickOk ? "OK" : "INVALID_KICKOFF",
    origin: "DISCOVERED_LIVE",
    first_seen_at: nowIso,
    last_seen_at: nowIso,
    canonicalization_status: "MATCH_EXACT",
  };
}

async function collectOpenLiga(
  fetchImpl?: typeof fetch,
): Promise<{ candidates: FreeFixtureCandidate[]; http: number | null; blocked: boolean }> {
  const candidates: FreeFixtureCandidate[] = [];
  let lastHttp: number | null = null;
  let blocked = false;
  for (const league of OPENLIGA_LEAGUES) {
    const url = openLigaMatchUrl(league.shortcut);
    const got = await acquisitionGet({
      url,
      sourceId: "openligadb",
      minIntervalMs: fetchImpl ? 0 : 800,
      fetchImpl,
      maxRetries: 1,
    });
    lastHttp = got.status;
    if (got.status === 403) blocked = true;
    if (!got.ok) continue;
    for (const m of parseOpenLigaMatches(got.text)) {
      const c = toCandidateFromOpenLiga(m, got.url);
      if (c) candidates.push(c);
    }
  }
  return { candidates, http: lastHttp, blocked };
}

async function collectTheSportsDb(
  fetchImpl?: typeof fetch,
): Promise<{ candidates: FreeFixtureCandidate[]; http: number | null; blocked: boolean }> {
  const candidates: FreeFixtureCandidate[] = [];
  let lastHttp: number | null = null;
  let blocked = false;
  for (const league of THESPORTSDB_LEAGUES) {
    const url = theSportsDbNextUrl(league.id);
    const got = await acquisitionGet({
      url,
      sourceId: "thesportsdb",
      minIntervalMs: fetchImpl ? 0 : 1_200,
      fetchImpl,
      maxRetries: 1,
    });
    lastHttp = got.status;
    if (got.status === 403) blocked = true;
    if (!got.ok) continue;
    for (const e of parseTheSportsDbEvents(got.text)) {
      const c = toCandidateFromTheSports(e, got.url);
      if (c) candidates.push(c);
    }
  }
  return { candidates, http: lastHttp, blocked };
}

async function collectEspn(
  fetchImpl?: typeof fetch,
): Promise<{ candidates: FreeFixtureCandidate[]; http: number | null; blocked: boolean }> {
  const candidates: FreeFixtureCandidate[] = [];
  let lastHttp: number | null = null;
  let blocked = false;
  let anyOk = false;
  for (const board of ESPN_SCOREBOARDS.slice(0, 8)) {
    const url = espnScoreboardUrl(board);
    const got = await acquisitionGet({
      url,
      sourceId: "espn",
      minIntervalMs: fetchImpl ? 0 : 1_000,
      fetchImpl,
      maxRetries: 0,
    });
    lastHttp = got.status;
    if (got.status === 403 || /access denied|just a moment|cf-challenge/i.test(got.text.slice(0, 500))) {
      blocked = true;
      continue;
    }
    if (!got.ok) continue;
    anyOk = true;
    for (const e of parseEspnScoreboard(got.text, board.slug)) {
      const c = toCandidateFromEspn(e, got.url);
      if (c) candidates.push(c);
    }
  }
  if (!anyOk && blocked) return { candidates: [], http: lastHttp, blocked: true };
  return { candidates, http: lastHttp, blocked };
}

/**
 * Discover ALL available free fixtures into Lab B. Queue is unbounded;
 * research budget remains separate.
 */
export async function runFreeDiscover(input: {
  labBRoot?: string;
  nowIso?: string;
  fetchImpl?: typeof fetch;
  persistNeon?: boolean;
  includeEspn?: boolean;
} = {}): Promise<FreeDiscoverResult> {
  const labB = input.labBRoot ?? permanentRoot044();
  ensurePermanentDirs044(labB);
  const nowIso = input.nowIso ?? new Date().toISOString();
  const store = loadStore044(labB);

  const by_source: FreeDiscoverResult["by_source"] = {};
  const sources_tried: string[] = [];
  const all: FreeFixtureCandidate[] = [];

  sources_tried.push("openligadb");
  const ol = await collectOpenLiga(input.fetchImpl);
  by_source.openligadb = {
    seen: ol.candidates.length,
    inserted: 0,
    blocked: ol.blocked,
    http: ol.http,
  };
  all.push(...ol.candidates);

  sources_tried.push("thesportsdb");
  const ts = await collectTheSportsDb(input.fetchImpl);
  by_source.thesportsdb = {
    seen: ts.candidates.length,
    inserted: 0,
    blocked: ts.blocked,
    http: ts.http,
  };
  all.push(...ts.candidates);

  if (input.includeEspn !== false) {
    sources_tried.push("espn");
    const es = await collectEspn(input.fetchImpl);
    by_source.espn = {
      seen: es.candidates.length,
      inserted: 0,
      blocked: es.blocked,
      http: es.http,
    };
    all.push(...es.candidates);
  }

  let events_inserted = 0;
  let events_updated = 0;
  let duplicates = 0;
  let identity_uncertain = 0;
  const sample_event_ids: string[] = [];
  const newIds: string[] = [];

  // Dedup by canonical within this batch (prefer openligadb > thesportsdb > espn)
  const sourceRank: Record<string, number> = { openligadb: 3, thesportsdb: 2, espn: 1 };
  const bestByCanonical = new Map<string, FreeFixtureCandidate>();
  for (const c of all) {
    const pevProbe = candidateToPermanent(c, nowIso);
    if (!pevProbe) {
      identity_uncertain += 1;
      continue;
    }
    const prev = bestByCanonical.get(pevProbe.canonical_event_id);
    if (!prev || (sourceRank[c.source] ?? 0) > (sourceRank[prev.source] ?? 0)) {
      bestByCanonical.set(pevProbe.canonical_event_id, c);
    }
  }

  for (const c of bestByCanonical.values()) {
    const pev = candidateToPermanent(c, nowIso);
    if (!pev) {
      identity_uncertain += 1;
      continue;
    }

    // Merge into existing same-source event or same canonical
    const existing =
      store.events.find((e) => e.event_id === pev.event_id) ??
      store.events.find((e) => e.canonical_event_id === pev.canonical_event_id);

    if (existing) {
      duplicates += 1;
      events_updated += 1;
      appendJsonl044(join(labB, "event_catalog", "catalog.jsonl"), {
        kind: "FREE_DISCOVER_SEEN",
        at: nowIso,
        event_id: existing.event_id,
        source: c.source,
        source_event_id: c.source_event_id,
      });
      if (input.persistNeon !== false) {
        await upsertResearchJob({
          event_id: existing.event_id,
          status: "DISCOVERED",
          discovered_at: nowIso,
          payload: { source: c.source, source_event_id: c.source_event_id },
        });
      }
      continue;
    }

    const r = appendEvent044(store, pev);
    if (r === "ok") {
      events_inserted += 1;
      newIds.push(pev.event_id);
      if (sample_event_ids.length < 12) sample_event_ids.push(pev.event_id);
      by_source[c.source]!.inserted += 1;
      appendJsonl044(join(labB, "event_catalog", "catalog.jsonl"), {
        ...pev,
        scheduled_start_utc: pev.kickoff_utc,
        discovered_at: nowIso,
        free_discover: true,
      });
      if (input.persistNeon !== false) {
        await upsertResearchJob({
          event_id: pev.event_id,
          status: "QUEUED",
          discovered_at: nowIso,
          payload: {
            source: c.source,
            source_event_id: c.source_event_id,
            home: c.home,
            away: c.away,
            competition: c.competition,
          },
        });
      }
    } else {
      duplicates += 1;
    }
  }

  if (newIds.length) {
    const fresh = store.events.filter((e) => newIds.includes(e.event_id));
    enqueueUpcomingEvents({
      events: fresh,
      nowMs: Date.parse(nowIso),
      nowIso,
      root: labB,
    });
  }

  appendJournal044(labB, {
    kind: "FREE_DISCOVER",
    at: nowIso,
    fixtures_seen: all.length,
    events_inserted,
    duplicates,
    by_source,
  });

  return {
    sources_tried,
    fixtures_seen: all.length,
    events_inserted,
    events_updated,
    duplicates,
    identity_uncertain,
    by_source,
    sample_event_ids,
  };
}
