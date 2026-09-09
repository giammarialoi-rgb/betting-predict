/**
 * WHY explanation — only factors actually present in the decision snapshot.
 */

export type WhyFactor = {
  feature: string;
  value: number | string | object | null;
  asOf: string;
  source: string | null;
  contribution: "supporting" | "contradicting" | "neutral" | "quality_warning";
  quality: string;
};

export type WhyExplanation = {
  eventId: string;
  asOf: string;
  supporting: WhyFactor[];
  contradicting: WhyFactor[];
  qualityWarnings: WhyFactor[];
  summary: string;
};

export function buildWhyExplanation(input: {
  eventId: string;
  asOf: Date;
  factors: Array<{
    feature: string;
    value: number | string | object | null;
    availableAt: Date | null;
    source?: string | null;
    contribution: WhyFactor["contribution"];
    quality: string;
  }>;
}): WhyExplanation {
  const factors: WhyFactor[] = input.factors.map((f) => ({
    feature: f.feature,
    value: f.value,
    asOf: (f.availableAt ?? input.asOf).toISOString(),
    source: f.source ?? null,
    contribution: f.contribution,
    quality: f.quality,
  }));
  const supporting = factors.filter((f) => f.contribution === "supporting");
  const contradicting = factors.filter(
    (f) => f.contribution === "contradicting",
  );
  const qualityWarnings = factors.filter(
    (f) => f.contribution === "quality_warning",
  );
  const parts = [
    supporting.length ? `+ ${supporting.map((f) => f.feature).join(", ")}` : null,
    contradicting.length
      ? `- ${contradicting.map((f) => f.feature).join(", ")}`
      : null,
    qualityWarnings.length
      ? `! ${qualityWarnings.map((f) => f.feature).join(", ")}`
      : null,
  ].filter(Boolean);
  return {
    eventId: input.eventId,
    asOf: input.asOf.toISOString(),
    supporting,
    contradicting,
    qualityWarnings,
    summary: parts.join(" | ") || "insufficient_evidence",
  };
}
