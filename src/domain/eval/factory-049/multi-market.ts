import { createHash } from "node:crypto";
import { join } from "node:path";
import { triangulateMarket043 } from "@/domain/eval/live-043/triangulation";
import { marketProbFromTri043, modelProbFromMarket043 } from "@/domain/eval/live-043/predict";
import { edgeFromProbs044, confidenceScore044 } from "@/domain/eval/permanent-044/predict";
import { appendJsonl044, type Store044 } from "@/domain/eval/permanent-044/store";
import type { PermanentEvent044, PermanentQuote044 } from "@/domain/eval/permanent-044/types";
import { classifyDecision048, buildWhy048 } from "@/domain/eval/factory-048/decision";
import type { LabDecision048 } from "@/domain/eval/factory-048/config";

export type MarketAnalysis049 = {
  event_id: string;
  market: string;
  selection: string | null;
  model_probability: number | null;
  market_probability: number | null;
  fair_odds: number | null;
  edge: number | null;
  confidence: number;
  risk_score: number;
  decision: LabDecision048;
  decision_reason_codes: string[];
  why: ReturnType<typeof buildWhy048>;
  n_books: number;
  dispersion: number | null;
};

export type EventMarketBoard049 = {
  event_id: string;
  sport: string;
  competition: string;
  markets_analyzed: MarketAnalysis049[];
  best_market: MarketAnalysis049 | null;
  alternatives: { market: string; decision: string }[];
};

function toQuote039(q: PermanentQuote044) {
  return {
    event_id: q.event_id,
    market: q.market === "1X2" ? "1X2" : q.market,
    bookmaker: q.bookmaker,
    outcome: q.selection,
    price: q.price,
    source_quote_timestamp: q.available_at_utc,
    collected_at: q.collected_at_utc,
    available_at: q.available_at_utc,
    raw_payload_hash: q.fingerprint.slice(0, 32),
    temporal_class: q.available_at_utc ? ("STRICT" as const) : ("RESEARCH_TEMPORAL" as const),
    match_status: "MATCH_EXACT" as const,
    window: null,
    offset_seconds_from_kickoff: null,
    coverage_status: q.available_at_utc ? ("COVERED" as const) : ("NO_OBSERVATION" as const),
  };
}

function analyzeOneMarket(
  ev: PermanentEvent044,
  market: string,
  qs: PermanentQuote044[],
  asOf: string,
): MarketAnalysis049 {
  const q039 = qs.filter((q) => q.market === market).map(toQuote039);
  const tri = triangulateMarket043({
    eventId: ev.event_id,
    market,
    sportKey: ev.competition,
    quotes: q039,
    asOf,
  });
  const marketP = marketProbFromTri043(tri);
  // MARKET_BASELINE only — not an independent MODEL. Explicitly market-mirrored.
  const modelP = modelProbFromMarket043(tri, null);
  const edge = edgeFromProbs044(modelP, marketP);
  const conf = confidenceScore044({
    hasMarket: Boolean(marketP),
    nBooks: tri?.n_books ?? 0,
    dispersion: tri?.dispersion ?? null,
    dataQuality: qs.length ? 0.6 : 0.2,
  });
  const marketOnly = true;
  const cls = classifyDecision048({
    edge: edge.edge_absolute,
    confidence: conf,
    dataQuality: 0.6,
    dispersion: tri?.dispersion ?? null,
    hasMarket: Boolean(marketP),
    marketOnly,
  });
  const sel = edge.selection;
  const modelProb = sel && modelP ? modelP[sel] ?? null : null;
  const mktProb = sel && marketP ? marketP[sel] ?? null : null;
  const why = buildWhy048({
    decision: cls.decision,
    codes: [...cls.codes, "MARKET_BASELINE", "NOT_INDEPENDENT_MODEL"],
    selection: sel,
    modelProb,
    marketProb: mktProb,
    edge: edge.edge_absolute,
    confidence: conf,
    risk: cls.risk,
    dispersion: tri?.dispersion ?? null,
  });
  // Enrich WHY with alternatives placeholder filled by caller
  return {
    event_id: ev.event_id,
    market,
    selection: sel,
    model_probability: modelProb,
    market_probability: mktProb,
    fair_odds: modelProb != null && modelProb > 0 ? 1 / modelProb : null,
    edge: edge.edge_absolute,
    confidence: conf,
    risk_score: cls.risk,
    decision: cls.decision,
    decision_reason_codes: [...new Set([...cls.codes, "MARKET_BASELINE", "MODEL_IS_MARKET_ONLY"])],
    why,
    n_books: tri?.n_books ?? 0,
    dispersion: tri?.dispersion ?? null,
  };
}

/** Analyze all observed markets for an event — never invent markets. */
export function analyzeEventMarkets049(
  store: Store044,
  eventId: string,
  nowIso: string,
): EventMarketBoard049 | null {
  const ev = store.events.find((e) => e.event_id === eventId);
  if (!ev) return null;
  const qs = store.quotes.filter((q) => q.event_id === eventId);
  const markets = [...new Set(qs.map((q) => q.market))];
  if (!markets.length) {
    return {
      event_id: eventId,
      sport: ev.sport,
      competition: ev.competition,
      markets_analyzed: [],
      best_market: null,
      alternatives: [],
    };
  }
  const asOf = qs.map((q) => q.available_at_utc).filter(Boolean).sort().at(-1) ?? nowIso;
  const analyzed = markets.map((m) => analyzeOneMarket(ev, m, qs, asOf));
  const rank = (d: LabDecision048) => (d === "STRONG_CANDIDATE" ? 3 : d === "BET_CANDIDATE" ? 2 : 0);
  const best =
    [...analyzed].sort(
      (a, b) =>
        rank(b.decision) - rank(a.decision) ||
        Math.abs(b.edge ?? 0) - Math.abs(a.edge ?? 0) ||
        b.confidence - a.confidence,
    )[0] ?? null;

  return {
    event_id: eventId,
    sport: ev.sport,
    competition: ev.competition,
    markets_analyzed: analyzed,
    best_market: best,
    alternatives: analyzed
      .filter((m) => m.market !== best?.market)
      .map((m) => ({ market: m.market, decision: m.decision })),
  };
}

export function runMultiMarketPass049(store: Store044, nowIso: string): {
  events: number;
  markets: number;
  boards_written: number;
} {
  let markets = 0;
  let boards = 0;
  for (const ev of store.events) {
    const board = analyzeEventMarkets049(store, ev.event_id, nowIso);
    if (!board) continue;
    markets += board.markets_analyzed.length;
    const fp = createHash("sha256")
      .update(`${ev.event_id}|${board.markets_analyzed.map((m) => m.market).join(",")}|${nowIso.slice(0, 13)}`)
      .digest("hex")
      .slice(0, 16);
    appendJsonl044(join(store.root, "markets.jsonl"), {
      kind: "MULTI_MARKET_BOARD_049",
      fingerprint: fp,
      ...board,
      at: nowIso,
    });
    boards += 1;
  }
  return { events: store.events.length, markets, boards_written: boards };
}
