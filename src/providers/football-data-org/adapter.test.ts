import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PermanentError, RetryableError, withRetry } from "@/ingest/retry";
import {
  FOOTBALL_DATA_ORG_PROVIDER_ID,
  FootballDataOrgProvider,
  footballDataOrgIngestRequests,
  getFootballDataOrgToken,
} from "./adapter";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("FootballDataOrgProvider", () => {
  it("fails health and fetch without a token and never calls HTTP", async () => {
    let calls = 0;
    const provider = new FootballDataOrgProvider({
      token: "",
      fetch: async () => {
        calls += 1;
        throw new Error("HTTP must not run");
      },
    });

    const previous = process.env.FOOTBALL_DATA_ORG_TOKEN;
    delete process.env.FOOTBALL_DATA_ORG_TOKEN;
    try {
      assert.equal(getFootballDataOrgToken(), undefined);
    } finally {
      if (previous === undefined) {
        delete process.env.FOOTBALL_DATA_ORG_TOKEN;
      } else {
        process.env.FOOTBALL_DATA_ORG_TOKEN = previous;
      }
    }

    const health = await provider.healthCheck();
    assert.equal(health.ok, false);
    assert.match(health.message, /FOOTBALL_DATA_ORG_TOKEN/);
    await assert.rejects(
      () => provider.fetch({ kind: "leagues" }),
      PermanentError,
    );
    assert.equal(calls, 0);
  });

  it("treats 401 and 403 as permanent", async () => {
    for (const status of [401, 403]) {
      const provider = new FootballDataOrgProvider({
        token: "test-token",
        fetch: async () => jsonResponse(status, { message: "no" }),
      });
      await assert.rejects(
        () => provider.fetch({ kind: "leagues" }),
        (error: unknown) =>
          error instanceof PermanentError && error.httpStatus === status,
      );
    }
  });

  it("classifies 429 and 500 as retryable and uses the shared retry helper", async () => {
    let attempts = 0;
    const provider = new FootballDataOrgProvider({
      token: "test-token",
      fetch: async () => {
        attempts += 1;
        if (attempts === 1) {
          return jsonResponse(429, { message: "slow down" });
        }
        if (attempts === 2) {
          return jsonResponse(500, { message: "boom" });
        }
        return jsonResponse(200, { competitions: [] });
      },
    });

    const { value, retryCount } = await withRetry(
      () => provider.fetch({ kind: "leagues" }),
      { maxRetries: 3, sleep: async () => undefined },
    );
    assert.equal(value.httpStatus, 200);
    assert.equal(value.sourcePublishedAt, null);
    assert.equal(retryCount, 2);
    assert.equal(attempts, 3);
  });

  it("classifies timeout as retryable", async () => {
    const provider = new FootballDataOrgProvider({
      token: "test-token",
      fetch: async () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      },
    });
    await assert.rejects(
      () => provider.fetch({ kind: "leagues" }),
      (error: unknown) =>
        error instanceof RetryableError && error.message === "timeout",
    );
  });

  it("treats malformed JSON as permanent", async () => {
    const provider = new FootballDataOrgProvider({
      token: "test-token",
      fetch: async () =>
        new Response("not-json", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    await assert.rejects(
      () => provider.fetch({ kind: "leagues" }),
      PermanentError,
    );
  });

  it("builds a small batch request list and does not hardcode 10 req/min in the core", () => {
    const provider = new FootballDataOrgProvider({ minIntervalMs: 8000 });
    assert.equal(provider.id, FOOTBALL_DATA_ORG_PROVIDER_ID);
    assert.equal(provider.minIntervalMs, 8000);
    const requests = footballDataOrgIngestRequests();
    assert.deepEqual(
      requests.map((item) => item.kind),
      ["leagues", "teams", "teams", "fixtures"],
    );
    assert.equal(requests[1]?.params?.competition, "PL");
    assert.equal(requests[2]?.params?.competition, "SA");
    assert.equal(requests[3]?.params?.competitions, "PL,SA");
  });
});
