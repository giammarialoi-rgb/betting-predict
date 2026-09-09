import type { PrematchFeatureObservation, SourceObservation } from "@/domain/eval/data-intelligence/types";
import type { FeatureDatum } from "@/domain/eval/predictive-intelligence/types";

/** Classify observation against decision asOf — never invent available_at. */
export function classifyObservationAsOf(
  obs: Pick<SourceObservation, "available_at"> | Pick<PrematchFeatureObservation, "available_at">,
  asOf: string,
): "ELIGIBLE" | "NOT_ELIGIBLE" {
  if (!obs.available_at) return "NOT_ELIGIBLE";
  const t = Date.parse(obs.available_at);
  const a = Date.parse(asOf);
  if (!Number.isFinite(t) || !Number.isFinite(a)) return "NOT_ELIGIBLE";
  return t <= a ? "ELIGIBLE" : "NOT_ELIGIBLE";
}

export function observationBlockedFuture(availableAt: string | null, asOf: string): boolean {
  if (!availableAt) return true;
  return classifyObservationAsOf({ available_at: availableAt }, asOf) === "NOT_ELIGIBLE";
}

/**
 * Map a prematch observation → FeatureDatum.
 * ELIGIBLE only if available_at < decisionTime, precision ≠ unknown, numeric value, and enters_independent_model.
 */
export function toFeatureDatum(
  obs: PrematchFeatureObservation,
  decisionTime: string,
): FeatureDatum {
  const precision =
    obs.timestamp_precision === "datetime"
      ? ("STRICT_AS_OF" as const)
      : obs.timestamp_precision === "date"
        ? ("DATE_ONLY" as const)
        : ("UNKNOWN" as const);

  if (!obs.enters_independent_model) {
    return {
      key: obs.feature_name,
      source: obs.source_id,
      event_id: obs.event_id,
      available_at: obs.available_at,
      feature_time: obs.feature_time ?? decisionTime,
      value: null,
      quality: 0,
      status: "NOT_ELIGIBLE",
      temporal_precision: precision,
    };
  }

  if (precision === "UNKNOWN" || !obs.available_at) {
    return {
      key: obs.feature_name,
      source: obs.source_id,
      event_id: obs.event_id,
      available_at: null,
      feature_time: obs.feature_time ?? decisionTime,
      value: null,
      quality: null,
      status: obs.feature_value == null ? "UNAVAILABLE" : "NOT_ELIGIBLE",
      temporal_precision: precision,
    };
  }

  const asOfOk = classifyObservationAsOf(obs, decisionTime) === "ELIGIBLE";
  const num =
    typeof obs.feature_value === "number"
      ? obs.feature_value
      : typeof obs.feature_value === "boolean"
        ? obs.feature_value
          ? 1
          : 0
        : null;

  if (!asOfOk || num == null || !Number.isFinite(num)) {
    return {
      key: obs.feature_name,
      source: obs.source_id,
      event_id: obs.event_id,
      available_at: obs.available_at,
      feature_time: obs.feature_time ?? decisionTime,
      value: null,
      quality: 0,
      status: "NOT_ELIGIBLE",
      temporal_precision: precision,
    };
  }

  return {
    key: obs.feature_name,
    source: obs.source_id,
    event_id: obs.event_id,
    available_at: obs.available_at,
    feature_time: obs.feature_time ?? decisionTime,
    value: num,
    quality: obs.quality === "conflict" || obs.quality === "low_confidence" ? 0.5 : 1,
    status: "ELIGIBLE",
    temporal_precision: precision,
  };
}

export function prematchFromSourceObservation(
  o: SourceObservation,
  opts?: { enters_independent_model?: boolean; feature_time?: string | null },
): PrematchFeatureObservation {
  return {
    event_id: o.event_id,
    event_time: o.event_time,
    source_id: o.source_id,
    feature_name: o.key,
    feature_value: o.value,
    source_published_at: o.available_at,
    retrieved_at: o.retrieved_at,
    available_at: o.available_at,
    feature_time: opts?.feature_time ?? o.available_at,
    quality:
      o.status === "ELIGIBLE"
        ? "ok"
        : o.status === "NOT_ELIGIBLE"
          ? "not_eligible"
          : o.status === "UNAVAILABLE"
            ? "missing"
            : "unknown",
    timestamp_precision: o.timestamp_precision,
    enters_independent_model: opts?.enters_independent_model ?? o.enters_independent_model,
    legal_status: o.legal_status,
  };
}
