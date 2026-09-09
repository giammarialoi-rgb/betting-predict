import { createHash } from "node:crypto";
import type { PermanentPrediction044 } from "@/domain/eval/permanent-044/types";
import type { LabDecision048 } from "@/domain/eval/factory-048/config";

export type WhyBlock048 = {
  WHY_PRIMARY: string;
  WHY_SUPPORTING: string[];
  WHY_AGAINST: string[];
  WHY_RISK: string[];
  WHY_NO_BET: string | null;
};

export type DecisionRecord048 = {
  decision_id: string;
  event_id: string;
  prediction_id: string;
  timestamp: string;
  model_version: string;
  market: string;
  prediction: string | null;
  probability: number | null;
  confidence: number;
  fair_probability: number | null;
  market_probability: number | null;
  estimated_edge: number | null;
  risk_score: number;
  data_quality_score: number;
  decision: LabDecision048;
  decision_reason_codes: string[];
  explanation: WhyBlock048;
  capital: "CLOSED";
  real_money: false;
  observed_decision: true;
};

const EDGE_CANDIDATE = 0.03;
const EDGE_STRONG = 0.06;
const CONF_CANDIDATE = 55;
const CONF_STRONG = 70;

/** Classify lab decision — never opens real capital; paper bankroll may open on BET_*. */
export function classifyDecision048(input: {
  edge: number | null;
  confidence: number;
  dataQuality: number;
  dispersion: number | null;
  hasMarket: boolean;
  marketOnly: boolean;
  insufficientData?: boolean;
  modelUncertain?: boolean;
  liquidityProxyLow?: boolean;
  marketSignalInsufficient?: boolean;
  featureQualityLow?: boolean;
}): { decision: LabDecision048; codes: string[]; risk: number } {
  const abs = Math.abs(input.edge ?? 0);
  const risk =
    (input.dispersion != null && input.dispersion > 0.12 ? 35 : 10) +
    (input.confidence < 40 ? 25 : 0) +
    (input.dataQuality < 0.4 ? 20 : 0) +
    (input.marketOnly ? 15 : 0) +
    (input.liquidityProxyLow ? 12 : 0) +
    (input.marketSignalInsufficient ? 8 : 0) +
    (input.featureQualityLow ? 10 : 0);

  if (input.insufficientData) {
    return {
      decision: "INSUFFICIENT_DATA",
      codes: ["INSUFFICIENT_DATA", "NO_INDEPENDENT_FEATURES"],
      risk: Math.min(100, risk + 25),
    };
  }

  if (input.modelUncertain && (input.edge == null || abs < EDGE_STRONG)) {
    return {
      decision: "MODEL_UNCERTAIN",
      codes: ["MODEL_UNCERTAIN", "INSUFFICIENT_SIGNAL"],
      risk: Math.min(100, risk + 20),
    };
  }

  if (!input.hasMarket) {
    return { decision: "NO_BET", codes: ["NO_MARKET", "INSUFFICIENT_SIGNAL"], risk: Math.min(100, risk + 30) };
  }

  // Thin liquidity / missing movement history + weak edge → stay out
  if (
    (input.liquidityProxyLow || input.marketSignalInsufficient || input.featureQualityLow) &&
    (input.edge == null || abs < EDGE_STRONG)
  ) {
    const codes = ["NO_BET", "INSUFFICIENT_SIGNAL", "EDGE_UNKNOWN_OR_LOW"];
    if (input.liquidityProxyLow) codes.push("LIQUIDITY_PROXY_LOW");
    if (input.marketSignalInsufficient) codes.push("MARKET_SIGNAL_INSUFFICIENT");
    if (input.featureQualityLow) codes.push("FEATURE_QUALITY_LOW");
    return {
      decision: abs < EDGE_CANDIDATE ? "NO_BET" : "MODEL_UNCERTAIN",
      codes: [...new Set(codes)],
      risk: Math.min(100, risk + 15),
    };
  }

  if (input.marketOnly || abs < EDGE_CANDIDATE) {
    const codes = ["EDGE_BELOW_THRESHOLD", "MODEL_MARKET_AGREEMENT", "INSUFFICIENT_SIGNAL"];
    if (risk >= 50) codes.push("RISK_TOO_HIGH");
    if (input.marketOnly) codes.push("MODEL_IS_MARKET_ONLY", "MARKET_BASELINE_ONLY");
    if (input.marketOnly || abs < 0.02) codes.push("EDGE_UNKNOWN_OR_LOW");
    return { decision: "NO_BET", codes: [...new Set(codes)], risk: Math.min(100, risk) };
  }

  if (abs >= EDGE_STRONG && input.confidence >= CONF_STRONG && input.dataQuality >= 0.5 && risk < 45) {
    return {
      decision: "STRONG_CANDIDATE",
      codes: ["HIGH_EDGE", "MULTI_SIGNAL_CONFIRMATION", "MARKET_DISAGREEMENT", "HIGH_CONFIDENCE"],
      risk: Math.min(100, risk),
    };
  }

  if (abs >= EDGE_CANDIDATE && input.confidence >= CONF_CANDIDATE && risk < 60) {
    const codes = ["POSITIVE_EDGE", "MARKET_DISAGREEMENT"];
    if (input.dataQuality >= 0.6) codes.push("HIGH_DATA_QUALITY");
    if (risk < 30) codes.push("LOW_RISK");
    return { decision: "BET_CANDIDATE", codes, risk: Math.min(100, risk) };
  }

  return {
    decision: "NO_BET",
    codes: ["EDGE_BELOW_THRESHOLD", "RISK_TOO_HIGH"].concat(
      input.confidence < CONF_CANDIDATE ? ["LOW_CONFIDENCE"] : [],
    ),
    risk: Math.min(100, risk),
  };
}

