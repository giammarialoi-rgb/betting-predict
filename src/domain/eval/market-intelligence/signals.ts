import { createHash } from "node:crypto";
import { classifyMovement034 } from "@/domain/eval/market-034/diagnostics";
import { decimalOddsToImpliedProbability, normalizeMarketProbabilities } from "@/domain/odds/math";
import { filterEligibleTicks } from "@/domain/eval/market-intelligence/asof";
import type {
  LiquidityProxyBand,
  MarketQuoteTick,
  MarketSignalSnapshot,
} from "@/domain/eval/market-intelligence/types";

export type QuoteLikeForSignals = {
  event_id: string;
  market: string;
  bookmaker: string;
  outcome?: string;
  selection?: string;
  price: number;
  available_at?: string | null;
  available_at_utc?: string | null;
  collected_at?: string;
  collected_at_utc?: string;
  source?: string;
};

function selectionOf(q: QuoteLikeForSignals): string {
  return (q.outcome ?? q.selection ?? "").toUpperCase();
}

function availableAtOf(q: QuoteLikeForSignals): string | null {
  return q.available_at ?? q.available_at_utc ?? null;
}

function retrievedAtOf(q: QuoteLikeForSignals): string {
  return q.collected_at ?? q.collected_at_utc ?? availableAtOf(q) ?? new Date(0).toISOString();
}

