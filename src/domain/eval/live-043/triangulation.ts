import { decimalOddsToImpliedProbability, normalizeMarketProbabilities } from "@/domain/odds/math";
import type { Quote039 } from "@/domain/eval/live-039/types";
import type { MarketFamily043, Triangulation043 } from "@/domain/eval/live-043/types";
import { computeMarketSignals } from "@/domain/eval/market-intelligence/signals";

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs)!;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
}

export function marketFamily043(market: string, sportKey: string): MarketFamily043 {
  const m = market.toUpperCase();
  if (sportKey.startsWith("tennis_")) {
    if (m.includes("H2H") || m === "1X2" || m === "WINNER") return "TENNIS_WINNER";
    if (m.includes("SET")) return "TENNIS_SET";
    if (m.includes("GAME")) return "TENNIS_GAMES";
    return "OTHER";
  }
  if (m === "1X2" || m === "H2H") return "MARKET_1X2";
  if (m.includes("AH") || m.includes("SPREAD") || m.includes("HANDICAP")) return "AH";
  if (m.includes("OU") || m.includes("TOTAL") || m.includes("OVER")) return "OU";
  if (m.includes("BTTS")) return "BTTS";
  if (m.includes("DNB")) return "DNB";
  if (m.includes("DC") || m.includes("DOUBLE")) return "DC";
  if (m.includes("CS") || m.includes("CORRECT")) return "CS";
  if (m.includes("CORNER")) return "CORNERS";
  if (m.includes("CARD") || m.includes("BOOKING")) return "CARDS";
  if (m.includes("PLAYER")) return "PLAYER";
  return "OTHER";
}

/** Triangulate latest pre-asOf quotes per bookmaker/outcome for a market. */
export function triangulateMarket043(input: {
  eventId: string;
  market: string;
  sportKey: string;
  quotes: readonly Quote039[];
  asOf: string;
}): Triangulation043 {
  const family = marketFamily043(input.market, input.sportKey);
  const asOfMs = Date.parse(input.asOf);
  const eligible = input.quotes.filter((q) => {
    if (q.event_id !== input.eventId || q.market !== input.market) return false;
    if (!q.available_at) return false;
    const t = Date.parse(q.available_at);
    return Number.isFinite(t) && t <= asOfMs;
  });
  const byBookOutcome = new Map<string, Quote039>();
  for (const q of eligible) {
    const key = `${q.bookmaker}|${q.outcome}`;
    const prev = byBookOutcome.get(key);
    if (!prev || Date.parse(q.available_at!) >= Date.parse(prev.available_at!)) byBookOutcome.set(key, q);
  }
  const outcomes = [...new Set([...byBookOutcome.values()].map((q) => q.outcome))].sort();
  const books = [...new Set([...byBookOutcome.values()].map((q) => q.bookmaker))];
  const best: Record<string, number | null> = {};
  const worst: Record<string, number | null> = {};
  const med: Record<string, number | null> = {};
  const mn: Record<string, number | null> = {};
  const cons: Record<string, number | null> = {};

  if (books.length < 2 || outcomes.length < 2) {
    const thin = computeMarketSignals({
      eventId: input.eventId,
      market: input.market,
      asOf: input.asOf,
      quotes: eligible,
      consensusDispersion: null,
    });
    return {
      event_id: input.eventId,
      market: input.market,
      market_family: "INSUFFICIENT_N",
      as_of: input.asOf,
      n_books: books.length,
      best_price: {},
      worst_price: {},
      median_price: {},
      mean_price: {},
      consensus_devig: {},
      dispersion: null,
      spread: null,
      movement: thin.movement,
      movement_velocity: thin.movement_velocity,
      disagreement: null,
      status: "INSUFFICIENT_N",
    };
  }

  const bookTriples: number[][] = [];
  for (const book of books) {
    const prices: number[] = [];
    let ok = true;
    for (const o of outcomes) {
      const q = byBookOutcome.get(`${book}|${o}`);
      if (!q) {
        ok = false;
        break;
      }
      prices.push(q.price);
    }
    if (ok && prices.length === outcomes.length) bookTriples.push(prices);
  }

  for (let i = 0; i < outcomes.length; i++) {
    const o = outcomes[i]!;
    const prices = bookTriples.map((t) => t[i]!).filter((p) => p > 1);
    best[o] = prices.length ? Math.max(...prices) : null;
    worst[o] = prices.length ? Math.min(...prices) : null;
    med[o] = median(prices);
    mn[o] = mean(prices);
  }

  // Consensus via mean prices then proportional devig when complete
  if (outcomes.length >= 2 && outcomes.every((o) => mn[o] != null && mn[o]! > 1)) {
    try {
      const odds = outcomes.map((o) => mn[o]!);
      const dev = normalizeMarketProbabilities(odds);
      outcomes.forEach((o, i) => {
        cons[o] = dev[i]!;
      });
    } catch {
      outcomes.forEach((o) => {
        cons[o] = null;
      });
    }
  }

  const allPrices = bookTriples.flat();
  const dispersion = stdev(allPrices);
  const spread =
    outcomes.length && best[outcomes[0]!] != null && worst[outcomes[0]!] != null
      ? best[outcomes[0]!]! - worst[outcomes[0]!]!
      : null;

  // disagreement = mean pairwise L1 of bookmaker implied vectors
  let disagreement: number | null = null;
  if (bookTriples.length >= 2) {
    const impl = bookTriples.map((odds) => {
      try {
        return normalizeMarketProbabilities(odds);
      } catch {
        return odds.map((p) => decimalOddsToImpliedProbability(p));
      }
    });
    let sum = 0;
    let n = 0;
    for (let i = 0; i < impl.length; i++) {
      for (let j = i + 1; j < impl.length; j++) {
        sum += impl[i]!.reduce((a, v, k) => a + Math.abs(v - impl[j]![k]!), 0);
        n += 1;
      }
    }
    disagreement = n ? sum / n : null;
  }

  const signals = computeMarketSignals({
    eventId: input.eventId,
    market: input.market,
    asOf: input.asOf,
    quotes: eligible,
    consensusDispersion: dispersion,
  });

  return {
    event_id: input.eventId,
    market: input.market,
    market_family: family,
    as_of: input.asOf,
    n_books: books.length,
    best_price: best,
    worst_price: worst,
    median_price: med,
    mean_price: mn,
    consensus_devig: cons,
    dispersion,
    spread,
    movement: signals.movement,
    movement_velocity: signals.movement_velocity,
    disagreement,
    status: "OK",
  };
}
