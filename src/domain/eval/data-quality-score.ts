/**
 * Technical data quality score — NOT win probability / bookmaker reliability.
 */

export type DataQualityDimensions = {
  temporal_precision: number;
  source_provenance: number;
  completeness: number;
  identity_quality: number;
  duplication: number;
  freshness: number;
};

export type DataQualityScore = {
  kind: "DATA_QUALITY";
  /** Never interpret as WIN_PROBABILITY. */
  score: number;
  dimensions: DataQualityDimensions;
  notes: string[];
};

export function computeDataQualityScore(input: {
  exactPrecisionShare: number;
  knownProvenanceShare: number;
  completenessShare: number;
  identityResolvedShare: number;
  duplicateRate: number;
  freshnessShare: number;
}): DataQualityScore {
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  const dimensions: DataQualityDimensions = {
    temporal_precision: clamp(input.exactPrecisionShare),
    source_provenance: clamp(input.knownProvenanceShare),
    completeness: clamp(input.completenessShare),
    identity_quality: clamp(input.identityResolvedShare),
    duplication: clamp(1 - input.duplicateRate),
    freshness: clamp(input.freshnessShare),
  };
  const score =
    (dimensions.temporal_precision +
      dimensions.source_provenance +
      dimensions.completeness +
      dimensions.identity_quality +
      dimensions.duplication +
      dimensions.freshness) /
    6;
  return {
    kind: "DATA_QUALITY",
    score,
    dimensions,
    notes: [
      "DATA_QUALITY ≠ WIN_PROBABILITY",
      "unknown temporal precision lowers temporal_precision dimension",
    ],
  };
}

export function assertNotWinProbability(label: string): void {
  if (label === "WIN_PROBABILITY" || label.toLowerCase().includes("win probability")) {
    throw new Error("DATA_QUALITY must not be labeled as WIN_PROBABILITY");
  }
}
