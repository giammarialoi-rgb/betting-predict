/**
 * Build EvidenceGraph with temporal firewall.
 * Evidence with availableAt > asOf never enters the graph — only blockedByTemporal.
 */

import type {
  EvidenceGraph,
  EvidenceItem,
  EvidencePolarity,
} from "@/domain/evidence/types";

export type BuildEvidenceGraphResult = {
  graph: EvidenceGraph;
  blockedByTemporal: EvidenceItem[];
};

function bucketForPolarity(
  polarity: EvidencePolarity,
): "supporting" | "contradicting" | "contextual" {
  if (polarity === "SUPPORTS") return "supporting";
  if (polarity === "CONTRADICTS") return "contradicting";
  return "contextual";
}

export function buildEvidenceGraph(input: {
  eventId: string;
  asOf: Date;
  hypothesis: string;
  items: readonly EvidenceItem[];
  insufficient?: string[];
}): BuildEvidenceGraphResult {
  const supporting: EvidenceItem[] = [];
  const contradicting: EvidenceItem[] = [];
  const contextual: EvidenceItem[] = [];
  const blockedByTemporal: EvidenceItem[] = [];

  for (const item of input.items) {
    if (item.availableAt.getTime() > input.asOf.getTime()) {
      blockedByTemporal.push(item);
      continue;
    }
    if (item.eventId !== input.eventId) {
      continue;
    }
    const bucket = bucketForPolarity(item.polarity);
    if (bucket === "supporting") supporting.push(item);
    else if (bucket === "contradicting") contradicting.push(item);
    else contextual.push(item);
  }

  return {
    graph: {
      eventId: input.eventId,
      asOf: input.asOf,
      hypothesis: input.hypothesis,
      supporting,
      contradicting,
      contextual,
      insufficient: [...(input.insufficient ?? [])],
    },
    blockedByTemporal,
  };
}
