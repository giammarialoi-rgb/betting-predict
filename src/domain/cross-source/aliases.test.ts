import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { VERIFIED_ENTITY_ALIASES, findAliasPartners } from "./aliases";

describe("verified entity aliases", () => {
  it("links official Premier League and Serie A ids across providers", () => {
    const fromFd = findAliasPartners("football-data-org", "competition", "2021");
    assert.ok(fromFd.some((item) => item.source === "api-football" && item.providerEntityId === "39"));
    assert.ok(fromFd.some((item) => item.source === "football-data-org" && item.providerEntityId === "PL"));

    const fromApi = findAliasPartners("api-football", "competition", "39");
    assert.ok(
      fromApi.some(
        (item) => item.source === "football-data-org" && item.providerEntityId === "2021",
      ),
    );

    const serieA = findAliasPartners("football-data-org", "competition", "SA");
    assert.ok(serieA.some((item) => item.source === "api-football" && item.providerEntityId === "135"));
  });

  it("does not invent team aliases from names such as Inter", () => {
    assert.equal(
      VERIFIED_ENTITY_ALIASES.some((item) => item.entityType === "team"),
      false,
    );
    assert.deepEqual(findAliasPartners("api-football", "team", "505"), []);
    assert.deepEqual(findAliasPartners("football-data-org", "team", "108"), []);
  });
});
