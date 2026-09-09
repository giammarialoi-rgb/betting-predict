/**
 * THE_ODDS_API adapter — reads Lab B discovered events (no UI API spend).
 * Live pulls remain in factory-049 / brain daemon with budget governor.
 */

import { createHash } from "node:crypto";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import type {
  Horizon055,
  ProvenanceField055,
  SourceEvent055,
  SourceHealth055,
  SourceRuntimeStatus055,
  SportsSourceAdapter,
} from "@/services/sources/types";

function sportBucket(s: string): string {
  const x = s.toLowerCase();
  if (x.includes("soccer") || x.includes("football")) return "soccer";
  if (x.includes("tennis")) return "tennis";
  if (x.includes("basket")) return "basketball";
  if (x.includes("volley")) return "volleyball";
  if (x.includes("hockey")) return "hockey";
  return "other";
}

function inHorizon(kickoff: string | null, horizon: Horizon055 | undefined, nowMs: number): boolean {
  if (!kickoff) return false;
  const t = Date.parse(kickoff);
  if (!Number.isFinite(t)) return false;
  const delta = t - nowMs;
  if (delta < -2 * 3600_000) return false; // allow slight past for today
  if (!horizon || horizon === "NEXT_30D") return delta <= 30 * 86400_000;
  if (horizon === "TODAY") {
    const d = new Date(nowMs);
    const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const end = start + 86400_000;
    return t >= start && t < end;
  }
  if (horizon === "NEXT_24H") return delta <= 24 * 3600_000;
  if (horizon === "NEXT_72H") return delta <= 72 * 3600_000;
  if (horizon === "NEXT_7D") return delta <= 7 * 86400_000;
  return true;
}

export function createOddsApiAdapter055(root = permanentRoot044()): SportsSourceAdapter {
  const store = () => loadStore044(root);

  return {
    sourceId: "THE_ODDS_API",
    enabled: () => true,
    health(): SourceHealth055 {
      const s = store();
      const unique = new Set(s.events.map((e) => e.event_id));
      const markets = new Set(s.quotes.map((q) => q.market));
      const status: SourceRuntimeStatus055 = unique.size > 0 ? "ACTIVE" : "EMPTY";
      return {
        sourceId: "THE_ODDS_API",
        status,
        enabled: true,
        last_success_at: s.events.length ? s.events[s.events.length - 1]!.collected_at_utc ?? null : null,
        last_error: null,
        events_discovered: unique.size,
        events_matched: unique.size,
        quotes: s.quotes.length,
        markets: markets.size,
        api_calls: 0,
        rate_limit_note: "live pulls gated by budget governor in factory-049",
        last_update: new Date().toISOString(),
        reason: status === "EMPTY" ? "no Lab B odds events yet" : null,
      };
    },
    async discoverEvents(input) {
      const s = store();
      const nowMs = Date.now();
      const byId = new Map<string, (typeof s.events)[0]>();
      for (const e of s.events) byId.set(e.event_id, e);
      const events: SourceEvent055[] = [];
      for (const e of byId.values()) {
        if (input?.sport && sportBucket(e.sport) !== input.sport.toLowerCase()) continue;
        // No horizon → full Lab B catalog (no artificial cap). Horizon filters only when requested.
        if (input?.horizon && e.kickoff_utc && !inHorizon(e.kickoff_utc, input.horizon, nowMs)) continue;
        const ingested = e.collected_at_utc;
        const payload = `${e.event_id}|${e.home_or_a}|${e.away_or_b}|${e.kickoff_utc}`;
        events.push({
          source_id: "THE_ODDS_API",
          source_event_id: e.event_id,
          sport: e.sport,
          competition: e.competition,
          country: e.country,
          home: e.home_or_a,
          away: e.away_or_b,
          commence_time: e.kickoff_utc,
          event_status: e.status ?? null,
          ingested_at: ingested,
          available_at: e.available_at_utc ?? ingested,
          source_published_at: null,
          content_hash: createHash("sha256").update(payload).digest("hex").slice(0, 32),
        });
      }
      return {
        events,
        status: events.length ? "ACTIVE" : "EMPTY",
        error: null,
      };
    },
    async fetchEventDetails(sourceEventId) {
      const e = store().events.find((x) => x.event_id === sourceEventId);
      if (!e) return { detail: null, status: "EMPTY", error: "not_found" };
      const at = e.available_at_utc ?? e.collected_at_utc;
      const detail: Record<string, ProvenanceField055> = {
        home: { field: "home", value: e.home_or_a, source: "THE_ODDS_API", observed_at: at, available_at: at, confidence: null },
        away: { field: "away", value: e.away_or_b, source: "THE_ODDS_API", observed_at: at, available_at: at, confidence: null },
        kickoff: {
          field: "commence_time",
          value: e.kickoff_utc,
          source: "THE_ODDS_API",
          observed_at: at,
          available_at: at,
          confidence: null,
        },
      };
      return { detail, status: "ACTIVE", error: null };
    },
    async fetchMarkets(sourceEventId) {
      const qs = store().quotes.filter((q) => q.event_id === sourceEventId);
      const markets = qs.map((q) => ({
        field: "market_quote",
        value: { market: q.market, bookmaker: q.bookmaker, selection: q.selection, price: q.price, line: q.line ?? null },
        source: "THE_ODDS_API" as const,
        observed_at: q.available_at_utc ?? q.collected_at_utc,
        available_at: q.available_at_utc ?? q.collected_at_utc,
        confidence: null,
      }));
      return { markets, status: markets.length ? "ACTIVE" : "EMPTY", error: null };
    },
    async fetchStatistics() {
      return { statistics: [], status: "EMPTY", error: "odds_api_has_no_form_stats" };
    },
    async fetchResults(sourceEventId) {
      const set = store().settlements.find((s) => s.event_id === sourceEventId);
      if (!set) return { result: null, status: "EMPTY", error: null };
      const at = set.settled_at;
      return {
        result: {
          field: "result",
          value: set.result ?? set.outcome,
          source: "THE_ODDS_API",
          observed_at: at,
          available_at: at,
          confidence: null,
        },
        status: "ACTIVE",
        error: null,
      };
    },
  };
}
