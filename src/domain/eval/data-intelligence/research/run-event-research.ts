/**
 * Event research for brain cycles.
 * Executes real adapters/probes where they exist; records MISSING_ADAPTER / DENIED honestly.
 * Never invents available_at; scrape / market never enters independent MODEL.
 */
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadApiSportsPrematchFromCacheSync } from "@/domain/eval/data-intelligence/adapters/api-sports-prematch";
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
  type CatalogueSource,
} from "@/domain/eval/data-intelligence/research/source-catalogue";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";
import { inspectClubEloForEvent } from "@/domain/eval/data-intelligence/research/clubelo-lookup";
import { asOfAfterKickoff } from "@/domain/eval/data-intelligence/research/temporal";
import {
  buildEventResearchPlan,
  persistEventResearchPlan,
} from "@/domain/eval/data-intelligence/research/research-plan";

export type ResearchCycleResult = {
  events_touched: number;
  research_fetches: number;
  research_failures: number;
  research_denied: number;
  missing_adapters: number;
  by_source: Record<string, { ok: number; fail: number; denied: number; missing: number }>;
};

function bump(
  by: ResearchCycleResult["by_source"],
  source: string,
  kind: "ok" | "fail" | "denied" | "missing",
): void {
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

function recordMissingOrDenied(
  ev: PermanentEvent044,
  cat: CatalogueSource,
  cycleNumber: number | null,
  nowIso: string,
  root: string,
  result: ResearchCycleResult,
): void {
  if (cat.adapter === "MISSING_ADAPTER") {
    appendResearchStatus(
      baseRow({
        event_id: ev.event_id,
        source_id: cat.source_id,
        phase: "MISSING_ADAPTER",
        ok: false,
        fetched: false,
        fetched_at: null,
        available_at: null,
        reason: `MISSING_ADAPTER — ${cat.notes}`,
        raw_ref: null,
        cycle_number: cycleNumber,
        at: nowIso,
        url: cat.url,
        adapter_kind: cat.adapter,
        http_status: null,
        parser_status: "NOT_RUN",
        fields_extracted: [],
      }),
      root,
    );
    bump(result.by_source, cat.source_id, "missing");
    result.missing_adapters += 1;
    return;
  }
  if (cat.adapter === "POLICY_DENIED") {
    appendResearchStatus(
      baseRow({
        event_id: ev.event_id,
        source_id: cat.source_id,
        phase: "DENIED",
        ok: false,
        fetched: false,
        fetched_at: null,
        available_at: null,
        reason: `DISABLED_BY_POLICY — ${cat.notes}`,
        raw_ref: null,
        cycle_number: cycleNumber,
        at: nowIso,
        url: cat.url,
        adapter_kind: cat.adapter,
        http_status: null,
        parser_status: "DENIED",
        fields_extracted: [],
      }),
      root,
    );
    bump(result.by_source, cat.source_id, "denied");
    result.research_denied += 1;
  }
}

/**
 * Research a capped set of events. Cache-only API-Sports; Open-Meteo network;
 * ordinary GET scrape probes always on (403/CAPTCHA stay BLOCKED); catalogue stubs for the rest.
 */
export async function runEventResearchBatch(input: {
  events: PermanentEvent044[];
  cycleNumber: number | null;
  nowIso?: string;
  labBRoot?: string;
  maxEvents?: number;
  allowScrapeProbes?: boolean;
  asOf?: string;
  /** When true (default), record MISSING_ADAPTER / POLICY rows for full catalogue once per event. */
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
    by_source: {},
  };

  const executed = new Set([
    "api-sports",
    "open-meteo",
    "fbref",
    "understat",
    "uefa",
    "sofascore",
    "directa",
    "flashscore",
    "soccerway",
    "clubelo",
    "football-data-co-uk",
    "club-football-match-data",
    "the-odds-api",
  ]);

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
    try {
      persistEventResearchPlan(buildEventResearchPlan(ev, root), root);
    } catch {
      /* plan persist optional */
    }

    const postNote = postKickoff
      ? " POST_KICKOFF — osservazione dopo kickoff, esclusa dal modello pre-match."
      : "";

    // 1) API-Sports cache-only
    const fixtureRaw = (ev as { fixture_id?: number | string }).fixture_id;
    const fixtureId =
      typeof fixtureRaw === "number"
        ? fixtureRaw
        : typeof fixtureRaw === "string" && /^\d+$/.test(fixtureRaw)
          ? Number(fixtureRaw)
          : null;
    const apiObs = loadApiSportsPrematchFromCacheSync({
      eventId: ev.event_id,
      eventTime: kickoff,
      homeTeam: ev.home_or_a,
      awayTeam: ev.away_or_b,
      fixtureId,
      decisionTime: asOf,
      labBRoot: root,
    });
    if (!fixtureId) {
      appendResearchStatus(
        baseRow({
          event_id: ev.event_id,
          source_id: "api-sports",
          phase: "UNAVAILABLE",
          ok: false,
          fetched: false,
          fetched_at: null,
          available_at: null,
          reason: "NO_FIXTURE_ID — cache lookup skipped (no invented id)",
          raw_ref: null,
          cycle_number: input.cycleNumber,
          at: nowIso,
          url: "https://v3.football.api-sports.io/",
          adapter_kind: "CACHE_ONLY",
          http_status: null,
          parser_status: "SKIPPED",
          fields_extracted: [],
        }),
        root,
      );
      bump(result.by_source, "api-sports", "fail");
      result.research_failures += 1;
    } else if (apiObs.length === 0) {
      appendResearchStatus(
        baseRow({
          event_id: ev.event_id,
          source_id: "api-sports",
          phase: "UNAVAILABLE",
          ok: false,
          fetched: false,
          fetched_at: null,
          available_at: null,
          reason: "CACHE_MISS — no injuries/lineups on disk for fixture",
          raw_ref: null,
          cycle_number: input.cycleNumber,
          at: nowIso,
          url: "https://v3.football.api-sports.io/",
          adapter_kind: "CACHE_ONLY",
          http_status: null,
          parser_status: "CACHE_MISS",
          fields_extracted: [],
        }),
        root,
      );
      bump(result.by_source, "api-sports", "fail");
      result.research_failures += 1;
    } else {
      const clocks = apiObs.map((o) => o.available_at).filter(Boolean) as string[];
      const fields = [...new Set(apiObs.map((o) => o.feature_name))];
      appendResearchStatus(
        baseRow({
          event_id: ev.event_id,
          source_id: "api-sports",
          phase: "OK",
          ok: true,
          fetched: true,
          fetched_at: nowIso,
          available_at: clocks[0] ?? null,
          observed_at: nowIso,
          reason: `cache observations=${apiObs.length}`,
          raw_ref: fixtureId != null ? `fixture:${fixtureId}` : null,
          cycle_number: input.cycleNumber,
          at: nowIso,
          url: "https://v3.football.api-sports.io/",
          adapter_kind: "CACHE_ONLY",
          http_status: 200,
          parser_status: "OK",
          fields_extracted: fields,
        }),
        root,
      );
      bump(result.by_source, "api-sports", "ok");
      result.research_fetches += 1;
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
        bump(result.by_source, "open-meteo", "fail");
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
          bump(result.by_source, "open-meteo", "ok");
          result.research_fetches += 1;
        } else {
          bump(result.by_source, "open-meteo", "fail");
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
      bump(result.by_source, "open-meteo", "fail");
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
        bump(result.by_source, "clubelo", "ok");
        result.research_fetches += 1;
      } else {
        bump(result.by_source, "clubelo", "fail");
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
        bump(result.by_source, "football-data-co-uk", "ok");
        result.research_fetches += 1;
      } else {
        bump(result.by_source, "football-data-co-uk", "fail");
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
        bump(result.by_source, "club-football-match-data", "ok");
        result.research_fetches += 1;
        const { appendResearchObservation } = await import(
          "@/domain/eval/data-intelligence/research/observations-store"
        );
        if (bind.home_gf_l5 != null) {
          appendResearchObservation(
            {
              event_id: ev.event_id,
              feature_key: "home_gf_l5",
              value: bind.home_gf_l5,
              source: "club-football-match-data",
              source_url: null,
              observed_at: nowIso,
              available_at: null,
              extraction_method: "csv_prior_rows",
              confidence: null,
              status: "REAL",
              enters_independent_model: false,
            },
            root,
          );
        }
        if (bind.away_gf_l5 != null) {
          appendResearchObservation(
            {
              event_id: ev.event_id,
              feature_key: "away_gf_l5",
              value: bind.away_gf_l5,
              source: "club-football-match-data",
              source_url: null,
              observed_at: nowIso,
              available_at: null,
              extraction_method: "csv_prior_rows",
              confidence: null,
              status: "REAL",
              enters_independent_model: false,
            },
            root,
          );
        }
      } else {
        bump(result.by_source, "club-football-match-data", "fail");
        result.research_failures += 1;
      }
    }

    // Odds API — market layer only (explicit: does not enter model)
    appendResearchStatus(
      baseRow({
        event_id: ev.event_id,
        source_id: "the-odds-api",
        phase: "OK",
        ok: false,
        fetched: true,
        fetched_at: nowIso,
        available_at: null,
        reason: "MARKET_COMPARE_ONLY — odds never enter independent MODEL vector. Not a research SUCCESS.",
        raw_ref: "lab_b_quotes",
        cycle_number: input.cycleNumber,
        at: nowIso,
        url: "https://the-odds-api.com/",
        adapter_kind: "PRODUCTION_ADAPTER",
        parser_status: "MARKET_LAYER",
        fields_extracted: ["probability_market", "odds"],
      }),
      root,
    );
    bump(result.by_source, "the-odds-api", "ok");
    // Do NOT count as research_fetches for independent research — market layer

    // Event-page probes (never homepage). One ordinary GET per source per event.
    if (input.allowScrapeProbes !== false) {
      const { fetchEventPage } = await import(
        "@/domain/eval/data-intelligence/research/event-page-fetch"
      );
      for (const sid of [
        "fbref",
        "understat",
        "uefa",
        "sofascore",
        "directa",
        "flashscore",
        "soccerway",
      ] as const) {
        const page = await fetchEventPage({
          sourceId: sid,
          home: ev.home_or_a,
          away: ev.away_or_b,
          cacheRoot: root,
          nowIso,
        });
        const typed = page.fields_extracted.filter(
          (f) => f !== "page_mentions_both_teams" && f !== "page_mentions_xg" && !f.startsWith("page_mentions_"),
        );
        const phase =
          page.status === "BLOCKED" || page.status === "AUTH_REQUIRED"
            ? "BLOCKED"
            : page.status === "DENIED" || page.status === "POLICY_DISABLED"
              ? "DENIED"
              : page.status === "SUCCESS"
                ? "OK"
                : page.status === "PARTIAL"
                  ? "OK"
                  : "UNAVAILABLE";
        appendResearchStatus(
          baseRow({
            event_id: ev.event_id,
            source_id: sid,
            phase,
            ok: page.status === "SUCCESS",
            fetched: page.fetched,
            fetched_at: page.fetched ? nowIso : null,
            available_at: null,
            observed_at: page.fetched ? nowIso : null,
            reason: page.reason,
            raw_ref: page.content_hash ?? null,
            cycle_number: input.cycleNumber,
            at: nowIso,
            url: page.url || null,
            http_status: page.http_status,
            parser_status: page.status,
            fields_extracted: page.fields_extracted,
            adapter_kind: "TEST_PROBE",
          }),
          root,
        );
        if (page.status === "SUCCESS" && typed.length > 0) {
          const { appendResearchObservation } = await import(
            "@/domain/eval/data-intelligence/research/observations-store"
          );
          for (const field of page.extracted_values ?? []) {
            if (typed.includes(field.key)) {
              appendResearchObservation(
                {
                  event_id: ev.event_id,
                  feature_key: `page_${field.key}`,
                  value: field.value,
                  source: sid,
                  source_url: page.url || null,
                  observed_at: nowIso,
                  available_at: null,
                  extraction_method: "html_extract",
                  confidence: null,
                  status: "CONTEXT",
                  enters_independent_model: false,
                  content_hash: page.content_hash ?? null,
                },
                root,
              );
            }
          }
        }
        if (page.status === "DENIED" || page.status === "POLICY_DISABLED") {
          bump(result.by_source, sid, "denied");
          result.research_denied += 1;
        } else if (page.status === "SUCCESS" && typed.length > 0) {
          bump(result.by_source, sid, "ok");
          result.research_fetches += 1;
        } else {
          bump(result.by_source, sid, "fail");
          result.research_failures += 1;
        }
      }
    }

    // Full catalogue stubs (MISSING_ADAPTER) once per event
    if (input.recordFullCatalogue !== false) {
      for (const cat of RESEARCH_SOURCE_CATALOGUE) {
        if (executed.has(cat.source_id)) continue;
        if (cat.adapter === "MISSING_ADAPTER" || cat.adapter === "POLICY_DENIED") {
          recordMissingOrDenied(ev, cat, input.cycleNumber, nowIso, root, result);
        }
      }
    }
  }

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
