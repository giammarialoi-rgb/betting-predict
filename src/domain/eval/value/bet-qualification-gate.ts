/**
 * BET_QUALIFICATION_GATE — odds stay outside the independent model.
 * A prediction is not a bet. Qualification requires independent probability + market quote.
 */
import { classifyDecision048 } from "@/domain/eval/factory-048/decision";

export const BET_QUALIFICATION_GATE = "BET_QUALIFICATION_GATE" as const;

export type BetQualification = {
  gate: typeof BET_QUALIFICATION_GATE;
  qualified: boolean;
  decision: string;
  codes: string[];
  risk: number;
  odds_in_model: false;
  reason_it: string;
};

export function runBetQualificationGate(input: {
  independent_ok: boolean;
  insufficient_data?: boolean;
  model_not_promoted?: boolean;
  edge: number | null;
  confidence: number;
  data_quality: number;
  has_market: boolean;
  market_only?: boolean;
}): BetQualification {
  if (!input.independent_ok || input.insufficient_data) {
    return {
      gate: BET_QUALIFICATION_GATE,
      qualified: false,
      decision: "INSUFFICIENT_DATA",
      codes: ["BET_QUALIFICATION_GATE", "INSUFFICIENT_DATA"],
      risk: 100,
      odds_in_model: false,
      reason_it: "Nessuna scommessa: manca una previsione indipendente valida.",
    };
  }
  if (input.model_not_promoted) {
    return {
      gate: BET_QUALIFICATION_GATE,
      qualified: false,
      decision: "MODEL_NOT_PROMOTED",
      codes: ["BET_QUALIFICATION_GATE", "MODEL_NOT_PROMOTED"],
      risk: 90,
      odds_in_model: false,
      reason_it: "Nessuna scommessa: il modello non e stato promosso.",
    };
  }
  const classified = classifyDecision048({
    edge: input.edge,
    confidence: input.confidence,
    dataQuality: input.data_quality,
    dispersion: null,
    hasMarket: input.has_market,
    marketOnly: input.market_only === true,
    insufficientData: false,
  });
  const qualified = classified.decision === "BET_CANDIDATE" || classified.decision === "STRONG_CANDIDATE";
  return {
    gate: BET_QUALIFICATION_GATE,
    qualified,
    decision: classified.decision,
    codes: [BET_QUALIFICATION_GATE, ...classified.codes],
    risk: classified.risk,
    odds_in_model: false,
    reason_it: qualified
      ? "Candidato valore: probabilità indipendente e quota di mercato confrontate, quote non usate nel modello."
      : "Nessuna scommessa qualificata: edge, mercato o qualità dati sotto soglia.",
  };
}