export function buildWhy048(input: {
  decision: LabDecision048;
  codes: string[];
  selection: string | null;
  modelProb: number | null;
  marketProb: number | null;
  edge: number | null;
  confidence: number;
  risk: number;
  dispersion: number | null;
}): WhyBlock048 {
  const sel = input.selection ?? "—";
  const mp = input.modelProb != null ? `${(input.modelProb * 100).toFixed(1)}%` : "n/a";
  const mk = input.marketProb != null ? `${(input.marketProb * 100).toFixed(1)}%` : "n/a";
  const primary =
    input.modelProb != null && input.marketProb != null
      ? `Il mercato assegna ${mk} a ${sel}, il modello stima ${mp}.`
      : "Probabilità di mercato insufficienti per confronto modello/mercato.";

  const supporting: string[] = [];
  if (input.codes.includes("HIGH_DATA_QUALITY") || input.codes.includes("MULTI_SIGNAL_CONFIRMATION")) {
    supporting.push("Segnali multipli o qualità dati elevata");
  }
  if (input.dispersion != null && input.dispersion < 0.08) supporting.push("Consensus bookmaker stabile");
  if (input.codes.includes("POSITIVE_EDGE") || input.codes.includes("HIGH_EDGE")) {
    supporting.push(`Edge stimato ${(input.edge ?? 0).toFixed(3)}`);
  }
  if (!supporting.length) supporting.push("Solo evidenza di mercato disponibile");

  const against: string[] = [];
  if (input.codes.includes("MODEL_IS_MARKET_ONLY")) {
    against.push("Modello allineato al mercato (nessun edge incrementale)");
  }
  if (input.codes.includes("INSUFFICIENT_SIGNAL")) against.push("Segnali non-market assenti");
  if (input.edge != null && Math.abs(input.edge) < 0.03) against.push("Edge concentrato sotto soglia");

  const riskLines: string[] = [];
  if (input.codes.includes("LIQUIDITY_PROXY_LOW")) {
    riskLines.push("Liquidità proxy bassa (pochi book / alta dispersione)");
  }
  if (input.codes.includes("STEAM_MOVE")) supporting.push("Steam move multi-book osservato");
  if (input.codes.includes("MARKET_DRIFT")) supporting.push("Drift quote osservato");
  if (input.codes.includes("MARKET_SIGNAL_INSUFFICIENT")) {
    against.push("Storia quote insufficiente per segnale movimento");
  }
  if (input.dispersion != null && input.dispersion > 0.12) riskLines.push("Alta dispersione bookmaker");
  if (input.confidence < 50) riskLines.push("Confidenza bassa");
  if (input.risk >= 50) riskLines.push(`Risk score ${input.risk}`);
  if (!riskLines.length) riskLines.push("Rischio residuale di laboratorio");

  const noBet =
    input.decision === "NO_BET" ||
    input.decision === "INSUFFICIENT_DATA" ||
    input.decision === "MODEL_UNCERTAIN"
      ? input.codes.includes("EDGE_BELOW_THRESHOLD")
        ? "Edge non sufficiente dopo penalizzazione rischio."
        : `${input.decision}: ${input.codes.join(", ")}`
      : null;

  return {
    WHY_PRIMARY: primary,
    WHY_SUPPORTING: supporting,
    WHY_AGAINST: against,
    WHY_RISK: riskLines,
    WHY_NO_BET: noBet,
  };
}

