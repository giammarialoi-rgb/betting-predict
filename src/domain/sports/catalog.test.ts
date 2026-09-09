import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSport, isEventType, listSports } from "./catalog";
import { EVENT_TYPES } from "./types";

describe("sport catalog", () => {
  it("has at least 13 sports with unique ids and names", () => {
    const sports = listSports();
    assert.ok(sports.length >= 13);
    const ids = sports.map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const item of sports) {
      assert.ok(item.id.length > 0);
      assert.ok(item.name.length > 0);
      assert.ok(isEventType(item.eventType));
      assert.ok((EVENT_TYPES as readonly string[]).includes(item.eventType));
    }
  });

  it("uses machine-friendly ids", () => {
    for (const item of listSports()) {
      assert.match(item.id, /^[a-z0-9-]+$/);
    }
  });

  it("returns a sport with getSport", () => {
    const football = getSport("football");
    assert.equal(football?.eventType, "team_vs_team");
    assert.equal(getSport("tennis")?.eventType, "individual_vs_individual");
    assert.equal(getSport("formula-1")?.eventType, "race");
    assert.equal(getSport("golf")?.eventType, "tournament");
  });

  it("returns undefined for an unknown sport", () => {
    assert.equal(getSport("quidditch"), undefined);
  });
});
