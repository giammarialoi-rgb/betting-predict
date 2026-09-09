import { argmax3 } from "@/domain/eval/validation-028/metrics";
import type { ErrorClass028 } from "@/domain/eval/validation-028/types";
import type { WalkRow028 } from "@/domain/eval/validation-028/walk";
import type { Bet028 } from "@/domain/eval/validation-028/capital";

export type ErrorRow028 = {
  eventId: string;
  partition: string;
  home: string;
  away: string;
  league: string;
  p_model: [number, number, number] | null;
  p_market: [number, number, number];
  actual: 0 | 1 | 2;
  odds: { home: number; draw: number; away: number };
  disagreement: number;
  pnl: number | null;
  class: ErrorClass028;
  note: string;
};

export function classifyError(input: {
  model: [number, number, number] | null;
  market: [number, number, number];
  actual: 0 | 1 | 2;
}): { class: ErrorClass028; note: string } {
  if (!input.model) return { class: "INSUFFICIENT_INFORMATION", note: "model probs null" };
  const mSide = argmax3(input.model);
  const kSide = argmax3(input.market);
  const conf = input.model[mSide]!;
  const modelOk = mSide === input.actual;
  const marketOk = kSide === input.actual;
  if (marketOk && !modelOk) return { class: "MARKET_CORRECT", note: "market argmax matched outcome; frozen model did not" };
  if (modelOk && !marketOk) return { class: "MODEL_CORRECT", note: "model argmax matched; market did not" };
  if (!modelOk && conf >= 0.6) return { class: "MODEL_OVERCONFIDENT", note: `argmax confidence ${conf.toFixed(3)} was wrong` };
  if (!modelOk && !marketOk) return { class: "INSUFFICIENT_INFORMATION", note: "both argmaxes missed" };
  return { class: "UNKNOWN", note: "no distinctive diagnostic" };
}

export function errorTables(input: {
  rows: readonly WalkRow028[];
  bets: readonly Bet028[];
  modelId: string;
  limit: number;
}): { topLosses: ErrorRow028[]; topDisagree: ErrorRow028[]; topConfFail: ErrorRow028[] } {
  const pnlBy = new Map(input.bets.map((b) => [b.eventId, b.pnl]));
  const toRow = (r: WalkRow028): ErrorRow028 => {
    const p = r.probs[input.modelId] ?? null;
    const cl = classifyError({ model: p, market: r.market, actual: r.actual });
    const disagree = p
      ? Math.max(Math.abs(p[0]! - r.market[0]!), Math.abs(p[1]! - r.market[1]!), Math.abs(p[2]! - r.market[2]!))
      : 0;
    return {
      eventId: r.event.event_id,
      partition: r.partition,
      home: r.event.home,
      away: r.event.away,
      league: r.event.competition,
      p_model: p,
      p_market: r.market,
      actual: r.actual,
      odds: { home: r.event.home_odds, draw: r.event.draw_odds, away: r.event.away_odds },
      disagreement: disagree,
      pnl: pnlBy.get(r.event.event_id) ?? null,
      class: cl.class,
      note: cl.note,
    };
  };
  const all = input.rows.map(toRow);
  const topLosses = [...all]
    .filter((r) => r.pnl != null)
    .sort((a, b) => (a.pnl ?? 0) - (b.pnl ?? 0))
    .slice(0, input.limit);
  const topDisagree = [...all].sort((a, b) => b.disagreement - a.disagreement).slice(0, input.limit);
  const topConfFail = [...all]
    .filter((r) => r.class === "MODEL_OVERCONFIDENT")
    .sort((a, b) => (b.p_model ? b.p_model[argmax3(b.p_model)]! : 0) - (a.p_model ? a.p_model[argmax3(a.p_model)]! : 0))
    .slice(0, input.limit);
  return { topLosses, topDisagree, topConfFail };
}
