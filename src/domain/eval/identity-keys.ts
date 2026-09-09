export function buildEventOutcomeIdentityKey(input: {
  eventId: string;
  homeScore: number;
  awayScore: number;
  resultCode: string;
  availableAt: Date;
}): string {
  return [
    input.eventId,
    input.homeScore,
    input.awayScore,
    input.resultCode,
    input.availableAt.toISOString(),
  ].join("|");
}

export function buildEloSnapshotIdentityKey(input: {
  teamId: string;
  snapshotAt: Date;
  rating: string;
  provenance: string;
}): string {
  return [
    input.teamId,
    input.snapshotAt.toISOString(),
    input.rating,
    input.provenance,
  ].join("|");
}

export function buildFeatureObservationIdentityKey(input: {
  eventId: string;
  featureKey: string;
  availableAt: Date;
  featureStatus: string;
  valueFingerprint: string;
}): string {
  return [
    input.eventId,
    input.featureKey,
    input.availableAt.toISOString(),
    input.featureStatus,
    input.valueFingerprint,
  ].join("|");
}

export function resultCodeFromScores(
  homeScore: number,
  awayScore: number,
): "HOME" | "DRAW" | "AWAY" {
  if (homeScore > awayScore) return "HOME";
  if (homeScore < awayScore) return "AWAY";
  return "DRAW";
}
