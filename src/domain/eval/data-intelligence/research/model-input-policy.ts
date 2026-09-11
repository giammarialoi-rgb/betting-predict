/**
 * Explicit independent-model input policy.
 * MARKET / POST_KICKOFF / UNVERIFIED / scrape CONTEXT never enter the vector.
 */
export type ModelInputClass =
  | "REAL_EVENT_DATA"
  | "HISTORICAL_PRIOR"
  | "DERIVED"
  | "MARKET"
  | "POST_KICKOFF"
  | "UNVERIFIED"
  | "CONFLICTED"
  | "CONTEXT"
  | "EXCLUDED_TEMPORAL";

export function classifyModelInput(input: {
  kind?: string | null;
  source?: string | null;
  available_at?: string | null;
  asOf?: string | null;
  kickoff?: string | null;
  market_layer?: boolean;
  temporal_valid?: boolean;
  conflicted?: boolean;
  verified?: boolean;
}): ModelInputClass {
  if (input.market_layer || input.source === "the-odds-api" || input.kind === "MARKET") return "MARKET";
  if (
    input.kind === "CONTEXT" ||
    input.source === "thesportsdb" ||
    input.source === "wikipedia" ||
    input.source === "ansa" ||
    input.source === "sky-sport" ||
    input.source === "bbc-sport" ||
    input.source === "gazzetta" ||
    input.source === "open-meteo"
  ) {
    return "CONTEXT";
  }
  if (input.temporal_valid === false) return "EXCLUDED_TEMPORAL";
  const asOf = input.asOf ? Date.parse(input.asOf) : NaN;
  const avail = input.available_at ? Date.parse(input.available_at) : NaN;
  const ko = input.kickoff ? Date.parse(input.kickoff) : NaN;
  if (Number.isFinite(asOf) && Number.isFinite(ko) && asOf >= ko) return "POST_KICKOFF";
  if (Number.isFinite(avail) && Number.isFinite(asOf) && avail > asOf) return "EXCLUDED_TEMPORAL";
  if (Number.isFinite(avail) && Number.isFinite(ko) && avail >= ko) return "POST_KICKOFF";
  if (input.verified === false) return "UNVERIFIED";
  if (input.conflicted) return "CONFLICTED";
  if (input.kind === "EVENT_RESEARCH") return "REAL_EVENT_DATA";
  if (input.kind === "DERIVED") return "DERIVED";
  return "HISTORICAL_PRIOR";
}

export function isEligibleForIndependentModel(cls: ModelInputClass): boolean {
  return cls === "REAL_EVENT_DATA" || cls === "HISTORICAL_PRIOR" || cls === "DERIVED";
}
