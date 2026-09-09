/**
 * Correlation exposure guard — prevent over-concentration on one match.
 */

import {
  buildCorrelationClusters,
  maxClusterExposure,
  type ExposureSelection,
} from "@/domain/risk/correlation-exposure";

export type CorrelationGuardResult = {
  allowed: boolean;
  proposedStake: number;
  cappedStake: number;
  clusterExposureAfter: number;
  reason: string;
};

export function correlationExposureGuard(input: {
  openSelections: readonly ExposureSelection[];
  candidate: ExposureSelection;
  bankroll: number;
  maxClusterFraction: number;
}): CorrelationGuardResult {
  const maxAbs = input.bankroll * input.maxClusterFraction;
  const withCandidate = [...input.openSelections, input.candidate];
  const clusters = buildCorrelationClusters(withCandidate);
  const eventCluster = clusters.find((c) =>
    c.selections.some((s) => s.eventId === input.candidate.eventId),
  );
  const clusterExp = eventCluster?.total_exposure ?? input.candidate.stake;
  if (clusterExp <= maxAbs) {
    return {
      allowed: true,
      proposedStake: input.candidate.stake,
      cappedStake: input.candidate.stake,
      clusterExposureAfter: clusterExp,
      reason: "within_correlation_cap",
    };
  }
  const others = (eventCluster?.selections ?? [])
    .filter(
      (s) =>
        !(
          s.eventId === input.candidate.eventId &&
          s.market === input.candidate.market &&
          s.selection === input.candidate.selection
        ),
    )
    .reduce((a, s) => a + s.stake, 0);
  const room = Math.max(0, maxAbs - others);
  return {
    allowed: room > 0,
    proposedStake: input.candidate.stake,
    cappedStake: Math.min(input.candidate.stake, room),
    clusterExposureAfter: others + Math.min(input.candidate.stake, room),
    reason:
      room > 0
        ? "capped_by_correlation_guard"
        : "NO_POSITION: correlation_cap_exhausted",
  };
}

export { maxClusterExposure, buildCorrelationClusters };
