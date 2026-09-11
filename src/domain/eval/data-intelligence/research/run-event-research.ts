/**
 * Event research for brain cycles.
 * Executes wired public adapters. WAF/policy stubs are not consulted.
 * Never invents available_at; scrape / market never enters independent MODEL.
 */
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { fetchOpenMeteoContext } from "@/domain/eval/data-intelligence/open-meteo";
import {
  ensureClubEloCacheDay,
  clubEloAsOfDateForKickoff,
} from "@/domain/eval/data-intelligence/clubelo-ensure";
import {
  appendResearchStatus,
  writeResearchCycleSummary,
  type ResearchStatusRow,
} from "@/domain/eval/data-intelligence/research/status";
import {
  RESEARCH_SOURCE_CATALOGUE,
  catalogueAdapterKind,
} from "@/domain/eval/data-intelligence/research/source-catalogue";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";
import { inspectClubEloForEvent } from "@/domain/eval/data-intelligence/research/clubelo-lookup";
import { asOfAfterKickoff } from "@/domain/eval/data-intelligence/research/temporal";
import {
  buildEventResearchPlan,
  persistEventResearchPlan,
} from "@/domain/eval/data-intelligence/research/research-plan";
import { resolveApiSportsFixturesForBatch } from "@/domain/eval/data-intelligence/research/api-sports-fixture";
import type { FixtureResolveResult } from "@/domain/eval/data-intelligence/research/api-sports-fixture";
import {
  runApiSportsPhase8Lane,
  runUnderstatPhase8Lane,
  runCalendarPhase8Lane,
} from "@/domain/eval/data-intelligence/research/phase8-lanes";
import { markSourceBlocked } from "@/domain/eval/data-intelligence/research/source-cooldown";
import { newsObservationFromRss } from "@/domain/eval/data-intelligence/research/news-classify";
import { upsertTeamIdentity } from "@/domain/eval/data-intelligence/research/identity-registry";
import { resolveEventIdentity } from "@/domain/eval/data-intelligence/research/event-identity";
import { attachAcquisitionCacheToEvent } from "@/domain/eval/data-intelligence/research/attach-acquisition-cache";
import { RSS_FEEDS, type RssSourceId } from "@/domain/eval/data-intelligence/research/rss-news";
import { ACTIVE_FONTI_SOURCE_IDS } from "@/domain/eval/acquisition-engine/active-fonti";

export type ResearchCycleResult = {
  events_touched: number;
  research_fetches: number;
  research_failures: number;
  research_denied: number;
  missing_adapters: number;
  observations_created: number;
  real_event_observations: number;
  historical_observations: number;
  derived_observations: number;
  events_with_real_event_data: number;
  events_with_historical_data: number;
  data_yield: number;
  by_source: Record<string, { ok: number; fail: number; denied: number; missing: number }>;
};

function bump(
  by: ResearchCycleResult["by_source"],
  source: string,
  kind: "ok" | "fail" | "denied" | "missing",
  recorded?: Set<string>,
): void {
  recorded?.add(source);
  if (!by[source]) by[source] = { ok: 0, fail: 0, denied: 0, missing: 0 };
  by[source]![kind] += 1;
}

function baseRow(
  partial: Omit<ResearchStatusRow, "enters_independent_model" | "at"> & { at?: string },
): ResearchStatusRow {
  return {
    url: null,
    http_status: null,
    parser_status: null,
    fields_extracted: null,
    adapter_kind: null,
    observed_at: null,
    ...partial,
    enters_independent_model: false,
    at: partial.at ?? new Date().toISOString(),
  };
}

/**
 * Research a capped set of events. Wired public adapters only.
 * WAF/policy stubs are not consulted. Odds stay market-layer.
 */
