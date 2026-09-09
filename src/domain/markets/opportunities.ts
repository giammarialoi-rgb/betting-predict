/**
 * Future research entrypoint — NOT "safe bets".
 * Confidence must remain null until calibrated metrics exist.
 */

export type SupportedOpportunity = {
  eventId: string;
  marketId: string;
  line: number | null;
  selection: string;
  modelProbability: number | null;
  marketProbability: number | null;
  differencePp: number | null;
  uncertainty: number | null;
  dataCompleteness: number | null;
  temporalIntegrity: "STRICT" | "PARTIAL" | "BLOCKED";
  evidence: string[];
  contradictingEvidence: string[];
  /** Always null until a validated metric exists — never invent. */
  confidence: null;
};

export type FindBestSupportedOpportunitiesInput = {
  sportId: string;
  asOf: Date;
  limit?: number;
  /** Optional precomputed candidates from an upstream research pipeline. */
  candidates?: SupportedOpportunity[];
};

/**
 * Skeleton: returns filtered candidates only.
 * Does not invent probabilities or confidence.
 */
export function findBestSupportedOpportunities(
  input: FindBestSupportedOpportunitiesInput,
): SupportedOpportunity[] {
  const limit = input.limit ?? 10;
  const candidates = input.candidates ?? [];
  return candidates
    .filter((c) => c.temporalIntegrity !== "BLOCKED")
    .filter((c) => c.confidence === null)
    .slice(0, limit);
}
