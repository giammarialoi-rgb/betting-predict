import type { SynthesisResult } from "@/domain/eval/data-intelligence/types";

export type SynthesisInputFact = {
  source_id: string;
  field: string;
  value: string | number | null;
  weight?: number;
};

/**
 * Multi-source agreement / conflict. No majority vote inventing truth.
 * Discordant critical fields → CONFLICT + FEATURE_QUALITY=LOW.
 */
export function synthesizePrematchFacts(input: {
  eventId: string;
  facts: readonly SynthesisInputFact[];
  dataCoverage?: number | null;
  timestampQuality?: number;
}): SynthesisResult {
  const byField = new Map<string, SynthesisInputFact[]>();
  for (const f of input.facts) {
    if (f.value == null || f.value === "") continue;
    const arr = byField.get(f.field) ?? [];
    arr.push(f);
    byField.set(f.field, arr);
  }

  const sources = new Set(input.facts.map((f) => f.source_id));
  const source_count = sources.size;
  const conflicts: SynthesisResult["conflicts"] = [];
  let agreeFields = 0;
  let comparedFields = 0;

  for (const [field, rows] of byField) {
    if (rows.length < 2) continue;
    comparedFields += 1;
    const norms = rows.map((r) => String(r.value).toLowerCase().replace(/\s+/g, ""));
    const unique = new Set(norms);
    if (unique.size > 1) {
      conflicts.push({
        field,
        sources: rows.map((r) => r.source_id),
        detail: `values=${[...unique].join("|")}`,
      });
    } else {
      agreeFields += 1;
    }
  }

  const source_agreement =
    comparedFields === 0 ? (source_count <= 1 ? 1 : 0.5) : agreeFields / comparedFields;

  let status: SynthesisResult["status"] = "INSUFFICIENT";
  if (source_count === 0) status = "INSUFFICIENT";
  else if (source_count === 1) status = "SINGLE_SOURCE";
  else if (conflicts.length > 0) status = "CONFLICT";
  else status = "AGREE";

  const feature_quality: SynthesisResult["feature_quality"] =
    status === "CONFLICT" || source_agreement < 0.6
      ? "LOW"
      : source_count >= 2 && source_agreement >= 0.85
        ? "HIGH"
        : "MEDIUM";

  const reason_codes: string[] = ["DATA_INTELLIGENCE_SYNTHESIS"];
  if (status === "CONFLICT") reason_codes.push("SOURCE_CONFLICT", "FEATURE_QUALITY_LOW");
  if (feature_quality === "LOW") reason_codes.push("FEATURE_QUALITY_LOW");
  if (status === "SINGLE_SOURCE") reason_codes.push("SINGLE_SOURCE");
  if ((input.dataCoverage ?? 1) < 0.4) reason_codes.push("DATA_COVERAGE_LOW");

  return {
    event_id: input.eventId,
    source_count,
    source_agreement: Math.round(source_agreement * 1000) / 1000,
    status,
    feature_quality,
    reason_codes: [...new Set(reason_codes)],
    conflicts,
    timestamp_quality: input.timestampQuality ?? 0,
    data_coverage: input.dataCoverage ?? null,
    real_money: false,
  };
}

/** Apply synthesis to confidence / DQ — never touches model probability. */
export function applySynthesisConfidenceAdjust(input: {
  confidence: number;
  dataQuality: number;
  synthesis: SynthesisResult;
}): { confidence: number; dataQuality: number; uncertain: boolean; codes: string[] } {
  let conf = input.confidence;
  let dq = input.dataQuality;
  let uncertain = false;
  const codes = [...input.synthesis.reason_codes];

  if (input.synthesis.feature_quality === "LOW") {
    conf = Math.max(10, conf - 12);
    dq = Math.max(0, dq - 0.1);
    uncertain = true;
  } else if (input.synthesis.feature_quality === "HIGH") {
    conf = Math.min(95, conf + 3);
    dq = Math.min(1, dq + 0.02);
  }
  if (input.synthesis.reason_codes.includes("DATA_COVERAGE_LOW")) {
    conf = Math.max(10, conf - 8);
    uncertain = true;
  }
  return {
    confidence: Math.round(conf),
    dataQuality: Math.round(dq * 1000) / 1000,
    uncertain,
    codes,
  };
}
