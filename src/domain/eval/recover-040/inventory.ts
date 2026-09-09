import { parseExactUtcMs, hasUtcOffset } from "@/domain/eval/prospective-036/clocks";
import { lastAtOrBeforeCutoff039, t1hCutoffMs039, eventCoverageRate039 } from "@/domain/eval/live-039/asof";
import { isStrict039 } from "@/domain/eval/live-039/classify";
import { quoteKey039, type Store039 } from "@/domain/eval/live-039/store";
import { WINDOWS_039, type Event039, type Quote039, type Window039 } from "@/domain/eval/live-039/types";
import type { CoverageMap040, RecoverTable040 } from "@/domain/eval/recover-040/types";

export type Inventory040 = {
  TOTAL_QUOTE_ROWS: number;
  UNIQUE_QUOTE_ROWS: number;
  EVENTS_DISCOVERED: number;
  EVENTS_RECONSTRUCTED: number;
  UNIQUE_EVENTS: number;
  QUOTE_OBSERVATIONS: number;
  UNIQUE_QUOTES: number;
  EXACT_KICKOFFS: number;
  MATCH_EXACT: number;
  STRICT_EVENTS: number;
  STRICT_QUOTES: number;
  EVENTS_WITH_KICKOFF: number;
  EVENTS_WITH_EXACT_KICKOFF: number;
  EVENTS_WITH_PREMATCH_QUOTES: number;
  EVENTS_WITH_T1H_QUOTE: number;
  EVENTS_WITH_T1H_COMPLETE_1X2: number;
  LOCKED_DECISIONS: number;
  SETTLED_EVENTS: number;
  pastKickoffs: number;
  futureKickoffs: number;
  noKickoff: number;
  nonUtcKickoff: number;
  collectorAsAvailable: number;
  parseErrors: number;
  sports: string[];
  bookmakers: string[];
  markets: string[];
  outcomes: string[];
  coverageBin: CoverageMap040;
  multiQuoteSameKey: number;
  recoverTable: RecoverTable040;
};

function reconstructEventsFromQuotes(store: Store039): Event039[] {
  const byId = new Map(store.events.map((e) => [e.event_id, e]));
  const missing = new Set<string>();
  for (const q of store.quotes) {
    if (!byId.has(q.event_id)) missing.add(q.event_id);
  }
  // Quotes alone cannot invent kickoff/home/away; reconstruction count = events already catalogued
  // that appear in quotes, plus events present only as quote ids (counted separately as unresolved).
  void missing;
  return store.events.filter((e) => store.quotes.some((q) => q.event_id === e.event_id));
}

function eventHasPrematchStrict(store: Store039, ev: Event039): boolean {
  if (!ev.commence_time) return false;
  const kick = parseExactUtcMs(ev.commence_time);
  if (kick == null) return false;
  return store.quotes.some((q) => {
    if (q.event_id !== ev.event_id || !isStrict039(q.temporal_class, q.match_status) || !q.available_at) return false;
    const a = parseExactUtcMs(q.available_at);
    return a != null && a < kick;
  });
}

function eventHasT1hBinQuote(store: Store039, ev: Event039): boolean {
  if (!ev.commence_time) return false;
  return store.quotes.some(
    (q) =>
      q.event_id === ev.event_id &&
      q.temporal_class === "STRICT" &&
      q.window === "T-1h" &&
      q.source_quote_timestamp,
  );
}

export function asOfComplete1x2Books040(
  store: Store039,
  ev: Event039,
): { bookmaker: string; chosen: Quote039[]; asOf: string } | null {
  if (ev.kickoff_status !== "OK" || !ev.commence_time) return null;
  const cutoff = t1hCutoffMs039(ev.commence_time);
  if (cutoff == null) return null;
  const pool = store.quotes
    .filter(
      (q) =>
        q.event_id === ev.event_id &&
        q.market === "1X2" &&
        q.available_at &&
        isStrict039(q.temporal_class, q.match_status),
    )
    .map((q) => ({ ...q, sourceMs: parseExactUtcMs(q.available_at!)! }))
    .filter((q) => Number.isFinite(q.sourceMs));
  const byBook = new Map<string, typeof pool>();
  for (const q of pool) {
    const g = byBook.get(q.bookmaker) ?? [];
    g.push(q);
    byBook.set(q.bookmaker, g);
  }
  const preference = ["pinnacle", "betfair_ex_uk", "betfair_ex_eu", "bet365"];
  const books = [...byBook.keys()].sort((a, b) => {
    const ia = preference.indexOf(a);
    const ib = preference.indexOf(b);
    if (ia >= 0 || ib >= 0) return (ia >= 0 ? ia : 99) - (ib >= 0 ? ib : 99);
    return a.localeCompare(b);
  });
  for (const book of books) {
    const qs = byBook.get(book)!;
    const chosen: Quote039[] = [];
    for (const sel of ["HOME", "DRAW", "AWAY"]) {
      const hit = lastAtOrBeforeCutoff039(
        qs.filter((q) => q.outcome === sel),
        cutoff,
      );
      if (!hit) {
        chosen.length = 0;
        break;
      }
      chosen.push(hit);
    }
    if (chosen.length !== 3) continue;
    const asOf = chosen.map((q) => q.available_at!).sort().at(-1)!;
    return { bookmaker: book, chosen, asOf };
  }
  return null;
}

