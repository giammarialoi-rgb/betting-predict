import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  bookmakers,
  competitions,
  dataSources,
  events,
  ingestionRuns,
  marketSnapshots,
  rawPayloads,
  sourceEntityMap,
  teams,
} from "@/db/schema";
import {
  buildMarketSnapshotIdentityKey,
  formatOddsDecimal,
  isSelectionSide,
} from "@/domain/odds/math";
import { isMarketType } from "@/domain/markets/catalog";
import { hashPayload } from "@/ingest/hash";
import { logIngest, sanitizeErrorMessage } from "@/ingest/logger";
import { computeTemporalFields } from "@/ingest/temporal";
import {
  getDataSourceBySlug,
  getSportBySlug,
  seedOperationalCatalog,
} from "@/ingest/seed";
import type { HistoricalOddsProvider } from "@/providers/odds/types";
import {
  MOCK_ODDS_EVENT_KICKOFF,
  MOCK_ODDS_EVENT_PROVIDER_ID,
  MOCK_ODDS_PROVIDER_ID,
} from "@/providers/odds/mock";

export type OddsIngestionResult = {
  runId: string;
  status: "succeeded" | "failed" | "partial";
  recordsReceived: number;
  recordsStored: number;
  recordsRejected: number;
  errorMessage: string | null;
  eventId: string | null;
};

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  const parts: string[] = [];
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (typeof current === "object") {
      const record = current as {
        code?: unknown;
        message?: unknown;
        cause?: unknown;
      };
      if (record.code === "23505" || record.code === 23505) {
        return true;
      }
      if (typeof record.message === "string") {
        parts.push(record.message);
      }
      current = record.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return /duplicate key|unique constraint|23505/i.test(parts.join(" "));
}

export async function seedOddsDataSources(): Promise<void> {
  await seedOperationalCatalog();
  const db = getDb();
  await db
    .insert(dataSources)
    .values({
      slug: MOCK_ODDS_PROVIDER_ID,
      name: "Mock Historical Odds Provider (technical)",
      licenseClass: "unknown",
      reliabilityScore: null,
    })
    .onConflictDoNothing({ target: dataSources.slug });
  await db
    .insert(dataSources)
    .values({
      slug: "football-data-co-uk",
      name: "football-data.co.uk Historical Market Baseline",
      licenseClass: "dataset",
      reliabilityScore: null,
    })
    .onConflictDoNothing({ target: dataSources.slug });
}

/** @deprecated use seedOddsDataSources */
export async function seedMockOddsDataSource(): Promise<void> {
  await seedOddsDataSources();
}

export async function ensureBookmaker(input: {
  slug: string;
  name: string;
}): Promise<string> {
  const db = getDb();
  await db
    .insert(bookmakers)
    .values({ slug: input.slug, name: input.name })
    .onConflictDoNothing({ target: bookmakers.slug });
  const [row] = await db
    .select()
    .from(bookmakers)
    .where(eq(bookmakers.slug, input.slug));
  if (!row) {
    throw new Error(`bookmaker ${input.slug} missing after upsert`);
  }
  return row.id;
}

/**
 * Ensures a canonical fixture exists for mock odds Event X,
 * mapped via source_entity_map under the mock-odds source.
 */
