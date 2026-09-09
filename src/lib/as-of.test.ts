import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AsOfLeakageError, assertAsOf, isAvailableAsOf } from "./as-of";

describe("assertAsOf", () => {
  const asOf = new Date("2026-09-06T14:32:17.000Z");

  it("allows a fact published before as_of", () => {
    const availableAt = new Date("2026-09-06T12:00:00.000Z");
    assert.equal(isAvailableAsOf(asOf, availableAt), true);
    assert.doesNotThrow(() => assertAsOf(asOf, availableAt));
  });

  it("allows a fact published at the exact as_of instant", () => {
    assert.doesNotThrow(() => assertAsOf(asOf, new Date(asOf)));
  });

  it("rejects a fact that arrived after as_of (late / post-event leak)", () => {
    const availableAt = new Date("2026-09-06T15:01:00.000Z");
    assert.equal(isAvailableAsOf(asOf, availableAt), false);
    assert.throws(() => assertAsOf(asOf, availableAt), AsOfLeakageError);
  });

  it("rejects invalid timestamps instead of treating them as known", () => {
    assert.throws(() => assertAsOf(asOf, new Date("not-a-date")), TypeError);
    assert.throws(() => assertAsOf(new Date("not-a-date"), asOf), TypeError);
  });
});
