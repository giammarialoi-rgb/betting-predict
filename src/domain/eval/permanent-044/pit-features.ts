/** Point-in-time feature store helpers — no look-ahead. */

export type PitFeature044 = {
  event_id: string;
  feature_name: string;
  feature_value: unknown;
  feature_available_at: string;
  event_date: string | null;
  model_version: string | null;
};

/** Reject features whose availability is after asOf. */
export function filterPitFeatures044(features: PitFeature044[], asOf: string): PitFeature044[] {
  const asOfMs = Date.parse(asOf);
  return features.filter((f) => {
    const t = Date.parse(f.feature_available_at);
    return Number.isFinite(t) && t <= asOfMs;
  });
}

export function assertNoLookahead044(features: PitFeature044[], asOf: string): void {
  const bad = features.filter((f) => Date.parse(f.feature_available_at) > Date.parse(asOf));
  if (bad.length) {
    throw new Error(`look_ahead_feature:${bad.map((b) => b.feature_name).join(",")}`);
  }
}
