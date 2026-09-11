/**
 * ESPN public soccer scoreboard JSON. Real event/team IDs only.
 * Form/records are CONTEXT with available_at = retrieved_at of this GET.
 * Never treated as independent-model inputs.
 */
import type { ResearchObservation } from "@/domain/eval/data-intelligence/research/observations-store";

export type EspnLeagueSlug =
  | "eng.1"
  | "ita.1"
  | "esp.1"
  | "ger.1"
  | "fra.1"
  | "usa.1"
  | "ned.1"
  | "uefa.champions"
  | "uefa.europa";

export const ESPN_LEAGUES: Array<{
  slug: EspnLeagueSlug;
  competition: string;
  country: string | null;
  division: string | null;
}> = [
  { slug: "eng.1", competition: "English Premier League", country: "England", division: "E0" },
  { slug: "ita.1", competition: "Italian Serie A", country: "Italy", division: "I1" },
  { slug: "esp.1", competition: "Spanish La Liga", country: "Spain", division: "SP1" },
  { slug: "ger.1", competition: "German Bundesliga", country: "Germany", division: "D1" },
  { slug: "fra.1", competition: "French Ligue 1", country: "France", division: "F1" },
  { slug: "usa.1", competition: "Major League Soccer", country: "USA", division: null },
  { slug: "ned.1", competition: "Dutch Eredivisie", country: "Netherlands", division: null },
  { slug: "uefa.champions", competition: "UEFA Champions League", country: null, division: null },
  { slug: "uefa.europa", competition: "UEFA Europa League", country: null, division: null },
];

export type EspnEvent = {
  espn_event_id: string;
  kickoff_utc: string;
  competition: string;
  slug: EspnLeagueSlug;
  country: string | null;
  home: string;
  away: string;
  home_espn_team_id: string | null;
  away_espn_team_id: string | null;
  venue: string | null;
  venue_city: string | null;
  home_form: string | null;
  away_form: string | null;
  home_record: string | null;
  away_record: string | null;
  status: string | null;
};

type EspnCompetitor = {
  homeAway?: string;
  form?: string;
  score?: string;
  records?: Array<{ type?: string; summary?: string }>;
  team?: { id?: string; displayName?: string; name?: string };
};

type EspnRawEvent = {
  id?: string;
  date?: string;
  name?: string;
  status?: { type?: { state?: string; completed?: boolean } };
  venue?: { fullName?: string; address?: { city?: string } };
  competitions?: Array<{
    venue?: { fullName?: string; address?: { city?: string } };
    competitors?: EspnCompetitor[];
  }>;
};

function competitorName(c: EspnCompetitor | undefined): string {
  return (c?.team?.displayName ?? c?.team?.name ?? "").trim();
}

export function parseEspnScoreboard(input: {
  json: unknown;
  slug: EspnLeagueSlug;
  competition: string;
  country: string | null;
}): EspnEvent[] {
  const root = input.json as { events?: EspnRawEvent[]; leagues?: Array<{ name?: string }> };
  const events = Array.isArray(root?.events) ? root.events : [];
  const competition = root.leagues?.[0]?.name ?? input.competition;
  const out: EspnEvent[] = [];
  for (const ev of events) {
    if (!ev?.id || !ev.date) continue;
    const state = ev.status?.type?.state ?? "";
    if (ev.status?.type?.completed === true || state === "post") continue;
    const comp = ev.competitions?.[0];
    const competitors = comp?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    const homeName = competitorName(home);
    const awayName = competitorName(away);
    if (!homeName || !awayName || homeName === awayName) continue;
    const ko = new Date(ev.date.endsWith("Z") ? ev.date : `${ev.date}Z`);
    if (!Number.isFinite(ko.getTime())) continue;
    const venue = comp?.venue ?? ev.venue;
    const homeRec = home?.records?.find((r) => r.type === "total")?.summary ?? home?.records?.[0]?.summary ?? null;
    const awayRec = away?.records?.find((r) => r.type === "total")?.summary ?? away?.records?.[0]?.summary ?? null;
    out.push({
      espn_event_id: String(ev.id),
      kickoff_utc: ko.toISOString(),
      competition,
      slug: input.slug,
      country: input.country,
      home: homeName,
      away: awayName,
      home_espn_team_id: home?.team?.id ? String(home.team.id) : null,
      away_espn_team_id: away?.team?.id ? String(away.team.id) : null,
      venue: venue?.fullName ?? null,
      venue_city: venue?.address?.city ?? null,
      home_form: home?.form ?? null,
      away_form: away?.form ?? null,
      home_record: homeRec,
      away_record: awayRec,
      status: state || null,
    });
  }
  return out;
}

const cache = new Map<string, { at: number; events: EspnEvent[]; http: number | null; error: string | null; url: string }>();
const CACHE_MS = 10 * 60 * 1000;

