/**
 * Typed player availability. Absence is never inferred from a missing name on a page.
 */
export type AvailabilityStatus =
  | "INJURED"
  | "SUSPENDED"
  | "DOUBTFUL"
  | "AVAILABLE"
  | "RETURNING"
  | "UNKNOWN";

export type PlayerAvailabilityObservation = {
  team: string;
  player: string;
  status: AvailabilityStatus;
  reason: string | null;
  source: string;
  observed_at: string;
  available_at: string | null;
  confidence: number | null;
  is_pre_match: boolean;
};

export function availabilityFromApiSportsInjury(input: {
  team: string;
  player: string;
  reason?: string | null;
  type?: string | null;
  source: string;
  observed_at: string;
  available_at: string | null;
  kickoffIso: string;
}): PlayerAvailabilityObservation {
  const hay = `${input.type ?? ""} ${input.reason ?? ""}`.toLowerCase();
  let status: AvailabilityStatus = "INJURED";
  if (/suspen|squal|red card|ban/.test(hay)) status = "SUSPENDED";
  else if (/doubt|question/.test(hay)) status = "DOUBTFUL";
  else if (/return|fit/.test(hay)) status = "RETURNING";
  const ko = Date.parse(input.kickoffIso);
  const asOf = input.available_at ? Date.parse(input.available_at) : Date.parse(input.observed_at);
  return {
    team: input.team,
    player: input.player,
    status,
    reason: input.reason ?? input.type ?? null,
    source: input.source,
    observed_at: input.observed_at,
    available_at: input.available_at,
    confidence: null,
    is_pre_match: Number.isFinite(ko) && Number.isFinite(asOf) ? asOf <= ko : true,
  };
}
