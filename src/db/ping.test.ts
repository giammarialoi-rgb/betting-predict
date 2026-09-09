import assert from "node:assert/strict";
import { config } from "dotenv";
import { describe, it } from "node:test";

config({ path: ".env.local" });
config({ path: ".env" });

describe("pingDatabase", () => {
  it("reaches the dedicated Neon database", async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip("DATABASE_URL is not set");
      return;
    }

    const { pingDatabase } = await import("./ping");
    await assert.doesNotReject(() => pingDatabase());
  });
});
