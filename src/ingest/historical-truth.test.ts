import assert from "node:assert/strict";
import { config } from "dotenv";
import { describe, it } from "node:test";
import { getDb } from "@/db/client";
import { competitions, events, teams } from "@/db/schema";
import {
  countHistoricalTruthTables,
  ensureClubEloDataSource,
  getFootballSportId,
  insertEloSnapshot,
  insertEventOutcome,
  insertFeatureObservation,
  listEloAsOf,
} from "@/ingest/historical-truth";
import { seedOperationalCatalog } from "@/ingest/seed";

config({ path: ".env.local" });
config({ path: ".env" });

describe("TASK 008 historical truth persistence", () => {
  it("migrated tables accept append-only outcomes, elo, features with idempotency", async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip("DATABASE_URL is not set");
      return;
    }

    await seedOperationalCatalog();
    const sportId = await getFootballSportId();
    assert.ok(sportId);
    const clubEloSourceId = await ensureClubEloDataSource();

    const db = getDb();
    const now = new Date();
    const [comp] = await db
      .insert(competitions)
      .values({
        sportId,
        name: `TASK008 League ${now.toISOString()}`,
        country: "TEST",
        season: "2024",
        observedAt: now,
        ingestedAt: now,
        availableAt: now,
      })
      .returning();
    const [home] = await db
      .insert(teams)
      .values({
        sportId,
        name: `TASK008 Home ${now.toISOString()}`,
        observedAt: now,
        ingestedAt: now,
        availableAt: now,
      })
      .returning();
    const [away] = await db
      .insert(teams)
      .values({
        sportId,
        name: `TASK008 Away ${now.toISOString()}`,
        observedAt: now,
        ingestedAt: now,
        availableAt: now,
      })
      .returning();
    const kickoff = new Date("2024-06-01T15:00:00.000Z");
    const [event] = await db
      .insert(events)
      .values({
        sportId,
        competitionId: comp!.id,
        homeTeamId: home!.id,
        awayTeamId: away!.id,
        scheduledStartAt: kickoff,
        status: "finished",
        observedAt: now,
        ingestedAt: now,
        availableAt: now,
      })
      .returning();

    const availableAt = new Date(Date.UTC(2024, 5, 1, 17, now.getMinutes(), now.getSeconds(), now.getMilliseconds()));
    const first = await insertEventOutcome({
      eventId: event!.id,
      sportId,
      homeScore: 2,
      awayScore: 1,
      observedAt: availableAt,
      availableAt,
    });
    assert.equal(first.stored, true);
    const dup = await insertEventOutcome({
      eventId: event!.id,
      sportId,
      homeScore: 2,
      awayScore: 1,
      observedAt: availableAt,
      availableAt,
    });
    assert.equal(dup.stored, false);

    const t1 = new Date(Date.UTC(2024, 4, 1, 0, now.getMinutes(), now.getSeconds()));
    const t2 = new Date(Date.UTC(2024, 4, 15, 0, now.getMinutes(), now.getSeconds()));
    assert.equal(
      (
        await insertEloSnapshot({
          sportId,
          teamId: home!.id,
          sourceId: clubEloSourceId,
          rating: 1500,
          snapshotAt: t1,
          observedAt: t1,
          availableAt: t1,
          provenance: "official_clubelo",
        })
      ).stored,
      true,
    );
    assert.equal(
      (
        await insertEloSnapshot({
          sportId,
          teamId: home!.id,
          sourceId: clubEloSourceId,
          rating: 1510,
          snapshotAt: t2,
          observedAt: t2,
          availableAt: t2,
          provenance: "official_clubelo",
        })
      ).stored,
      true,
    );
    assert.equal(
      (
        await insertEloSnapshot({
          sportId,
          teamId: home!.id,
          sourceId: clubEloSourceId,
          rating: 1510,
          snapshotAt: t2,
          observedAt: t2,
          availableAt: t2,
          provenance: "official_clubelo",
        })
      ).stored,
      false,
    );

    const asOfT1 = await listEloAsOf({ teamId: home!.id, asOf: t1 });
    assert.equal(Number(asOfT1[0]?.rating), 1500);
    const asOfT2 = await listEloAsOf({ teamId: home!.id, asOf: t2 });
    assert.equal(Number(asOfT2[0]?.rating), 1510);

    assert.equal(
      (
        await insertFeatureObservation({
          eventId: event!.id,
          sportId,
          featureKey: "form_5_overall",
          featureValueNumeric: 7,
          observedAt: t2,
          availableAt: t2,
          featureStatus: "VALID",
          temporalPrecision: "exact",
          sourceId: clubEloSourceId,
        })
      ).stored,
      true,
    );
    assert.equal(
      (
        await insertFeatureObservation({
          eventId: event!.id,
          sportId,
          featureKey: "form_5_overall",
          featureValueNumeric: 7,
          observedAt: t2,
          availableAt: t2,
          featureStatus: "VALID",
          temporalPrecision: "exact",
          sourceId: clubEloSourceId,
        })
      ).stored,
      false,
    );

    const counts = await countHistoricalTruthTables();
    assert.ok(counts.eventOutcomes >= 1);
    assert.ok(counts.eloSnapshots >= 2);
    assert.ok(counts.featureObservations >= 1);
  });
});
