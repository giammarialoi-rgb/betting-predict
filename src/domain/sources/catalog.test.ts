import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSport } from "../sports/catalog";
import {
  assertCatalogIntegrity,
  findCandidateSources,
  getSource,
  getSourcesByCapability,
  getSourcesForSport,
  getSourcesForSportAndCapability,
  listSources,
} from "./catalog";
import {
  QUALITY_DIMENSIONS,
  SOURCE_CAPABILITIES,
  unknownQuality,
  type SourceCapability,
} from "./types";

describe("source intelligence catalog", () => {
  it("has unique machine-friendly ids", () => {
    const ids = listSources().map((item) => item.id);
    assert.ok(ids.length >= 24);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) {
      assert.match(id, /^[a-z0-9-]+$/);
    }
  });

  it("references only catalogued sports and valid capabilities", () => {
    assert.doesNotThrow(() => assertCatalogIntegrity());
    for (const item of listSources()) {
      for (const sportId of item.sports) {
        assert.ok(getSport(sportId), `${item.id} -> ${sportId}`);
      }
      for (const capability of item.capabilities) {
        assert.ok(
          (SOURCE_CAPABILITIES as readonly string[]).includes(capability),
        );
      }
    }
  });

  it("returns a source with getSource and undefined when missing", () => {
    assert.equal(getSource("clubelo")?.name, "ClubElo");
    assert.equal(getSource("not-a-source"), undefined);
  });

  it("lists football-data.org with verified free-tier capabilities only", () => {
    const source = getSource("football-data-org");
    assert.ok(source);
    assert.equal(source.sourceType, "api");
    assert.deepEqual([...source.capabilities], ["fixtures", "results"]);
    assert.equal(source.requiresAuth, true);
    assert.equal(source.freeTier, true);
    assert.equal(source.historicalData, "unknown");
    assert.equal(source.realtime, false);
    assert.equal(source.official, false);
    assert.equal(source.quality.reliability, "unknown");
  });

  it("filters by sport", () => {
    const football = getSourcesForSport("football");
    const tennis = getSourcesForSport("tennis");
    assert.ok(football.some((item) => item.id === "fbref"));
    assert.ok(tennis.every((item) => item.sports.includes("tennis")));
    assert.ok(tennis.some((item) => item.id === "tennis-explorer"));
    assert.equal(
      football.some((item) => item.id === "tennis-explorer"),
      false,
    );
  });

  it("filters by capability", () => {
    const elo = getSourcesByCapability("elo");
    assert.ok(elo.some((item) => item.id === "clubelo"));
    assert.ok(elo.every((item) => item.capabilities.includes("elo")));
  });

  it("filters by sport and capability together", () => {
    const rows = getSourcesForSportAndCapability(
      "football",
      "advanced_stats" as SourceCapability,
    );
    assert.ok(rows.some((item) => item.id === "fbref"));
    assert.ok(
      rows.every(
        (item) =>
          item.sports.includes("football") &&
          item.capabilities.includes("advanced_stats"),
      ),
    );
  });

  it("finds free candidate sources without HTTP", () => {
    const rows = findCandidateSources({
      sport: "football",
      capability: "elo",
      freeOnly: true,
    });
    assert.ok(rows.some((item) => item.id === "clubelo"));
    assert.ok(rows.every((item) => item.freeTier === true));

    const paidOpta = findCandidateSources({
      sport: "football",
      capability: "lineups",
      freeOnly: true,
    });
    assert.equal(
      paidOpta.some((item) => item.id === "opta-stats-perform"),
      false,
    );
  });

  it("keeps priority separate from reliability and assigns no invented scores", () => {
    const unknown = unknownQuality();
    for (const item of listSources()) {
      assert.notEqual(item.priority, item.quality.reliability);
      assert.equal(item.quality.reliability, "unknown");
      for (const dimension of QUALITY_DIMENSIONS) {
        assert.equal(item.quality[dimension], "unknown");
        assert.equal(typeof item.quality[dimension] === "number", false);
      }
      assert.deepEqual(item.quality, unknown);
      assert.equal(item.scrapingAllowed, "unknown");
    }
  });
});