export function quotesToTicks(quotes: readonly QuoteLikeForSignals[]): MarketQuoteTick[] {
  return quotes.map((q) => {
    const available_at = availableAtOf(q);
    const price = q.price;
    return {
      source: q.source ?? "lab_b",
      event_id: q.event_id,
      market: q.market,
      selection: selectionOf(q),
      bookmaker: q.bookmaker,
      price,
      implied_prob: price > 1 ? decimalOddsToImpliedProbability(price) : 0,
      volume: null,
      retrieved_at: retrievedAtOf(q),
      available_at,
      status: "UNAVAILABLE",
      temporal_precision: "UNKNOWN",
    };
  });
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

/** Latest eligible quote per bookmaker×selection. */
function latestByBookSel(ticks: readonly MarketQuoteTick[]): Map<string, MarketQuoteTick> {
  const map = new Map<string, MarketQuoteTick>();
  for (const t of ticks) {
    const key = `${t.bookmaker}|${t.selection}`;
    const prev = map.get(key);
    if (!prev || Date.parse(t.available_at!) >= Date.parse(prev.available_at!)) map.set(key, t);
  }
  return map;
}

/** Earliest eligible quote per bookmaker×selection. */
function earliestByBookSel(ticks: readonly MarketQuoteTick[]): Map<string, MarketQuoteTick> {
  const map = new Map<string, MarketQuoteTick>();
  for (const t of ticks) {
    const key = `${t.bookmaker}|${t.selection}`;
    const prev = map.get(key);
    if (!prev || Date.parse(t.available_at!) < Date.parse(prev.available_at!)) map.set(key, t);
  }
  return map;
}

function consensusFavP(
  byBookSel: Map<string, MarketQuoteTick>,
  selections: string[],
): { fav: string | null; pFav: number | null; nBooks: number; prices: number[] } {
  const books = [...new Set([...byBookSel.values()].map((t) => t.bookmaker))];
  const complete: number[][] = [];
  for (const book of books) {
    const row: number[] = [];
    let ok = true;
    for (const sel of selections) {
      const t = byBookSel.get(`${book}|${sel}`);
      if (!t || t.price <= 1) {
        ok = false;
        break;
      }
      row.push(t.price);
    }
    if (ok) complete.push(row);
  }
  if (complete.length < 1 || selections.length < 2) {
    return { fav: null, pFav: null, nBooks: complete.length, prices: [] };
  }
  const means = selections.map((_, i) => mean(complete.map((r) => r[i]!))!);
  let probs: number[];
  try {
    probs = normalizeMarketProbabilities(means);
  } catch {
    probs = means.map((p) => decimalOddsToImpliedProbability(p));
    const s = probs.reduce((a, b) => a + b, 0);
    probs = s > 0 ? probs.map((p) => p / s) : probs;
  }
  let favIdx = 0;
  for (let i = 1; i < probs.length; i++) {
    if (probs[i]! > probs[favIdx]!) favIdx = i;
  }
  return {
    fav: selections[favIdx]!,
    pFav: probs[favIdx]!,
    nBooks: complete.length,
    prices: complete.flat(),
  };
}

function liquidityProxy(nBooks: number, dispersion: number | null): LiquidityProxyBand {
  if (nBooks < 2) return "unknown";
  if (nBooks >= 5 && (dispersion == null || dispersion < 0.15)) return "high";
  if (nBooks >= 3 && (dispersion == null || dispersion < 0.25)) return "medium";
  if (nBooks >= 2) return "low";
  return "unknown";
}

function pushUnique(arr: string[], v: string): void {
  if (v && !arr.includes(v)) arr.push(v);
}

/**
 * Compute market signals from quote history as-of decision time.
 * Does NOT produce model probabilities — compare-layer only.
 */
export function computeMarketSignals(input: {
  eventId: string;
  market: string;
  asOf: string;
  quotes: readonly QuoteLikeForSignals[];
  /** Optional precomputed dispersion from triangulation. */
  consensusDispersion?: number | null;
}): MarketSignalSnapshot {
  const ticks = quotesToTicks(
    input.quotes.filter((q) => q.event_id === input.eventId && q.market === input.market),
  );
  const { eligible, blocked } = filterEligibleTicks(ticks, input.asOf);
  const selections = [...new Set(eligible.map((t) => t.selection))].filter(Boolean).sort();
  const early = earliestByBookSel(eligible);
  const late = latestByBookSel(eligible);

  const earlyCons = consensusFavP(early, selections);
  const lateCons = consensusFavP(late, selections);

  const sameFav =
    earlyCons.fav && lateCons.fav && earlyCons.fav === lateCons.fav ? earlyCons.fav : lateCons.fav;
  let delta_fav_p: number | null = null;
  if (
    sameFav &&
    earlyCons.pFav != null &&
    lateCons.pFav != null &&
    earlyCons.nBooks >= 1 &&
    lateCons.nBooks >= 1
  ) {
    // Need at least two distinct timestamps overall
    const times = eligible.map((t) => Date.parse(t.available_at!));
    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    if (tMax > tMin) {
      delta_fav_p = lateCons.pFav - earlyCons.pFav;
    }
  }

  const movement_label = classifyMovement034(delta_fav_p);
  const steam_move = movement_label === "steam" || movement_label === "reverse_steam";

  // Per-book favorite implied move alignment
  let steam_books_aligned = 0;
  if (sameFav && delta_fav_p != null && Math.abs(delta_fav_p) >= 0.005) {
    const dir = Math.sign(delta_fav_p);
    const books = [...new Set(eligible.map((t) => t.bookmaker))];
    for (const book of books) {
      const e = early.get(`${book}|${sameFav}`);
      const l = late.get(`${book}|${sameFav}`);
      if (!e || !l || e.available_at === l.available_at) continue;
      const d = l.implied_prob - e.implied_prob;
      if (Math.sign(d) === dir && Math.abs(d) >= 0.005) steam_books_aligned += 1;
    }
  }

  const n_books = lateCons.nBooks;
  const consensus_dispersion =
    input.consensusDispersion != null ? input.consensusDispersion : stdev(lateCons.prices);
  const liquidity_proxy = liquidityProxy(n_books, consensus_dispersion);

  const drift_pct =
    delta_fav_p != null && earlyCons.pFav != null && earlyCons.pFav > 1e-9
      ? (delta_fav_p / earlyCons.pFav) * 100
      : null;

  const dtHours =
    eligible.length >= 2
      ? (Math.max(...eligible.map((t) => Date.parse(t.available_at!))) -
          Math.min(...eligible.map((t) => Date.parse(t.available_at!)))) /
        3_600_000
      : null;
  const movement_velocity =
    delta_fav_p != null && dtHours != null && dtHours > 0 ? delta_fav_p / dtHours : null;

  const reason_codes: string[] = ["MARKET_SIGNAL_LAYER", "NOT_MODEL_INPUT"];
  if (movement_label === "no_second_snapshot") reason_codes.push("MARKET_SIGNAL_INSUFFICIENT");
  if (movement_label === "drift") reason_codes.push("MARKET_DRIFT");
  if (movement_label === "steam") reason_codes.push("STEAM_MOVE");
  if (movement_label === "reverse_steam") reason_codes.push("REVERSE_STEAM");
  if (movement_label === "stability") reason_codes.push("MARKET_STABLE");
  if (liquidity_proxy === "low") reason_codes.push("LIQUIDITY_PROXY_LOW");
  if (liquidity_proxy === "high") reason_codes.push("LIQUIDITY_PROXY_HIGH");
  reason_codes.push("LIQUIDITY_PROXY_BOOKS");
  reason_codes.push("VOLUME_UNAVAILABLE");
  reason_codes.push("RLM_UNAVAILABLE");

  const contextual_factors: string[] = [];
  pushUnique(contextual_factors, `movement_label=${movement_label}`);
  if (delta_fav_p != null) pushUnique(contextual_factors, `delta_fav_p=${delta_fav_p.toFixed(4)}`);
  if (drift_pct != null) pushUnique(contextual_factors, `drift_pct=${drift_pct.toFixed(2)}`);
  pushUnique(contextual_factors, `steam_books_aligned=${steam_books_aligned}`);
  pushUnique(contextual_factors, `n_books=${n_books}`);
  pushUnique(contextual_factors, `liquidity_proxy=${liquidity_proxy}`);
  pushUnique(contextual_factors, "volume=UNAVAILABLE");
  pushUnique(contextual_factors, "rlm=UNAVAILABLE");

  const body = {
    event_id: input.eventId,
    market: input.market,
    as_of: input.asOf,
    delta_fav_p,
    drift_pct,
    movement: delta_fav_p,
    movement_velocity,
    movement_label,
    steam_move,
    steam_books_aligned,
    consensus_dispersion,
    n_books,
    liquidity_proxy,
    liquidity_label: "LIQUIDITY_PROXY_BOOKS" as const,
    volume: null,
    volume_status: "UNAVAILABLE" as const,
    rlm_status: "UNAVAILABLE" as const,
    reason_codes,
    favorite_selection: sameFav,
    contextual_factors,
    real_money: false as const,
    enters_independent_model: false as const,
  };

  // Hash excludes blocked-tick counts so future post-asOf quotes cannot mutate snapshot identity
  const snapshot_hash = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 24);

  return {
    ...body,
    ticks_eligible: eligible.length,
    ticks_blocked: blocked.length,
    snapshot_hash,
  };
}

/** Apply signal-based adjustments to confidence / DQ (never to model probability). */
export function applyMarketSignalConfidenceAdjust(input: {
  confidence: number;
  dataQuality: number;
  signal: MarketSignalSnapshot;
}): { confidence: number; dataQuality: number; uncertain: boolean } {
  let conf = input.confidence;
  let dq = input.dataQuality;
  let uncertain = false;

  if (input.signal.reason_codes.includes("MARKET_SIGNAL_INSUFFICIENT")) {
    // No extra boost; mild uncertainty only when already thin
    if (input.signal.n_books < 2) uncertain = true;
  }
  if (input.signal.steam_move && input.signal.steam_books_aligned >= 2) {
    conf = Math.min(95, conf + 5);
  }
  if (input.signal.reason_codes.includes("MARKET_DRIFT")) {
    conf = Math.min(95, conf + 2);
  }
  if (input.signal.liquidity_proxy === "low") {
    dq = Math.max(0, dq - 0.08);
    uncertain = true;
  }
  if (input.signal.liquidity_proxy === "high") {
    dq = Math.min(1, dq + 0.03);
  }
  return { confidence: Math.round(conf), dataQuality: Math.round(dq * 1000) / 1000, uncertain };
}
