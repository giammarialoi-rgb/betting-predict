import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coerceAvailableAt, coerceAvailableAtToIso } from "./available-at";

describe("coerceAvailableAtToIso", () => {
  it("passes through a valid ISO instant as UTC ISO", () => {
    assert.equal(coerceAvailableAtToIso("2026-09-12T16:00:00.000Z"), "2026-09-12T16:00:00.000Z");
  });

  it("coerces RFC 2822 RSS pubDate to ISO (does not invent)", () => {
    const iso = coerceAvailableAtToIso("Sat, 12 Sep 2026 18:32:00 +0200");
    assert.equal(iso, "2026-09-12T16:32:00.000Z");
  });

  it("coerces RFC 2822 GMT pubDate", () => {
    assert.equal(coerceAvailableAtToIso("Sat, 12 Sep 2026 16:32:00 GMT"), "2026-09-12T16:32:00.000Z");
  });

  it("omits empty / null without marking unparseable", () => {
    assert.deepEqual(coerceAvailableAt(null), { iso: null, unparseable: false });
    assert.deepEqual(coerceAvailableAt(""), { iso: null, unparseable: false });
    assert.deepEqual(coerceAvailableAt("   "), { iso: null, unparseable: false });
  });

  it("omits junk instead of inventing a timestamp", () => {
    assert.equal(coerceAvailableAtToIso("not-a-date"), null);
    assert.equal(coerceAvailableAt("not-a-date").unparseable, true);
    assert.equal(coerceAvailableAtToIso("soon"), null);
    assert.equal(coerceAvailableAtToIso("September"), null);
  });

  it("does not invent midnight from a date-only string", () => {
    assert.equal(coerceAvailableAtToIso("2026-09-12"), null);
    assert.equal(coerceAvailableAt("2026-09-12").unparseable, true);
  });

  it("does not treat a year or epoch-seconds as a clock", () => {
    assert.equal(coerceAvailableAtToIso("2026"), null);
    assert.equal(coerceAvailableAtToIso(1_726_160_000), null);
  });
});
