/**
 * Attribution citations — UI-consumable, citeable sources.
 */

import type {
  AttributionCitation,
  EvidenceItem,
} from "@/domain/evidence/types";

function citationKind(
  category: EvidenceItem["category"],
): AttributionCitation["kind"] {
  if (category === "news" || category === "external_research") return "news";
  if (category === "market") return "market";
  if (
    category === "statistical" ||
    category === "historical" ||
    category === "injury" ||
    category === "lineup"
  ) {
    return "dataset";
  }
  return "other";
}

export function buildAttributions(
  items: readonly EvidenceItem[],
): AttributionCitation[] {
  return items.map((e) => ({
    evidenceId: e.evidenceId,
    kind: citationKind(e.category),
    sourceId: e.sourceId,
    sourceUrl: e.sourceUrl,
    publishedAt: e.publishedAt?.toISOString() ?? null,
    availableAt: e.availableAt.toISOString(),
    observedAt: e.observedAt.toISOString(),
    claim: e.claim,
    epistemicKind: e.epistemicKind,
    polarity: e.polarity,
    category: e.category,
  }));
}
