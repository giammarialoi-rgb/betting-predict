import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PermanentError,
  RetryableError,
  withRetry,
} from "./retry";

describe("withRetry", () => {
  it("retries 429 then succeeds", async () => {
    let attempts = 0;
    const { retryCount } = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new RetryableError("HTTP 429", 429);
        }
        return "ok";
      },
      { maxRetries: 3, sleep: async () => undefined },
    );
    assert.equal(retryCount, 1);
  });

  it("retries 500 then succeeds", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new RetryableError("HTTP 500", 500);
        }
        return "ok";
      },
      { maxRetries: 3, sleep: async () => undefined },
    );
    assert.equal(result.value, "ok");
  });

  it("retries timeout then succeeds", async () => {
    let attempts = 0;
    await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new RetryableError("timeout");
        }
        return "ok";
      },
      { maxRetries: 2, sleep: async () => undefined },
    );
    assert.equal(attempts, 2);
  });

  it("stops at the retry limit", async () => {
    await assert.rejects(
      () =>
        withRetry(
          async () => {
            throw new RetryableError("HTTP 429", 429);
          },
          { maxRetries: 2, sleep: async () => undefined },
        ),
      RetryableError,
    );
  });

  it("does not retry permanent 400 errors", async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        withRetry(
          async () => {
            attempts += 1;
            throw new PermanentError("HTTP 400", 400);
          },
          { maxRetries: 3, sleep: async () => undefined },
        ),
      PermanentError,
    );
    assert.equal(attempts, 1);
  });
});
