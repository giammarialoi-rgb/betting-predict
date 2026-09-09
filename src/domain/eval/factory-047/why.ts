import type { PermanentPrediction044 } from "@/domain/eval/permanent-044/types";

export type WhySignal047 = {
  key: string;
  value: string | number | null;
  status: "AVAILABLE" | "NOT_AVAILABLE";
  direction?: string | null;
};

export type StructuredWhy047 = {
  event_id: string;
  prediction_id: string;
  market_signal: WhySignal047;
  form_signal: WhySignal047;
  history_signal: WhySignal047;
  schedule_signal: WhySignal047;
  movement_signal: WhySignal047;
  injury_signal: WhySignal047;
  lineup_signal: WhySignal047;
  consensus_signal: WhySignal047;
  risk_flags: string[];
  FINAL_REASON: string;
};

/** Structured WHY — never invent unavailable signals. */
export function buildStructuredWhy047(p: PermanentPrediction044): StructuredWhy047 {
  const hasMarket = Boolean(p.probability_market);
  const nCodes = p.reason_codes;
  return {
    event_id: p.event_id,
    prediction_id: p.prediction_id,
    market_signal: {
      key: "market_devig",
      value: hasMarket ? JSON.stringify(p.probability_market) : null,
      status: hasMarket ? "AVAILABLE" : "NOT_AVAILABLE",
      direction: p.selection,
    },
    form_signal: { key: "form", value: null, status: "NOT_AVAILABLE" },
    history_signal: { key: "h2h", value: null, status: "NOT_AVAILABLE" },
    schedule_signal: { key: "schedule", value: null, status: "NOT_AVAILABLE" },
    movement_signal: {
      key: "odds_movement",
      value: p.edge_absolute,
      status: p.edge_absolute != null ? "AVAILABLE" : "NOT_AVAILABLE",
    },
    injury_signal: { key: "injury", value: null, status: "NOT_AVAILABLE" },
    lineup_signal: { key: "lineup", value: null, status: "NOT_AVAILABLE" },
    consensus_signal: {
      key: "book_consensus",
      value: hasMarket ? "MARKET_DEVIG_MIRROR" : null,
      status: hasMarket ? "AVAILABLE" : "NOT_AVAILABLE",
      direction: nCodes.includes("MODEL_IS_MARKET_ONLY") ? "model_equals_market" : null,
    },
    risk_flags: p.risk_flags,
    FINAL_REASON: p.human_readable_reason || "NO STRUCTURED EXPLANATION AVAILABLE",
  };
}
