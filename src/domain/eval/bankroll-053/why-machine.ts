/**
 * Machine-readable WHY — never invent edge; explain NO_BET when model mirrors market.
 */

export type WhyMachine053 = {
  market: string | null;
  decision: "BET_CANDIDATE" | "STRONG_CANDIDATE" | "NO_BET" | "INSUFFICIENT_DATA" | "WATCH" | "BLOCKED";
  probability_model: number | null;
  probability_market_devig: number | null;
  market_baseline: number | null;
  model_edge: number | null;
  uncertainty: number | null;
  data_quality: number | null;
  confidence: number | null;
  reasons: string[];
  negative_reasons: string[];
  risk_flags: string[];
  no_edge_reason: string | null;
};

export function buildWhyMachine053(input: {
  market?: string | null;
  recommended?: boolean;
  confidence?: number | null;
  edge_absolute?: number | null;
  probability_model?: number | null;
  probability_market?: number | null;
  data_quality?: number | null;
  reason_codes?: string[];
  risk_flags?: string[];
  human_reason?: string | null;
}): WhyMachine053 {
  const edge = input.edge_absolute ?? null;
  const conf = input.confidence ?? null;
  const dq = input.data_quality ?? null;
  const hasModel = input.probability_model != null;
  const hasMarket = input.probability_market != null;

  let decision: WhyMachine053["decision"] = "NO_BET";
  if (!hasModel || !hasMarket || (dq != null && dq < 0.35)) {
    decision = "INSUFFICIENT_DATA";
  } else if (input.recommended && conf != null && conf >= 0.75 && edge != null && edge > 0) {
    decision = "STRONG_CANDIDATE";
  } else if (input.recommended && edge != null && edge > 0) {
    decision = "BET_CANDIDATE";
  } else {
    decision = "NO_BET";
  }

  const reasons = [...(input.reason_codes ?? [])];
  const negative: string[] = [];
  let no_edge_reason: string | null = null;

  if (decision === "NO_BET" || decision === "INSUFFICIENT_DATA") {
    if (edge == null || edge <= 0) {
      no_edge_reason = "NO_POSITIVE_EDGE";
      negative.push("no_positive_model_edge");
    }
    if (
      hasModel &&
      hasMarket &&
      input.probability_model != null &&
      input.probability_market != null &&
      Math.abs(input.probability_model - input.probability_market) < 0.02
    ) {
      negative.push("MODEL_MIRRORS_MARKET");
      no_edge_reason = no_edge_reason ?? "MODEL_MIRRORS_MARKET_BASELINE";
    }
    if (!hasModel) negative.push("missing_model_probability");
    if (!hasMarket) negative.push("missing_market_probability");
    if (dq != null && dq < 0.5) negative.push("low_data_quality");
  }

  if (input.human_reason) reasons.push(input.human_reason);

  return {
    market: input.market ?? null,
    decision,
    probability_model: input.probability_model ?? null,
    probability_market_devig: input.probability_market ?? null,
    market_baseline: input.probability_market ?? null,
    model_edge: edge,
    uncertainty: conf == null ? null : Number((1 - conf).toFixed(4)),
    data_quality: dq,
    confidence: conf,
    reasons,
    negative_reasons: negative,
    risk_flags: [...(input.risk_flags ?? [])],
    no_edge_reason,
  };
}
