/**
 * Per-event TheSportsDB + Wikipedia research. CONTEXT / DATE_ONLY priors only.
 * Does not invent fixture IDs. Truncated free-API lists stay PARTIAL.
 */
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";
import type { ResearchObservation } from "@/domain/eval/data-intelligence/research/observations-store";
import { mapCompetitionToPiDivision } from "@/domain/eval/predictive-intelligence/live-resolve";
import {
  searchSportsDbEvent,
  pickSportsDbEventForMatch,
  eventsLastTeamSportsDb,
  lastMatchStatsForTeam,
  sportsDbEventObservations,
  sportsDbKickoffIso,
  lookupSportsDbTable,
  type SportsDbEvent,
} from "@/domain/eval/data-intelligence/research/thesportsdb";
import {
  fetchWikipediaLeaguePage,
  standingForTeam,
} from "@/domain/eval/data-intelligence/research/wikipedia-league";

export type PublicApiResearch = {
  observations: ResearchObservation[];
  tsdb: {
    ok: boolean;
    fetched: boolean;
    http_status: number | null;
    url: string | null;
    fields: string[];
    reason: string;
    parser_status: string;
    fixture_id: number | null;
    idEvent: string | null;
  };
  wikipedia: {
    ok: boolean;
    fetched: boolean;
    http_status: number | null;
    url: string | null;
    fields: string[];
    reason: string;
    parser_status: string;
  };
};

const wikiCache = new Map<string, Awaited<ReturnType<typeof fetchWikipediaLeaguePage>>>();
const tableCache = new Map<string, Awaited<ReturnType<typeof lookupSportsDbTable>>>();