export function mapCompetitionToEspnSlug(competition: string | null | undefined): EspnLeagueSlug | null {
  const c = (competition ?? "").toLowerCase();
  if (!c) return null;
  if (c.includes("premier league") || c === "e0" || c.includes("epl")) return "eng.1";
  if (c.includes("serie a") || c === "i1") return "ita.1";
  if (c.includes("la liga") || c.includes("laliga") || c === "sp1") return "esp.1";
  if (c.includes("bundesliga") || c === "d1") return "ger.1";
  if (c.includes("ligue 1") || c.includes("ligue1") || c === "f1") return "fra.1";
  if (c.includes("major league soccer") || c.includes("mls")) return "usa.1";
  if (c.includes("eredivisie")) return "ned.1";
  if (c.includes("champions league") || c.includes("uefa champions")) return "uefa.champions";
  if (c.includes("europa league") || c.includes("uefa europa")) return "uefa.europa";
  return null;
}

export function espnScoreboardUrl(slug: EspnLeagueSlug, yyyymmdd: string): string {
  return `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${yyyymmdd}`;
}

export async function fetchEspnScoreboard(input: {
  slug: EspnLeagueSlug;
  yyyymmdd: string;
  competition: string;
  country: string | null;
  fetchImpl?: typeof fetch;
  jsonText?: string;
}): Promise<{ events: EspnEvent[]; http_status: number | null; url: string; error: string | null }> {
  const url = espnScoreboardUrl(input.slug, input.yyyymmdd);
  if (input.jsonText != null) {
    try {
      return {
        events: parseEspnScoreboard({
          json: JSON.parse(input.jsonText),
          slug: input.slug,
          competition: input.competition,
          country: input.country,
        }),
        http_status: 200,
        url,
        error: null,
      };
    } catch (e) {
      return { events: [], http_status: 200, url, error: e instanceof Error ? e.message : String(e) };
    }
  }
  const key = `${input.slug}|${input.yyyymmdd}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) {
    return { events: hit.events, http_status: hit.http, url: hit.url, error: hit.error };
  }
  try {
    const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const res = await fetchImpl(url, {
      headers: { Accept: "application/json", "User-Agent": "betmind-research/1.0 (ordinary GET; ESPN public scoreboard)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 403 || res.status === 401) {
      cache.set(key, { at: now, events: [], http: res.status, error: `BLOCKED HTTP ${res.status}`, url });
      return { events: [], http_status: res.status, url, error: `BLOCKED HTTP ${res.status}` };
    }
    if (!res.ok) {
      cache.set(key, { at: now, events: [], http: res.status, error: `HTTP_${res.status}`, url });
      return { events: [], http_status: res.status, url, error: `HTTP_${res.status}` };
    }
    const json: unknown = await res.json();
    const events = parseEspnScoreboard({
      json,
      slug: input.slug,
      competition: input.competition,
      country: input.country,
    });
    cache.set(key, { at: now, events, http: res.status, error: null, url });
    return { events, http_status: res.status, url, error: null };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    cache.set(key, { at: now, events: [], http: null, error, url });
    return { events: [], http_status: null, url, error };
  }
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function pickEspnEventForMatch(
  events: EspnEvent[],
  home: string,
  away: string,
  kickoffIso?: string | null,
): EspnEvent | null {
  const h = norm(home);
  const a = norm(away);
  const day = kickoffIso?.slice(0, 10);
  const scored = events
    .map((ev) => {
      const eh = norm(ev.home);
      const ea = norm(ev.away);
      const homeOk = eh === h || eh.includes(h) || h.includes(eh);
      const awayOk = ea === a || ea.includes(a) || a.includes(ea);
      if (!homeOk || !awayOk) return null;
      if (day && ev.kickoff_utc.slice(0, 10) !== day) return null;
      return ev;
    })
    .filter(Boolean) as EspnEvent[];
  return scored[0] ?? null;
}

export function espnEventObservations(input: {
  eventId: string;
  hit: EspnEvent;
  nowIso: string;
  url: string;
}): ResearchObservation[] {
  const rows: ResearchObservation[] = [];
  const push = (feature_key: string, value: string | number) => {
    rows.push({
      event_id: input.eventId,
      feature_key,
      value,
      source: "espn",
      source_url: input.url,
      observed_at: input.nowIso,
      available_at: input.nowIso,
      extraction_method: "espn_scoreboard_json",
      confidence: null,
      status: "CONTEXT",
      kind: "EVENT_RESEARCH",
      enters_independent_model: false,
    });
  };
  push("espn_event_id", input.hit.espn_event_id);
  if (input.hit.venue) push("venue", input.hit.venue);
  if (input.hit.venue_city) push("venue_city", input.hit.venue_city);
  if (input.hit.home_form) push("home_espn_form", input.hit.home_form);
  if (input.hit.away_form) push("away_espn_form", input.hit.away_form);
  if (input.hit.home_record) push("home_espn_record", input.hit.home_record);
  if (input.hit.away_record) push("away_espn_record", input.hit.away_record);
  if (input.hit.home_espn_team_id) push("home_espn_team_id", input.hit.home_espn_team_id);
  if (input.hit.away_espn_team_id) push("away_espn_team_id", input.hit.away_espn_team_id);
  return rows;
}
