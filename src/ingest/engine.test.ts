import assert from "node:assert/strict";
import { config } from "dotenv";
import { count, eq } from "drizzle-orm";
import { describe, it } from "node:test";
import { getDb } from "../db/client";
import { events, ingestionRuns, rawPayloads, sports } from "../db/schema";
import { listEventsAsOf } from "./as-of-query";
import { runIngestion } from "./engine";
import { PermanentError } from "./retry";
import {
  MockSportsProvider,
  type MockStep,
  mockIngestRequests,
} from "../providers/mock/adapter";

config({ path: ".env.local" });
config({ path: ".env" });

function suffix(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function stepsFor(id: string, t1: Date, t2: Date): MockStep[] {
  return [
    {
      kind: "leagues",
      sourcePublishedAt: t1,
      payload: {
        competitions: [
          {
            id: `${id}-league`,
            name: "Alignment League",
            country: "Testland",
            season: "2026",
            sourcePublishedAt: t1.toISOString(),
          },
        ],
      },
    },
    {
      kind: "teams",
      sourcePublishedAt: t1,
      payload: {
        teams: [
          {
            id: `${id}-home`,
            name: "Home FC",
            country: "Testland",
            sourcePublishedAt: t1.toISOString(),
          },
          {
            id: `${id}-away`,
            name: "Away FC",
            country: "Testland",
            sourcePublishedAt: t1.toISOString(),
          },
        ],
      },
    },
    {
      kind: "fixtures",
      sourcePublishedAt: t2,
      payload: {
        events: [
          {
            id: `${id}-event-a`,
            competitionId: `${id}-league`,
            homeTeamId: `${id}-home`,
            awayTeamId: `${id}-away`,
            scheduledStartAt: "2026-09-06T16:00:00.000Z",
            status: "NS",
            sourcePublishedAt: t1.toISOString(),
          },
          {
            id: `${id}-event-b`,
            competitionId: `${id}-league`,
            homeTeamId: `${id}-away`,
            awayTeamId: `${id}-home`,
            scheduledStartAt: "2026-09-06T16:00:00.000Z",
            status: "NS",
            sourcePublishedAt: t2.toISOString(),
          },
        ],
      },
    },
  ];
}

describe("ingestion engine", () => {
  it("runs a successful mock ingest and stays idempotent", async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip("DATABASE_URL is not set");
      return;
    }

    const id = suffix();
    const t1 = new Date("2026-09-06T12:00:00.000Z");
    const t2 = new Date("2026-09-06T13:00:00.000Z");
    const requests = mockIngestRequests();

    const first = await runIngestion({
      provider: new MockSportsProvider(stepsFor(id, t1, t2)),
      requests,
      licenseClass: "unknown",
    });
    assert.equal(first.status, "succeeded");
    assert.ok(first.recordsStored >= 5);

    const second = await runIngestion({
      provider: new MockSportsProvider(stepsFor(id, t1, t2)),
      requests,
      licenseClass: "unknown",
    });
    assert.equal(second.status, "succeeded");
    assert.notEqual(second.runId, first.runId);
    assert.equal(second.recordsStored, 0);
    assert.ok(second.recordsRejected >= 5);

    const db = getDb();
    const [sportCount] = await db
      .select({ value: count() })
      .from(sports)
      .where(eq(sports.slug, "football"));
    assert.equal(sportCount.value, 1);
  });

  it("records a failed run when every fetch is permanent", async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip("DATABASE_URL is not set");
      return;
    }

    const provider = new MockSportsProvider([
      { kind: "leagues", payload: {}, failure: 400 },
    ]);
    const result = await runIngestion({
      provider,
      requests: [{ kind: "leagues" }],
      licenseClass: "unknown",
    });
    assert.equal(result.status, "failed");
    assert.ok(result.errorMessage);
  });

  it("records a partial run when one fetch fails", async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip("DATABASE_URL is not set");
      return;
    }

    const provider = new MockSportsProvider([
      {
        kind: "leagues",
        payload: {
          competitions: [
            { id: `partial-${suffix()}`, name: "Partial", country: "X", season: "2026" },
          ],
        },
      },
    ]);
    const originalFetch = provider.fetch.bind(provider);
    provider.fetch = async (req) => {
      if (req.kind === "teams") {
        throw new PermanentError("HTTP 400", 400);
      }
      return originalFetch(req);
    };

    const result = await runIngestion({
      provider,
      requests: [{ kind: "leagues" }, { kind: "teams" }],
      licenseClass: "unknown",
    });
    assert.equal(result.status, "partial");
  });

  it("persists raw payloads and excludes future facts from as-of queries", async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip("DATABASE_URL is not set");
      return;
    }

    const id = `asof-${suffix()}`;
    const t1 = new Date("2026-09-06T12:00:00.000Z");
    const t2 = new Date("2026-09-06T13:00:00.000Z");
    const t3 = new Date("2026-09-06T15:00:00.000Z");

    await runIngestion({
      provider: new MockSportsProvider(stepsFor(id, t1, t2)),
      requests: mockIngestRequests(),
      licenseClass: "unknown",
    });

    const db = getDb();
    const rawRows = await db.select().from(rawPayloads);
    assert.ok(rawRows.length > 0);

    const asOfT1 = await listEventsAsOf(t1);
    const asOfT3 = await listEventsAsOf(t3);
    const eventsT1 = asOfT1.filter((row) => row.status === "NS");
    void events;
    assert.ok(asOfT1.every((row) => row.availableAt.getTime() <= t1.getTime()));
    assert.ok(
      asOfT3.some((row) => row.availableAt.getTime() > t1.getTime()),
      "B published at T2 must be visible as of T3",
    );
    assert.ok(eventsT1.every((row) => row.availableAt.getTime() <= t1.getTime()));

    const [runs] = await db
      .select({ value: count() })
      .from(ingestionRuns);
    assert.ok(runs.value >= 1);
  });
});
