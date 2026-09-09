import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  asOfSnapshots,
  competitions,
  events,
  ingestionRuns,
  rawPayloads,
  sourceEntityMap,
  teams,
} from "@/db/schema";
import { hashPayload, requestExternalId } from "@/ingest/hash";
import { logIngest, sanitizeErrorMessage } from "@/ingest/logger";
import {
  getMinIntervalMs,
  waitForProviderSlot,
} from "@/ingest/rate-limit";
import {
  PermanentError,
  getMaxRetries,
  withRetry,
} from "@/ingest/retry";
import { findAliasPartners } from "@/domain/cross-source/aliases";
import { getDataSourceBySlug, getSportBySlug, seedOperationalCatalog } from "@/ingest/seed";
import { computeTemporalFields } from "@/ingest/temporal";
import type { LicenseClass } from "@/domain/alignment-ids";
import type {
  NormalizedBatch,
  ProviderFetchRequest,
  SportsDataProvider,
} from "@/providers/types";

export type IngestionStatus = "succeeded" | "failed" | "partial";

export type IngestionResult = {
  runId: string;
  status: IngestionStatus;
  recordsReceived: number;
  recordsStored: number;
  recordsRejected: number;
  errorMessage: string | null;
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

export async function runIngestion(options: {
  provider: SportsDataProvider;
  requests: ProviderFetchRequest[];
  licenseClass: LicenseClass;
}): Promise<IngestionResult> {
  await seedOperationalCatalog();

  const source = await getDataSourceBySlug(options.provider.id);
  if (!source) {
    throw new Error(
      `data_sources.slug "${options.provider.id}" is missing after seed`,
    );
  }

  const sport = await getSportBySlug("football");
  if (!sport) {
    throw new Error('sports.slug "football" is missing after seed');
  }

  const db = getDb();
  const [run] = await db
    .insert(ingestionRuns)
    .values({
      sourceId: source.id,
      status: "running",
      requestMeta: { provider: options.provider.id },
    })
    .returning({ id: ingestionRuns.id });

  const stats = {
    received: 0,
    stored: 0,
    rejected: 0,
  };
  let fetchFailures = 0;
  let fetchSuccesses = 0;
  const errors: string[] = [];
  let maxAvailableAt: Date | null = null;

  for (const request of options.requests) {
    const started = Date.now();
    try {
      await waitForProviderSlot(
        options.provider.id,
        options.provider.minIntervalMs ??
          getMinIntervalMs(process.env.INGEST_MIN_INTERVAL_MS),
      );

      const { value: fetched, retryCount } = await withRetry(
        () => options.provider.fetch(request),
        { maxRetries: getMaxRetries(process.env.INGEST_MAX_RETRIES) },
      );

      const ingestedAt = new Date();
      const contentHash = hashPayload(fetched.payload);
      const externalId = requestExternalId(request.kind, request.params);
      let rawId: string | null = null;

      try {
        const [raw] = await db
          .insert(rawPayloads)
          .values({
            runId: run.id,
            sourceId: source.id,
            externalId,
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

      const batch = options.provider.normalize(request.kind, fetched.payload);
      const persisted = await persistCanonical({
        batch,
        sourceId: source.id,
        sourceSlug: options.provider.id,
        sportId: sport.id,
        rawId,
        fetchedAt: fetched.fetchedAt,
        ingestedAt,
        payloadPublishedAt: fetched.sourcePublishedAt,
      });

      stats.received += persisted.received;
      stats.stored += persisted.stored;
      stats.rejected += persisted.rejected;
      if (persisted.maxAvailableAt) {
        if (!maxAvailableAt || persisted.maxAvailableAt > maxAvailableAt) {
          maxAvailableAt = persisted.maxAvailableAt;
        }
      }

      fetchSuccesses += 1;
      logIngest({
        provider: options.provider.id,
        endpoint: request.kind,
        runId: run.id,
        durationMs: Date.now() - started,
        status: "ok",
        httpStatus: fetched.httpStatus,
        retryCount,
        records: {
          received: persisted.received,
          stored: persisted.stored,
          rejected: persisted.rejected,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        fetchSuccesses += 1;
        stats.rejected += 1;
        continue;
      }
      fetchFailures += 1;
      const message = sanitizeErrorMessage(error);
      errors.push(`${request.kind}: ${message}`);
      logIngest({
        provider: options.provider.id,
        endpoint: request.kind,
        runId: run.id,
        durationMs: Date.now() - started,
        status: error instanceof PermanentError ? "permanent_error" : "retryable_error",
        httpStatus: "httpStatus" in (error as object)
          ? (error as { httpStatus?: number }).httpStatus
          : undefined,
      });
    }
  }

  const status: IngestionStatus =
    fetchSuccesses === 0
      ? "failed"
      : fetchFailures > 0
        ? "partial"
        : "succeeded";

  if (maxAvailableAt) {
    await db.insert(asOfSnapshots).values({
      label: `ingest:${run.id}`,
      watermarkT: maxAvailableAt,
    });
  }

  await db
    .update(ingestionRuns)
    .set({
      finishedAt: new Date(),
      status,
      recordsReceived: stats.received,
      recordsStored: stats.stored,
      recordsRejected: stats.rejected,
      errorMessage: errors.length > 0 ? errors.join("; ") : null,
      requestMeta: {
        provider: options.provider.id,
        licenseClass: options.licenseClass,
      },
    })
    .where(eq(ingestionRuns.id, run.id));

  return {
    runId: run.id,
    status,
    recordsReceived: stats.received,
    recordsStored: stats.stored,
    recordsRejected: stats.rejected,
    errorMessage: errors.length > 0 ? errors.join("; ") : null,
  };
}

async function persistCanonical(input: {
  batch: NormalizedBatch;
  sourceId: string;
  sourceSlug: string;
  sportId: string;
  rawId: string | null;
  fetchedAt: Date;
  ingestedAt: Date;
  payloadPublishedAt: Date | null;
}): Promise<{
  received: number;
  stored: number;
  rejected: number;
  maxAvailableAt: Date | null;
}> {
  let received = 0;
  let stored = 0;
  let rejected = 0;
  let maxAvailableAt: Date | null = null;

  const db = getDb();

  for (const competition of input.batch.competitions) {
    received += 1;
    const temporal = computeTemporalFields({
      fetchedAt: input.fetchedAt,
      ingestedAt: input.ingestedAt,
      sourcePublishedAt:
        competition.sourcePublishedAt ?? input.payloadPublishedAt,
    });
    const inserted = await insertMappedEntity({
      sourceId: input.sourceId,
      sourceSlug: input.sourceSlug,
      entityType: "competition",
      providerEntityId: competition.providerEntityId,
      insertRow: async () => {
        const [row] = await db
          .insert(competitions)
          .values({
            sportId: input.sportId,
            name: competition.name,
            country: competition.country,
            season: competition.season,
            observedAt: temporal.observedAt,
            ingestedAt: temporal.ingestedAt,
            availableAt: temporal.availableAt,
            rawPayloadId: input.rawId,
          })
          .returning({ id: competitions.id });
        return row.id;
      },
    });
    if (inserted === "stored") {
      stored += 1;
      maxAvailableAt = later(maxAvailableAt, temporal.availableAt);
    } else {
      rejected += 1;
    }
  }

  for (const team of input.batch.teams) {
    received += 1;
    const temporal = computeTemporalFields({
      fetchedAt: input.fetchedAt,
      ingestedAt: input.ingestedAt,
      sourcePublishedAt: team.sourcePublishedAt ?? input.payloadPublishedAt,
    });
    const inserted = await insertMappedEntity({
      sourceId: input.sourceId,
      sourceSlug: input.sourceSlug,
      entityType: "team",
      providerEntityId: team.providerEntityId,
      insertRow: async () => {
        const [row] = await db
          .insert(teams)
          .values({
            sportId: input.sportId,
            name: team.name,
            country: team.country,
            observedAt: temporal.observedAt,
            ingestedAt: temporal.ingestedAt,
            availableAt: temporal.availableAt,
            rawPayloadId: input.rawId,
          })
          .returning({ id: teams.id });
        return row.id;
      },
    });
    if (inserted === "stored") {
      stored += 1;
      maxAvailableAt = later(maxAvailableAt, temporal.availableAt);
    } else {
      rejected += 1;
    }
  }

  for (const event of input.batch.events) {
    received += 1;
    const competitionId = await lookupCanonicalOrAlias(
      input.sourceId,
      input.sourceSlug,
      "competition",
      event.competitionProviderId,
    );
    const homeTeamId = await lookupCanonicalOrAlias(
      input.sourceId,
      input.sourceSlug,
      "team",
      event.homeTeamProviderId,
    );
    const awayTeamId = await lookupCanonicalOrAlias(
      input.sourceId,
      input.sourceSlug,
      "team",
      event.awayTeamProviderId,
    );
    if (!competitionId || !homeTeamId || !awayTeamId) {
      rejected += 1;
      continue;
    }

    const temporal = computeTemporalFields({
      fetchedAt: input.fetchedAt,
      ingestedAt: input.ingestedAt,
      sourcePublishedAt: event.sourcePublishedAt ?? input.payloadPublishedAt,
    });
    const inserted = await insertMappedEntity({
      sourceId: input.sourceId,
      sourceSlug: input.sourceSlug,
      entityType: "event",
      providerEntityId: event.providerEntityId,
      insertRow: async () => {
        const [row] = await db
          .insert(events)
          .values({
            sportId: input.sportId,
            competitionId,
            homeTeamId,
            awayTeamId,
            scheduledStartAt: event.scheduledStartAt,
            status: event.status,
            observedAt: temporal.observedAt,
            ingestedAt: temporal.ingestedAt,
            availableAt: temporal.availableAt,
            rawPayloadId: input.rawId,
          })
          .returning({ id: events.id });
        return row.id;
      },
    });
    if (inserted === "stored") {
      stored += 1;
      maxAvailableAt = later(maxAvailableAt, temporal.availableAt);
    } else {
      rejected += 1;
    }
  }

  return { received, stored, rejected, maxAvailableAt };
}

async function lookupCanonical(
  sourceId: string,
  entityType: "competition" | "team" | "event",
  providerEntityId: string,
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(sourceEntityMap)
    .where(
      and(
        eq(sourceEntityMap.sourceId, sourceId),
        eq(sourceEntityMap.entityType, entityType),
        eq(sourceEntityMap.providerEntityId, providerEntityId),
      ),
    );
  return row?.canonicalId ?? null;
}

async function lookupCanonicalViaAlias(
  sourceSlug: string,
  entityType: "competition" | "team" | "event",
  providerEntityId: string,
): Promise<string | null> {
  for (const partner of findAliasPartners(sourceSlug, entityType, providerEntityId)) {
    const source = await getDataSourceBySlug(partner.source);
    if (!source) {
      continue;
    }
    const canonicalId = await lookupCanonical(
      source.id,
      entityType,
      partner.providerEntityId,
    );
    if (canonicalId) {
      return canonicalId;
    }
  }
  return null;
}

async function lookupCanonicalOrAlias(
  sourceId: string,
  sourceSlug: string,
  entityType: "competition" | "team" | "event",
  providerEntityId: string,
): Promise<string | null> {
  return (
    (await lookupCanonical(sourceId, entityType, providerEntityId)) ??
    (await lookupCanonicalViaAlias(sourceSlug, entityType, providerEntityId))
  );
}

async function insertMappedEntity(input: {
  sourceId: string;
  sourceSlug: string;
  entityType: "competition" | "team" | "event";
  providerEntityId: string;
  insertRow: () => Promise<string>;
}): Promise<"stored" | "rejected"> {
  const existing = await lookupCanonical(
    input.sourceId,
    input.entityType,
    input.providerEntityId,
  );
  if (existing) {
    return "rejected";
  }

  const db = getDb();
  const aliased =
    input.entityType === "event"
      ? null
      : await lookupCanonicalViaAlias(
          input.sourceSlug,
          input.entityType,
          input.providerEntityId,
        );
  const canonicalId = aliased ?? (await input.insertRow());
  try {
    await db.insert(sourceEntityMap).values({
      sourceId: input.sourceId,
      entityType: input.entityType,
      providerEntityId: input.providerEntityId,
      canonicalId,
    });
    return "stored";
  } catch (error) {
    if (isUniqueViolation(error)) {
      return "rejected";
    }
    throw error;
  }
}

function later(current: Date | null, next: Date): Date {
  return !current || next > current ? next : current;
}
