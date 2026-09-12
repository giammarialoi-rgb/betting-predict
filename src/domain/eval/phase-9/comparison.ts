import { ALL_MARKETS, derivedMarketProb, historicalOddsForMarket, scoreMatrix, settleMarket, type ScoreKind } from "@/domain/eval/phase-9/markets";
import { binaryMetrics } from "@/domain/eval/phase-9/metrics";
import { PHASE9_NON_DETERMINABILE, type Phase9MarketEval, type Phase9MarketId, type Phase9Match, type Phase9ModelId, type Phase9PredRow, type Phase9QualityMetrics } from "@/domain/eval/phase-9/types";
import { MIN_N_QUALITY, MIN_N_ROI } from "@/domain/eval/phase-9/config";

export type ModelMarketCell = {
  model_id: string;
  market_id: Phase9MarketId;
  n: number;
  log_loss: number | null;
  brier: number | null;
  accuracy: number | null;
  yield: number | null;
  n_bets: number;
  has_odds: boolean;
  insufficient: boolean;
  note: string;
  auto_promote: false;
};

function kindForModel(id: Phase9ModelId): ScoreKind | null {
  if (id === "INDEPENDENT_POISSON_v1") return "poisson";
  if (id === "DIXON_COLES_v1") return "dixon_coles";
  if (id === "NEGBIN_v1") return "negbin";
  return null;
}

export function evaluateMarketsForModel(input: {
  model_id: Phase9ModelId;
  matches: Phase9Match[];
  preds: Phase9PredRow[];
}): Phase9MarketEval[] {
  const byId = new Map(input.preds.map((p) => [p.canonical_id, p]));
  const kind = kindForModel(input.model_id);
  const out: Phase9MarketEval[] = [];
  for (const market of ALL_MARKETS) {
    const binaryRows: { p: number; y: 0 | 1 }[] = [];
    let settlement_n = 0;
    let oddsN = 0;
    let profit = 0;
    let bets = 0;
    for (const m of input.matches) {
      const pred = byId.get(m.canonical_id);
      if (!pred) continue;
      const settled = settleMarket(market, m);
      if (!settled.settled || settled.voided) continue;
      settlement_n += 1;
      if (market === "1X2") {
        continue;
      }
      if (!kind || pred.lambda_home == null || pred.lambda_away == null) continue;
      const M = scoreMatrix(kind, pred.lambda_home, pred.lambda_away);
      const derived = derivedMarketProb(market, M, pred.p);
      if (!derived || settled.won == null) continue;
      binaryRows.push({ p: derived.p, y: settled.won ? 1 : 0 });
      const price = historicalOddsForMarket(market, m);
      if (price && derived.p - price.implied >= 0.03) {
        bets += 1;
        oddsN += 1;
        profit += settled.won ? price.price - 1 : -1;
      } else if (price) {
        oddsN += 1;
      }
    }
    const quality = binaryRows.length ? binaryMetrics(binaryRows) : null;
    const has_odds = oddsN > 0;
    const coverage = input.matches.length ? settlement_n / input.matches.length : 0;
    const noteParts: string[] = [];
    if (!kind && market !== "1X2") {
      noteParts.push("model emits 1X2 only — no invented BTTS/O/U head");
    }
    if (!has_odds && market !== "1X2") {
      noteParts.push("no historical price — ROI " + PHASE9_NON_DETERMINABILE);
    }
    if (settlement_n < MIN_N_QUALITY) noteParts.push("INSUFFICIENT_EVIDENCE for quality");
    out.push({
      market_id: market,
      settlement_n,
      coverage,
      has_historical_odds: has_odds,
      model_quality: quality,
      value:
        has_odds && bets > 0
          ? {
              edge_threshold: 0.03,
              chosen_on: "GRID_REPORT_ONLY",
              n_bets: bets,
              hit_rate: null,
              yield: bets ? profit / bets : null,
              roi: bets ? profit / bets : null,
              max_drawdown: null,
              profit,
              longest_losing_streak: 0,
              longest_winning_streak: 0,
              insufficient: bets < MIN_N_ROI,
              reason: bets < MIN_N_ROI ? `INSUFFICIENT_EVIDENCE n_bets=${bets}` : null,
            }
          : null,
      note: noteParts.join("; ") || "settlement-backed quality only unless odds exist",
    });
  }
  return out;
}

export function modelMarketMatrix(input: {
  models: { model_id: Phase9ModelId; quality: Phase9QualityMetrics | null; markets: Phase9MarketEval[] }[];
}): ModelMarketCell[] {
  const cells: ModelMarketCell[] = [];
  for (const m of input.models) {
    cells.push({
      model_id: m.model_id,
      market_id: "1X2",
      n: m.quality?.n ?? 0,
      log_loss: m.quality?.log_loss ?? null,
      brier: m.quality?.brier ?? null,
      accuracy: m.quality?.accuracy ?? null,
      yield: null,
      n_bets: 0,
      has_odds: true,
      insufficient: m.quality?.insufficient ?? true,
      note: "1X2 quality; value reported separately",
      auto_promote: false,
    });
    for (const mk of m.markets) {
      if (mk.market_id === "1X2") continue;
      const q = mk.model_quality && "log_loss" in mk.model_quality ? mk.model_quality : null;
      cells.push({
        model_id: m.model_id,
        market_id: mk.market_id,
        n: mk.settlement_n,
        log_loss: q?.log_loss ?? null,
        brier: q && "brier" in q ? q.brier : null,
        accuracy: q && "accuracy" in q ? q.accuracy : null,
        yield: mk.value?.yield ?? null,
        n_bets: mk.value?.n_bets ?? 0,
        has_odds: mk.has_historical_odds,
        insufficient: mk.settlement_n < MIN_N_QUALITY || Boolean(mk.value?.insufficient),
        note: mk.note,
        auto_promote: false,
      });
    }
  }
  return cells;
}
