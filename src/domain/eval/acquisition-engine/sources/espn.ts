/**
 * ESPN unofficial site.api scoreboard JSON.
 * Allowlisted after a real unauthenticated 200 without CAPTCHA.
 * Status is honestly unofficial/unstable. No WAF tricks.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { acquisitionGet } from "@/domain/eval/acquisition-engine/http";
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import { persistCompareOnlyQuotes, registerAcquisitionSource } from "@/domain/eval/acquisition-engine/persist";
import { matchEventPair, pickUniqueDatedPair } from "@/domain/eval/data-intelligence/research/identity-match";
import { ESPN_SCOREBOARDS, espnScoreboardUrl } from "@/domain/eval/acquisition-engine/catalog";
import type {
  AcquisitionCycleInput,
  AcquisitionRecord,
  SourceLaneResult,
} from "@/domain/eval/acquisition-engine/types";

export type EspnEvent = {
  id?: string;
  date?: string;
  name?: string;
  home?: string | null;
  away?: string | null;
  league?: string | null;
  sport?: string | null;
  completed?: boolean;
  /** Real competitor score when ESPN publishes a finite integer. Never invented. */
  homeScore?: number | null;
  awayScore?: number | null;
  /** ESPN status.type.state: pre | in | post */
  statusState?: string | null;
  statusName?: string | null;
  statusDetail?: string | null;
  displayClock?: string | null;
  period?: number | null;
  oddsHome?: number | null;
  oddsDraw?: number | null;
  oddsAway?: number | null;
  bookmaker?: string | null;
};

function parsePublishedScore(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

function asRec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function decimalOdds(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 1 ? n : null;
}

export function parseEspnScoreboard(jsonText: string, leagueHint = ""): EspnEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  const root = asRec(parsed);
  if (!root) return [];
  const events = Array.isArray(root.events) ? root.events : [];
  const out: EspnEvent[] = [];
  for (const raw of events) {
    const ev = asRec(raw);
    if (!ev) continue;
    const comps = Array.isArray(ev.competitions) ? ev.competitions : [];
    const comp = asRec(comps[0]);
    const competitors = Array.isArray(comp?.competitors) ? comp!.competitors : [];
    let home: string | null = null;
    let away: string | null = null;
    for (const c of competitors) {
      const row = asRec(c);
      const team = asRec(row?.team);
      const name = typeof team?.displayName === "string" ? team.displayName : null;
      if (!name) continue;
      if (row?.homeAway === "home") home = name;
      else if (row?.homeAway === "away") away = name;
    }
    const oddsRaw = Array.isArray(comp?.odds) ? asRec(comp!.odds[0]) : null;
    const homeOdds = decimalOdds(oddsRaw?.homeOdds ?? oddsRaw?.homeOdd);
    const awayOdds = decimalOdds(oddsRaw?.awayOdds ?? oddsRaw?.awayOdd);
    const drawOdds = decimalOdds(oddsRaw?.drawOdds ?? oddsRaw?.drawOdd);
    const status = asRec(comp?.status) ?? asRec(ev.status);
    const type = asRec(status?.type);
    let homeScore: number | null = null;
    let awayScore: number | null = null;
    for (const c of competitors) {
      const row = asRec(c);
      if (!row) continue;
      const sc = parsePublishedScore(row.score);
      if (row.homeAway === "home") homeScore = sc;
      else if (row.homeAway === "away") awayScore = sc;
    }
    const periodRaw = status?.period;
    const period =
      typeof periodRaw === "number" && Number.isFinite(periodRaw)
        ? periodRaw
        : typeof periodRaw === "string" && Number.isFinite(Number(periodRaw))
          ? Number(periodRaw)
          : null;
    out.push({
      id: typeof ev.id === "string" ? ev.id : typeof ev.id === "number" ? String(ev.id) : undefined,
      date: typeof ev.date === "string" ? ev.date : undefined,
      name: typeof ev.name === "string" ? ev.name : undefined,
      home,
      away,
      league: leagueHint,
      sport: leagueHint === "nba" ? "basketball" : "football",
      completed: type?.completed === true,
      homeScore,
      awayScore,
      statusState: typeof type?.state === "string" ? type.state : null,
      statusName: typeof type?.name === "string" ? type.name : null,
      statusDetail:
        typeof type?.shortDetail === "string"
          ? type.shortDetail
          : typeof type?.detail === "string"
            ? type.detail
            : typeof type?.description === "string"
              ? type.description
              : null,
      displayClock: typeof status?.displayClock === "string" ? status.displayClock : null,
      period,
      oddsHome: homeOdds,
      oddsDraw: drawOdds,
      oddsAway: awayOdds,
      bookmaker: typeof oddsRaw?.provider === "object"
        ? String(asRec(oddsRaw?.provider)?.name ?? "") || null
        : typeof oddsRaw?.provider === "string"
          ? oddsRaw.provider
          : null,
    });
  }
  return out;
}

