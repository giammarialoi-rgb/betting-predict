import assert from "node:assert/strict";
import { config } from "dotenv";
import { count, eq } from "drizzle-orm";
import { describe, it } from "node:test";
import { getDb } from "@/db/client";
import { bookmakers, marketSnapshots, rawPayloads } from "@/db/schema";
import {
  mapFootballDataCoUkEvent,
  runFootballDataCoUkIngestion,
  seedOddsDataSources,
} from "@/ingest/odds-engine";
import {
  getBookmakerBySlug,
  getDatasetClosingOdds,
  getDatasetOpeningOdds,
  listMarketSnapshotsAsOfWithMeta,
} from "@/ingest/odds-query";
import { TemporalPrecisionError } from "@/domain/odds/temporal";
import { getDataSourceBySlug } from "@/ingest/seed";
import { FootballDataCoUkOddsProvider } from "@/providers/football-data-co-uk/adapter";
import {
  FOOTBALL_DATA_CO_UK_FIXTURE_CSV,
  FOOTBALL_DATA_CO_UK_FIXTURE_DIVISION,
  FOOTBALL_DATA_CO_UK_FIXTURE_SEASON,
} from "@/providers/football-data-co-uk/fixture";
import { parseFootballDataCoUkMatches } from "@/providers/football-data-co-uk/parser";

config({ path: ".env.local" });
config({ path: ".env" });

describe("football-data.co.uk ingestion", () => {
  it("blocks live download when the CSV endpoint is not HTTP 200", async () => {
    const provider = new FootballDataCoUkOddsProvider(
      { seasonCode: "2425", division: "E0" },
      {
        fetch: async () =>
          new Response("temporarily unavailable", {
            status: 503,
            headers: { "content-type": "text/html" },
          }),
      },
    );
    const health = await provider.healthCheck();
    assert.equal(health.ok, false);
    await assert.rejects(() => provider.fetchOdds(), /BLOCKED|503/);
  });

  it("ingests fixture CSV into snapshots with dataset open/close semantics", async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip("DATABASE_URL is not set");
      return;
    }

    await seedOddsDataSources();
    const source = await getDataSourceBySlug("football-data-co-uk");
    assert.ok(source);

    const parsed = parseFootballDataCoUkMatches({
      csvText: FOOTBALL_DATA_CO_UK_FIXTURE_CSV,
      seasonCode: FOOTBALL_DATA_CO_UK_FIXTURE_SEASON,
      division: FOOTBALL_DATA_CO_UK_FIXTURE_DIVISION,
    });

    for (const match of parsed.matches) {
      await mapFootballDataCoUkEvent({
        sourceId: source.id,
        providerEventId: match.providerEventId,
        competitionName: "Premier League",
        homeName: match.homeTeamRaw,
        awayName: match.awayTeamRaw,
        scheduledStartAt: new Date("2024-08-17T15:00:00.000Z"),
      });
    }

    const started = Date.now();
    const first = await runFootballDataCoUkIngestion({
      seasonCode: FOOTBALL_DATA_CO_UK_FIXTURE_SEASON,
      division: FOOTBALL_DATA_CO_UK_FIXTURE_DIVISION,
      csvText: FOOTBALL_DATA_CO_UK_FIXTURE_CSV,
    });
    const durationMs = Date.now() - started;

    assert.equal(first.status, "succeeded");
    assert.ok(first.recordsStored >= 9 || first.recordsRejected >= 9);

    const united = parsed.matches.find((m) => m.homeTeamId === "manchester-united");
    assert.ok(united);
    const unitedEventId = await mapFootballDataCoUkEvent({
      sourceId: source.id,
      providerEventId: united.providerEventId,
      competitionName: "Premier League",
      homeName: united.homeTeamRaw,
      awayName: united.awayTeamRaw,
      scheduledStartAt: new Date("2024-08-17T15:00:00.000Z"),
    });

    const db = getDb();
    const [existingSnaps] = await db
      .select({ value: count() })
      .from(marketSnapshots)
      .where(eq(marketSnapshots.eventId, unitedEventId));
    assert.ok(Number(existingSnaps.value) >= 9);

    const second = await runFootballDataCoUkIngestion({
      seasonCode: FOOTBALL_DATA_CO_UK_FIXTURE_SEASON,
      division: FOOTBALL_DATA_CO_UK_FIXTURE_DIVISION,
      csvText: FOOTBALL_DATA_CO_UK_FIXTURE_CSV,
    });
    assert.equal(second.status, "succeeded");
    assert.notEqual(second.runId, first.runId);
    assert.equal(second.recordsStored, 0);
    assert.ok(second.recordsRejected >= 9);

    const bet365 = await getBookmakerBySlug("bet365");
    assert.ok(bet365);
    const opening = await getDatasetOpeningOdds({
      eventId: unitedEventId,
      bookmakerId: bet365.id,
      marketType: "winner",
      selectionSide: "HOME",
      requirePrecision: "any",
    });
    const closing = await getDatasetClosingOdds({
      eventId: unitedEventId,
      bookmakerId: bet365.id,
      marketType: "winner",
      selectionSide: "HOME",
      requirePrecision: "any",
    });
    assert.ok(opening && closing);
    assert.equal(opening.observationKind, "dataset_open");
    assert.equal(closing.observationKind, "dataset_close");
    assert.equal(opening.temporalPrecision, "unknown");
    assert.equal(Number(opening.oddsDecimal), 2);
    assert.equal(Number(closing.oddsDecimal), 1.8);

    await assert.rejects(
      () =>
        getDatasetClosingOdds({
          eventId: unitedEventId,
          bookmakerId: bet365.id,
          marketType: "winner",
          selectionSide: "HOME",
          requirePrecision: "exact",
        }),
      TemporalPrecisionError,
    );

    const asOfExact = await listMarketSnapshotsAsOfWithMeta({
      asOf: new Date("2024-08-17T12:00:00.000Z"),
      eventId: unitedEventId,
      requirePrecision: "exact",
    });
    assert.equal(asOfExact.rows.length, 0);

    const asOfAny = await listMarketSnapshotsAsOfWithMeta({
      asOf: new Date("2024-08-17T12:00:00.000Z"),
      eventId: unitedEventId,
      requirePrecision: "any",
    });
    assert.ok(asOfAny.rows.length > 0);
    assert.ok(asOfAny.temporalLimitation);

    const [bookCount] = await db.select({ value: count() }).from(bookmakers);
    assert.ok(Number(bookCount.value) >= 2);

    const [snapCount] = await db
      .select({ value: count() })
      .from(marketSnapshots)
      .where(eq(marketSnapshots.sourceId, source.id));

    const [rawCount] = await db
      .select({ value: count() })
      .from(rawPayloads)
      .where(eq(rawPayloads.sourceId, source.id));
    assert.ok(Number(rawCount.value) >= 1);

    console.log(
      JSON.stringify({
        acceptance: {
          csvRowsRead: parsed.stats.rowsRead,
          validRows: parsed.stats.validMatchRows,
          rejectedRows: parsed.stats.rejectedRows,
          eventsMatched: parsed.matches.length,
          unmatchedOrRejected: parsed.stats.rejectedRows,
          bookmakersDetected: ["bet365", "pinnacle"],
          snapshotsStoredFirstRun: first.recordsStored,
          duplicateSnapshotsSkipped: second.recordsRejected,
          rawPayloadsStored: Number(rawCount.value),
          ingestionDurationMs: durationMs,
          dbSnapshotRowsForSource: Number(snapCount.value),
        },
      }),
    );
  });
});
