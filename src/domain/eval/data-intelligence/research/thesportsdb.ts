/**
 * TheSportsDB public v1 API (test key 3). Ordinary GET only.
 * Free responses are often truncated — PARTIAL, never invent the missing rows.
 * Odds fields are ignored. Provider IDs are copied only when the payload contains them.
 */
import type { ResearchObservation } from "@/domain/eval/data-intelligence/research/observations-store";

export const THESPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";

/** League IDs observed from live TheSportsDB `eventsnextleague` responses. */
export const THESPORTSDB_LEAGUES: ReadonlyArray<{ id: string; title: string; pi_div: string | null }> = [
  { id: "4328", title: "English Premier League", pi_div: "E0" },
  { id: "4332", title: "Italian Serie A", pi_div: "I1" },
  { id: "4335", title: "Spanish La Liga", pi_div: "SP1" },
  { id: "4331", title: "German Bundesliga", pi_div: "D1" },
  { id: "4334", title: "French Ligue 1", pi_div: "F1" },
  { id: "4480", title: "UEFA Champions League", pi_div: null },
  { id: "4481", title: "UEFA Europa League", pi_div: null },
  { id: "4346", title: "American Major League Soccer", pi_div: null },
  { id: "4337", title: "Dutch Eredivisie", pi_div: null },
];

export type SportsDbEvent = {
  idEvent: string;
  idAPIfootball: string | null;
  strHomeTeam: string;
  strAwayTeam: string;
  strTimestamp: string | null;
  dateEvent: string | null;
  strTime: string | null;
  strLeague: string | null;
  idLeague: string | null;
  strVenue: string | null;
  strOfficial: string | null;
  strStatus: string | null;
  strCountry: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
  idHomeTeam: string | null;
  idAwayTeam: string | null;
  strSeason: string | null;
};

export type SportsDbTeam = {
  idTeam: string;
  strTeam: string;
  idAPIfootball: string | null;
  strStadium: string | null;
  strLocation: string | null;
  strCountry: string | null;
  intStadiumCapacity: string | null;
};

export type SportsDbFetchDeps = {
  fetchImpl?: typeof fetch;
  jsonText?: string;
};

function asRec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function parseSportsDbEvent(raw: unknown): SportsDbEvent | null {
  const r = asRec(raw);
  if (!r) return null;
  const idEvent = str(r.idEvent);
  const home = str(r.strHomeTeam);
  const away = str(r.strAwayTeam);
  if (!idEvent || !home || !away) return null;
  return {
    idEvent,
    idAPIfootball: str(r.idAPIfootball),
    strHomeTeam: home,
    strAwayTeam: away,
    strTimestamp: str(r.strTimestamp),
    dateEvent: str(r.dateEvent),
    strTime: str(r.strTime),
    strLeague: str(r.strLeague),
    idLeague: str(r.idLeague),
    strVenue: str(r.strVenue),
    strOfficial: str(r.strOfficial),
    strStatus: str(r.strStatus),
    strCountry: str(r.strCountry),
    intHomeScore: str(r.intHomeScore),
    intAwayScore: str(r.intAwayScore),
    idHomeTeam: str(r.idHomeTeam),
    idAwayTeam: str(r.idAwayTeam),
    strSeason: str(r.strSeason),
  };
}

export function parseSportsDbTeam(raw: unknown): SportsDbTeam | null {
  const r = asRec(raw);
  if (!r) return null;
  const idTeam = str(r.idTeam);
  const name = str(r.strTeam);
  if (!idTeam || !name) return null;
  return {
    idTeam,
    strTeam: name,
    idAPIfootball: str(r.idAPIfootball),
    strStadium: str(r.strStadium),
    strLocation: str(r.strLocation),
    strCountry: str(r.strCountry),
    intStadiumCapacity: str(r.intStadiumCapacity),
  };
}