export async function ensureMockOddsEvent(sourceId: string): Promise<string> {
  const db = getDb();
  const sport = await getSportBySlug("football");
  if (!sport) {
    throw new Error('sports.slug "football" is missing');
  }

  const [existing] = await db
    .select()
    .from(sourceEntityMap)
    .where(
      and(
        eq(sourceEntityMap.sourceId, sourceId),
        eq(sourceEntityMap.entityType, "event"),
        eq(sourceEntityMap.providerEntityId, MOCK_ODDS_EVENT_PROVIDER_ID),
      ),
    );
  if (existing) {
    return existing.canonicalId;
  }

  const now = new Date();
  const [competition] = await db
    .insert(competitions)
    .values({
      sportId: sport.id,
      name: "Mock Odds League",
      country: "Testland",
      season: "2026",
      observedAt: now,
      ingestedAt: now,
      availableAt: now,
    })
    .returning({ id: competitions.id });

  const [home] = await db
    .insert(teams)
    .values({
      sportId: sport.id,
      name: "Mock Odds Home",
      country: "Testland",
      observedAt: now,
      ingestedAt: now,
      availableAt: now,
    })
    .returning({ id: teams.id });

  const [away] = await db
    .insert(teams)
    .values({
      sportId: sport.id,
      name: "Mock Odds Away",
      country: "Testland",
      observedAt: now,
      ingestedAt: now,
      availableAt: now,
    })
    .returning({ id: teams.id });

  const [event] = await db
    .insert(events)
    .values({
      sportId: sport.id,
      competitionId: competition.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      scheduledStartAt: MOCK_ODDS_EVENT_KICKOFF,
      status: "SCHEDULED",
      observedAt: now,
      ingestedAt: now,
      availableAt: now,
    })
    .returning({ id: events.id });

  try {
    await db.insert(sourceEntityMap).values({
      sourceId,
      entityType: "event",
      providerEntityId: MOCK_ODDS_EVENT_PROVIDER_ID,
      canonicalId: event.id,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
    const [mapped] = await db
      .select()
      .from(sourceEntityMap)
      .where(
        and(
          eq(sourceEntityMap.sourceId, sourceId),
          eq(sourceEntityMap.entityType, "event"),
          eq(sourceEntityMap.providerEntityId, MOCK_ODDS_EVENT_PROVIDER_ID),
        ),
      );
    if (!mapped) {
      throw error;
    }
    return mapped.canonicalId;
  }

  return event.id;
}

export async function runOddsIngestion(options: {
  provider: HistoricalOddsProvider;
  /** Resolve provider event ids to canonical event ids. */
  resolveEventId: (
    providerEventId: string,
    sourceId: string,
  ) => Promise<string | null>;
}): Promise<OddsIngestionResult> {
  await seedOddsDataSources();
  const source = await getDataSourceBySlug(options.provider.id);
  if (!source) {
    throw new Error(
      `data_sources.slug "${options.provider.id}" is missing after seed`,
    );
  }

  const db = getDb();
  const [run] = await db
    .insert(ingestionRuns)
    .values({
      sourceId: source.id,
      status: "running",
      requestMeta: { provider: options.provider.id, kind: "historical_odds" },
    })
    .returning({ id: ingestionRuns.id });

  const stats = { received: 0, stored: 0, rejected: 0 };
  const errors: string[] = [];
  let eventId: string | null = null;
  const started = Date.now();

  try {
    const fetched = await options.provider.fetchOdds();
    const ingestedAt = new Date();
    const contentHash = hashPayload(fetched.payload);
    let rawId: string | null = null;

    try {
      const [raw] = await db
        .insert(rawPayloads)
        .values({
          runId: run.id,
          sourceId: source.id,
          externalId: `odds:${options.provider.id}`,
          payloadJson: fetched.payload as object,
          fetchedAt: fetched.fetchedAt,
          sourcePublishedAt: fetched.sourcePublishedAt,
          contentHash,
        })
        .returning({ id: rawPayloads.id });
      rawId = raw.id;
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }

    for (const snapshot of fetched.snapshots) {
      if (!isMarketType(snapshot.marketType)) {
        stats.rejected += snapshot.selections.length;
        continue;
      }

      const canonicalEventId = await options.resolveEventId(
        snapshot.providerEventId,
        source.id,
      );
      if (!canonicalEventId) {
        stats.rejected += snapshot.selections.length;
        continue;
      }
      eventId = canonicalEventId;

      const bookmakerId = await ensureBookmaker({
        slug: snapshot.bookmakerSlug,
        name: snapshot.bookmakerName,
      });

      for (const selection of snapshot.selections) {
        stats.received += 1;
        if (!isSelectionSide(selection.side)) {
          stats.rejected += 1;
          continue;
        }
        if (
          !Number.isFinite(selection.oddsDecimal) ||
          selection.oddsDecimal <= 1
        ) {
          stats.rejected += 1;
          continue;
        }

        const temporal = computeTemporalFields({
          fetchedAt: fetched.fetchedAt,
          ingestedAt,
          sourcePublishedAt:
            snapshot.sourcePublishedAt ?? fetched.sourcePublishedAt,
        });

        // exact_tick: available_at from temporal rules
        // dataset_open/close with unknown precision: calendar-date anchor only
        // (observedAt already holds dataset_date_anchor; never kickoff)
        const availableAt =
          snapshot.temporalPrecision === "unknown"
            ? snapshot.observedAt
            : temporal.availableAt;

        const oddsDecimal = formatOddsDecimal(selection.oddsDecimal);
        const identityKey = buildMarketSnapshotIdentityKey({
          bookmakerSlug: snapshot.bookmakerSlug,
          eventId: canonicalEventId,
          marketType: snapshot.marketType,
          selectionSide: selection.side,
          line: selection.line ?? null,
          observationKind: snapshot.observationKind,
          observedAt: snapshot.observedAt,
          oddsDecimal,
        });

        try {
          await db.insert(marketSnapshots).values({
            eventId: canonicalEventId,
            sourceId: source.id,
            bookmakerId,
            marketType: snapshot.marketType,
            selectionSide: selection.side,
            selectionRef: selection.selectionRef ?? null,
            line: selection.line ?? null,
            oddsDecimal,
            observationKind: snapshot.observationKind,
            temporalPrecision: snapshot.temporalPrecision,
            observedAt: snapshot.observedAt,
            availableAt,
            ingestedAt: temporal.ingestedAt,
            rawPayloadId: rawId,
            identityKey,
          });
          stats.stored += 1;
        } catch (error) {
          if (isUniqueViolation(error)) {
            stats.rejected += 1;
            continue;
          }
          throw error;
        }
      }
    }

    const finalStatus: OddsIngestionResult["status"] =
      stats.received === 0 ? "failed" : "succeeded";

    await db
      .update(ingestionRuns)
      .set({
        finishedAt: new Date(),
        status: finalStatus,
        recordsReceived: stats.received,
        recordsStored: stats.stored,
        recordsRejected: stats.rejected,
        errorMessage: errors.length > 0 ? errors.join("; ") : null,
        requestMeta: {
          provider: options.provider.id,
          kind: "historical_odds",
        },
      })
      .where(eq(ingestionRuns.id, run.id));

    logIngest({
      provider: options.provider.id,
      endpoint: "odds",
      runId: run.id,
      durationMs: Date.now() - started,
      status: "ok",
      records: {
        received: stats.received,
        stored: stats.stored,
        rejected: stats.rejected,
      },
    });

    return {
      runId: run.id,
      status: finalStatus,
      recordsReceived: stats.received,
      recordsStored: stats.stored,
      recordsRejected: stats.rejected,
      errorMessage: errors.length > 0 ? errors.join("; ") : null,
      eventId,
    };
  } catch (error) {
    const message = sanitizeErrorMessage(error);
    await db
      .update(ingestionRuns)
      .set({
        finishedAt: new Date(),
        status: "failed",
        recordsReceived: stats.received,
        recordsStored: stats.stored,
        recordsRejected: stats.rejected,
        errorMessage: message,
        requestMeta: {
          provider: options.provider.id,
          kind: "historical_odds",
        },
      })
      .where(eq(ingestionRuns.id, run.id));

    return {
      runId: run.id,
      status: "failed",
      recordsReceived: stats.received,
      recordsStored: stats.stored,
      recordsRejected: stats.rejected,
      errorMessage: message,
      eventId,
    };
  }
}

export async function runMockOddsIngestion(): Promise<OddsIngestionResult> {
  const { MockHistoricalOddsProvider } = await import("@/providers/odds/mock");
  const provider = new MockHistoricalOddsProvider();
  return runOddsIngestion({
    provider,
    resolveEventId: async (_providerEventId, sourceId) =>
      ensureMockOddsEvent(sourceId),
  });
}

async function lookupMappedEvent(
  sourceId: string,
  providerEventId: string,
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(sourceEntityMap)
    .where(
      and(
        eq(sourceEntityMap.sourceId, sourceId),
        eq(sourceEntityMap.entityType, "event"),
        eq(sourceEntityMap.providerEntityId, providerEventId),
      ),
    );
  return row?.canonicalId ?? null;
}

/**
 * Test/research helper: create a canonical event and map a football-data.co.uk
 * provider event id. Production ingest only looks up existing maps (no invent).
 */
export async function mapFootballDataCoUkEvent(input: {
  sourceId: string;
  providerEventId: string;
  competitionName: string;
  homeName: string;
  awayName: string;
  scheduledStartAt: Date;
}): Promise<string> {
  const existing = await lookupMappedEvent(input.sourceId, input.providerEventId);
  if (existing) {
    return existing;
  }

  const sport = await getSportBySlug("football");
  if (!sport) {
    throw new Error('sports.slug "football" is missing');
  }
  const db = getDb();
  const now = new Date();
  const [competition] = await db
    .insert(competitions)
    .values({
      sportId: sport.id,
      name: input.competitionName,
      country: null,
      season: null,
      observedAt: now,
      ingestedAt: now,
      availableAt: now,
    })
    .returning({ id: competitions.id });
  const [home] = await db
    .insert(teams)
    .values({
      sportId: sport.id,
      name: input.homeName,
      country: null,
      observedAt: now,
      ingestedAt: now,
      availableAt: now,
    })
    .returning({ id: teams.id });
  const [away] = await db
    .insert(teams)
    .values({
      sportId: sport.id,
      name: input.awayName,
      country: null,
      observedAt: now,
      ingestedAt: now,
      availableAt: now,
    })
    .returning({ id: teams.id });
  const [event] = await db
    .insert(events)
    .values({
      sportId: sport.id,
      competitionId: competition.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      scheduledStartAt: input.scheduledStartAt,
      status: "SCHEDULED",
      observedAt: now,
      ingestedAt: now,
      availableAt: now,
    })
    .returning({ id: events.id });

  try {
    await db.insert(sourceEntityMap).values({
      sourceId: input.sourceId,
      entityType: "event",
      providerEntityId: input.providerEventId,
      canonicalId: event.id,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
    const mapped = await lookupMappedEvent(input.sourceId, input.providerEventId);
    if (!mapped) {
      throw error;
    }
    return mapped;
  }
  return event.id;
}

export async function runFootballDataCoUkIngestion(options: {
  seasonCode: string;
  division: string;
  /** Inject CSV for offline tests. Omit for live download (may be BLOCKED). */
  csvText?: string;
}): Promise<OddsIngestionResult> {
  const { FootballDataCoUkOddsProvider, isFootballDataCoUkDivisionCode } = await import(
    "@/providers/football-data-co-uk/adapter"
  );
  if (!isFootballDataCoUkDivisionCode(options.division)) {
    throw new Error(`Unknown football-data.co.uk division code: ${options.division}`);
  }
  const provider = new FootballDataCoUkOddsProvider(
    { seasonCode: options.seasonCode, division: options.division },
    options.csvText != null ? { csvText: options.csvText } : {},
  );

  return runOddsIngestion({
    provider,
    resolveEventId: async (providerEventId, sourceId) =>
      lookupMappedEvent(sourceId, providerEventId),
  });
}
