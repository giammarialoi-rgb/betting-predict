import { storeRoot039 } from "@/domain/eval/live-039/config";
import { loadStore039, quoteKey039 } from "@/domain/eval/live-039/store";
import { parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import { lastAtOrBeforeCutoff039, t1hCutoffMs039 } from "@/domain/eval/live-039/asof";

function main() {
  const store = loadStore039(storeRoot039());
  const now = Date.now();
  const events = store.events;
  const quotes = store.quotes;
  const uniqueQuoteKeys = new Set(quotes.map((q) => quoteKey039(q)));
  const byEvent = new Set(quotes.map((q) => q.event_id));
  const sports = [...new Set(events.map((e) => e.sport_key))].sort();
  const books = [...new Set(quotes.map((q) => q.bookmaker))].sort();
  const markets = [...new Set(quotes.map((q) => q.market))].sort();
  const outcomes = [...new Set(quotes.map((q) => q.outcome))].sort();
  const classes: Record<string, number> = {};
  for (const q of quotes) classes[q.temporal_class] = (classes[q.temporal_class] ?? 0) + 1;
  const match: Record<string, number> = {};
  for (const q of quotes) match[q.match_status] = (match[q.match_status] ?? 0) + 1;
  let past = 0;
  let future = 0;
  let noKick = 0;
  let nonUtc = 0;
  for (const e of events) {
    if (!e.commence_time) {
      noKick += 1;
      continue;
    }
    const ms = parseExactUtcMs(e.commence_time);
    if (ms == null) {
      nonUtc += 1;
      continue;
    }
    if (ms < now) past += 1;
    else future += 1;
  }
  const withAvail = quotes.filter((q) => q.available_at && q.available_at === q.source_quote_timestamp).length;
  const collectorAsAvail = quotes.filter((q) => q.available_at === q.collected_at).length;
  const windows: Record<string, number> = {};
  for (const q of quotes) {
    const w = q.window ?? "null";
    windows[w] = (windows[w] ?? 0) + 1;
  }
  const cov: Record<string, number> = {};
  for (const q of quotes) cov[q.coverage_status] = (cov[q.coverage_status] ?? 0) + 1;

  let t1hComplete = 0;
  let eventsWithT1h = 0;
  let eventsPrematch = 0;
  let exactKickoffs = 0;
  for (const e of events) {
    if (e.kickoff_status === "OK" && e.commence_time && parseExactUtcMs(e.commence_time) != null) exactKickoffs += 1;
    if (!e.commence_time) continue;
    const kick = parseExactUtcMs(e.commence_time);
    if (kick == null) continue;
    const qs = quotes.filter((q) => q.event_id === e.event_id && q.available_at && q.temporal_class === "STRICT");
    const pre = qs.filter((q) => {
      const a = parseExactUtcMs(q.available_at);
      return a != null && a < kick;
    });
    if (pre.length) eventsPrematch += 1;
    const cutoff = t1hCutoffMs039(e.commence_time);
    if (cutoff == null) continue;
    const pool = qs
      .map((q) => ({ ...q, sourceMs: parseExactUtcMs(q.available_at)! }))
      .filter((q) => Number.isFinite(q.sourceMs));
    const t1 = pool.filter((q) => q.sourceMs <= cutoff);
    if (t1.length) eventsWithT1h += 1;
    const byBook = new Map<string, Set<string>>();
    for (const q of t1.filter((x) => x.market === "1X2")) {
      const g = byBook.get(q.bookmaker) ?? new Set();
      g.add(q.outcome);
      byBook.set(q.bookmaker, g);
    }
    for (const g of byBook.values()) {
      if (g.has("HOME") && g.has("DRAW") && g.has("AWAY")) {
        t1hComplete += 1;
        break;
      }
    }
  }

  // sample one AS_OF selection
  const sample = events.find((e) => e.commence_time);
  let sampleLock: unknown = null;
  if (sample?.commence_time) {
    const cutoff = t1hCutoffMs039(sample.commence_time)!;
    const pool = quotes
      .filter((q) => q.event_id === sample.event_id && q.market === "1X2" && q.available_at && q.temporal_class === "STRICT")
      .map((q) => ({ ...q, sourceMs: parseExactUtcMs(q.available_at)! }))
      .filter((q) => Number.isFinite(q.sourceMs));
    sampleLock = {
      event: sample.event_id,
      home_team: sample.home_team,
      away_team: sample.away_team,
      kickoff: sample.commence_time,
      cutoff: new Date(cutoff).toISOString(),
      home_price: lastAtOrBeforeCutoff039(pool.filter((q) => q.outcome === "HOME"), cutoff)?.price ?? null,
      draw_price: lastAtOrBeforeCutoff039(pool.filter((q) => q.outcome === "DRAW"), cutoff)?.price ?? null,
      away_price: lastAtOrBeforeCutoff039(pool.filter((q) => q.outcome === "AWAY"), cutoff)?.price ?? null,
      booksWithTriple: [...new Set(pool.map((q) => q.bookmaker))].filter((b) => {
        const qs = pool.filter((q) => q.bookmaker === b && q.sourceMs <= cutoff);
        return ["HOME", "DRAW", "AWAY"].every((o) => qs.some((q) => q.outcome === o));
      }).length,
    };
  }

  console.log(
    JSON.stringify(
      {
        root: storeRoot039(),
        events: events.length,
        quotes: quotes.length,
        uniqueQuotes: uniqueQuoteKeys.size,
        uniqueEventsFromQuotes: byEvent.size,
        sports,
        bookmakers: books.length,
        booksSample: books.slice(0, 12),
        markets,
        outcomes,
        classes,
        match,
        past,
        future,
        noKick,
        nonUtc,
        exactKickoffs,
        withAvail,
        collectorAsAvail,
        windows,
        cov,
        eventsPrematch,
        eventsWithT1h,
        t1hComplete,
        decisions: store.decisions.length,
        settlements: store.settlements.length,
        journal: store.journal,
        sampleLock,
      },
      null,
      2,
    ),
  );
}

main();