export function decisionId048(eventId: string, predictionId: string): string {
  return createHash("sha256").update(`dec048|${eventId}|${predictionId}`).digest("hex").slice(0, 24);
}

export function decisionFromPrediction048(
  p: PermanentPrediction044,
  modelVersion: string,
  dispersion: number | null,
): DecisionRecord048 {
  const marketOnly = p.reason_codes.includes("MODEL_IS_MARKET_ONLY");
  const insufficientData =
    p.reason_codes.includes("INSUFFICIENT_DATA") ||
    p.reason_codes.includes("NO_INDEPENDENT_MODEL") ||
    p.probability_model == null;
  const modelUncertain = p.reason_codes.includes("MODEL_UNCERTAIN");
  const liquidityProxyLow = p.reason_codes.includes("LIQUIDITY_PROXY_LOW");
  const marketSignalInsufficient = p.reason_codes.includes("MARKET_SIGNAL_INSUFFICIENT");
  const featureQualityLow = p.reason_codes.includes("FEATURE_QUALITY_LOW");
  const cls = classifyDecision048({
    edge: insufficientData ? null : p.edge_absolute,
    confidence: p.confidence_score,
    dataQuality: p.data_quality_score,
    dispersion,
    hasMarket: Boolean(p.probability_market),
    marketOnly: marketOnly && !insufficientData,
    insufficientData,
    modelUncertain: modelUncertain && !insufficientData,
    liquidityProxyLow,
    marketSignalInsufficient,
    featureQualityLow,
  });
  const sel = p.selection;
  const modelProb = sel && p.probability_model ? p.probability_model[sel] ?? null : null;
  const marketProb = sel && p.probability_market ? p.probability_market[sel] ?? null : null;
  return {
    decision_id: decisionId048(p.event_id, p.prediction_id),
    event_id: p.event_id,
    prediction_id: p.prediction_id,
    timestamp: p.timestamp,
    model_version: modelVersion,
    market: p.market,
    prediction: sel,
    probability: modelProb,
    confidence: p.confidence_score,
    fair_probability: modelProb,
    market_probability: marketProb,
    estimated_edge: p.edge_absolute,
    risk_score: cls.risk,
    data_quality_score: p.data_quality_score,
    decision: cls.decision,
    decision_reason_codes: cls.codes,
    explanation: buildWhy048({
      decision: cls.decision,
      codes: cls.codes,
      selection: sel,
      modelProb,
      marketProb,
      edge: p.edge_absolute,
      confidence: p.confidence_score,
      risk: cls.risk,
      dispersion,
    }),
    capital: "CLOSED",
    real_money: false,
    observed_decision: true,
  };
}
