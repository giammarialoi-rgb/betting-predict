import type { SourceObservation } from "./agreement";

const T1 = new Date("2026-09-06T12:00:00.000Z");
const T2 = new Date("2026-09-06T13:00:00.000Z");
const KICKOFF = new Date("2026-09-06T20:00:00.000Z");
const KICKOFF_B = new Date("2026-09-06T20:30:00.000Z");

function eventObservation(
  source: string,
  providerEntityId: string,
  availableAt: Date,
  fields: SourceObservation["fields"],
): SourceObservation {
  return {
    source,
    entityType: "event",
    providerEntityId,
    canonicalId: "canonical-event-1",
    observedAt: availableAt,
    availableAt,
    fields,
  };
}

const identity = {
  competitionCanonicalId: "comp-1",
  homeTeamCanonicalId: "home-1",
  awayTeamCanonicalId: "away-1",
};

export function agreementObservations(): {
  left: SourceObservation;
  right: SourceObservation;
} {
  const fields = {
    ...identity,
    scheduledStartAt: KICKOFF,
    status: "SCHEDULED",
  };
  return {
    left: eventObservation("api-football", "a-1", T1, fields),
    right: eventObservation("football-data-org", "b-1", T1, fields),
  };
}

export function disagreementObservations(): {
  left: SourceObservation;
  right: SourceObservation;
} {
  return {
    left: eventObservation("api-football", "a-1", T1, {
      ...identity,
      scheduledStartAt: KICKOFF,
      status: "SCHEDULED",
    }),
    right: eventObservation("football-data-org", "b-1", T1, {
      ...identity,
      scheduledStartAt: KICKOFF_B,
      status: "SCHEDULED",
    }),
  };
}

export function missingObservations(): {
  left: SourceObservation;
  right: null;
} {
  return {
    left: eventObservation("api-football", "a-1", T1, {
      ...identity,
      scheduledStartAt: KICKOFF,
      status: "SCHEDULED",
    }),
    right: null,
  };
}

export function temporalChangeObservations(): {
  left: SourceObservation;
  right: SourceObservation;
} {
  return {
    left: eventObservation("api-football", "a-1", T1, {
      ...identity,
      scheduledStartAt: KICKOFF,
      status: "SCHEDULED",
    }),
    right: eventObservation("football-data-org", "b-1", T2, {
      ...identity,
      scheduledStartAt: KICKOFF,
      status: "POSTPONED",
    }),
  };
}

export const SCENARIO_TIMESTAMPS = { T1, T2, KICKOFF, KICKOFF_B };
