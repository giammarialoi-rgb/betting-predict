import { createOddsApiAdapter055 } from "@/services/sources/odds-api/adapter";
import { createSofascoreAdapter055 } from "@/services/sources/sofascore/adapter";
import { createFlashscoreAdapter055 } from "@/services/sources/flashscore/adapter";
import { createSoccerwayAdapter055 } from "@/services/sources/soccerway/adapter";
import { createDirectaAdapter054 } from "@/services/sources/directa";
import type { SportsSourceAdapter, SourceHealth055, SourceEvent055 } from "@/services/sources/types";

/** Wrap Directa 054 surface onto SportsSourceAdapter without coupling DecisionEngine. */
function wrapDirecta055(): SportsSourceAdapter {
  const d = createDirectaAdapter054();
  const h = d.health();
  return {
    sourceId: "DIRECTA",
    enabled: () => h.enabled,
    health(): SourceHealth055 {
      const x = d.health();
      return {
        sourceId: "DIRECTA",
        status: x.policy_status === "DISABLED_BY_POLICY" ? "DISABLED_BY_POLICY" : "UNAVAILABLE",
        enabled: x.enabled,
        last_success_at: x.last_success_at,
        last_error: x.last_error ?? x.reason,
        events_discovered: x.events_discovered,
        events_matched: 0,
        quotes: 0,
        markets: 0,
        api_calls: 0,
        rate_limit_note: `min_interval_ms=${x.rate_limit.min_interval_ms}`,
        last_update: x.last_request_at,
        reason: x.reason,
      };
    },
    async discoverEvents(input) {
      const r = await d.discoverEvents({
        horizon: input?.horizon === "NEXT_30D" ? "NEXT_7D" : input?.horizon,
      });
      const events: SourceEvent055[] = r.events.map((e) => ({
        source_id: "DIRECTA",
        source_event_id: e.source_event_id,
        sport: e.sport,
        competition: e.competition,
        country: e.country,
        home: e.participant_1,
        away: e.participant_2,
        commence_time: e.kickoff_utc,
        event_status: e.event_status,
        ingested_at: e.ingested_at,
        available_at: e.available_at,
        source_published_at: e.source_published_at,
        content_hash: e.content_hash,
      }));
      return {
        events,
        status: r.status === "DISABLED_BY_POLICY" ? "DISABLED_BY_POLICY" : r.events.length ? "ACTIVE" : "EMPTY",
        error: r.error ?? null,
      };
    },
    async fetchEventDetails(id) {
      const r = await d.discoverEventDetails(id);
      return { detail: null, status: "DISABLED_BY_POLICY", error: r.error };
    },
    async fetchMarkets(id) {
      const r = await d.discoverMarkets(id);
      return { markets: [], status: "DISABLED_BY_POLICY", error: r.error };
    },
    async fetchStatistics() {
      return { statistics: [], status: "DISABLED_BY_POLICY", error: h.reason };
    },
    async fetchResults() {
      return { result: null, status: "DISABLED_BY_POLICY", error: h.reason };
    },
  };
}

export function createAllSourceAdapters055(): SportsSourceAdapter[] {
  return [
    createOddsApiAdapter055(),
    createSofascoreAdapter055(),
    createFlashscoreAdapter055(),
    createSoccerwayAdapter055(),
    wrapDirecta055(),
  ];
}

export {
  createOddsApiAdapter055,
  createSofascoreAdapter055,
  createFlashscoreAdapter055,
  createSoccerwayAdapter055,
};
