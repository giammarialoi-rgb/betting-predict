import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPayload } from "./hash";

describe("hashPayload", () => {
  it("is deterministic across key order", () => {
    assert.equal(
      hashPayload({ b: 1, a: 2 }),
      hashPayload({ a: 2, b: 1 }),
    );
  });
});
