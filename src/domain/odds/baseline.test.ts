import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMarketBaseline,
  closingLineValueDelta,
  openCloseMovement,
} from "./baseline";

describe("market baseline math", () => {
  it("builds equal-weight baseline without calling it a prediction", () => {
    const baseline = buildMarketBaseline([
      { bookmakerSlug: "bet365", odds: { home: 2, draw: 3.4, away: 4 } },
      { bookmakerSlug: "pinnacle", odds: { home: 1.8, draw: 3.6, away: 4.5 } },
    ]);
    assert.equal(baseline.method, "equal_weight_arithmetic_mean_v1");
    assert.equal(baseline.bookmakers.length, 2);
    assert.ok(baseline.bookmakers[0]!.overround > 1);
    assert.ok(baseline.disagreement.home.min < baseline.disagreement.home.max);
  });

  it("computes open→close movement deltas only", () => {
    const moves = openCloseMovement(
      { home: 2, draw: 3.4, away: 4 },
      { home: 1.8, draw: 3.6, away: 4.5 },
    );
    assert.equal(moves[0]!.selection, "HOME");
    assert.ok(Math.abs(moves[0]!.movement.oddsChange.oddsDelta - -0.2) < 1e-12);
  });

  it("exposes CLV foundation deltas without ROI", () => {
    const clv = closingLineValueDelta({ betOdds: 2, closingOdds: 1.8 });
    assert.ok(clv.impliedDelta > 0);
    assert.ok(clv.oddsDelta < 0);
  });
});
