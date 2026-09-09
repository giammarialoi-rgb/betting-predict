import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeOverround,
  decimalOddsToImpliedProbability,
  formatOddsDecimal,
  impliedProbabilityToDecimalOdds,
  marketMovement,
  normalizeMarketProbabilities,
  oddsChange,
} from "./math";

describe("odds conversion", () => {
  it("converts decimal odds to market-implied probability", () => {
    assert.equal(decimalOddsToImpliedProbability(2), 0.5);
    assert.ok(Math.abs(decimalOddsToImpliedProbability(4) - 0.25) < 1e-12);
  });

  it("converts implied probability back to decimal odds", () => {
    assert.equal(impliedProbabilityToDecimalOdds(0.5), 2);
    assert.ok(Math.abs(impliedProbabilityToDecimalOdds(0.25) - 4) < 1e-12);
  });

  it("rejects odds <= 1 and non-finite values", () => {
    assert.throws(() => decimalOddsToImpliedProbability(1), RangeError);
    assert.throws(() => decimalOddsToImpliedProbability(0.5), RangeError);
    assert.throws(() => decimalOddsToImpliedProbability(Number.NaN), RangeError);
    assert.throws(() => impliedProbabilityToDecimalOdds(0), RangeError);
    assert.throws(() => impliedProbabilityToDecimalOdds(1), RangeError);
    assert.throws(() => impliedProbabilityToDecimalOdds(-0.1), RangeError);
  });

  it("formats odds for NUMERIC(12,6)", () => {
    assert.equal(formatOddsDecimal(2), "2.000000");
    assert.equal(formatOddsDecimal(1.9), "1.900000");
  });
});

describe("overround", () => {
  it("computes 2-way and 3-way overround without removing margin", () => {
    const twoWay = computeOverround([1.9, 1.9]);
    assert.equal(twoWay.rawImpliedProbabilities.length, 2);
    assert.ok(Math.abs(twoWay.overround - (1 / 1.9 + 1 / 1.9)) < 1e-12);
    assert.ok(twoWay.margin > 0);

    const threeWay = computeOverround([2, 3.5, 4]);
    assert.equal(threeWay.rawImpliedProbabilities.length, 3);
    assert.ok(
      Math.abs(threeWay.overround - (0.5 + 1 / 3.5 + 0.25)) < 1e-12,
    );
  });

  it("normalizes with documented proportional method", () => {
    const normalized = normalizeMarketProbabilities([2, 3.5, 4]);
    const sum = normalized.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-12);
  });

  it("rejects invalid overround inputs", () => {
    assert.throws(() => computeOverround([2]), RangeError);
    assert.throws(() => computeOverround([2, 1]), RangeError);
  });
});

describe("market movement", () => {
  it("computes odds and implied-probability deltas without interpretation", () => {
    const change = oddsChange(2, 1.8);
    assert.ok(Math.abs(change.oddsDelta - -0.2) < 1e-12);
    assert.ok(Math.abs(change.oddsRelativeChange - -0.1) < 1e-12);

    const movement = marketMovement(2, 1.8);
    assert.ok(
      Math.abs(movement.impliedProbabilityChange.impliedProbabilityDelta - (1 / 1.8 - 0.5)) <
        1e-12,
    );
  });
});