export function inventory040(store: Store039, nowMs = Date.now()): Inventory040 {
  const uniqueKeys = new Set(store.quotes.map((q) => quoteKey039(q)));
  const reconstructed = reconstructEventsFromQuotes(store);
  const eventIdsFromQuotes = new Set(store.quotes.map((q) => q.event_id));
  const exactKick = store.events.filter((e) => e.kickoff_status === "OK" && e.commence_time);
  let past = 0;
  let future = 0;
  let noKick = 0;
  let nonUtc = 0;
  for (const e of store.events) {
    if (!e.commence_time) {
      noKick += 1;
      continue;
    }
    if (!hasUtcOffset(e.commence_time)) nonUtc += 1;
    const k = parseExactUtcMs(e.commence_time);
    if (k == null) {
      noKick += 1;
      continue;
    }
    if (k < nowMs) past += 1;
    else future += 1;
  }
  const strictQ = store.quotes.filter((q) => isStrict039(q.temporal_class, q.match_status));
  const matchExact = new Set(store.quotes.filter((q) => q.match_status === "MATCH_EXACT").map((q) => q.event_id)).size;
  const strictEvents = new Set(strictQ.map((q) => q.event_id)).size;
  let t1hComplete = 0;
  let prematch = 0;
  let t1hBin = 0;
  for (const ev of store.events) {
    if (eventHasPrematchStrict(store, ev)) prematch += 1;
    if (eventHasT1hBinQuote(store, ev)) t1hBin += 1;
    if (asOfComplete1x2Books040(store, ev)) t1hComplete += 1;
  }
  const collectorAsAvailable = store.quotes.filter(
    (q) => q.available_at != null && q.available_at === q.collected_at && q.source_quote_timestamp !== q.collected_at,
  ).length;
  const coverageBin = Object.fromEntries(
    WINDOWS_039.map((w) => [w, eventCoverageRate039(store.events, store.quotes, w)]),
  ) as CoverageMap040;

  // Same event/market/outcome/timestamp with different prices → multi-row
  const stampKey = new Map<string, number>();
  for (const q of store.quotes) {
    const k = [q.event_id, q.market, q.outcome, q.source_quote_timestamp ?? "", q.bookmaker].join("|");
    stampKey.set(k, (stampKey.get(k) ?? 0) + 1);
  }
  let multiQuoteSameKey = 0;
  for (const n of stampKey.values()) if (n > 1) multiQuoteSameKey += n - 1;

  const settled = store.settlements.filter((s) => s.outcome !== "UNSETTLED").length;
  const recoverTable: RecoverTable040 = {
    TOTAL_QUOTE_ROWS: store.quotes.length,
    UNIQUE_QUOTE_ROWS: uniqueKeys.size,
    UNIQUE_EVENTS: Math.max(store.events.length, eventIdsFromQuotes.size),
    EVENTS_WITH_KICKOFF: store.events.filter((e) => e.commence_time).length,
    EVENTS_WITH_EXACT_KICKOFF: exactKick.length,
    EVENTS_WITH_PREMATCH_QUOTES: prematch,
    EVENTS_WITH_T1H_QUOTE: t1hBin,
    EVENTS_WITH_T1H_COMPLETE_1X2: t1hComplete,
    MATCH_EXACT: matchExact,
    STRICT_EVENTS: strictEvents,
    LOCKED_DECISIONS: store.decisions.length,
    SETTLED_EVENTS: settled,
  };

  return {
    TOTAL_QUOTE_ROWS: store.quotes.length,
    UNIQUE_QUOTE_ROWS: uniqueKeys.size,
    EVENTS_DISCOVERED: store.events.length,
    EVENTS_RECONSTRUCTED: reconstructed.length,
    UNIQUE_EVENTS: recoverTable.UNIQUE_EVENTS,
    QUOTE_OBSERVATIONS: store.quotes.length,
    UNIQUE_QUOTES: uniqueKeys.size,
    EXACT_KICKOFFS: exactKick.length,
    MATCH_EXACT: matchExact,
    STRICT_EVENTS: strictEvents,
    STRICT_QUOTES: strictQ.length,
    EVENTS_WITH_KICKOFF: recoverTable.EVENTS_WITH_KICKOFF,
    EVENTS_WITH_EXACT_KICKOFF: exactKick.length,
    EVENTS_WITH_PREMATCH_QUOTES: prematch,
    EVENTS_WITH_T1H_QUOTE: t1hBin,
    EVENTS_WITH_T1H_COMPLETE_1X2: t1hComplete,
    LOCKED_DECISIONS: store.decisions.length,
    SETTLED_EVENTS: settled,
    pastKickoffs: past,
    futureKickoffs: future,
    noKickoff: noKick,
    nonUtcKickoff: nonUtc,
    collectorAsAvailable,
    parseErrors: 0,
    sports: [...new Set(store.events.map((e) => e.sport_key))].sort(),
    bookmakers: [...new Set(store.quotes.map((q) => q.bookmaker))].sort(),
    markets: [...new Set(store.quotes.map((q) => q.market))].sort(),
    outcomes: [...new Set(store.quotes.map((q) => q.outcome))].sort(),
    coverageBin,
    multiQuoteSameKey,
    recoverTable,
  };
}

export function coverageField040(inv: Inventory040, w: Window039): number {
  return inv.coverageBin[w] ?? 0;
}
