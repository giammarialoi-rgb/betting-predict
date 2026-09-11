/**
 * Compare-only book 1X2 for UI. Never blended, never invented, never fed into the independent model.
 *
 * A displayed price exists only when one bookmaker has a complete HOME/DRAW/AWAY 1X2
 * (all three finite decimal odds > 1). Incomplete books stay missing.
 * `1 / probability_market` is not a book price.
 */
import { normalizeMarketType044 } from "@/domain/eval/permanent-044/taxonomy";

export type QuoteSnippet = {
  event_id?: unknown;
  bookmaker?: unknown;
  market?: unknown;
  market_type?: unknown;
  selection?: unknown;
  line?: unknown;
  price?: unknown;
  collected_at_utc?: unknown;
};

export type CompareBook1x2 = {
  bookmaker: string;
  market: "1X2";
  line: null;
  odds_home: number;
  odds_draw: number;
  odds_away: number;
  collected_at_utc: string;
  odds_compare_only: true;
};

export type CompareOddsLayer = {
  odds_home: number | null;
  odds_draw: number | null;
  odds_away: number | null;
  bookmaker: string | null;
  odds_market: "1X2" | null;
  line: null;
  odds_collected_at: string | null;
  probability_market: Record<string, number> | null;
  odds_compare_only: true;
};

const EMPTY_LAYER: CompareOddsLayer = {
  odds_home: null,
  odds_draw: null,
  odds_away: null,
  bookmaker: null,
  odds_market: null,
  line: null,
  odds_collected_at: null,
  probability_market: null,
  odds_compare_only: true,
};

export function isCompareOnly1x2Market(market: string | null | undefined): boolean {
  const raw = String(market ?? "").trim();
  if (!raw) return false;
  const tax = normalizeMarketType044(raw, "soccer");
  return tax.market_type === "1X2";
}

export function normalize1x2Selection(raw: unknown): "HOME" | "DRAW" | "AWAY" | null {
  const u = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (u === "HOME" || u === "H" || u === "1") return "HOME";
  if (u === "DRAW" || u === "D" || u === "X" || u === "TIE") return "DRAW";
  if (u === "AWAY" || u === "A" || u === "2") return "AWAY";
  return null;
}

function decimalPrice(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 1) return null;
  return n;
}

function quoteTime(raw: unknown): string {
  return typeof raw === "string" && raw.trim() ? raw.trim() : "";
}

function isStraight1x2Line(line: unknown): boolean {
  return line == null || line === "" || (typeof line === "number" && line === 0);
}

type Legs = {
  HOME?: { price: number; at: string };
  DRAW?: { price: number; at: string };
  AWAY?: { price: number; at: string };
};

function considerLeg(map: Legs, sel: "HOME" | "DRAW" | "AWAY", price: number, at: string): void {
  const prev = map[sel];
  if (!prev || at >= prev.at) map[sel] = { price, at };
}

function completeFromLegs(bookmaker: string, legs: Legs): CompareBook1x2 | null {
  if (!legs.HOME || !legs.DRAW || !legs.AWAY) return null;
  const collected_at_utc = [legs.HOME.at, legs.DRAW.at, legs.AWAY.at].sort().at(-1) ?? "";
  return {
    bookmaker,
    market: "1X2",
    line: null,
    odds_home: legs.HOME.price,
    odds_draw: legs.DRAW.price,
    odds_away: legs.AWAY.price,
    collected_at_utc,
    odds_compare_only: true,
  };
}

/** Latest complete 1X2 from a single bookmaker. Does not blend books or fill missing legs. */
export function latestCompleteBook1x2(quotes: QuoteSnippet[]): CompareBook1x2 | null {
  const byBook = new Map<string, Legs>();
  for (const q of quotes) {
    const bookmaker = String(q.bookmaker ?? "").trim();
    if (!bookmaker) continue;
    const market = String(q.market_type ?? q.market ?? "");
    if (!isCompareOnly1x2Market(market)) continue;
    if (!isStraight1x2Line(q.line)) continue;
    const sel = normalize1x2Selection(q.selection);
    const price = decimalPrice(q.price);
    if (!sel || price == null) continue;
    const at = quoteTime(q.collected_at_utc);
    let legs = byBook.get(bookmaker);
    if (!legs) {
      legs = {};
      byBook.set(bookmaker, legs);
    }
    considerLeg(legs, sel, price, at);
  }

  let best: CompareBook1x2 | null = null;
  for (const [bookmaker, legs] of byBook) {
    const complete = completeFromLegs(bookmaker, legs);
    if (!complete) continue;
    if (!best || complete.collected_at_utc > best.collected_at_utc) best = complete;
  }
  return best;
}

export function indexLatestCompleteBook1x2(quotes: QuoteSnippet[]): Map<string, CompareBook1x2> {
  const byEvent = new Map<string, QuoteSnippet[]>();
  for (const q of quotes) {
    const id = String(q.event_id ?? "").trim();
    if (!id) continue;
    const list = byEvent.get(id);
    if (list) list.push(q);
    else byEvent.set(id, [q]);
  }
  const out = new Map<string, CompareBook1x2>();
  for (const [id, list] of byEvent) {
    const book = latestCompleteBook1x2(list);
    if (book) out.set(id, book);
  }
  return out;
}

/** Copy prediction market probabilities as-is. Never convert 1/p into a fake book price. */
export function compareMarketProbability(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const key of ["HOME", "DRAW", "AWAY"] as const) {
    const n = typeof rec[key] === "number" ? rec[key] : Number(rec[key]);
    if (Number.isFinite(n) && n >= 0 && n <= 1) out[key] = n;
  }
  return Object.keys(out).length ? out : null;
}

export function compareOddsLayer(input: {
  quotes?: QuoteSnippet[] | null;
  probability_market?: unknown;
}): CompareOddsLayer {
  const book = latestCompleteBook1x2(input.quotes ?? []);
  const probability_market = compareMarketProbability(input.probability_market);
  if (!book && !probability_market) return EMPTY_LAYER;
  return {
    odds_home: book?.odds_home ?? null,
    odds_draw: book?.odds_draw ?? null,
    odds_away: book?.odds_away ?? null,
    bookmaker: book?.bookmaker ?? null,
    odds_market: book ? "1X2" : null,
    line: null,
    odds_collected_at: book?.collected_at_utc || null,
    probability_market,
    odds_compare_only: true,
  };
}
