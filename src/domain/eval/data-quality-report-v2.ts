/**
 * Data quality report — NOT win probability.
 */

export type QualityLevel =
  | "UNUSABLE"
  | "WEAK"
  | "ACCEPTABLE"
  | "STRONG"
  | "INSUFFICIENT_DATA";

export type DataQualityReportV2 = {
  kind: "DATA_QUALITY_REPORT";
  quality_score: number | null;
  quality_level: QualityLevel;
  dimensions: {
    completeness: number;
    temporal_precision: number;
    source_authority: number;
    cross_source_agreement: number;
    entity_resolution: number;
    duplicate_rate: number;
    missing_rate: number;
  };
  blocking_reasons: string[];
  notes: string[];
};

export function buildDataQualityReport(input: {
  completeness: number;
  exactPrecisionShare: number;
  sourceAuthorityShare: number;
  crossSourceAgreementShare: number;
  entityResolutionShare: number;
  duplicateRate: number;
  missingRate: number;
  requireExactForStrict?: boolean;
}): DataQualityReportV2 {
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  const dimensions = {
    completeness: clamp(input.completeness),
    temporal_precision: clamp(input.exactPrecisionShare),
    source_authority: clamp(input.sourceAuthorityShare),
    cross_source_agreement: clamp(input.crossSourceAgreementShare),
    entity_resolution: clamp(input.entityResolutionShare),
    duplicate_rate: clamp(input.duplicateRate),
    missing_rate: clamp(input.missingRate),
  };

  const blocking: string[] = [];
  if (input.requireExactForStrict !== false && dimensions.temporal_precision < 0.5) {
    blocking.push(
      "temporal_precision_UNKNOWN_blocks_STRICT_AS_OF",
    );
  }
  if (dimensions.completeness < 0.5) {
    blocking.push("completeness_below_50pct");
  }
  if (dimensions.missing_rate > 0.5) {
    blocking.push("missing_rate_above_50pct");
  }

  if (
    !Number.isFinite(dimensions.completeness) ||
    input.completeness + input.exactPrecisionShare === 0
  ) {
    return {
      kind: "DATA_QUALITY_REPORT",
      quality_score: null,
      quality_level: "INSUFFICIENT_DATA",
      dimensions,
      blocking_reasons: ["INSUFFICIENT_DATA", ...blocking],
      notes: ["DATA_QUALITY ≠ WIN_PROBABILITY"],
    };
  }

  const quality_score =
    (dimensions.completeness +
      dimensions.temporal_precision +
      dimensions.source_authority +
      dimensions.cross_source_agreement +
      dimensions.entity_resolution +
      (1 - dimensions.duplicate_rate) +
      (1 - dimensions.missing_rate)) /
    7;

  let quality_level: QualityLevel = "WEAK";
  if (blocking.length > 0) quality_level = "UNUSABLE";
  else if (quality_score >= 0.85) quality_level = "STRONG";
  else if (quality_score >= 0.65) quality_level = "ACCEPTABLE";

  return {
    kind: "DATA_QUALITY_REPORT",
    quality_score,
    quality_level,
    dimensions,
    blocking_reasons: blocking,
    notes: [
      "DATA_QUALITY ≠ WIN_PROBABILITY",
      "high coverage with UNKNOWN temporal precision remains UNUSABLE under STRICT_AS_OF",
    ],
  };
}
