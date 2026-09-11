/**
 * Dossier data-quality score. Never used to bypass model gates.
 */
export type DataQualityInput = {
  real_features: number;
  derived_features: number;
  historical_prior_features: number;
  missing_features: number;
  sources_success: number;
  sources_partial: number;
  sources_blocked: number;
  independent_sources: number;
  conflicts: number;
  temporal_exclusions: number;
};

export type DataQualityResult = {
  data_quality_score: number;
  letter: "A" | "B" | "C" | "D" | "F";
  breakdown: Record<string, number>;
  note_it: string;
};

function letterOf(score: number): DataQualityResult["letter"] {
  if (score >= 0.8) return "A";
  if (score >= 0.6) return "B";
  if (score >= 0.4) return "C";
  if (score >= 0.2) return "D";
  return "F";
}

export function computeDataQualityScore(input: DataQualityInput): DataQualityResult {
  const usable = input.real_features + input.historical_prior_features + input.derived_features * 0.5;
  const denom = usable + input.missing_features;
  const coverage = denom > 0 ? usable / denom : 0;
  const sourceBreadth = Math.min(1, input.independent_sources / 4);
  const freshness = Math.max(0, 1 - input.sources_blocked * 0.05);
  const conflictPenalty = Math.min(0.25, input.conflicts * 0.05);
  const temporalPenalty = Math.min(0.2, input.temporal_exclusions * 0.05);
  const score = Math.max(
    0,
    Math.min(
      1,
      Math.round(
        (coverage * 0.45 + sourceBreadth * 0.25 + freshness * 0.15 + Math.min(1, input.sources_success / 5) * 0.15 -
          conflictPenalty -
          temporalPenalty) *
          1000,
      ) / 1000,
    ),
  );
  const letter = letterOf(score);
  return {
    data_quality_score: score,
    letter,
    breakdown: {
      coverage: Math.round(coverage * 1000) / 1000,
      source_breadth: Math.round(sourceBreadth * 1000) / 1000,
      freshness: Math.round(freshness * 1000) / 1000,
      conflict_penalty: conflictPenalty,
      temporal_penalty: temporalPenalty,
    },
    note_it: `Qualita dati ${letter} (${Math.round(score * 100)}%). Non sostituisce i gate del modello e non produce probabilita.`,
  };
}
