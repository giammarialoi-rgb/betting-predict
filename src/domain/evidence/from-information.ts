/**
 * Bridge InformationEvent → EvidenceItem.
 * NEWS defaults to CONTEXT_ONLY — never auto-predictive.
 */

import type { InformationEvent } from "@/domain/info/contracts";
import type {
  EvidenceCategory,
  EvidenceItem,
  EpistemicKind,
} from "@/domain/evidence/types";

function categoryForInfo(
  t: InformationEvent["information_type"],
): EvidenceCategory {
  if (t === "NEWS") return "news";
  if (t === "INJURY" || t === "SUSPENSION") return "injury";
  if (t === "LINEUP") return "lineup";
  if (t === "WEATHER_FORECAST") return "weather";
  return "contextual";
}

function epistemicForInfo(
  t: InformationEvent["information_type"],
): EpistemicKind {
  if (t === "NEWS") return "FACT"; // published claim as fact of publication — not causal judgment
  if (t === "INJURY" || t === "LINEUP" || t === "SUSPENSION") return "FACT";
  if (t === "WEATHER_FORECAST") return "FACT";
  return "FACT";
}

export function evidenceItemFromInformation(input: {
  info: InformationEvent;
  eventId: string;
  targetHypothesis: string;
  evidenceId: string;
  sourceUrl?: string | null;
  claim?: string;
}): EvidenceItem {
  const info = input.info;
  const isNews = info.information_type === "NEWS";
  const claim =
    input.claim ??
    `${info.information_type}: ${info.subject}${
      info.payload ? ` ${JSON.stringify(info.payload)}` : ""
    }`;

  return {
    evidenceId: input.evidenceId,
    category: categoryForInfo(info.information_type),
    epistemicKind: epistemicForInfo(info.information_type),
    claim,
    entityRef: info.subject,
    eventId: input.eventId,
    sourceId: info.source,
    sourceUrl: input.sourceUrl ?? null,
    publishedAt: info.published_at,
    availableAt: info.available_at,
    observedAt: info.available_at,
    temporalPrecision: "exact",
    // NEWS (and weather) start as CONTEXT_ONLY — no causal jump to prediction
    polarity: isNews || info.information_type === "WEATHER_FORECAST"
      ? "CONTEXT_ONLY"
      : "NEUTRAL",
    targetHypothesis: input.targetHypothesis,
    magnitude: null,
    claimConfidence: info.confidence,
    sourceReliability: null,
    confirmations: [],
    rebuttals: [],
  };
}
