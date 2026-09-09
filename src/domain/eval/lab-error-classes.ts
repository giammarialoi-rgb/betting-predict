/**
 * Extended error taxonomy for Blind Market Lab (TASK 013).
 */

export const LAB_ERROR_CLASSES = [
  "ERROR_FORM",
  "ERROR_ELO",
  "ERROR_MARKET",
  "ERROR_DATA",
  "ERROR_TEMPORAL",
  "ERROR_CALIBRATION",
  "ERROR_MODEL",
  "ERROR_ENTITY",
  "ERROR_SAMPLE",
  "ERROR_UNKNOWN",
] as const;

export type LabErrorClass = (typeof LAB_ERROR_CLASSES)[number];

export function classifyLabError(input: {
  predicted: string;
  actual: string;
  features?: ReadonlyArray<{ featureKey: string; featureStatus: string }>;
  temporalViolation?: boolean;
  entityAmbiguous?: boolean;
  sampleSize?: number;
  marketShock?: boolean;
}): { error_class: LabErrorClass; notes: string[] } {
  if (input.temporalViolation) {
    return { error_class: "ERROR_TEMPORAL", notes: ["temporal_violation"] };
  }
  if (input.entityAmbiguous) {
    return { error_class: "ERROR_ENTITY", notes: ["entity_ambiguous"] };
  }
  if ((input.sampleSize ?? 999) < 10) {
    return { error_class: "ERROR_SAMPLE", notes: ["low_sample"] };
  }
  if (input.marketShock) {
    return { error_class: "ERROR_MARKET", notes: ["market_shock"] };
  }
  const missing = (input.features ?? []).filter(
    (f) => f.featureStatus === "MISSING" || f.featureStatus === "TEMPORAL_UNKNOWN",
  );
  if (missing.length >= 3) {
    return {
      error_class: "ERROR_DATA",
      notes: missing.map((m) => m.featureKey),
    };
  }
  const formMissing = missing.some((m) => m.featureKey.includes("form"));
  if (formMissing) return { error_class: "ERROR_FORM", notes: ["form_missing"] };
  const eloMissing = missing.some((m) => m.featureKey.includes("elo"));
  if (eloMissing) return { error_class: "ERROR_ELO", notes: ["elo_missing"] };
  if (input.predicted !== input.actual) {
    return { error_class: "ERROR_MODEL", notes: ["argmax_mismatch"] };
  }
  return { error_class: "ERROR_UNKNOWN", notes: [] };
}
