import { createHash } from "node:crypto";
import { join } from "node:path";
import { appendJsonl044, type Store044 } from "@/domain/eval/permanent-044/store";
import type { PermanentQuote044 } from "@/domain/eval/permanent-044/types";

export type MarketCatalogEntry047 = {
  event_id: string;
  market_key: string;
  market_name: string;
  selection: string;
  line: number | null;
  price: number;
  bookmaker: string;
  source: string;
  available_at: string | null;
  collected_at: string;
  fingerprint: string;
};

function sha(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Build MARKET_CATALOG[event] from observed quotes — never invent markets. */
export function catalogMarketsForEvent047(quotes: PermanentQuote044[]): MarketCatalogEntry047[] {
  const seen = new Set<string>();
  const out: MarketCatalogEntry047[] = [];
  for (const q of quotes) {
    const fp = sha(
      [q.event_id, q.market, q.selection, String(q.line), q.bookmaker, q.available_at_utc ?? "", String(q.price)].join("|"),
    );
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push({
      event_id: q.event_id,
      market_key: q.market,
      market_name: q.market_type || q.market,
      selection: q.selection,
      line: q.line,
      price: q.price,
      bookmaker: q.bookmaker,
      source: q.source,
      available_at: q.available_at_utc,
      collected_at: q.collected_at_utc,
      fingerprint: fp,
    });
  }
  return out;
}

export function writeMarketCatalog047(store: Store044, eventId: string): number {
  const qs = store.quotes.filter((q) => q.event_id === eventId);
  const catalog = catalogMarketsForEvent047(qs);
  appendJsonl044(join(store.root, "markets.jsonl"), {
    kind: "MARKET_CATALOG",
    event_id: eventId,
    markets: [...new Set(catalog.map((c) => c.market_key))],
    selections: catalog.length,
    at: new Date().toISOString(),
  });
  return catalog.length;
}

export function summarizeMarketsObserved047(store: Store044): {
  market_keys: string[];
  events_with_markets: number;
  quote_observations: number;
} {
  const keys = new Set(store.quotes.map((q) => q.market));
  const events = new Set(store.quotes.map((q) => q.event_id));
  return {
    market_keys: [...keys].sort(),
    events_with_markets: events.size,
    quote_observations: store.quotes.length,
  };
}
