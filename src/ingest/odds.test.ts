import assert from "node:assert/strict";
import { config } from "dotenv";
import { and, count, eq } from "drizzle-orm";
import { describe, it } from "node:test";
import { getDb } from "@/db/client";
import { bookmakers, marketSnapshots } from "@/db/schema";
import { AsOfLeakageError, assertAsOf } from "@/lib/as-of";
import { runMockOddsIngestion } from "@/ingest/odds-engine";
import {
  getBookmakerBySlug,
  listMarketSnapshotsAsOf,
  selectClosingLine,
  selectOpeningLine,
  snapshotOddsNumber,
} from "@/ingest/odds-query";
import {
  MOCK_BOOKMAKER_A_SLUG,
  MOCK_BOOKMAKER_B_SLUG,
  MOCK_ODDS_EVENT_KICKOFF,
  MOCK_ODDS_T1,
  MOCK_ODDS_T2,
  MOCK_ODDS_T3,
  MOCK_ODDS_T4,
} from "@/providers/odds/mock";

config({ path: ".env.local" });
config({ path: ".env" });

describe("historical odds mock ingestion", () => {
  it("ingests append-only snapshots for multiple bookmakers and timestamps", async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip("DATABASE_URL is not set");
      return;
    }

    const first = await runMockOddsIngestion();
    assert.equal(first.status, "succeeded");
    assert.ok(first.eventId);
    assert.ok(first.recordsStored >= 15 || first.recordsRejected >= 15);

    const db = getDb();
    const [snapshotTotal] = await db
      .select({ value: count() })
      .from(marketSnapshots)
      .where(eq(marketSnapshots.eventId, first.eventId!));
    assert.ok(snapshotTotal.value >= 24);
    const [bookA] = await db
      .select({ value: count() })
      .from(bookmakers)
      .where(eq(bookmakers.slug, MOCK_BOOKMAKER_A_SLUG));
    const [bookB] = await db
      .select({ value: count() })
      .from(bookmakers)
      .where(eq(bookmakers.slug, MOCK_BOOKMAKER_B_SLUG));
    assert.equal(bookA.value, 1);
    assert.equal(bookB.value, 1);

    const asOfT1 = await listMarketSnapshotsAsOf({
      asOf: new Date("2026-09-06T13:00:00.000Z"),
      eventId: first.eventId!,
    });
    assert.ok(asOfT1.length >= 6);
    assert.ok(
      asOfT1.every((row) => row.availableAt.getTime() <= MOCK_ODDS_T1.getTime()),
    );
    assert.equal(
      asOfT1.some((row) => row.availableAt.getTime() >= MOCK_ODDS_T2.getTime()),
      false,
    );

    const asOfT2 = await listMarketSnapshotsAsOf({
      asOf: new Date("2026-09-06T16:00:00.000Z"),
      eventId: first.eventId!,
    });
    assert.ok(
      asOfT2.some((row) => row.availableAt.getTime() === MOCK_ODDS_T1.getTime()),
    );
    assert.ok(
      asOfT2.some((row) => row.availableAt.getTime() === MOCK_ODDS_T2.getTime()),
    );
    assert.equal(
      asOfT2.some((row) => row.availableAt.getTime() >= MOCK_ODDS_T3.getTime()),
      false,
    );

    const asOfT3 = await listMarketSnapshotsAsOf({
      asOf: new Date("2026-09-06T19:45:00.000Z"),
      eventId: first.eventId!,
    });
    assert.ok(
      asOfT3.some((row) => row.availableAt.getTime() === MOCK_ODDS_T3.getTime()),
    );
    assert.equal(
      asOfT3.some((row) => row.availableAt.getTime() >= MOCK_ODDS_T4.getTime()),
      false,
    );

    const asOfKickoff = await listMarketSnapshotsAsOf({
      asOf: MOCK_ODDS_EVENT_KICKOFF,
      eventId: first.eventId!,
    });
    assert.equal(
      asOfKickoff.some((row) => row.availableAt.getTime() > MOCK_ODDS_EVENT_KICKOFF.getTime()),
      false,
    );
  });

  it("is idempotent on repeated mock odds ingestion", async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip("DATABASE_URL is not set");
      return;
    }

    const first = await runMockOddsIngestion();
    const before = await listMarketSnapshotsAsOf({
      asOf: new Date("2026-09-07T00:00:00.000Z"),
      eventId: first.eventId!,
    });

    const second = await runMockOddsIngestion();
    assert.equal(second.status, "succeeded");
    assert.notEqual(second.runId, first.runId);
    assert.equal(second.recordsStored, 0);
    assert.ok(second.recordsRejected >= 24);

    const after = await listMarketSnapshotsAsOf({
      asOf: new Date("2026-09-07T00:00:00.000Z"),
      eventId: first.eventId!,
    });
    assert.equal(after.length, before.length);
  });

  it("blocks look-ahead: a 15:00 decision cannot see later odds or post-event prices", async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip("DATABASE_URL is not set");
      return;
    }

    const result = await runMockOddsIngestion();
    const decisionAt = new Date("2026-09-06T15:00:00.000Z");
    const visible = await listMarketSnapshotsAsOf({
      asOf: decisionAt,
      eventId: result.eventId!,
    });

    assert.ok(visible.every((row) => row.availableAt.getTime() <= decisionAt.getTime()));
    assert.equal(
      visible.some((row) => row.availableAt.getTime() > decisionAt.getTime()),
      false,
    );
    assert.equal(
      visible.some((row) => row.availableAt.getTime() === MOCK_ODDS_T3.getTime()),
      false,
    );
    assert.equal(
      visible.some((row) => row.availableAt.getTime() === MOCK_ODDS_T4.getTime()),
      false,
    );

    const later = await listMarketSnapshotsAsOf({
      asOf: new Date("2026-09-06T19:45:00.000Z"),
      eventId: result.eventId!,
    });
    const leakCandidate = later.find(
      (row) => row.availableAt.getTime() === MOCK_ODDS_T3.getTime(),
    );
    assert.ok(leakCandidate);
    assert.throws(
      () => assertAsOf(decisionAt, leakCandidate.availableAt),
      AsOfLeakageError,
    );

    const postEvent = later.find(
      (row) => row.availableAt.getTime() === MOCK_ODDS_T4.getTime(),
    );
    assert.equal(postEvent, undefined);
    const allKnown = await listMarketSnapshotsAsOf({
      asOf: new Date("2026-09-06T21:00:00.000Z"),
      eventId: result.eventId!,
    });
    const postKickoff = allKnown.find(
      (row) => row.availableAt.getTime() === MOCK_ODDS_T4.getTime(),
    );
    assert.ok(postKickoff);
    assert.throws(
      () => assertAsOf(MOCK_ODDS_EVENT_KICKOFF, postKickoff.availableAt),
      AsOfLeakageError,
    );
  });

  it("selects opening and closing lines without using post-kickoff snapshots", async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip("DATABASE_URL is not set");
      return;
    }

    const result = await runMockOddsIngestion();
    const bookA = await getBookmakerBySlug(MOCK_BOOKMAKER_A_SLUG);
    assert.ok(bookA);

    const opening = await selectOpeningLine({
      eventId: result.eventId!,
      bookmakerId: bookA.id,
      marketType: "winner",
      selectionSide: "HOME",
    });
    assert.ok(opening);
    assert.equal(opening.availableAt.toISOString(), MOCK_ODDS_T1.toISOString());
    assert.equal(snapshotOddsNumber(opening), 2);

    const closing = await selectClosingLine({
      eventId: result.eventId!,
      bookmakerId: bookA.id,
      marketType: "winner",
      selectionSide: "HOME",
    });
    assert.ok(closing);
    assert.equal(closing.availableAt.toISOString(), MOCK_ODDS_T3.toISOString());
    assert.equal(snapshotOddsNumber(closing), 1.7);

    const closingAt1545 = await selectClosingLine({
      eventId: result.eventId!,
      bookmakerId: bookA.id,
      marketType: "winner",
      selectionSide: "HOME",
      asOf: new Date("2026-09-06T15:45:00.000Z"),
    });
    assert.ok(closingAt1545);
    assert.equal(
      closingAt1545.availableAt.toISOString(),
      MOCK_ODDS_T2.toISOString(),
    );
    assert.equal(snapshotOddsNumber(closingAt1545), 1.8);

    const db = getDb();
    const postEvent = await db
      .select()
      .from(marketSnapshots)
      .where(
        and(
          eq(marketSnapshots.eventId, result.eventId!),
          eq(marketSnapshots.bookmakerId, bookA.id),
          eq(marketSnapshots.selectionSide, "HOME"),
        ),
      );
    assert.ok(
      postEvent.some((row) => row.availableAt.getTime() === MOCK_ODDS_T4.getTime()),
    );
    assert.notEqual(
      closing.availableAt.toISOString(),
      MOCK_ODDS_T4.toISOString(),
    );
  });

  it("keeps disagreeing bookmakers as separate snapshots", async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip("DATABASE_URL is not set");
      return;
    }

    const result = await runMockOddsIngestion();
    const bookA = await getBookmakerBySlug(MOCK_BOOKMAKER_A_SLUG);
    const bookB = await getBookmakerBySlug(MOCK_BOOKMAKER_B_SLUG);
    assert.ok(bookA && bookB);

    const asOfT1 = await listMarketSnapshotsAsOf({
      asOf: MOCK_ODDS_T1,
      eventId: result.eventId!,
    });
    const homeA = asOfT1.find(
      (row) =>
        row.bookmakerId === bookA.id &&
        row.selectionSide === "HOME" &&
        row.availableAt.getTime() === MOCK_ODDS_T1.getTime(),
    );
    const homeB = asOfT1.find(
      (row) =>
        row.bookmakerId === bookB.id &&
        row.selectionSide === "HOME" &&
        row.availableAt.getTime() === MOCK_ODDS_T1.getTime(),
    );
    assert.ok(homeA && homeB);
    assert.equal(snapshotOddsNumber(homeA), 2);
    assert.equal(snapshotOddsNumber(homeB), 2.2);
    assert.notEqual(homeA.id, homeB.id);
  });
});
