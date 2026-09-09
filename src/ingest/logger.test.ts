import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { logIngest, redactValue } from "./logger";

describe("ingest logger secrets", () => {
  const previous = process.env.API_FOOTBALL_KEY;
  const previousFd = process.env.FOOTBALL_DATA_ORG_TOKEN;

  before(() => {
    process.env.API_FOOTBALL_KEY = "super-secret-test-key";
    process.env.FOOTBALL_DATA_ORG_TOKEN = "fd-org-secret-token";
  });

  after(() => {
    if (previous === undefined) {
      delete process.env.API_FOOTBALL_KEY;
    } else {
      process.env.API_FOOTBALL_KEY = previous;
    }
    if (previousFd === undefined) {
      delete process.env.FOOTBALL_DATA_ORG_TOKEN;
    } else {
      process.env.FOOTBALL_DATA_ORG_TOKEN = previousFd;
    }
  });

  it("redacts keys and authorization fields", () => {
    const redacted = redactValue({
      authorization: "Bearer super-secret-test-key",
      "x-apisports-key": "super-secret-test-key",
      note: "using super-secret-test-key in text",
    }) as Record<string, unknown>;

    assert.equal(redacted.authorization, "[redacted]");
    assert.equal(redacted["x-apisports-key"], "[redacted]");
    assert.equal(redacted.note, "using [redacted] in text");
    assert.equal(
      redactValue("token=fd-org-secret-token"),
      "token=[redacted]",
    );
  });

  it("does not print the API key when logging", () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (value: unknown) => {
      lines.push(String(value));
    };
    try {
      logIngest({
        provider: "api-football",
        endpoint: "leagues",
        runId: "run-1",
        durationMs: 1,
        status: "ok",
      });
    } finally {
      console.log = original;
    }
    assert.equal(lines.join("\n").includes("super-secret-test-key"), false);
  });
});
