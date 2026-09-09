/**
 * Stat / prop capability placeholders — no invented observations.
 */

export const STAT_CAPABILITIES = [
  "goals",
  "corners",
  "cards",
  "shots",
  "shots_on_target",
  "offsides",
  "fouls",
  "possession",
  "passes",
  "xg",
  "player_shots",
  "player_goals",
  "player_assists",
  "player_cards",
  "player_minutes",
] as const;

export type StatCapability = (typeof STAT_CAPABILITIES)[number];

export type StatObservationContract = {
  capability: StatCapability;
  event_time: Date | null;
  observed_at: Date | null;
  available_at: Date | null;
  ingested_at: Date | null;
  temporal_precision: "exact" | "unknown" | "dataset_window";
  source: string;
  raw_payload_ref: string | null;
  value: number | null;
  status: "CATALOGUED" | "OBSERVED" | "MISSING";
};

export function cataloguedStatPlaceholders(
  source = "capability_registry",
): StatObservationContract[] {
  return STAT_CAPABILITIES.map((capability) => ({
    capability,
    event_time: null,
    observed_at: null,
    available_at: null,
    ingested_at: null,
    temporal_precision: "unknown",
    source,
    raw_payload_ref: null,
    value: null,
    status: "CATALOGUED",
  }));
}

export function assertStatUsableInStrict(
  obs: StatObservationContract,
): void {
  if (obs.status !== "OBSERVED") {
    throw new Error(`STAT_NOT_OBSERVED: ${obs.capability}`);
  }
  if (obs.temporal_precision === "unknown" || obs.available_at == null) {
    throw new Error(`STAT_TEMPORAL_UNKNOWN: ${obs.capability}`);
  }
}
