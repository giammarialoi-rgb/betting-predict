import { assertAsOf } from "../../lib/as-of";

export type AgreementStatus =
  | "AGREE"
  | "DISAGREE"
  | "UNKNOWN"
  | "CONFLICT"
  | "MISSING";

export type FieldComparisonStatus = "same" | "different" | "missing";

export type EventObservationFields = {
  competitionCanonicalId: string | null;
  homeTeamCanonicalId: string | null;
  awayTeamCanonicalId: string | null;
  scheduledStartAt: Date | null;
  status: string | null;
};

export type SourceObservation = {
  source: string;
  entityType: "competition" | "team" | "event";
  providerEntityId: string;
  canonicalId: string | null;
  observedAt: Date;
  availableAt: Date;
  fields: EventObservationFields;
};

export type FieldComparison = {
  field: keyof EventObservationFields;
  status: FieldComparisonStatus;
  left: unknown;
  right: unknown;
};

export type SourceAgreement = {
  status: AgreementStatus;
  fields: FieldComparison[];
};

export type CanonicalEventCandidate = {
  canonicalId: string;
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledStartAt: Date;
  status: string;
};

export type ProviderEventSignal = {
  competitionCanonicalId: string | null;
  homeTeamCanonicalId: string | null;
  awayTeamCanonicalId: string | null;
  scheduledStartAt: Date;
};

const DEFAULT_TIME_TOLERANCE_MS = 2 * 60 * 60 * 1000;

export function findPotentialEventMatches(
  input: ProviderEventSignal,
  candidates: readonly CanonicalEventCandidate[],
  toleranceMs = DEFAULT_TIME_TOLERANCE_MS,
): CanonicalEventCandidate[] {
  if (
    !input.competitionCanonicalId ||
    !input.homeTeamCanonicalId ||
    !input.awayTeamCanonicalId
  ) {
    return [];
  }

  return candidates.filter((candidate) => {
    if (candidate.competitionId !== input.competitionCanonicalId) {
      return false;
    }
    if (candidate.homeTeamId !== input.homeTeamCanonicalId) {
      return false;
    }
    if (candidate.awayTeamId !== input.awayTeamCanonicalId) {
      return false;
    }
    return (
      Math.abs(
        candidate.scheduledStartAt.getTime() - input.scheduledStartAt.getTime(),
      ) <= toleranceMs
    );
  });
}

export function observationsAsOf(
  asOf: Date,
  observations: readonly SourceObservation[],
): SourceObservation[] {
  return observations.filter((item) => {
    try {
      assertAsOf(asOf, item.availableAt);
      return true;
    } catch {
      return false;
    }
  });
}

export function compareEventObservations(
  left: SourceObservation,
  right: SourceObservation | null,
): SourceAgreement {
  if (!right) {
    return { status: "MISSING", fields: [] };
  }

  const fields: FieldComparison[] = [
    compareField("competitionCanonicalId", left.fields, right.fields),
    compareField("homeTeamCanonicalId", left.fields, right.fields),
    compareField("awayTeamCanonicalId", left.fields, right.fields),
    compareTime("scheduledStartAt", left.fields, right.fields),
    compareField("status", left.fields, right.fields),
  ];

  const identityKnown =
    Boolean(left.fields.homeTeamCanonicalId) &&
    Boolean(right.fields.homeTeamCanonicalId) &&
    Boolean(left.fields.awayTeamCanonicalId) &&
    Boolean(right.fields.awayTeamCanonicalId);

  if (!identityKnown) {
    return { status: "UNKNOWN", fields };
  }

  const statusPair = [left.fields.status, right.fields.status];
  const temporalConflict =
    statusPair.includes("POSTPONED") &&
    statusPair.some((value) => value === "SCHEDULED" || value === "TIMED" || value === "NS");

  if (temporalConflict) {
    return { status: "CONFLICT", fields };
  }

  if (fields.some((field) => field.status === "different")) {
    return { status: "DISAGREE", fields };
  }

  if (fields.some((field) => field.status === "missing")) {
    return { status: "UNKNOWN", fields };
  }

  return { status: "AGREE", fields };
}

function compareField(
  field: keyof EventObservationFields,
  left: EventObservationFields,
  right: EventObservationFields,
): FieldComparison {
  const leftValue = left[field];
  const rightValue = right[field];
  if (leftValue == null || rightValue == null) {
    return { field, status: "missing", left: leftValue, right: rightValue };
  }
  return {
    field,
    status: Object.is(leftValue, rightValue) ? "same" : "different",
    left: leftValue,
    right: rightValue,
  };
}

function compareTime(
  field: "scheduledStartAt",
  left: EventObservationFields,
  right: EventObservationFields,
): FieldComparison {
  const leftValue = left[field];
  const rightValue = right[field];
  if (!leftValue || !rightValue) {
    return { field, status: "missing", left: leftValue, right: rightValue };
  }
  return {
    field,
    status: leftValue.getTime() === rightValue.getTime() ? "same" : "different",
    left: leftValue,
    right: rightValue,
  };
}
