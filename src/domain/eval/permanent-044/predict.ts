import type { RankingBucket044 } from "@/domain/eval/permanent-044/types";

export function confidenceScore044(input: {
  hasMarket: boolean;
  nBooks: number;
  dispersion: number | null;
  dataQuality: number;
}): number {
  if (!input.hasMarket) return 10;
  let c = 40;
  c += Math.min(30, input.nBooks * 4);
  c += Math.round(input.dataQuality * 20);
  if (input.dispersion != null && input.dispersion < 0.05) c += 10;
  if (input.dispersion != null && input.dispersion > 0.15) c -= 10;
  return Math.max(0, Math.min(100, c));
}

export function edgeFromProbs044(
  model: Record<string, number> | null,
  market: Record<string, number> | null,
): { selection: string | null; edge_absolute: number | null; edge_relative: number | null } {
  if (!model || !market) return { selection: null, edge_absolute: null, edge_relative: null };
  let bestSel: string | null = null;
  let bestAbs = -Infinity;
  for (const k of Object.keys(model)) {
    const mkt = market[k];
    if (mkt == null) continue;
    const abs = model[k]! - mkt;
    if (abs > bestAbs) {
      bestAbs = abs;
      bestSel = k;
    }
  }
  if (bestSel == null || !Number.isFinite(bestAbs)) {
    return { selection: null, edge_absolute: null, edge_relative: null };
  }
  const mkt = market[bestSel]!;
  return {
    selection: bestSel,
    edge_absolute: bestAbs,
    edge_relative: mkt > 0 ? bestAbs / mkt : null,
  };
}

/** MODEL_v1 = MARKET_ONLY → always NO_BET / no recommended. */
export function buildPredictionReasons044(input: {
  marketOnly: boolean;
  edgeAbsolute: number | null;
  confidence: number;
  hasMarket: boolean;
  nBooks: number;
}): { reason_codes: string[]; human: string; bucket: RankingBucket044; recommended: false } {
  const codes: string[] = [];
  if (!input.hasMarket) {
    codes.push("NO_MARKET");
    return {
      reason_codes: codes,
      human: "No usable market probabilities at as-of; recorded as observation-only NO_BET.",
      bucket: "NO_BET",
      recommended: false,
    };
  }
  if (input.marketOnly) {
    codes.push("MODEL_IS_MARKET_ONLY", "NO_INCREMENTAL_EDGE", "EDGE_BELOW_THRESHOLD");
  }
  if (input.edgeAbsolute != null && Math.abs(input.edgeAbsolute) < 0.02) {
    codes.push("EDGE_BELOW_THRESHOLD", "MARKET_AGREEMENT_HIGH");
  }
  if (input.confidence < 50) codes.push("UNCERTAINTY_ELEVATED", "LOW_CONFIDENCE");
  if (input.nBooks < 2) codes.push("INSUFFICIENT_BOOK_TRIANGULATION");

  const abs = input.edgeAbsolute ?? 0;
  let bucket: RankingBucket044 = "NO_BET";
  if (input.confidence >= 70) bucket = "TOP_CONFIDENCE";
  else if (Math.abs(abs) >= 0.04) bucket = "TOP_MARKET_DISLOCATIONS";
  else if (input.confidence < 40) bucket = "HIGH_UNCERTAINTY";
  else bucket = "NO_BET";

  const human = [
    "Verdict NO_BET (research observation only).",
    input.marketOnly
      ? "MODEL_v1 mirrors MARKET_DEVIG so absolute edge vs market is definitionally zero for production claims."
      : `Largest absolute edge ${input.edgeAbsolute?.toFixed(3) ?? "n/a"}.`,
    `Confidence ${input.confidence}/100; books=${input.nBooks}.`,
    codes.includes("EDGE_BELOW_THRESHOLD") ? "Edge below threshold." : null,
    codes.includes("MARKET_AGREEMENT_HIGH") ? "Market agreement high." : null,
    codes.includes("UNCERTAINTY_ELEVATED") ? "Uncertainty elevated." : null,
  ]
    .filter(Boolean)
    .join(" ");

  return { reason_codes: [...new Set(codes)], human, bucket, recommended: false };
}