export function sportsDbKickoffIso(ev: SportsDbEvent): string | null {
  if (ev.strTimestamp && Number.isFinite(Date.parse(ev.strTimestamp))) {
    const d = new Date(ev.strTimestamp);
    return d.toISOString();
  }
  if (ev.dateEvent && /^\d{4}-\d{2}-\d{2}$/.test(ev.dateEvent)) {
    const t = ev.strTime && /^\d{2}:\d{2}/.test(ev.strTime) ? ev.strTime.slice(0, 8) : "12:00:00";
    const iso = `${ev.dateEvent}T${t.length === 5 ? `${t}:00` : t}Z`;
    return Number.isFinite(Date.parse(iso)) ? new Date(iso).toISOString() : `${ev.dateEvent}T12:00:00.000Z`;
  }
  return null;
}

function searchEventQuery(home: string, away: string): string {
  return `${home.trim().replace(/\s+/g, "_")}_vs_${away.trim().replace(/\s+/g, "_")}`;
}

const mem = new Map<string, { at: number; status: number; body: unknown }>();
const MEM_MS = 10 * 60 * 1000;

export async function fetchSportsDbJson(
  pathAndQuery: string,
  deps?: SportsDbFetchDeps,
): Promise<{ http_status: number | null; body: unknown; url: string; error: string | null; truncated_hint: boolean }> {
  const url = pathAndQuery.startsWith("http") ? pathAndQuery : `${THESPORTSDB_BASE}/${pathAndQuery.replace(/^\//, "")}`;
  if (deps?.jsonText != null) {
    try {
      const body = JSON.parse(deps.jsonText) as unknown;
      return { http_status: 200, body, url, error: null, truncated_hint: detectTruncation(body) };
    } catch (e) {
      return { http_status: 200, body: null, url, error: e instanceof Error ? e.message : String(e), truncated_hint: false };
    }
  }
  const now = Date.now();
  const hit = mem.get(url);
  if (hit && now - hit.at < MEM_MS) {
    return { http_status: hit.status, body: hit.body, url, error: null, truncated_hint: detectTruncation(hit.body) };
  }
  try {
    const fetchImpl = deps?.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const res = await fetchImpl(url, {
      headers: { Accept: "application/json", "User-Agent": "betmind-research/1.0 (ordinary GET; no WAF bypass)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 403 || res.status === 401 || res.status === 429) {
      mem.set(url, { at: now, status: res.status, body: null });
      return { http_status: res.status, body: null, url, error: `HTTP_${res.status}`, truncated_hint: false };
    }
    const text = await res.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = null;
    }
    mem.set(url, { at: now, status: res.status, body });
    return {
      http_status: res.status,
      body,
      url,
      error: res.ok ? null : `HTTP_${res.status}`,
      truncated_hint: detectTruncation(body),
    };
  } catch (e) {
    return { http_status: null, body: null, url, error: e instanceof Error ? e.message : String(e), truncated_hint: false };
  }
}

/** Free-tier lists often stop at 1/3/5 rows. Record as truncated, do not pad. */
export function detectTruncation(body: unknown): boolean {
  const r = asRec(body);
  if (!r) return false;
  for (const k of ["events", "event", "results", "teams", "table", "lineup", "eventstats"]) {
    const v = r[k];
    if (Array.isArray(v) && (v.length === 1 || v.length === 3 || v.length === 5)) return true;
  }
  return false;
}

export function listEventsFromBody(body: unknown): SportsDbEvent[] {
  const r = asRec(body);
  if (!r) return [];
  const raw = r.events ?? r.event ?? r.results;
  if (!Array.isArray(raw)) return [];
  return raw.map(parseSportsDbEvent).filter(Boolean) as SportsDbEvent[];
}

export async function searchSportsDbEvent(input: {
  home: string;
  away: string;
  deps?: SportsDbFetchDeps;
}): Promise<{ http_status: number | null; url: string; events: SportsDbEvent[]; error: string | null; truncated: boolean }> {
  const q = searchEventQuery(input.home, input.away);
  const res = await fetchSportsDbJson(`searchevents.php?e=${encodeURIComponent(q)}`, input.deps);
  return {
    http_status: res.http_status,
    url: res.url,
    events: listEventsFromBody(res.body),
    error: res.error,
    truncated: res.truncated_hint,
  };
}

export async function lookupSportsDbEvent(input: {
  idEvent: string;
  deps?: SportsDbFetchDeps;
}): Promise<{ http_status: number | null; url: string; event: SportsDbEvent | null; error: string | null }> {
  const res = await fetchSportsDbJson(`lookupevent.php?id=${encodeURIComponent(input.idEvent)}`, input.deps);
  return {
    http_status: res.http_status,
    url: res.url,
    event: listEventsFromBody(res.body)[0] ?? null,
    error: res.error,
  };
}

export async function eventsNextLeagueSportsDb(input: {
  leagueId: string;
  deps?: SportsDbFetchDeps;
}): Promise<{ http_status: number | null; url: string; events: SportsDbEvent[]; error: string | null; truncated: boolean }> {
  const res = await fetchSportsDbJson(`eventsnextleague.php?id=${encodeURIComponent(input.leagueId)}`, input.deps);
  return {
    http_status: res.http_status,
    url: res.url,
    events: listEventsFromBody(res.body),
    error: res.error,
    truncated: res.truncated_hint,
  };
}

export async function eventsNextTeamSportsDb(input: {
  teamId: string;
  deps?: SportsDbFetchDeps;
}): Promise<{ http_status: number | null; url: string; events: SportsDbEvent[]; error: string | null; truncated: boolean }> {
  const res = await fetchSportsDbJson(`eventsnext.php?id=${encodeURIComponent(input.teamId)}`, input.deps);
  return {
    http_status: res.http_status,
    url: res.url,
    events: listEventsFromBody(res.body),
    error: res.error,
    truncated: res.truncated_hint,
  };
}

export async function eventsLastTeamSportsDb(input: {
  teamId: string;
  deps?: SportsDbFetchDeps;
}): Promise<{ http_status: number | null; url: string; events: SportsDbEvent[]; error: string | null; truncated: boolean }> {
  const res = await fetchSportsDbJson(`eventslast.php?id=${encodeURIComponent(input.teamId)}`, input.deps);
  return {
    http_status: res.http_status,
    url: res.url,
    events: listEventsFromBody(res.body),
    error: res.error,
    truncated: res.truncated_hint,
  };
}

export async function searchSportsDbTeam(input: {
  name: string;
  deps?: SportsDbFetchDeps;
}): Promise<{ http_status: number | null; url: string; team: SportsDbTeam | null; error: string | null }> {
  const q = input.name.trim().replace(/\s+/g, "_");
  const res = await fetchSportsDbJson(`searchteams.php?t=${encodeURIComponent(q)}`, input.deps);
  const r = asRec(res.body);
  const teams = Array.isArray(r?.teams) ? r!.teams.map(parseSportsDbTeam).filter(Boolean) : [];
  return {
    http_status: res.http_status,
    url: res.url,
    team: (teams[0] as SportsDbTeam | undefined) ?? null,
    error: res.error,
  };
}

export type SportsDbTableRow = {
  intRank: number | null;
  strTeam: string;
  intPlayed: number | null;
  intWin: number | null;
  intDraw: number | null;
  intLoss: number | null;
  intGoalsFor: number | null;
  intGoalsAgainst: number | null;
  intPoints: number | null;
  strForm: string | null;
  dateUpdated: string | null;
};

export async function lookupSportsDbTable(input: {
  leagueId: string;
  season: string;
  deps?: SportsDbFetchDeps;
}): Promise<{ http_status: number | null; url: string; rows: SportsDbTableRow[]; error: string | null; truncated: boolean }> {
  const res = await fetchSportsDbJson(
    `lookuptable.php?l=${encodeURIComponent(input.leagueId)}&s=${encodeURIComponent(input.season)}`,
    input.deps,
  );
  const r = asRec(res.body);
  const table = Array.isArray(r?.table) ? r!.table : [];
  const rows: SportsDbTableRow[] = [];
  for (const raw of table) {
    const rec = asRec(raw);
    if (!rec) continue;
    const name = str(rec.strTeam);
    if (!name) continue;
    rows.push({
      intRank: Number.isFinite(Number(rec.intRank)) ? Number(rec.intRank) : null,
      strTeam: name,
      intPlayed: Number.isFinite(Number(rec.intPlayed)) ? Number(rec.intPlayed) : null,
      intWin: Number.isFinite(Number(rec.intWin)) ? Number(rec.intWin) : null,
      intDraw: Number.isFinite(Number(rec.intDraw)) ? Number(rec.intDraw) : null,
      intLoss: Number.isFinite(Number(rec.intLoss)) ? Number(rec.intLoss) : null,
      intGoalsFor: Number.isFinite(Number(rec.intGoalsFor)) ? Number(rec.intGoalsFor) : null,
      intGoalsAgainst: Number.isFinite(Number(rec.intGoalsAgainst)) ? Number(rec.intGoalsAgainst) : null,
      intPoints: Number.isFinite(Number(rec.intPoints)) ? Number(rec.intPoints) : null,
      strForm: str(rec.strForm),
      dateUpdated: str(rec.dateUpdated),
    });
  }
  return { http_status: res.http_status, url: res.url, rows, error: res.error, truncated: res.truncated_hint };
}

export function pickSportsDbEventForMatch(
  events: SportsDbEvent[],
  home: string,
  away: string,
  kickoffIso?: string | null,
): SportsDbEvent | null {
  const day = kickoffIso?.slice(0, 10) ?? null;
  const hn = normName(home);
  const an = normName(away);
  const scored = events.map((e) => {
    let s = 0;
    if (normName(e.strHomeTeam) === hn) s += 2;
    else if (normName(e.strHomeTeam).includes(hn) || hn.includes(normName(e.strHomeTeam))) s += 1;
    if (normName(e.strAwayTeam) === an) s += 2;
    else if (normName(e.strAwayTeam).includes(an) || an.includes(normName(e.strAwayTeam))) s += 1;
    const ed = e.dateEvent ?? e.strTimestamp?.slice(0, 10) ?? null;
    if (day && ed === day) s += 2;
    return { e, s };
  });
  scored.sort((a, b) => b.s - a.s);
  const best = scored[0];
  if (!best || best.s < 3) return null;
  return best.e;
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|afc|cf|sc|club|as|ss|ac)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function sportsDbEventObservations(input: {
  eventId: string;
  hit: SportsDbEvent;
  nowIso: string;
  url: string;
  truncated: boolean;
}): ResearchObservation[] {
  const rows: ResearchObservation[] = [];
  const push = (feature_key: string, value: string | number, extra?: Partial<ResearchObservation>) => {
    rows.push({
      event_id: input.eventId,
      feature_key,
      value,
      source: "thesportsdb",
      source_url: input.url,
      observed_at: input.nowIso,
      available_at: input.nowIso,
      extraction_method: "thesportsdb_json",
      confidence: null,
      status: "CONTEXT",
      kind: "EVENT_RESEARCH",
      enters_independent_model: false,
      ...extra,
    });
  };
  push("venue", input.hit.strVenue ?? "unknown");
  if (input.hit.strOfficial) push("referee_name", input.hit.strOfficial);
  if (input.hit.strCountry) push("country", input.hit.strCountry);
  if (input.hit.idEvent) push("thesportsdb_event_id", input.hit.idEvent);
  if (input.hit.idAPIfootball) push("api_football_fixture_id", input.hit.idAPIfootball);
  if (input.truncated) push("free_api_truncated", 1);
  return rows;
}

/** Last-match GF/GA for a named team from a prior event. DATE_ONLY — available_at null. */
export function lastMatchStatsForTeam(
  teamName: string,
  prior: SportsDbEvent,
): { gf: number; ga: number; was_home: boolean } | null {
  const hg = Number(prior.intHomeScore);
  const ag = Number(prior.intAwayScore);
  if (!Number.isFinite(hg) || !Number.isFinite(ag)) return null;
  const t = normName(teamName);
  if (normName(prior.strHomeTeam) === t || normName(prior.strHomeTeam).includes(t) || t.includes(normName(prior.strHomeTeam))) {
    return { gf: hg, ga: ag, was_home: true };
  }
  if (normName(prior.strAwayTeam) === t || normName(prior.strAwayTeam).includes(t) || t.includes(normName(prior.strAwayTeam))) {
    return { gf: ag, ga: hg, was_home: false };
  }
  return null;
}
