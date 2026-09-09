import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareEventObservations,
  findPotentialEventMatches,
  observationsAsOf,
} from "./agreement";
import {
  SCENARIO_TIMESTAMPS,
  agreementObservations,
  disagreementObservations,
  missingObservations,
  temporalChangeObservations,
} from "./scenarios";
import { mockCrossSourceScenario } from "../../providers/mock/adapter";

const { T1, T2, KICKOFF } = SCENARIO_TIMESTAMPS;

describe("cross-source agreement", () => {
  it("represents agreement, disagreement, and missing without a reliability score", () => {
    const agree = compareEventObservations(
      agreementObservations().left,
      agreementObservations().right,
    );
    assert.equal(agree.status, "AGREE");
    assert.ok(agree.fields.every((field) => field.status === "same"));

    const disagree = compareEventObservations(
      disagreementObservations().left,
      disagreementObservations().right,
    );
    assert.equal(disagree.status, "DISAGREE");
    const kickoff = disagree.fields.find((field) => field.field === "scheduledStartAt");
    assert.equal(kickoff?.status, "different");

    const missing = compareEventObservations(missingObservations().left, null);
    assert.equal(missing.status, "MISSING");

    const fromMock = mockCrossSourceScenario("agreement");
    assert.equal(
      compareEventObservations(fromMock.left, fromMock.right).status,
      "AGREE",
    );
  });

  it("records temporal conflict instead of declaring a source wrong", () => {
    const { left, right } = temporalChangeObservations();
    const agreement = compareEventObservations(left, right);
    assert.equal(agreement.status, "CONFLICT");
    const status = agreement.fields.find((field) => field.field === "status");
    assert.equal(status?.status, "different");
    assert.equal(status?.left, "SCHEDULED");
    assert.equal(status?.right, "POSTPONED");
  });

  it("hides T2 knowledge from an AS OF T1 query", () => {
    const { left, right } = temporalChangeObservations();
    const asOfT1 = observationsAsOf(T1, [left, right]);
    assert.deepEqual(
      asOfT1.map((item) => item.source),
      ["api-football"],
    );
    assert.equal(asOfT1.some((item) => item.fields.status === "POSTPONED"), false);

    const asOfT2 = observationsAsOf(T2, [left, right]);
    assert.equal(asOfT2.length, 2);
    assert.ok(asOfT2.some((item) => item.fields.status === "POSTPONED"));
  });

  it("finds deterministic event candidates and refuses ambiguous matches", () => {
    const candidates = [
      {
        canonicalId: "e1",
        competitionId: "comp-1",
        homeTeamId: "home-1",
        awayTeamId: "away-1",
        scheduledStartAt: KICKOFF,
        status: "SCHEDULED",
      },
      {
        canonicalId: "e2",
        competitionId: "comp-1",
        homeTeamId: "home-1",
        awayTeamId: "away-1",
        scheduledStartAt: new Date("2026-09-06T20:30:00.000Z"),
        status: "SCHEDULED",
      },
    ];

    const exact = findPotentialEventMatches(
      {
        competitionCanonicalId: "comp-1",
        homeTeamCanonicalId: "home-1",
        awayTeamCanonicalId: "away-1",
        scheduledStartAt: KICKOFF,
      },
      candidates,
      0,
    );
    assert.deepEqual(
      exact.map((item) => item.canonicalId),
      ["e1"],
    );

    const ambiguous = findPotentialEventMatches(
      {
        competitionCanonicalId: "comp-1",
        homeTeamCanonicalId: "home-1",
        awayTeamCanonicalId: "away-1",
        scheduledStartAt: KICKOFF,
      },
      candidates,
      2 * 60 * 60 * 1000,
    );
    assert.equal(ambiguous.length, 2);

    const unknownTeams = findPotentialEventMatches(
      {
        competitionCanonicalId: "comp-1",
        homeTeamCanonicalId: null,
        awayTeamCanonicalId: "away-1",
        scheduledStartAt: KICKOFF,
      },
      candidates,
    );
    assert.deepEqual(unknownTeams, []);
  });
});
