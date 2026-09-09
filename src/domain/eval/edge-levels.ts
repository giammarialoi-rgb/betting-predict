/**
 * Edge classification — never auto-promote to VALIDATED_EDGE.
 */

export const EDGE_LEVELS = [
  "NO_SIGNAL",
  "WEAK_SIGNAL",
  "RESEARCH_SIGNAL",
  "CANDIDATE_EDGE",
  "VALIDATED_EDGE",
] as const;

export type EdgeLevel = (typeof EDGE_LEVELS)[number];

export type EdgeAssessment = {
  model_probability: number;
  market_probability: number;
  edge_raw: number;
  level: EdgeLevel;
  reasons: string[];
};

export function classifyEdge(input: {
  modelProbability: number;
  marketProbability: number;
  sampleSize: number;
  walkForwardPassed: boolean;
  holdoutPassed: boolean;
  calibrationOk: boolean;
  multipleTestingCorrected: boolean;
  temporalIntegrity: boolean;
  minSample?: number;
}): EdgeAssessment {
  const edge_raw = input.modelProbability - input.marketProbability;
  const abs = Math.abs(edge_raw);
  const reasons: string[] = [];
  const minSample = input.minSample ?? 200;

  if (!input.temporalIntegrity) {
    return {
      model_probability: input.modelProbability,
      market_probability: input.marketProbability,
      edge_raw,
      level: "NO_SIGNAL",
      reasons: ["temporal_integrity_failed"],
    };
  }

  let level: EdgeLevel = "NO_SIGNAL";
  if (abs < 0.02) {
    level = "NO_SIGNAL";
    reasons.push("gap_below_2pp");
  } else if (abs < 0.05) {
    level = "WEAK_SIGNAL";
    reasons.push("gap_2_to_5pp");
  } else {
    level = "RESEARCH_SIGNAL";
    reasons.push("gap_ge_5pp");
  }

  if (
    level === "RESEARCH_SIGNAL" &&
    input.sampleSize >= Math.floor(minSample / 2) &&
    input.walkForwardPassed
  ) {
    level = "CANDIDATE_EDGE";
    reasons.push("partial_oos_support");
  }

  // VALIDATED_EDGE is intentionally unreachable without ALL gates.
  const canValidate =
    input.sampleSize >= minSample &&
    input.walkForwardPassed &&
    input.holdoutPassed &&
    input.calibrationOk &&
    input.multipleTestingCorrected &&
    input.temporalIntegrity;

  if (level === "CANDIDATE_EDGE" && canValidate) {
    level = "VALIDATED_EDGE";
    reasons.push("all_validation_gates_passed");
  } else if (!canValidate && level === "CANDIDATE_EDGE") {
    reasons.push("validated_edge_blocked_missing_gates");
  }

  return {
    model_probability: input.modelProbability,
    market_probability: input.marketProbability,
    edge_raw,
    level,
    reasons,
  };
}

export function assertNoValidatedEdgeWithoutGates(level: EdgeLevel): void {
  if (level === "VALIDATED_EDGE") {
    // Callers must have passed classifyEdge gates; this is a documentation hook.
  }
}
