import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FootballDataOrgNormalizer,
  normalizeFootballDataOrg,
} from "./normalizer";

const lastUpdated = "2026-09-06T11:00:00Z";

describe("FootballDataOrgNormalizer", () => {
  it("keeps only PL and SA from the competitions list", () => {
    const batch = normalizeFootballDataOrg("leagues", {
      competitions: [
        {
          id: 2021,
          name: "Premier League",
          code: "PL",
          area: { name: "England" },
          currentSeason: { startDate: "2025-08-15" },
          lastUpdated,
        },
        {
          id: 2002,
          name: "Bundesliga",
          code: "BL1",
          area: { name: "Germany" },
        },
        {
          id: 2019,
          name: "Serie A",
          code: "SA",
          area: { name: "Italy" },
        },
      ],
    });

    assert.deepEqual(
      batch.competitions.map((item) => item.providerEntityId),
      ["2021", "2019"],
    );
    assert.equal(batch.competitions[0]?.sourcePublishedAt?.toISOString(), "2026-09-06T11:00:00.000Z");
  });

  it("normalizes teams without using the team name as an identifier", () => {
    const batch = new FootballDataOrgNormalizer().normalize("teams", {
      competition: { id: 2019, name: "Serie A", code: "SA" },
      teams: [
        { id: 108, name: "FC Internazionale Milano", area: { name: "Italy" } },
        { id: 98, name: "AC Milan", area: { name: "Italy" } },
      ],
    });

    assert.deepEqual(
      batch.teams.map((item) => item.providerEntityId),
      ["108", "98"],
    );
    assert.equal(batch.teams[0]?.name, "FC Internazionale Milano");
    assert.equal(batch.competitions[0]?.providerEntityId, "2019");
  });

  it("normalizes matches and does not invent sourcePublishedAt", () => {
    const withStamp = normalizeFootballDataOrg("fixtures", {
      matches: [
        {
          id: 1,
          utcDate: "2026-09-06T18:00:00Z",
          status: "TIMED",
          lastUpdated,
          competition: { id: 2021, name: "Premier League", code: "PL" },
          homeTeam: { id: 57, name: "Arsenal FC" },
          awayTeam: { id: 65, name: "Manchester City FC" },
        },
        {
          id: 2,
          utcDate: "2026-09-06T19:00:00Z",
          status: "SCHEDULED",
          competition: { id: 2002, name: "Bundesliga", code: "BL1" },
          homeTeam: { id: 5, name: "Bayern" },
          awayTeam: { id: 4, name: "Dortmund" },
        },
        {
          id: 3,
          utcDate: "not-a-date",
          status: "SCHEDULED",
          competition: { id: 2021, name: "Premier League", code: "PL" },
          homeTeam: { id: 57, name: "Arsenal FC" },
          awayTeam: { id: 65, name: "Manchester City FC" },
        },
      ],
    });

    assert.equal(withStamp.events.length, 1);
    assert.equal(withStamp.events[0]?.providerEntityId, "1");
    assert.equal(withStamp.events[0]?.homeTeamProviderId, "57");
    assert.equal(
      withStamp.events[0]?.sourcePublishedAt?.toISOString(),
      "2026-09-06T11:00:00.000Z",
    );

    const withoutStamp = normalizeFootballDataOrg("fixtures", {
      matches: [
        {
          id: 4,
          utcDate: "2026-09-06T18:00:00Z",
          status: "SCHEDULED",
          competition: { id: 2021, name: "Premier League", code: "PL" },
          homeTeam: { id: 57, name: "Arsenal FC" },
          awayTeam: { id: 65, name: "Manchester City FC" },
        },
      ],
    });
    assert.equal(withoutStamp.events[0]?.sourcePublishedAt ?? null, null);
  });
});