export async function researchPublicApisForEvent(input: {
  ev: PermanentEvent044;
  nowIso: string;
  asOf: string;
}): Promise<PublicApiResearch> {
  const observations: ResearchObservation[] = [];
  const ev = input.ev;
  const search = await searchSportsDbEvent({ home: ev.home_or_a, away: ev.away_or_b });
  let hit: SportsDbEvent | null = null;
  if (!search.error && search.http_status != null && search.http_status < 400) {
    hit = pickSportsDbEventForMatch(search.events, ev.home_or_a, ev.away_or_b, ev.kickoff_utc);
  }

  let tsdbStatus: PublicApiResearch["tsdb"];
  if (search.http_status === 403 || search.http_status === 401) {
    tsdbStatus = {
      ok: false,
      fetched: true,
      http_status: search.http_status,
      url: search.url,
      fields: [],
      reason: `BLOCKED HTTP ${search.http_status} — no WAF bypass`,
      parser_status: "BLOCKED",
      fixture_id: null,
      idEvent: null,
    };
  } else if (search.error || search.http_status == null || search.http_status >= 400) {
    tsdbStatus = {
      ok: false,
      fetched: search.http_status != null,
      http_status: search.http_status,
      url: search.url,
      fields: [],
      reason: search.error ?? "TheSportsDB fetch failed",
      parser_status: "HTTP_ERROR",
      fixture_id: null,
      idEvent: null,
    };
  } else if (!hit) {
    tsdbStatus = {
      ok: false,
      fetched: true,
      http_status: search.http_status,
      url: search.url,
      fields: [],
      reason: `NO_EVENT — ${search.events.length} risultati, nessuno abbinato a ${ev.home_or_a} vs ${ev.away_or_b}`,
      parser_status: "NO_EVENT",
      fixture_id: null,
      idEvent: null,
    };
  } else {
    const rows = sportsDbEventObservations({
      eventId: ev.event_id,
      hit,
      nowIso: input.nowIso,
      url: search.url,
      truncated: search.truncated,
    });
    observations.push(...rows);

    if (hit.idHomeTeam) {
      const last = await eventsLastTeamSportsDb({ teamId: hit.idHomeTeam });
      const prior = last.events[0];
      const priorKo = prior ? sportsDbKickoffIso(prior) : null;
      if (prior && priorKo && priorKo.slice(0, 10) < String(ev.kickoff_utc ?? "").slice(0, 10)) {
        const stats = lastMatchStatsForTeam(ev.home_or_a, prior);
        if (stats) {
          observations.push({
            event_id: ev.event_id,
            feature_key: "home_last_gf",
            value: stats.gf,
            source: "thesportsdb",
            source_url: last.url,
            observed_at: input.nowIso,
            available_at: null,
            extraction_method: "thesportsdb_eventslast",
            confidence: null,
            status: "REAL",
            kind: "HISTORICAL_PRIOR",
            enters_independent_model: false,
            derived_from: [`thesportsdb:${prior.idEvent}`],
          });
          observations.push({
            event_id: ev.event_id,
            feature_key: "home_last_ga",
            value: stats.ga,
            source: "thesportsdb",
            source_url: last.url,
            observed_at: input.nowIso,
            available_at: null,
            extraction_method: "thesportsdb_eventslast",
            confidence: null,
            status: "REAL",
            kind: "HISTORICAL_PRIOR",
            enters_independent_model: false,
            derived_from: [`thesportsdb:${prior.idEvent}`],
          });
        }
      }
    }
    if (hit.idAwayTeam) {
      const last = await eventsLastTeamSportsDb({ teamId: hit.idAwayTeam });
      const prior = last.events[0];
      const priorKo = prior ? sportsDbKickoffIso(prior) : null;
      if (prior && priorKo && priorKo.slice(0, 10) < String(ev.kickoff_utc ?? "").slice(0, 10)) {
        const stats = lastMatchStatsForTeam(ev.away_or_b, prior);
        if (stats) {
          observations.push({
            event_id: ev.event_id,
            feature_key: "away_last_gf",
            value: stats.gf,
            source: "thesportsdb",
            source_url: last.url,
            observed_at: input.nowIso,
            available_at: null,
            extraction_method: "thesportsdb_eventslast",
            confidence: null,
            status: "REAL",
            kind: "HISTORICAL_PRIOR",
            enters_independent_model: false,
            derived_from: [`thesportsdb:${prior.idEvent}`],
          });
          observations.push({
            event_id: ev.event_id,
            feature_key: "away_last_ga",
            value: stats.ga,
            source: "thesportsdb",
            source_url: last.url,
            observed_at: input.nowIso,
            available_at: null,
            extraction_method: "thesportsdb_eventslast",
            confidence: null,
            status: "REAL",
            kind: "HISTORICAL_PRIOR",
            enters_independent_model: false,
            derived_from: [`thesportsdb:${prior.idEvent}`],
          });
        }
      }
    }

    if (hit.idLeague) {
      const season = hit.strSeason ?? "2026-2027";
      const cacheKey = `${hit.idLeague}|${season}`;
      let table = tableCache.get(cacheKey);
      if (!table) {
        table = await lookupSportsDbTable({ leagueId: hit.idLeague, season });
        tableCache.set(cacheKey, table);
      }
      const homeRow = table.rows.find((r) => r.strTeam.toLowerCase() === ev.home_or_a.toLowerCase());
      const awayRow = table.rows.find((r) => r.strTeam.toLowerCase() === ev.away_or_b.toLowerCase());
      const avail = table.rows[0]?.dateUpdated ?? input.nowIso;
      if (homeRow?.intPoints != null) {
        observations.push({
          event_id: ev.event_id,
          feature_key: "home_table_pts",
          value: homeRow.intPoints,
          source: "thesportsdb",
          source_url: table.url,
          observed_at: input.nowIso,
          available_at: avail,
          extraction_method: "thesportsdb_lookuptable",
          confidence: null,
          status: "CONTEXT",
          kind: "EVENT_RESEARCH",
          enters_independent_model: false,
        });
      }
      if (homeRow?.intRank != null) {
        observations.push({
          event_id: ev.event_id,
          feature_key: "home_table_rank",
          value: homeRow.intRank,
          source: "thesportsdb",
          source_url: table.url,
          observed_at: input.nowIso,
          available_at: avail,
          extraction_method: "thesportsdb_lookuptable",
          confidence: null,
          status: "CONTEXT",
          kind: "EVENT_RESEARCH",
          enters_independent_model: false,
        });
      }
      if (awayRow?.intPoints != null) {
        observations.push({
          event_id: ev.event_id,
          feature_key: "away_table_pts",
          value: awayRow.intPoints,
          source: "thesportsdb",
          source_url: table.url,
          observed_at: input.nowIso,
          available_at: avail,
          extraction_method: "thesportsdb_lookuptable",
          confidence: null,
          status: "CONTEXT",
          kind: "EVENT_RESEARCH",
          enters_independent_model: false,
        });
      }
      if (awayRow?.intRank != null) {
        observations.push({
          event_id: ev.event_id,
          feature_key: "away_table_rank",
          value: awayRow.intRank,
          source: "thesportsdb",
          source_url: table.url,
          observed_at: input.nowIso,
          available_at: avail,
          extraction_method: "thesportsdb_lookuptable",
          confidence: null,
          status: "CONTEXT",
          kind: "EVENT_RESEARCH",
          enters_independent_model: false,
        });
      }
    }

    const fields = [...new Set(observations.filter((o) => o.source === "thesportsdb").map((o) => o.feature_key))];
    tsdbStatus = {
      ok: fields.length > 0,
      fetched: true,
      http_status: search.http_status,
      url: search.url,
      fields,
      reason: search.truncated
        ? `PARTIAL — evento ${hit.idEvent} abbinato; risposta free-API troncata, non completata.`
        : `evento ${hit.idEvent} abbinato`,
      parser_status: search.truncated ? "PARTIAL" : "OK",
      fixture_id: hit.idAPIfootball && /^\d+$/.test(hit.idAPIfootball) ? Number(hit.idAPIfootball) : null,
      idEvent: hit.idEvent,
    };
  }

  const div = mapCompetitionToPiDivision(ev.competition);
  const wikiKey = div ?? "E0";
  let wikiPage = wikiCache.get(wikiKey);
  if (!wikiPage && (div === "E0" || div === "I1" || div === "SP1" || div === "D1" || div === "F1")) {
    wikiPage = await fetchWikipediaLeaguePage({ division: div, nowIso: input.nowIso });
    wikiCache.set(wikiKey, wikiPage);
  } else if (!wikiPage && !div) {
    wikiPage = await fetchWikipediaLeaguePage({ division: "E0", nowIso: input.nowIso });
    wikiCache.set("E0", wikiPage);
  }

  let wikipedia: PublicApiResearch["wikipedia"];
  if (!wikiPage) {
    wikipedia = {
      ok: false,
      fetched: false,
      http_status: null,
      url: null,
      fields: [],
      reason: "Nessuna pagina Wikipedia mappata per questa competizione",
      parser_status: "NO_DATA",
    };
  } else if (wikiPage.error && wikiPage.standings.length === 0) {
    wikipedia = {
      ok: false,
      fetched: wikiPage.http_status != null,
      http_status: wikiPage.http_status,
      url: wikiPage.url,
      fields: [],
      reason: wikiPage.error,
      parser_status: wikiPage.http_status === 403 ? "BLOCKED" : "NO_DATA",
    };
  } else {
    const home = standingForTeam(wikiPage.standings, ev.home_or_a);
    const away = standingForTeam(wikiPage.standings, ev.away_or_b);
    const fields: string[] = [];
    if (home?.pts != null) {
      observations.push({
        event_id: ev.event_id,
        feature_key: "home_wiki_pts",
        value: home.pts,
        source: "wikipedia",
        source_url: wikiPage.url,
        observed_at: input.nowIso,
        available_at: wikiPage.retrieved_at,
        extraction_method: "wikipedia_league_table",
        confidence: null,
        status: "CONTEXT",
        kind: "EVENT_RESEARCH",
        enters_independent_model: false,
      });
      fields.push("home_wiki_pts");
    }
    if (home?.rank != null) {
      observations.push({
        event_id: ev.event_id,
        feature_key: "home_wiki_rank",
        value: home.rank,
        source: "wikipedia",
        source_url: wikiPage.url,
        observed_at: input.nowIso,
        available_at: wikiPage.retrieved_at,
        extraction_method: "wikipedia_league_table",
        confidence: null,
        status: "CONTEXT",
        kind: "EVENT_RESEARCH",
        enters_independent_model: false,
      });
      fields.push("home_wiki_rank");
    }
    if (away?.pts != null) {
      observations.push({
        event_id: ev.event_id,
        feature_key: "away_wiki_pts",
        value: away.pts,
        source: "wikipedia",
        source_url: wikiPage.url,
        observed_at: input.nowIso,
        available_at: wikiPage.retrieved_at,
        extraction_method: "wikipedia_league_table",
        confidence: null,
        status: "CONTEXT",
        kind: "EVENT_RESEARCH",
        enters_independent_model: false,
      });
      fields.push("away_wiki_pts");
    }
    if (away?.rank != null) {
      observations.push({
        event_id: ev.event_id,
        feature_key: "away_wiki_rank",
        value: away.rank,
        source: "wikipedia",
        source_url: wikiPage.url,
        observed_at: input.nowIso,
        available_at: wikiPage.retrieved_at,
        extraction_method: "wikipedia_league_table",
        confidence: null,
        status: "CONTEXT",
        kind: "EVENT_RESEARCH",
        enters_independent_model: false,
      });
      fields.push("away_wiki_rank");
    }
    wikipedia = {
      ok: fields.length > 0,
      fetched: true,
      http_status: wikiPage.http_status,
      url: wikiPage.url,
      fields,
      reason:
        fields.length > 0
          ? `Classifica ${wikiPage.title} — ${fields.length} campi per questa partita`
          : `Pagina letta ma ${ev.home_or_a}/${ev.away_or_b} non in classifica parsata`,
      parser_status: fields.length > 0 ? "OK" : "NO_EVENT",
    };
  }

  return { observations, tsdb: tsdbStatus, wikipedia };
}
