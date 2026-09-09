/**
 * Event research for brain cycles.
 * API-Sports cache, Open-Meteo CONTEXT, gated scrape probes.
 * Never invents available_at; scrape never enters independent MODEL.
 */
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadApiSportsPrematchFromCacheSync } from "@/domain/eval/data-intelligence/adapters/api-sports-prematch";
import { fetchOpenMeteoContext } from "@/domain/eval/data-intelligence/open-meteo";
import { isTestScrapeEnabled } from "@/domain/sources/scraping-policy";
import { runTestScrapeProbes } from "@/domain/eval/data-intelligence/scrape/probe";
import {
  appendResearchStatus,
  writeResearchCycleSummary,
  type ResearchStatusRow,
} from "@/domain/eval/data-intelligence/research/status";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";

export type ResearchCycleResult = {
  events_touched: number;
  research_fetches: number;
  research_failures: number;
  research_denied: number;
  by_source: Record<string, { ok: number; fail: number; denied: number }>;
};

function bump(
  by: ResearchCycleResult["by_source"],
  source: string,
  kind: "ok" | "fail" | "denied",
): void {
  if (!by[source]) by[source] = { ok: 0, fail: 0, denied: 0 };
  by[source]![kind] += 1;
}

function row(partial: Omit<ResearchStatusRow, "enters_independent_model" | "at"> & { at?: string }): ResearchStatusRow {
  return {
    ...partial,
    enters_independent_model: false,
    at: partial.at ?? new Date().toISOString(),
  };
}

/**
 * Research a capped set of events. Cache-only API-Sports; Open-Meteo network;
 * scrape probes only when BETMIND_TEST_SCRAPE allows.
 */
export async function runEventResearchBatch(input: {
  events: PermanentEvent044[];
  cycleNumber: number | null;
  nowIso?: string;
  labBRoot?: string;
  /** Max events to research this cycle (politeness / budget). */
  maxEvents?: number;
  /** When true, also run gated homepage scrape probes once per batch (not per event flood). */
  allowScrapeProbes?: boolean;
  asOf?: string;
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
    by_source: {},
  };

  for (const ev of slice) {
    const kickoff = ev.kickoff_utc ?? nowIso;
    const asOf = input.asOf ?? nowIso;

    // 1) API-Sports cache-only (no invent fixture id)
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
        row({
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
        }),
        root,
      );
      bump(result.by_source, "api-sports", "fail");
      result.research_failures += 1;
    } else if (apiObs.length === 0) {
      appendResearchStatus(
        row({
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
        }),
        root,
      );
      bump(result.by_source, "api-sports", "fail");
      result.research_failures += 1;
    } else {
      const clocks = apiObs.map((o) => o.available_at).filter(Boolean) as string[];
      appendResearchStatus(
        row({
          event_id: ev.event_id,
          source_id: "api-sports",
          phase: "OK",
          ok: true,
          fetched: true,
          fetched_at: nowIso,
          available_at: clocks[0] ?? null,
          reason: `cache observations=${apiObs.length}`,
          raw_ref: fixtureId != null ? `fixture:${fixtureId}` : null,
          cycle_number: input.cycleNumber,
          at: nowIso,
        }),
        root,
      );
      bump(result.by_source, "api-sports", "ok");
      result.research_fetches += 1;
    }

    // 2) Open-Meteo CONTEXT (network; may fail without coords)
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
          row({
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
          }),
          root,
        );
        bump(result.by_source, "open-meteo", "fail");
        result.research_failures += 1;
      } else {
        appendResearchStatus(
          row({
            event_id: ev.event_id,
            source_id: "open-meteo",
            phase: blocked && eligible.length === 0 ? "BLOCKED" : "OK",
            ok: eligible.length > 0,
            fetched: true,
            fetched_at: nowIso,
            available_at: eligible[0]?.available_at ?? null,
            reason: blocked
              ? "CONTEXT recuperato; alcune righe bloccate temporalmente / solo contesto"
              : `osservazioni CONTEXT=${wx.length}`,
            raw_ref: null,
            cycle_number: input.cycleNumber,
            at: nowIso,
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
        row({
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
        }),
        root,
      );
      bump(result.by_source, "open-meteo", "fail");
      result.research_failures += 1;
    }

    // Policy stubs — honest UNAVAILABLE (no WAF bypass)
    for (const sid of ["sofascore", "flashscore", "soccerway", "directa"] as const) {
      appendResearchStatus(
        row({
          event_id: ev.event_id,
          source_id: sid,
          phase: "DENIED",
          ok: false,
          fetched: false,
          fetched_at: null,
          available_at: null,
          reason: "DISABLED_BY_POLICY — no unauthorized scrape",
          raw_ref: null,
          cycle_number: input.cycleNumber,
          at: nowIso,
        }),
        root,
      );
      bump(result.by_source, sid, "denied");
      result.research_denied += 1;
    }
  }

  // 3) Gated scrape probes once per batch (homepage research test — CONTEXT only)
  if (input.allowScrapeProbes !== false && isTestScrapeEnabled() && slice[0]) {
    const probes = await runTestScrapeProbes({
      eventId: slice[0].event_id,
      eventTime: slice[0].kickoff_utc,
      labBRoot: root,
    });
    for (const p of probes) {
      const fetched = p.status === "OK" || p.status === "BLOCKED" || p.status === "INVALID";
      appendResearchStatus(
        row({
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
          available_at: null, // probes never invent clocks
          reason: p.reason ?? `probe_${p.status}`,
          raw_ref: p.content_hash,
          cycle_number: input.cycleNumber,
          at: nowIso,
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
    for (const sid of ["fbref", "understat", "uefa"] as const) {
      appendResearchStatus(
        row({
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
      real_money: false,
      scrape_enters_model: false,
    },
    root,
  );

  return result;
}
