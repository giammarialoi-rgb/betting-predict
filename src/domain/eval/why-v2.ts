/**
 * WHY Engine V2 — hierarchical explanation structure.
 */

import type { WhyFactor } from "@/domain/eval/why-explanation";

export type WhyTreeV2 = {
  eventId: string;
  asOf: string;
  MODEL: {
    form: WhyFactor[];
    elo: WhyFactor[];
    goals: WhyFactor[];
    contextual: WhyFactor[];
  };
  MARKET: {
    consensus: WhyFactor[];
    disagreement: WhyFactor[];
    movement: WhyFactor[];
    de_vig: WhyFactor[];
  };
  DATA: {
    completeness: WhyFactor[];
    temporal_precision: WhyFactor[];
    source_quality: WhyFactor[];
  };
  RISKS: {
    low_sample: WhyFactor[];
    missing_player_data: WhyFactor[];
    temporal_uncertainty: WhyFactor[];
    model_disagreement: WhyFactor[];
  };
  summary: string;
};

function bucket(factors: WhyFactor[], pred: (f: WhyFactor) => boolean): WhyFactor[] {
  return factors.filter(pred);
}

export function buildWhyTreeV2(input: {
  eventId: string;
  asOf: Date;
  factors: WhyFactor[];
}): WhyTreeV2 {
  const f = input.factors;
  const tree: WhyTreeV2 = {
    eventId: input.eventId,
    asOf: input.asOf.toISOString(),
    MODEL: {
      form: bucket(f, (x) => x.feature.includes("form")),
      elo: bucket(f, (x) => x.feature.includes("elo")),
      goals: bucket(f, (x) => x.feature.includes("goal")),
      contextual: bucket(
        f,
        (x) =>
          x.feature.includes("home") ||
          x.feature.includes("rest") ||
          x.feature.includes("strength"),
      ),
    },
    MARKET: {
      consensus: bucket(f, (x) => x.feature.includes("consensus")),
      disagreement: bucket(
        f,
        (x) =>
          x.feature.includes("disagreement") || x.feature.includes("dispersion"),
      ),
      movement: bucket(f, (x) => x.feature.includes("movement")),
      de_vig: bucket(f, (x) => x.feature.includes("devig")),
    },
    DATA: {
      completeness: bucket(f, (x) => x.feature.includes("completeness")),
      temporal_precision: bucket(
        f,
        (x) =>
          x.feature.includes("temporal") || x.quality.includes("unknown"),
      ),
      source_quality: bucket(f, (x) => x.feature.includes("source")),
    },
    RISKS: {
      low_sample: bucket(f, (x) => x.feature.includes("sample")),
      missing_player_data: bucket(f, (x) => x.feature.includes("player")),
      temporal_uncertainty: bucket(
        f,
        (x) => x.contribution === "quality_warning",
      ),
      model_disagreement: bucket(f, (x) => x.feature.includes("model_disagreement")),
    },
    summary: "",
  };

  const parts: string[] = [];
  const count = (arr: WhyFactor[]) => arr.length;
  if (count(tree.MODEL.elo) + count(tree.MODEL.form) > 0) {
    parts.push("MODEL signals present");
  }
  if (count(tree.MARKET.disagreement) > 0) parts.push("MARKET disagreement");
  if (count(tree.RISKS.temporal_uncertainty) > 0) parts.push("RISKS present");
  tree.summary = parts.join(" | ") || "insufficient_structured_evidence";
  return tree;
}
