import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getMarket,
  isMarketType,
  listMarkets,
  listMarketsForSport,
} from "./catalog";

describe("market taxonomy", () => {
  it("keeps market ids unique and typed", () => {
    const ids = listMarkets().map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) {
      assert.equal(isMarketType(id), true);
    }
  });

  it("does not treat winner as universal across sports", () => {
    const football = listMarketsForSport("football").map((item) => item.id);
    const f1 = listMarketsForSport("formula-1").map((item) => item.id);
    assert.ok(football.includes("draw"));
    assert.equal(f1.includes("draw"), false);
    assert.ok(f1.includes("race_winner"));
    assert.equal(football.includes("race_winner"), false);
    assert.equal(getMarket("winner")?.selectionKind, "n_way");
  });

  it("returns no markets for an unknown sport", () => {
    assert.deepEqual(listMarketsForSport("quidditch"), []);
  });
});
