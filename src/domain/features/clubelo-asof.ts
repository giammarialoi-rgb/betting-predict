/**
 * ClubElo asOf path — rating_date / available_at <= asOf only.
 */

import { selectEloAsOf, classifyEloProvenance } from "@/domain/features/elo";
import type { EloSnapshot, FeatureCell } from "@/domain/features/types";

export type ClubEloObservation = {
  teamId: string;
  rating: number;
  ratingDate: Date;
  availableAt: Date;
  provenance: EloSnapshot["provenance"];
};

export function toEloSnapshots(
  rows: readonly ClubEloObservation[],
): EloSnapshot[] {
  return rows.map((r) => ({
    clubKey: r.teamId,
    elo: r.rating,
    snapshotDate: r.ratingDate,
    provenance: r.provenance,
    availableAt: r.availableAt,
  }));
}

/**
 * Latest official ClubElo rating available at decision time.
 */
export function clubEloAsOf(input: {
  observations: readonly ClubEloObservation[];
  teamId: string;
  asOf: Date;
}): FeatureCell<number> {
  return selectEloAsOf({
    snapshots: toEloSnapshots(input.observations),
    clubKey: input.teamId,
    asOf: input.asOf,
    featureId: "clubelo_rating",
  });
}

export function assertClubEloNotAfterAsOf(
  availableAt: Date,
  asOf: Date,
): void {
  if (availableAt.getTime() > asOf.getTime()) {
    throw new Error("CLUBELO_LEAK: rating available_at after asOf");
  }
}

export function provenanceForClubEloDate(isoDate: string): EloSnapshot["provenance"] {
  return classifyEloProvenance(isoDate);
}
