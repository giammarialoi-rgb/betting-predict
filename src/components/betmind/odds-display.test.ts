import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { completeBook1x2 } from "@/components/betmind/OddsBlock";

describe("completeBook1x2", () => {
  it("accepts only a complete decimal 1X2 greater than 1", () => {
    const book = completeBook1x2({ odds_home: 1.85, odds_draw: 3.4, odds_away: 4.2 });
    assert.deepEqual(book, { home: 1.85, draw: 3.4, away: 4.2 });
  });

  it("refuses incomplete or invented prices", () => {
    assert.equal(completeBook1x2({ odds_home: 1.85, odds_draw: 3.4 }), null);
    assert.equal(completeBook1x2({ odds_home: 0.55, odds_draw: 0.25, odds_away: 0.2 }), null);
    assert.equal(completeBook1x2({ odds_home: 1, odds_draw: 2, odds_away: 3 }), null);
    assert.equal(completeBook1x2({}), null);
  });
});
