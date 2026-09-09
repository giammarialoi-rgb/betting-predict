import { eventCoverageRate, sourceHealth036 } from "@/domain/eval/prospective-036/health";
import { parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import type { ProspectiveStore036 } from "@/domain/eval/prospective-036/store";
import { canEnterStrict038 } from "@/domain/eval/datalake-038/classify";
import { matchGrade038 } from "@/domain/eval/datalake-038/matching";
import { coverageFromObservations038 } from "@/domain/eval/datalake-038/asof";
import { getOddsApiKey } from "@/domain/eval/datalake-038/sources";
import type { CollectionStatus038, Coverage038, Health038 } from "@/domain/eval/datalake-038/types";

export function isStrictQuote038(q: {
  source_timestamp_utc: string | null;
  kickoff_at_utc: string;
  temporal_basis: string;
  collector_timestamp_utc: string;
  home_team: string;
  away_team: string;
  competition: string;
  source_event_id: string;
  market: string;
  source: string;
}): boolean {
  return canEnterStrict038({
    quoteTimestampUtc: q.source_timestamp_utc,
    kickoffUtc: q.kickoff_at_utc,
    temporalBasis: q.temporal_basis,
    clientRetrievedAt: q.temporal_basis === "COLLECTOR_TIMESTAMP" ? q.collector_timestamp_utc : null,
    match: matchGrade038({
      home: q.home_team,
      away: q.away_team,
      kickoffUtc: q.kickoff_at_utc,
      competition: q.competition,
      sourceEventId: q.source_event_id,
    }),
    market: q.market,
    provenance: q.source,
  });
}

export function strictQuotes038(store: ProspectiveStore036) {
  return store.quotes.filter((q) => isStrictQuote038(q));
}

export function matchExactCount038(store: ProspectiveStore036): number {
  return new Set(
    store.events
      .filter((e) =>
        matchGrade038({
          home: e.home_team,
          away: e.away_team,
          kickoffUtc: e.kickoff_at_utc,
          competition: e.competition,
          sourceEventId: e.source_event_id,
        }) === "MATCH_EXACT",
      )
      .map((e) => e.event_id),
  ).size;
}

export function complete1x2Events038(store: ProspectiveStore036): number {
  const byEvent = new Map<string, Set<string>>();
  for (const q of strictQuotes038(store).filter((q) => q.market === "1X2")) {
    const set = byEvent.get(q.event_id) ?? new Set();
    set.add(q.selection);
    byEvent.set(q.event_id, set);
  }
  let n = 0;
  for (const sels of byEvent.values()) {
    if (sels.has("HOME") && sels.has("DRAW") && sels.has("AWAY")) n += 1;
  }
  return n;
}

export function asOfCoverageRate038(store: ProspectiveStore036, window: "T-72h" | "T-24h" | "T-1h" | "T-5m"): number {
  const events = [...new Set(strictQuotes038(store).map((q) => q.event_id))];
  if (!events.length) return 0;
  let hit = 0;
  for (const id of events) {
    const ev = store.events.find((e) => e.event_id === id);
    if (!ev) continue;
    const obs = store.quotes
      .filter((q) => q.event_id === id && isStrictQuote038(q))
      .map((q) => ({
        observedAtMs: parseExactUtcMs(q.source_timestamp_utc) ?? -1,
        bookmaker: q.bookmaker,
        market: q.market,
        selection: q.selection,
      }))
      .filter((q) => q.observedAtMs > 0);
    const cov = coverageFromObservations038(obs, ev.kickoff_at_utc);
    if (cov[window] === 1) hit += 1;
  }
  return hit / events.length;
}

export function collectionStatus038(input: {
  configured: boolean;
  lastStatus: string | null;
  lastOk: boolean;
  lastError: string | null;
  collecting?: boolean;
}): CollectionStatus038 {
  if (!input.configured) return "NOT_CONFIGURED";
  if (input.collecting) return "COLLECTING";
  if (input.lastStatus === "error" && !input.lastOk) return "ERROR";
  if (input.lastStatus === "SOURCE_UNAVAILABLE" && !input.lastOk) return "SOURCE_UNAVAILABLE";
  if (input.lastOk && input.lastError) return "DEGRADED";
  return "READY";
}

export function liveHealth038(store: ProspectiveStore036): Health038 {
  const configured = Boolean(getOddsApiKey());
  const journal = store.journal.filter((j) => j.source === "the-odds-api");
  const last = journal.at(-1);
  const lastOk = [...journal].reverse().find((j) => j.status === "ok");
  const errors = journal.filter((j) => j.error).map((j) => j.error!).slice(-8);
  const strict = new Set(strictQuotes038(store).map((q) => q.event_id)).size;
  return {
    configured,
    source: "THE_ODDS_API",
    lastSuccessfulPoll: lastOk?.received_at_utc ?? null,
    eventsDiscovered: store.events.length,
    quotesObserved: store.quotes.length,
    strictEligible: strict,
    errors,
    collectionStatus: collectionStatus038({
      configured,
      lastStatus: last?.status ?? null,
      lastOk: Boolean(lastOk),
      lastError: last?.error ?? null,
    }),
    liveAdapter: "READY",
    apiKey: configured ? "configured" : "missing",
  };
}

export function windowCoverage036Fallback(store: ProspectiveStore036): { t72: number; t24: number; t1h: number; t5m: number } {
  return {
    t72: eventCoverageRate(store, "T-72h"),
    t24: eventCoverageRate(store, "T-24h"),
    t1h: eventCoverageRate(store, "T-1h"),
    t5m: eventCoverageRate(store, "T-5m"),
  };
}

export function oddsApiSourceHealth(store: ProspectiveStore036) {
  return sourceHealth036(store, "the-odds-api", Boolean(getOddsApiKey()));
}

export type { Coverage038 };
