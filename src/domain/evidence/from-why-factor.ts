/**
 * Adapter: WhyFactor → EvidenceItem (backward compatible).
 */

import type { WhyFactor } from "@/domain/eval/why-explanation";
import type {
  EvidenceItem,
  EvidencePolarity,
  EpistemicKind,
} from "@/domain/evidence/types";

function polarityFromContribution(
  c: WhyFactor["contribution"],
): EvidencePolarity {
  if (c === "supporting") return "SUPPORTS";
  if (c === "contradicting") return "CONTRADICTS";
  return "NEUTRAL";
}

function epistemicFromQuality(quality: string): EpistemicKind {
  if (quality === "exact" || quality === "observed") return "FACT";
  if (quality === "model" || quality === "judgment") return "MODEL_JUDGMENT";
  if (quality === "inferred") return "INFERENCE";
  return "QUANTITATIVE_EVIDENCE";
}

export function evidenceItemFromWhyFactor(input: {
  factor: WhyFactor;
  eventId: string;
  targetHypothesis: string;
  evidenceId?: string;
  availableAt?: Date;
  observedAt?: Date;
  category?: EvidenceItem["category"];
}): EvidenceItem {
  const f = input.factor;
  const availableAt = input.availableAt ?? new Date(f.asOf);
  const observedAt = input.observedAt ?? availableAt;
  return {
    evidenceId: input.evidenceId ?? `why:${f.feature}:${f.asOf}`,
    category: input.category ?? "statistical",
    epistemicKind: epistemicFromQuality(f.quality),
    claim: `${f.feature}=${JSON.stringify(f.value)}`,
    entityRef: null,
    eventId: input.eventId,
    sourceId: f.source ?? "unknown",
    sourceUrl: null,
    publishedAt: null,
    availableAt,
    observedAt,
    temporalPrecision:
      f.quality === "exact"
        ? "exact"
        : f.quality === "unknown"
          ? "unknown"
          : "dataset_window",
    polarity: polarityFromContribution(f.contribution),
    targetHypothesis: input.targetHypothesis,
    magnitude: typeof f.value === "number" ? f.value : null,
    claimConfidence: null,
    sourceReliability: null,
    confirmations: [],
    rebuttals: [],
  };
}

export function evidenceItemsFromWhyFactors(input: {
  factors: readonly WhyFactor[];
  eventId: string;
  targetHypothesis: string;
}): EvidenceItem[] {
  return input.factors.map((factor, i) =>
    evidenceItemFromWhyFactor({
      factor,
      eventId: input.eventId,
      targetHypothesis: input.targetHypothesis,
      evidenceId: `why:${i}:${factor.feature}`,
    }),
  );
}
