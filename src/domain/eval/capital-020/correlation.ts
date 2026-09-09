/**
 * Correlation V1: rho is UNKNOWN — conservative same-event cap.
 * Never invent numeric rho.
 */

export type ClusterKey = {
  eventId: string;
  family: string;
};

export function marketFamily(marketType: string): string {
  if (marketType === "1X2" || marketType === "DNB" || marketType === "DC") {
    return "match_result";
  }
  if (marketType === "TOTAL_GOALS" || marketType === "BTTS" || marketType === "TEAM_GOALS") {
    return "goals";
  }
  if (marketType === "ASIAN_HANDICAP" || marketType === "EH") {
    return "handicap";
  }
  return marketType;
}

export const RHO = "UNKNOWN" as const;

export function conservativeSameEventCap(input: {
  bankroll: number;
  maxClusterFraction: number;
  openSameEventExposure: number;
  proposed: number;
}): { stake: number; reason: string } {
  const cap = input.bankroll * input.maxClusterFraction;
  const room = Math.max(0, cap - input.openSameEventExposure);
  const stake = Math.min(input.proposed, room, input.bankroll);
  if (stake <= 1e-12) {
    return { stake: 0, reason: "NO_BET_RISK: rho_UNKNOWN_same_event_cap" };
  }
  return { stake, reason: "capped_rho_UNKNOWN" };
}
