/**
 * explainDecision — numeric WHY, not marketing language.
 */

import type { WhyFactor } from "@/domain/eval/why-explanation";
import { buildWhyTreeV2 } from "@/domain/eval/why-v2";

export type ExplainDecisionResult = {
  eventId: string;
  asOf: string;
  why_tree: ReturnType<typeof buildWhyTreeV2>;
  evidence: WhyFactor[];
  supporting_data: WhyFactor[];
  contradicting_data: WhyFactor[];
  blocking_factors: string[];
  summary: string;
};

export function explainDecision(input: {
  eventId: string;
  asOf: Date;
  factors: WhyFactor[];
  blocking?: string[];
}): ExplainDecisionResult {
  const why_tree = buildWhyTreeV2(input);
  const supporting = input.factors.filter((f) => f.contribution === "supporting");
  const contradicting = input.factors.filter(
    (f) => f.contribution === "contradicting",
  );
  const blocking_factors = [
    ...(input.blocking ?? []),
    ...input.factors
      .filter((f) => f.contribution === "quality_warning")
      .map((f) => f.feature),
  ];
  const summary =
    blocking_factors.length > 0 && supporting.length === 0
      ? "INSUFFICIENT_EVIDENCE"
      : why_tree.summary;
  return {
    eventId: input.eventId,
    asOf: input.asOf.toISOString(),
    why_tree,
    evidence: [...input.factors],
    supporting_data: supporting,
    contradicting_data: contradicting,
    blocking_factors,
    summary,
  };
}
