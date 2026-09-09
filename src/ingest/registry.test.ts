import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getProvider, registerProvider, resetRegistry } from "./registry";
import { MockSportsProvider } from "../providers/mock/adapter";

describe("provider registry", () => {
  it("looks up a registered provider and rejects unknown ids", async () => {
    resetRegistry();
    const provider = new MockSportsProvider();
    registerProvider(provider);
    assert.equal(getProvider("mock").id, "mock");
    assert.equal((await getProvider("mock").healthCheck()).ok, true);
    assert.throws(() => getProvider("fbref"), /Unknown provider: fbref/);
    resetRegistry();
  });
});
