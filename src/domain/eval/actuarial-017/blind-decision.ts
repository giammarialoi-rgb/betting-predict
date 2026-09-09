/**
 * BlindDecision — immutable pre-outcome lock object.
 */

import type { AssessmentReport } from "@/domain/evidence/types";
import type { DecisionContext } from "@/domain/eval/contexts";
import { createHash } from "node:crypto";

export type BlindDecision = {
  kind: "BlindDecision";
  decisionId: string;
  eventId: string;
  asOf: string;
  market: string;
  selection: string;
  odds: number;
  modelProbability: number;
  marketProbability: number;
  differenceCategory:
    | "NO_SIGNAL"
    | "WEAK_DIFFERENCE"
    | "UNVALIDATED_EDGE"
    | "VALIDATED_EDGE";
  evidenceGraphSummary: {
    supporting: number;
    contradicting: number;
    contextual: number;
    blocked: number;
    strength: string;
  };
  riskDecision: {
    policy: string;
    stake: number;
    riskClass: string | null;
    noPosition: boolean;
    reason: string;
  };
  stake: number;
  bankrollBefore: number;
  decisionTimestamp: string;
  featureSnapshotHash: string;
  dataSnapshotHash: string;
  LOCK: true;
  /** Explicit: no outcome fields. */
  outcome: null;
};

export type OutcomeReveal = {
  kind: "OutcomeReveal";
  decisionId: string;
  eventId: string;
  revealedAt: string;
  resultCode: "HOME" | "DRAW" | "AWAY";
  homeScore: number;
  awayScore: number;
};

export function hashSnapshot(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 16);
}

export function classifyDifference(
  modelP: number,
  marketP: number,
  validatedEdge: boolean,
): BlindDecision["differenceCategory"] {
  const d = Math.abs(modelP - marketP);
  if (validatedEdge && d >= 0.03) return "VALIDATED_EDGE";
  if (d < 0.01) return "NO_SIGNAL";
  if (d < 0.03) return "WEAK_DIFFERENCE";
  return "UNVALIDATED_EDGE";
}

export function buildBlindDecision(input: {
  decisionId: string;
  eventId: string;
  asOf: Date;
  market: string;
  selection: string;
  odds: number;
  modelProbability: number;
  marketProbability: number;
  assessment: AssessmentReport;
  policy: string;
  stake: number;
  bankrollBefore: number;
  riskClass: string | null;
  noPosition: boolean;
  reason: string;
  decisionContext: DecisionContext;
  validatedEdge?: boolean;
}): BlindDecision {
  if (input.assessment.probability === null && input.stake > 0) {
    throw new Error("BlindDecision: cannot stake without assessment probability");
  }
  return {
    kind: "BlindDecision",
    decisionId: input.decisionId,
    eventId: input.eventId,
    asOf: input.asOf.toISOString(),
    market: input.market,
    selection: input.selection,
    odds: input.odds,
    modelProbability: input.modelProbability,
    marketProbability: input.marketProbability,
    differenceCategory: classifyDifference(
      input.modelProbability,
      input.marketProbability,
      input.validatedEdge ?? false,
    ),
    evidenceGraphSummary: {
      supporting: input.assessment.evidenceGraph.supporting.length,
      contradicting: input.assessment.evidenceGraph.contradicting.length,
      contextual: input.assessment.evidenceGraph.contextual.length,
      blocked: input.assessment.blockedByTemporal.length,
      strength: input.assessment.evidenceStrength,
    },
    riskDecision: {
      policy: input.policy,
      stake: input.stake,
      riskClass: input.riskClass,
      noPosition: input.noPosition,
      reason: input.reason,
    },
    stake: input.stake,
    bankrollBefore: input.bankrollBefore,
    decisionTimestamp: input.asOf.toISOString(),
    featureSnapshotHash: hashSnapshot({
      features: input.decisionContext.availableFeatures.map((f) => [
        f.featureKey,
        f.value,
        f.availableAt?.toISOString() ?? null,
      ]),
    }),
    dataSnapshotHash: hashSnapshot({
      markets: input.decisionContext.availableMarkets.map((m) => [
        m.marketType,
        m.selectionSide,
        m.oddsDecimal,
        m.availableAt.toISOString(),
      ]),
    }),
    LOCK: true,
    outcome: null,
  };
}
