import type { PrematchFeatureObservation, SynthesisResult } from "@/domain/eval/data-intelligence/types";
import { DI_MODEL_MERGE_KEYS } from "@/domain/eval/data-intelligence/feature-manifest";
import { toFeatureDatum } from "@/domain/eval/data-intelligence/observation";
import {
  synthesizePrematchFacts,
  applySynthesisConfidenceAdjust,
  type SynthesisInputFact,
} from "@/domain/eval/data-intelligence/synthesis";
import type { FeatureDatum, PiFeatureVector } from "@/domain/eval/predictive-intelligence/types";

/**
 * Sources that must never enter independent MODEL via the generic DI merge
 * (synthesizeFeatureBag / mergeDiIntoFeatureVector diFeatures path).
 * Understat is deliberately NOT here: its xG rolling priors get a dedicated,
 * ClubElo-style path (buildFeatureVectorPi's understatMatches opt) with its
 * own reconstructed available_at and STRICT_AS_OF gate -- see
 * data-intelligence/research/understat-league.ts.
 */
const CONTEXT_ONLY_SOURCES = new Set([
  "open-meteo",
  "fbref",
  "uefa",
  "sofascore",
  "directa",
  "flashscore",
  "soccerway",
  "the-odds-api",
]);

/** Preferred primary source per feature when conflict. */
const PRIMARY_SOURCE: Record<string, string> = {
  home_injuries_n: "api-sports",
  away_injuries_n: "api-sports",
  home_lineup_confirmed: "api-sports",
  away_lineup_confirmed: "api-sports",
  home_elo: "clubelo",
  away_elo: "clubelo",
  elo_diff: "clubelo",
};

export type FeatureBagSynthesis = {
  features: Map<string, FeatureDatum>;
  synthesis: SynthesisResult;
  reason_codes: string[];
  conflicts: SynthesisResult["conflicts"];
};

function normVal(v: number | string | boolean | null): string {
  if (v == null) return "";
  return String(v).toLowerCase().replace(/\s+/g, "");
}

/**
 * Multi-source observations → FeatureDatum map for MODEL merge keys.
 * Scrape/meteo/odds never promoted. Conflict → primary source + FEATURE_QUALITY_LOW.
 */
export function synthesizeFeatureBag(input: {
  eventId: string;
  decisionTime: string;
  observations: readonly PrematchFeatureObservation[];
  dataCoverage?: number | null;
}): FeatureBagSynthesis {
  const byKey = new Map<string, PrematchFeatureObservation[]>();
  for (const o of input.observations) {
    if (CONTEXT_ONLY_SOURCES.has(o.source_id)) continue;
    if (!DI_MODEL_MERGE_KEYS.has(o.feature_name)) continue;
    const arr = byKey.get(o.feature_name) ?? [];
    arr.push(o);
    byKey.set(o.feature_name, arr);
  }

  const features = new Map<string, FeatureDatum>();
  const conflicts: SynthesisResult["conflicts"] = [];
  const facts: SynthesisInputFact[] = [];

  for (const [key, rows] of byKey) {
    const modelRows = rows.filter((r) => r.enters_independent_model);
    if (!modelRows.length) {
      features.set(
        key,
        toFeatureDatum(
          {
            ...rows[0]!,
            enters_independent_model: false,
            quality: "not_eligible",
          },
          input.decisionTime,
        ),
      );
      continue;
    }

    const values = modelRows.map((r) => normVal(r.feature_value));
    const unique = new Set(values.filter(Boolean));
    let chosen = modelRows[0]!;
    const primary = PRIMARY_SOURCE[key];
    if (primary) {
      const pref = modelRows.find((r) => r.source_id === primary);
      if (pref) chosen = pref;
    }

    if (unique.size > 1) {
      conflicts.push({
        field: key,
        sources: modelRows.map((r) => r.source_id),
        detail: `values=${[...unique].join("|")}`,
      });
      chosen = {
        ...chosen,
        quality: "conflict",
      };
    }

    for (const r of modelRows) {
      facts.push({
        source_id: r.source_id,
        field: key,
        value: r.feature_value == null ? null : String(r.feature_value),
      });
    }

    features.set(key, toFeatureDatum(chosen, input.decisionTime));
  }

  const synthesis = synthesizePrematchFacts({
    eventId: input.eventId,
    facts,
    dataCoverage: input.dataCoverage ?? null,
    timestampQuality: 0.7,
  });

  // Merge explicit conflicts from feature map
  for (const c of conflicts) {
    if (!synthesis.conflicts.some((x) => x.field === c.field)) {
      synthesis.conflicts.push(c);
    }
  }
  if (conflicts.length > 0) {
    synthesis.status = "CONFLICT";
    synthesis.feature_quality = "LOW";
    if (!synthesis.reason_codes.includes("SOURCE_CONFLICT")) {
      synthesis.reason_codes.push("SOURCE_CONFLICT", "FEATURE_QUALITY_LOW");
    }
  }

  return {
    features,
    synthesis,
    reason_codes: [...new Set(synthesis.reason_codes)],
    conflicts: synthesis.conflicts,
  };
}

/**
 * Merge ELIGIBLE DI FeatureDatum into an existing PI feature vector (mutates copy).
 * Never copies odds/scrape/meteo. Replaces UNAVAILABLE stubs for injuries/lineups/elo.
 */
export function mergeDiIntoFeatureVector(
  base: PiFeatureVector,
  diFeatures: Map<string, FeatureDatum> | FeatureDatum[],
): PiFeatureVector {
  const map =
    diFeatures instanceof Map
      ? diFeatures
      : new Map(diFeatures.map((d) => [d.key, d] as const));

  const values = { ...base.values };
  const missing = new Set(base.missing_keys);
  const feature_data = [...base.feature_data];

  for (const [key, datum] of map) {
    if (!DI_MODEL_MERGE_KEYS.has(key)) continue;
    if (datum.status !== "ELIGIBLE" || datum.value == null || !Number.isFinite(datum.value)) {
      // Replace stub status but do not put in values
      const idx = feature_data.findIndex((f) => f.key === key);
      if (idx >= 0) feature_data[idx] = datum;
      else feature_data.push(datum);
      continue;
    }

    values[key] = datum.value;
    missing.delete(key);
    const idx = feature_data.findIndex((f) => f.key === key);
    if (idx >= 0) feature_data[idx] = datum;
    else feature_data.push(datum);
  }

  const modelKeys = Object.keys(values);
  const usable = feature_data.filter(
    (d) => modelKeys.includes(d.key) && d.status === "ELIGIBLE",
  );
  const feature_coverage = modelKeys.length ? usable.length / modelKeys.length : 0;
  const data_coverage = feature_coverage;
  const data_quality =
    Math.round(
      (usable.filter((d) => (d.quality ?? 0) >= 0.9).length / Math.max(1, usable.length)) * 1000,
    ) / 1000;

  return {
    ...base,
    values,
    missing_keys: [...missing],
    feature_data,
    feature_coverage: Math.round(feature_coverage * 1000) / 1000,
    data_coverage: Math.round(data_coverage * 1000) / 1000,
    data_quality,
  };
}

export function applyFeatureBagConfidenceAdjust(input: {
  confidence: number;
  dataQuality: number;
  bag: FeatureBagSynthesis;
}): ReturnType<typeof applySynthesisConfidenceAdjust> {
  return applySynthesisConfidenceAdjust({
    confidence: input.confidence,
    dataQuality: input.dataQuality,
    synthesis: input.bag.synthesis,
  });
}