export async function runEspnLane(input: {
  url: string;
  nowIso: string;
  cwd: string;
  persistNeon: boolean;
  persistLabB?: boolean;
  labBRoot?: string;
  jsonText?: string;
  fetchImpl?: typeof fetch;
  labEvents?: AcquisitionCycleInput["labEvents"];
  maxRetries?: number;
}): Promise<SourceLaneResult> {
  const cacheDir = join(input.cwd, "data", "acquisition", "espn");
  mkdirSync(cacheDir, { recursive: true });

  const events: EspnEvent[] = [];
  const leagues: string[] = [];
  const sports = new Set<string>();
  let http = 200;
  let retries = 0;
  let url = input.url;
  let lastError: string | null = null;

  if (input.jsonText != null) {
    const parsed = parseEspnScoreboard(input.jsonText, "eng.1");
    writeFileSync(join(cacheDir, "eng.1.json"), input.jsonText, "utf8");
    events.push(...parsed);
    if (parsed.length) {
      leagues.push("eng.1");
      sports.add("football");
    }
  } else {
    for (const board of ESPN_SCOREBOARDS) {
      const got = await acquisitionGet({
        url: espnScoreboardUrl(board),
        sourceId: "espn",
        minIntervalMs: input.fetchImpl ? 0 : 1_000,
        fetchImpl: input.fetchImpl,
        maxRetries: input.maxRetries,
      });
      retries += got.retries;
      http = got.status;
      url = got.url;
      if (!got.ok) {
        lastError = got.error ?? `HTTP_${got.status}`;
        if (got.status === 403) {
          return emptyLane({
            source_id: "espn",
            url: got.url,
            status: "BLOCKED",
            http_status: 403,
            retries,
            reason: "HTTP_403",
            reason_it:
              "ESPN scoreboard ha restituito HTTP 403. Fonte non ufficiale lasciata BLOCKED. Nessun bypass.",
          });
        }
        continue;
      }
      const parsed = parseEspnScoreboard(got.text, board.slug);
      if (!parsed.length) continue;
      writeFileSync(join(cacheDir, `${board.slug}.json`), got.text, "utf8");
      events.push(...parsed);
      leagues.push(board.slug);
      sports.add("football");
    }
  }

  if (!events.length) {
    return emptyLane({
      source_id: "espn",
      url,
      status: http === 403 ? "BLOCKED" : lastError ? "NETWORK_ERROR" : "NO_DATA",
      http_status: http || null,
      retries,
      reason: lastError ?? "EMPTY_EVENTS",
      reason_it: "ESPN scoreboard non ha restituito eventi. Fonte non ufficiale; nessun dato inventato.",
    });
  }

  const records: AcquisitionRecord[] = [
    {
      source_id: "espn",
      kind: "fixtures",
      feature_key: "espn_events_parsed",
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
      extraction_method: "espn_site_api_scoreboard_unofficial",
      source_url: url,
      identity_status: "UNBOUND",
      reason_it: `${events.length} eventi ESPN scoreboard (non ufficiale/instabile) su ${leagues.join(", ")}.`,
    },
  ];

  let quotesStored = 0;
  for (const ev of input.labEvents ?? []) {
    const hits = events.filter((e) => e.home && e.away && matchEventPair(ev.home, ev.away, e.home, e.away).matched);
    const e = pickUniqueDatedPair(hits, (row) => row.date, ev.kickoff_utc);
    if (!e) continue;
    records.push({
      source_id: "espn",
      kind: "fixtures",
      feature_key: "espn_fixture",
      value: e.id ?? e.name ?? null,
      event_id: ev.event_id,
      home: e.home ?? ev.home,
      away: e.away ?? ev.away,
      kickoff_iso: e.date ?? ev.kickoff_utc ?? null,
      team_name: null,
      observed_at: input.nowIso,
      available_at: input.nowIso,
      temporal_precision: "exact",
      feature_status: "CONTEXT",
      enters_independent_model: false,
      extraction_method: "espn_site_api_scoreboard_unofficial",
      source_url: url,
      identity_status: "EXACT",
      reason_it: "Fixture ESPN (JSON non ufficiale). Solo contesto calendario.",
    });
    if (
      input.persistLabB &&
      input.labBRoot &&
      e.oddsHome != null &&
      e.oddsDraw != null &&
      e.oddsAway != null
    ) {
      const persisted = persistCompareOnlyQuotes({
        labBRoot: input.labBRoot,
        eventId: ev.event_id,
        bookmaker: e.bookmaker ?? "espn-scoreboard",
        source: "espn",
        home: e.oddsHome,
        draw: e.oddsDraw,
        away: e.oddsAway,
        collectedAt: input.nowIso,
      });
      quotesStored += persisted.stored;
    }
  }

  let neon = { source_registered: false, elo_stored: 0, features_stored: 0, reason: null as string | null };
  if (input.persistNeon) {
    neon = await registerAcquisitionSource({
      slug: "espn",
      name: "ESPN Scoreboard (unofficial)",
      licenseClass: "public_endpoint",
    });
  }

  return {
    source_id: "espn",
    ok: true,
    fetched: true,
    status: "OK",
    http_status: http,
    url,
    records,
    fields_extracted: [...new Set(records.map((r) => r.feature_key))],
    reason: `events=${events.length}; leagues=${leagues.join(",")}; unofficial`,
    reason_it: `ESPN scoreboard (non ufficiale): ${events.length} eventi (${leagues.join(", ")}). Instabile; in cache.`,
    retries,
    cache_path: join(cacheDir, `${leagues[0] ?? "eng.1"}.json`),
    neon,
    coverage: { leagues, sports: [...sports], market_quotes: quotesStored },
  };
}
