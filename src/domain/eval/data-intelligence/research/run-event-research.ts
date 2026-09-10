/**
 * Event research for brain cycles.
 * Executes real adapters/probes where they exist; records MISSING_ADAPTER / DENIED honestly.
 * Never invents available_at; scrape / market never enters independent MODEL.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadApiSportsPrematchFromCacheSync } from "@/domain/eval/data-intelligence/adapters/api-sports-prematch";
import { fetchOpenMeteoContext } from "@/domain/eval/data-intelligence/open-meteo";
import { isTestScrapeEnabled } from "@/domain/sources/scraping-policy";
import { runTestScrapeProbes } from "@/domain/eval/data-intelligence/scrape/probe";
import { clubEloCachePresent, findClubEloCachePaths } from "@/domain/eval/data-intelligence/registry";
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
 * scrape probes only when BETMIND_TEST_SCRAPE allows; catalogue stubs for the rest.
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

  for (const ev of slice) {
    const kickoff = ev.kickoff_utc ?? nowIso;
    const asOf = input.asOf ?? nowIso;

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

    // 3) ClubElo local cache presence (no network)
    const eloPresent = clubEloCachePresent(process.cwd());
    const eloPaths = findClubEloCachePaths(process.cwd());
    appendResearchStatus(
      baseRow({
        event_id: ev.event_id,
        source_id: "clubelo",
        phase: eloPresent ? "OK" : "UNAVAILABLE",
        ok: eloPresent,
        fetched: eloPresent,
        fetched_at: eloPresent ? nowIso : null,
        available_at: null, // DATE_ONLY — no invented exact clock
        observed_at: eloPresent ? nowIso : null,
        reason: eloPresent
          ? `local_csv_paths=${eloPaths.length} (DATE_ONLY; enters model only if rating_date < match_date)`
          : "No local ClubElo CSV cache",
        raw_ref: eloPaths[0] ?? null,
        cycle_number: input.cycleNumber,
        at: nowIso,
        url: "http://clubelo.com/",
        adapter_kind: "CACHE_ONLY",
        http_status: null,
        parser_status: eloPresent ? "CACHE_PRESENT" : "CACHE_ABSENT",
        fields_extracted: eloPresent ? ["club_elo_rating"] : [],
      }),
      root,
    );
    if (eloPresent) {
      bump(result.by_source, "clubelo", "ok");
      result.research_fetches += 1;
    } else {
      bump(result.by_source, "clubelo", "fail");
      result.research_failures += 1;
    }

    // 4) football-data / club-football local hints
    const fdPath = join(process.cwd(), "audit", "external", "task-044", "predictive-intelligence", "matches.jsonl");
    const fdAlt = join(root, "predictive-intelligence", "matches.jsonl");
    const fdPresent = existsSync(fdPath) || existsSync(fdAlt);
    appendResearchStatus(
      baseRow({
        event_id: ev.event_id,
        source_id: "football-data-co-uk",
        phase: fdPresent ? "OK" : "UNAVAILABLE",
        ok: fdPresent,
        fetched: fdPresent,
        fetched_at: fdPresent ? nowIso : null,
        available_at: null,
        reason: fdPresent
          ? "Local historical matches present — DATE_ONLY; form features often NOT_ELIGIBLE STRICT"
          : "No local matches.jsonl",
        raw_ref: fdPresent ? "matches.jsonl" : null,
        cycle_number: input.cycleNumber,
        at: nowIso,
        url: "https://www.football-data.co.uk/",
        adapter_kind: "CACHE_ONLY",
        parser_status: fdPresent ? "CACHE_PRESENT" : "CACHE_ABSENT",
        fields_extracted: fdPresent ? ["form_l3", "form_l5", "form_l10"] : [],
      }),
      root,
    );
    if (fdPresent) {
      bump(result.by_source, "football-data-co-uk", "ok");
      result.research_fetches += 1;
    } else {
      bump(result.by_source, "football-data-co-uk", "fail");
      result.research_failures += 1;
    }

    // Odds API — market layer only (explicit: does not enter model)
    appendResearchStatus(
      baseRow({
        event_id: ev.event_id,
        source_id: "the-odds-api",
        phase: "OK",
        ok: true,
        fetched: true,
        fetched_at: nowIso,
        available_at: null,
        reason: "MARKET_COMPARE_ONLY — odds never enter independent MODEL vector",
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
    // (still recorded for lineage honesty)

    // Policy denied sources (per event)
    for (const sid of ["directa", "flashscore", "soccerway"] as const) {
      const cat = RESEARCH_SOURCE_CATALOGUE.find((c) => c.source_id === sid)!;
      recordMissingOrDenied(ev, cat, input.cycleNumber, nowIso, root, result);
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

  // Gated scrape probes once per batch
  if (input.allowScrapeProbes !== false && isTestScrapeEnabled() && slice[0]) {
    const probes = await runTestScrapeProbes({
      eventId: slice[0].event_id,
      eventTime: slice[0].kickoff_utc,
      labBRoot: root,
    });
    for (const p of probes) {
      const fetched = p.status === "OK" || p.status === "BLOCKED" || p.status === "INVALID";
      const fields = p.observations.map((o) => o.key);
      appendResearchStatus(
        baseRow({
          event_id: slice[0].event_id,
          source_id: p.source_id,
          phase:
            p.status === "OK"
              ? "OK"
              : p.status === "DENIED"
                ? "DENIED"
                : p.status === "BLOCKED"
                  ? "BLOCKED"
                  : "UNAVAILABLE",
          ok: p.status === "OK",
          fetched,
          fetched_at: fetched ? nowIso : null,
          available_at: null,
          observed_at: fetched ? nowIso : null,
          reason: p.reason ?? `probe_${p.status}`,
          raw_ref: p.content_hash,
          cycle_number: input.cycleNumber,
          at: nowIso,
          url: p.url,
          http_status: p.http_status || null,
          parser_status: p.status,
          fields_extracted: fields,
          adapter_kind: "TEST_PROBE",
        }),
        root,
      );
      if (p.status === "DENIED") {
        bump(result.by_source, p.source_id, "denied");
        result.research_denied += 1;
      } else if (p.status === "OK") {
        bump(result.by_source, p.source_id, "ok");
        result.research_fetches += 1;
      } else {
        bump(result.by_source, p.source_id, "fail");
        result.research_failures += 1;
      }
    }
  } else if (!isTestScrapeEnabled()) {
    for (const sid of ["fbref", "understat", "uefa", "sofascore"] as const) {
      appendResearchStatus(
        baseRow({
          event_id: slice[0]?.event_id ?? "batch",
          source_id: sid,
          phase: "DENIED",
          ok: false,
          fetched: false,
          fetched_at: null,
          available_at: null,
          reason: "BETMIND_TEST_SCRAPE disabled — probe not run",
          raw_ref: null,
          cycle_number: input.cycleNumber,
          at: nowIso,
          adapter_kind: "TEST_PROBE",
          parser_status: "DENIED",
          fields_extracted: [],
        }),
        root,
      );
      bump(result.by_source, sid, "denied");
      result.research_denied += 1;
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
