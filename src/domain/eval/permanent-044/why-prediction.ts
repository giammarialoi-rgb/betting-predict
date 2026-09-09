import type { PermanentPrediction044 } from "@/domain/eval/permanent-044/types";

export type WhyThisPrediction044 = {
  event_id: string;
  prediction_id: string;
  predicted_selection: string | null;
  confidence: number;
  MAIN_REASONS: string[];
  NEGATIVE_FACTORS: string[];
  DATA_QUALITY: number;
  MODEL_CONFIDENCE: number;
  market_strength: string;
  anomalies: string[];
  missing_factors: string[];
  uncertainty: number;
  final_motivation: string;
  as_of: string;
};

/** Explanation from pre-event data only — never from result. */
export function whyThisPrediction044(p: PermanentPrediction044): WhyThisPrediction044 {
  const main: string[] = [];
  const neg: string[] = [];
  const anomalies: string[] = [];
  const missing: string[] = [];

  if (p.probability_market) main.push("market consensus (MARKET_DEVIG)");
  if (p.reason_codes.includes("MODEL_IS_MARKET_ONLY")) {
    main.push("MODEL_v1 mirrors market — no incremental alpha claimed");
  }
  if ((p.edge_absolute ?? 0) === 0) main.push("model≈market (expected under MARKET_ONLY)");

  if (p.reason_codes.includes("NO_MARKET")) missing.push("usable market probabilities");
  if (p.reason_codes.includes("INSUFFICIENT_BOOK_TRIANGULATION")) neg.push("few bookmakers for triangulation");
  if (p.reason_codes.includes("UNCERTAINTY_ELEVATED")) neg.push("elevated uncertainty");
  if (p.reason_codes.includes("LOW_CONFIDENCE")) neg.push("low confidence score");
  if (p.data_quality_score < 0.5) neg.push("data quality below 0.5");
  if (!p.probability_model) missing.push("model probability vector");

  if (p.risk_flags.includes("RESEARCH_ONLY")) anomalies.push("research_only_flag");

  return {
    event_id: p.event_id,
    prediction_id: p.prediction_id,
    predicted_selection: p.selection,
    confidence: p.confidence_score / 100,
    MAIN_REASONS: main.length ? main : ["insufficient signal for structured reasons"],
    NEGATIVE_FACTORS: neg,
    DATA_QUALITY: p.data_quality_score,
    MODEL_CONFIDENCE: p.confidence_score / 100,
    market_strength: p.probability_market ? "present" : "absent",
    anomalies,
    missing_factors: missing,
    uncertainty: 1 - p.data_quality_score,
    final_motivation: p.human_readable_reason,
    as_of: p.timestamp,
  };
}
