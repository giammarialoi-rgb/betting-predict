import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertTemporalPrecision,
  canSatisfyPrecision,
  datasetDateAnchorUtc,
  TemporalPrecisionError,
} from "./temporal";

describe("temporal precision guards", () => {
  it("rejects unknown when requirePrecision is exact", () => {
    assert.equal(canSatisfyPrecision("unknown", "exact"), false);
    assert.throws(
      () => assertTemporalPrecision("unknown", "exact"),
      TemporalPrecisionError,
    );
  });

  it("allows unknown when requirePrecision is any", () => {
    assert.equal(canSatisfyPrecision("unknown", "any"), true);
    assert.doesNotThrow(() => assertTemporalPrecision("unknown", "any"));
  });

  it("builds UTC midnight dataset_date_anchor without inventing clock time", () => {
    const anchor = datasetDateAnchorUtc(new Date("2024-08-17T15:00:00.000Z"));
    assert.equal(anchor.toISOString(), "2024-08-17T00:00:00.000Z");
  });
});