export async function runEventResearchBatch(input: {
  events: PermanentEvent044[];
  cycleNumber: number | null;
  nowIso?: string;
  labBRoot?: string;
  maxEvents?: number;
  /** When true, do not probe WAF sites. Default false — those sources are pruned from Fonti. */
  allowScrapeProbes?: boolean;
  asOf?: string;
  /** Unused: policy stubs are no longer recorded as consulted Fonti. */
  recordFullCatalogue?: boolean;
}): Promise<ResearchCycleResult> {
  const root = input.labBRoot ?? permanentRoot044();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const maxEvents = input.maxEvents ?? 12;
  const slice = input.events.slice(0, maxEvents);
  const result: ResearchCycleResult = {
    events_touched: slice.length,
    research_fetches: 0,
    research_failures: 0,
    research_denied: 0,
    missing_adapters: 0,
    observations_created: 0,
    real_event_observations: 0,
    historical_observations: 0,
    derived_observations: 0,
    events_with_real_event_data: 0,
    events_with_historical_data: 0,
    data_yield: 0,
    by_source: {},
  };
  const eventsWithReal = new Set<string>();
  const eventsWithHist = new Set<string>();

  const noteObs = async (
    rows: Array<{
      kind?: string;
      status?: string;
      source?: string;
    }>,
    eventId: string,
  ) => {
    result.observations_created += rows.length;
    for (const o of rows) {
      if (
        o.kind === "EVENT_RESEARCH" ||
        o.source === "open-meteo" ||
        o.source === "ansa" ||
        o.source === "sky-sports" ||
        o.source === "espn-soccer-news" ||
        o.source === "corriere-sport" ||
        o.source === "il-messaggero"
      ) {
        result.real_event_observations += 1;
        eventsWithReal.add(eventId);
      } else if (o.kind === "DERIVED") {
        result.derived_observations += 1;
        eventsWithHist.add(eventId);
      } else if (o.kind === "CONTEXT" || o.status === "CONTEXT") {
        /* context scrape — not historical, not model */
      } else {
        result.historical_observations += 1;
        eventsWithHist.add(eventId);
      }
    }
  };

  let fixtureByEvent = new Map<string, FixtureResolveResult>();
  try {
    fixtureByEvent = await resolveApiSportsFixturesForBatch({
      events: slice,
      labBRoot: root,
      nowIso,
      maxNetworkDates: 6,
    });
  } catch {
    fixtureByEvent = new Map();
  }
  let apiDetailBudget = 8;

  // ClubElo once per batch (shared day as-of now) — avoid N× network
  const batchEloDay = clubEloAsOfDateForKickoff(
    slice[0]?.kickoff_utc ?? nowIso,
    nowIso,
  );
  let batchElo: Awaited<ReturnType<typeof ensureClubEloCacheDay>> | null = null;
  try {
    batchElo = await ensureClubEloCacheDay({ ratingDateIso: batchEloDay });
  } catch {
    batchElo = null;
  }

  for (const ev of slice) {
    const kickoff = ev.kickoff_utc ?? nowIso;
    const asOf = input.asOf ?? nowIso;
    const postKickoff = asOfAfterKickoff(asOf, ev.kickoff_utc);
    const recordedThisEvent = new Set<string>();
    try {
      persistEventResearchPlan(buildEventResearchPlan(ev, root), root);
    } catch {
      /* plan persist optional */
    }

    const postNote = postKickoff
      ? " POST_KICKOFF — osservazione dopo kickoff, esclusa dal modello pre-match."
      : "";

    try {
      const ident = resolveEventIdentity({
        home: ev.home_or_a,
        away: ev.away_or_b,
        competition: ev.competition,
        kickoff: ev.kickoff_utc,
        labBRoot: root,
      });
      upsertTeamIdentity({
        canonical_id: ident.home.canonical_id,
        display_name: ev.home_or_a,
        competition: ev.competition,
        source_ids: { football_data: ident.home.source_ids.football_data ?? undefined },
        root,
      });
      upsertTeamIdentity({
        canonical_id: ident.away.canonical_id,
        display_name: ev.away_or_b,
        competition: ev.competition,
        source_ids: { football_data: ident.away.source_ids.football_data ?? undefined },
        root,
      });
    } catch {
      /* identity persist optional */
    }

    // 1) API-Sports — resolve fixture, then injuries/lineups/referee. Continue on fail.
    {
      const allowDetails = apiDetailBudget > 0;
      if (allowDetails) apiDetailBudget -= 1;
      const lane = await runApiSportsPhase8Lane({
        ev,
        resolved: fixtureByEvent.get(ev.event_id),
        nowIso,
        asOf,
        root,
        allowNetworkDetails: allowDetails,
      });
      for (const st of lane.statuses) {
        appendResearchStatus(
          baseRow({
            event_id: ev.event_id,
            source_id: st.source_id,
            phase: st.phase,
            ok: st.ok,
            fetched: st.fetched,
            fetched_at: st.fetched ? nowIso : null,
            available_at: null,
            observed_at: st.ok ? nowIso : null,
            reason: st.reason + postNote,
            raw_ref: st.raw_ref,
            cycle_number: input.cycleNumber,
            at: nowIso,
            url: st.url,
            adapter_kind: "PRODUCTION_ADAPTER",
            http_status: st.http_status,
            parser_status: st.parser_status,
            fields_extracted: st.fields_extracted,
          }),
          root,
        );
        if (st.ok) {
          bump(result.by_source, st.source_id, "ok", recordedThisEvent);
          result.research_fetches += 1;
        } else {
          bump(result.by_source, st.source_id, "fail", recordedThisEvent);
          result.research_failures += 1;
        }
      }
      await noteObs(lane.observations, ev.event_id);
    }

    // 2) Open-Meteo CONTEXT
    try {
      const wx = await fetchOpenMeteoContext({
        eventId: ev.event_id,
        homeTeam: ev.home_or_a,
        eventTimeIso: kickoff,
        asOf,
      });
      const eligible = wx.filter((o) => o.status === "ELIGIBLE");
      const blocked = wx.some((o) => o.status === "NOT_ELIGIBLE" || o.status === "BLOCKED");
      const unavailableHint = wx.every(
        (o) => o.status === "UNAVAILABLE" || o.key === "weather_coords_missing",
      );
      if (wx.length === 0 || unavailableHint) {
        appendResearchStatus(
          baseRow({
            event_id: ev.event_id,
            source_id: "open-meteo",
            phase: "UNAVAILABLE",
            ok: false,
            fetched: wx.length > 0,
            fetched_at: wx.length > 0 ? nowIso : null,
            available_at: null,
            reason: String(wx[0]?.key ?? "NO_STADIUM_COORDS_OR_EMPTY"),
            raw_ref: null,
            cycle_number: input.cycleNumber,
            at: nowIso,
            url: "https://archive-api.open-meteo.com/",
            adapter_kind: "PRODUCTION_ADAPTER",
            http_status: wx.length > 0 ? 200 : null,
            parser_status: "NO_COORDS_OR_EMPTY",
            fields_extracted: wx.map((o) => o.key),
          }),
          root,
        );
        bump(result.by_source, "open-meteo", "fail", recordedThisEvent);
        result.research_failures += 1;
      } else {
        appendResearchStatus(
          baseRow({
            event_id: ev.event_id,
            source_id: "open-meteo",
            phase: blocked && eligible.length === 0 ? "BLOCKED" : "OK",
            ok: eligible.length > 0,
            fetched: true,
            fetched_at: nowIso,
            available_at: eligible[0]?.available_at ?? null,
            observed_at: nowIso,
            reason: blocked
              ? "CONTEXT recuperato; alcune righe bloccate temporalmente / solo contesto"
              : `osservazioni CONTEXT=${wx.length}`,
            raw_ref: null,
            cycle_number: input.cycleNumber,
            at: nowIso,
            url: "https://archive-api.open-meteo.com/",
            adapter_kind: "PRODUCTION_ADAPTER",
            http_status: 200,
            parser_status: "OK",
            fields_extracted: wx.map((o) => o.key),
          }),
          root,
        );
        if (eligible.length > 0) {
          bump(result.by_source, "open-meteo", "ok", recordedThisEvent);
          result.research_fetches += 1;
          const { appendResearchObservation } = await import(
            "@/domain/eval/data-intelligence/research/observations-store"
          );
          const persisted = [];
          for (const o of eligible) {
            if (o.value == null || !Number.isFinite(Number(o.value))) continue;
            const row = {
              event_id: ev.event_id,
              feature_key: o.key,
              value: o.value,
              source: "open-meteo",
              source_url: "https://api.open-meteo.com/",
              observed_at: nowIso,
              available_at: o.available_at ?? nowIso,
              extraction_method: "open_meteo_forecast_or_archive",
              confidence: null,
              status: "CONTEXT" as const,
              kind: "EVENT_RESEARCH" as const,
              enters_independent_model: false,
            };
            appendResearchObservation(row, root);
            persisted.push(row);
          }
          await noteObs(persisted, ev.event_id);
        } else {
          bump(result.by_source, "open-meteo", "fail", recordedThisEvent);
          result.research_failures += 1;
        }
      }
    } catch (e) {
      appendResearchStatus(
        baseRow({
          event_id: ev.event_id,
          source_id: "open-meteo",
          phase: "BLOCKED",
          ok: false,
          fetched: false,
          fetched_at: null,
          available_at: null,
          reason: e instanceof Error ? e.message : String(e),
          raw_ref: null,
          cycle_number: input.cycleNumber,
          at: nowIso,
          url: "https://archive-api.open-meteo.com/",
          adapter_kind: "PRODUCTION_ADAPTER",
          parser_status: "ERROR",
          fields_extracted: [],
        }),
        root,
      );
      bump(result.by_source, "open-meteo", "fail", recordedThisEvent);
      result.research_failures += 1;
    }

    // 3) ClubElo — event-specific team ratings (CSV presence is not success)
    {
      const eloDay = clubEloAsOfDateForKickoff(kickoff, nowIso);
      if (!batchElo) {
        try {
          batchElo = await ensureClubEloCacheDay({ ratingDateIso: eloDay });
        } catch {
          batchElo = null;
        }
      }
      const elo = inspectClubEloForEvent({
        home: ev.home_or_a,
        away: ev.away_or_b,
        kickoffIso: kickoff,
      });
      const eloOk = elo.status === "SUCCESS" || elo.status === "PARTIAL";
      const avail = elo.home_available_at ?? elo.away_available_at;
      const blockedTemporal = postKickoff || (avail != null && asOfAfterKickoff(avail, ev.kickoff_utc));
      appendResearchStatus(
        baseRow({
          event_id: ev.event_id,
          source_id: "clubelo",
          phase: blockedTemporal ? "POST_KICKOFF" : eloOk ? "OK" : "UNAVAILABLE",
          ok: eloOk && !blockedTemporal,
          fetched: elo.file_present,
          fetched_at: elo.file_present ? nowIso : null,
          available_at: blockedTemporal ? avail : eloOk ? avail : null,
          observed_at: elo.file_present ? nowIso : null,
          reason: (blockedTemporal ? `POST_KICKOFF. ${elo.reason}` : elo.reason) + postNote,
          raw_ref: batchElo?.path ?? null,
          cycle_number: input.cycleNumber,
          at: nowIso,
          url: `http://api.clubelo.com/${eloDay}`,
          adapter_kind: "PRODUCTION_ADAPTER",
          http_status: batchElo?.http_status ?? null,
          parser_status: blockedTemporal ? "POST_KICKOFF" : elo.status === "SUCCESS" ? "OK" : elo.status,
          fields_extracted: blockedTemporal ? [] : elo.fields_extracted,
        }),
        root,
      );
      if (eloOk && !blockedTemporal) {
        bump(result.by_source, "clubelo", "ok", recordedThisEvent);
        result.research_fetches += 1;
        const { appendResearchObservation } = await import(
          "@/domain/eval/data-intelligence/research/observations-store"
        );
        const eloRows = [];
        if (elo.home_rating != null) {
          const row = {
            event_id: ev.event_id,
            feature_key: "home_elo",
            value: elo.home_rating,
            source: "clubelo",
            source_url: `http://api.clubelo.com/${eloDay}`,
            observed_at: nowIso,
            available_at: elo.home_available_at,
            extraction_method: "clubelo_asof",
            confidence: null,
            status: "REAL" as const,
            kind: "HISTORICAL_PRIOR" as const,
            enters_independent_model: true,
          };
          appendResearchObservation(row, root);
          eloRows.push(row);
        }
        if (elo.away_rating != null) {
          const row = {
            event_id: ev.event_id,
            feature_key: "away_elo",
            value: elo.away_rating,
            source: "clubelo",
            source_url: `http://api.clubelo.com/${eloDay}`,
            observed_at: nowIso,
            available_at: elo.away_available_at,
            extraction_method: "clubelo_asof",
            confidence: null,
            status: "REAL" as const,
            kind: "HISTORICAL_PRIOR" as const,
            enters_independent_model: true,
          };
          appendResearchObservation(row, root);
          eloRows.push(row);
        }
        await noteObs(eloRows, ev.event_id);
      } else {
        bump(result.by_source, "clubelo", "fail", recordedThisEvent);
        result.research_failures += 1;
      }
    }

    // 4) football-data — event-specific archive match (not file presence)
    {
      const { inspectFootballDataArchive } = await import(
        "@/domain/eval/data-intelligence/research/archive-lookup"
      );
      const arch = inspectFootballDataArchive({
        home: ev.home_or_a,
        away: ev.away_or_b,
        competition: String(ev.competition ?? ""),
        kickoffIso: kickoff,
        labBRoot: root,
      });
      const fdOk = arch.status === "SUCCESS" || arch.status === "PARTIAL";
      const fdPhase = postKickoff
        ? "POST_KICKOFF"
        : fdOk
          ? "OK"
          : "UNAVAILABLE";
      appendResearchStatus(
        baseRow({
          event_id: ev.event_id,
          source_id: "football-data-co-uk",
          phase: fdPhase,
          ok: fdOk && !postKickoff,
          fetched: arch.file_present,
          fetched_at: arch.file_present ? nowIso : null,
          available_at: null,
          observed_at: fdOk ? nowIso : null,
          reason: (postKickoff ? `POST_KICKOFF. ${arch.reason}` : arch.reason) + postNote,
          raw_ref: arch.file_present
            ? `priors_home=${arch.prior_n_home};priors_away=${arch.prior_n_away};div=${arch.division};ids_home=${arch.prior_ids_home.slice(-5).join(",")}`
            : null,
          cycle_number: input.cycleNumber,
          at: nowIso,
          url: "https://www.football-data.co.uk/",
          adapter_kind: "CACHE_ONLY",
          parser_status: postKickoff ? "POST_KICKOFF" : arch.status === "SUCCESS" ? "OK" : arch.status,
          fields_extracted: postKickoff ? [] : arch.fields_extracted,
        }),
        root,
      );
      if (fdOk && !postKickoff) {
        bump(result.by_source, "football-data-co-uk", "ok", recordedThisEvent);
        result.research_fetches += 1;
        const { extractFootballDataObservations } = await import(
          "@/domain/eval/data-intelligence/research/extract-archive-observations"
        );
        const { appendResearchObservation } = await import(
          "@/domain/eval/data-intelligence/research/observations-store"
        );
        const fdObs = extractFootballDataObservations({
          eventId: ev.event_id,
          home: ev.home_or_a,
          away: ev.away_or_b,
          competition: ev.competition,
          kickoffIso: kickoff,
          nowIso,
          labBRoot: root,
        });
        for (const o of fdObs) appendResearchObservation(o, root);
        await noteObs(fdObs, ev.event_id);
        const cal = runCalendarPhase8Lane({ ev, nowIso, asOf, root });
        await noteObs(cal.observations, ev.event_id);
      } else {
        bump(result.by_source, "football-data-co-uk", "fail", recordedThisEvent);
        result.research_failures += 1;
      }
    }

    // 4b) Club-Football-Match-Data — bound prior rows only (file presence is not SUCCESS)
    {
      const { bindClubFootballEvent } = await import(
        "@/domain/eval/data-intelligence/research/club-football-bind"
      );
      const bind = bindClubFootballEvent({
        home: ev.home_or_a,
        away: ev.away_or_b,
        kickoffIso: ev.kickoff_utc ?? nowIso,
      });
      const cfOk = bind.status === "SUCCESS" || bind.status === "PARTIAL";
      appendResearchStatus(
        baseRow({
          event_id: ev.event_id,
          source_id: "club-football-match-data",
          phase: postKickoff ? "POST_KICKOFF" : cfOk ? "OK" : "UNAVAILABLE",
          ok: cfOk && !postKickoff,
          fetched: bind.file_present,
          fetched_at: bind.file_present ? nowIso : null,
          available_at: null,
          reason: (postKickoff ? `POST_KICKOFF. ${bind.reason}` : bind.reason) + postNote,
          raw_ref: bind.file_present ? `prior_n=${bind.prior_n}` : null,
          cycle_number: input.cycleNumber,
          at: nowIso,
          url: null,
          adapter_kind: "CACHE_ONLY",
          parser_status: postKickoff ? "POST_KICKOFF" : bind.status,
          fields_extracted: postKickoff ? [] : bind.fields_extracted,
        }),
        root,
      );
      if (cfOk && !postKickoff) {
        bump(result.by_source, "club-football-match-data", "ok", recordedThisEvent);
        result.research_fetches += 1;
        const { appendResearchObservation } = await import(
          "@/domain/eval/data-intelligence/research/observations-store"
        );
        const cfRows = [];
        if (bind.home_gf_l5 != null) {
          const row = {
            event_id: ev.event_id,
            feature_key: "home_gf_l5",
            value: bind.home_gf_l5,
            source: "club-football-match-data",
            source_url: null,
            observed_at: nowIso,
            available_at: null,
            extraction_method: "csv_prior_rows",
            confidence: null,
            status: "REAL" as const,
            kind: "HISTORICAL_PRIOR" as const,
            enters_independent_model: false,
          };
          appendResearchObservation(row, root);
          cfRows.push(row);
        }
        if (bind.away_gf_l5 != null) {
          const row = {
            event_id: ev.event_id,
            feature_key: "away_gf_l5",
            value: bind.away_gf_l5,
            source: "club-football-match-data",
            source_url: null,
            observed_at: nowIso,
            available_at: null,
            extraction_method: "csv_prior_rows",
            confidence: null,
            status: "REAL" as const,
            kind: "HISTORICAL_PRIOR" as const,
            enters_independent_model: false,
          };
          appendResearchObservation(row, root);
          cfRows.push(row);
        }
        await noteObs(cfRows, ev.event_id);
      } else {
        bump(result.by_source, "club-football-match-data", "fail", recordedThisEvent);
        result.research_failures += 1;
      }
    }

    // Odds stay MARKET/UI. Token APIs without keys are not consulted Fonti.

    // WAF/CAPTCHA sites are not consulted. Attach public acquisition cache instead.
    {
      const attached = attachAcquisitionCacheToEvent({
        home: ev.home_or_a,
        away: ev.away_or_b,
        kickoffIso: ev.kickoff_utc,
      });
      for (const hit of attached) {
        appendResearchStatus(
          baseRow({
            event_id: ev.event_id,
            source_id: hit.source_id,
            phase: hit.ok ? "OK" : "UNAVAILABLE",
            ok: hit.ok,
            fetched: hit.fetched,
            fetched_at: hit.fetched ? nowIso : null,
            available_at: hit.ok ? nowIso : null,
            observed_at: hit.ok ? nowIso : null,
            reason: hit.reason,
            raw_ref: null,
            cycle_number: input.cycleNumber,
            at: nowIso,
            url: hit.url,
            adapter_kind: "PRODUCTION_ADAPTER",
            parser_status: hit.parser_status,
            fields_extracted: hit.fields,
          }),
          root,
        );
        if (hit.ok) {
          bump(result.by_source, hit.source_id, "ok", recordedThisEvent);
          result.research_fetches += 1;
        } else {
          bump(result.by_source, hit.source_id, "fail", recordedThisEvent);
          result.research_failures += 1;
        }
      }
    }

    // Understat league page — prior xG only. 403 does not stop other sources.
    {
      const us = await runUnderstatPhase8Lane({ ev, nowIso, asOf, root });
      for (const st of us.statuses) {
        if (st.http_status === 403 || st.http_status === 429) markSourceBlocked("understat", st.http_status);
        appendResearchStatus(
          baseRow({
            event_id: ev.event_id,
            source_id: st.source_id,
            phase: st.phase,
            ok: st.ok,
            fetched: st.fetched,
            fetched_at: st.fetched ? nowIso : null,
            available_at: null,
            observed_at: st.ok ? nowIso : null,
            reason: st.reason + postNote,
            raw_ref: st.raw_ref,
            cycle_number: input.cycleNumber,
            at: nowIso,
            url: st.url,
            adapter_kind: catalogueAdapterKind("understat") ?? "PRODUCTION_ADAPTER",
            http_status: st.http_status,
            parser_status: st.parser_status,
            fields_extracted: st.fields_extracted,
          }),
          root,
        );
        if (st.ok) {
          bump(result.by_source, "understat", "ok", recordedThisEvent);
          result.research_fetches += 1;
        } else if (st.parser_status === "DENIED") {
          bump(result.by_source, "understat", "denied", recordedThisEvent);
          result.research_denied += 1;
        } else {
          bump(result.by_source, "understat", "fail", recordedThisEvent);
          result.research_failures += 1;
        }
      }
      await noteObs(us.observations, ev.event_id);
    }

    // Public RSS — CONTEXT mention only (both teams, identity tokens)
    {
      const { matchRssToEvent } = await import("@/domain/eval/data-intelligence/research/rss-news");
      for (const sid of Object.keys(RSS_FEEDS) as RssSourceId[]) {
        const rss = await matchRssToEvent({ sourceId: sid, home: ev.home_or_a, away: ev.away_or_b });
        const phase =
          rss.status === "BLOCKED"
            ? "BLOCKED"
            : rss.status === "PARTIAL"
              ? "OK"
              : rss.status === "HTTP_ERROR"
                ? "UNAVAILABLE"
                : "UNAVAILABLE";
        appendResearchStatus(
          baseRow({
            event_id: ev.event_id,
            source_id: sid,
            phase,
            ok: rss.status === "PARTIAL",
            fetched: rss.http_status != null,
            fetched_at: rss.http_status != null ? nowIso : null,
            available_at: rss.matched_pubDate,
            observed_at: rss.status === "PARTIAL" ? nowIso : null,
            reason: rss.reason,
            raw_ref: rss.matched_link,
            cycle_number: input.cycleNumber,
            at: nowIso,
            url: rss.url,
            http_status: rss.http_status,
            parser_status: rss.status,
            fields_extracted: rss.matched_title ? ["rss_mention"] : [],
            adapter_kind: "PRODUCTION_ADAPTER",
          }),
          root,
        );
        if (rss.status === "PARTIAL" && rss.matched_title) {
          bump(result.by_source, sid, "ok", recordedThisEvent);
          result.research_fetches += 1;
          const { appendResearchObservation } = await import(
            "@/domain/eval/data-intelligence/research/observations-store"
          );
          const news = newsObservationFromRss({
            source: sid,
            title: rss.matched_title,
            link: rss.matched_link,
            pubDate: rss.matched_pubDate,
            eventId: ev.event_id,
            home: ev.home_or_a,
            away: ev.away_or_b,
          });
          const row = {
            event_id: ev.event_id,
            feature_key: `news_${news.category.toLowerCase()}`,
            value: rss.matched_title,
            source: sid,
            source_url: rss.matched_link ?? rss.url,
            observed_at: nowIso,
            available_at: rss.matched_pubDate,
            extraction_method: "public_rss",
            confidence: null,
            status: "CONTEXT" as const,
            kind: "EVENT_RESEARCH" as const,
            enters_independent_model: false,
          };
          appendResearchObservation(row, root);
          await noteObs([row], ev.event_id);
        } else if (rss.status === "BLOCKED") {
          bump(result.by_source, sid, "fail", recordedThisEvent);
          result.research_failures += 1;
        } else {
          bump(result.by_source, sid, "fail", recordedThisEvent);
          result.research_failures += 1;
        }
      }
    }

    for (const id of ACTIVE_FONTI_SOURCE_IDS) {
      if (recordedThisEvent.has(id)) continue;
      const cat = RESEARCH_SOURCE_CATALOGUE.find((s) => s.source_id === id);
      appendResearchStatus(
        baseRow({
          event_id: ev.event_id,
          source_id: id,
          phase: "UNAVAILABLE",
          ok: false,
          fetched: false,
          fetched_at: null,
          available_at: null,
          reason: "Fonte cablata, senza abbinamento per questa partita (identità fail-closed).",
          raw_ref: null,
          cycle_number: input.cycleNumber,
          at: nowIso,
          url: cat?.url ?? null,
          adapter_kind: cat?.adapter ?? "PRODUCTION_ADAPTER",
          parser_status: "NO_DATA",
          fields_extracted: [],
        }),
        root,
      );
      bump(result.by_source, id, "fail", recordedThisEvent);
      result.research_failures += 1;
    }
  }

  result.events_with_real_event_data = eventsWithReal.size;
  result.events_with_historical_data = eventsWithHist.size;
  const attempts = result.research_fetches + result.research_failures + result.research_denied;
  result.data_yield = attempts > 0 ? Math.round((result.observations_created / attempts) * 1000) / 1000 : 0;

  writeResearchCycleSummary(
    {
      at: nowIso,
      cycle_number: input.cycleNumber,
      ...result,
      catalogue_size: RESEARCH_SOURCE_CATALOGUE.length,
      real_money: false,
      scrape_enters_model: false,
      odds_enter_model: false,
    },
    root,
  );

  return result;
}
