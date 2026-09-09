import { and, eq, lte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  dataSources,
  eloSnapshots,
  eventOutcomes,
  featureObservations,
  sports,
} from "@/db/schema";
import {
  buildEloSnapshotIdentityKey,
  buildEventOutcomeIdentityKey,
  buildFeatureObservationIdentityKey,
  resultCodeFromScores,
} from "@/domain/eval/identity-keys";
import { classifyEloProvenance } from "@/domain/features/elo";

function isUniqueViolation(error: unknown): boolean {
  const parts: string[] = [];
  let current: unknown = error;
  for (let i = 0; i < 4 && current; i++) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = (current as Error & { cause?: unknown }).cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  const text = parts.join(" | ");
  return (
    text.includes("duplicate key") ||
    text.includes("23505") ||
    text.includes("_identity_uidx") ||
    text.includes("unique constraint")
  );
}

export async function ensureClubEloDataSource(): Promise<string> {
  const db = getDb();
  const existing = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.slug, "clubelo"))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const [row] = await db
    .insert(dataSources)
    .values({
      slug: "clubelo",
      name: "ClubElo",
      licenseClass: "public_endpoint",
    })
    .returning({ id: dataSources.id });
  return row!.id;
}

export async function insertEventOutcome(input: {
  eventId: string;
  sportId: string;
  homeScore: number;
  awayScore: number;
  observedAt: Date;
  availableAt: Date;
  rawPayloadId?: string | null;
}): Promise<{ stored: boolean; id: string | null }> {
  const resultCode = resultCodeFromScores(input.homeScore, input.awayScore);
  const identityKey = buildEventOutcomeIdentityKey({
    eventId: input.eventId,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    resultCode,
    availableAt: input.availableAt,
  });
  const db = getDb();
  const ingestedAt = new Date();
  try {
    const [row] = await db
      .insert(eventOutcomes)
      .values({
        eventId: input.eventId,
        sportId: input.sportId,
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        resultCode,
        observedAt: input.observedAt,
        availableAt: input.availableAt,
        ingestedAt,
        rawPayloadId: input.rawPayloadId ?? null,
        identityKey,
      })
      .returning({ id: eventOutcomes.id });
    return { stored: true, id: row!.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { stored: false, id: null };
    }
    throw error;
  }
}

export async function insertEloSnapshot(input: {
  sportId: string;
  teamId: string;
  sourceId: string;
  rating: number;
  snapshotAt: Date;
  observedAt: Date;
  availableAt: Date;
  temporalPrecision?: string;
  provenance?: string;
  rawPayloadId?: string | null;
}): Promise<{ stored: boolean }> {
  const provenance =
    input.provenance ??
    classifyEloProvenance(input.snapshotAt.toISOString().slice(0, 10));
  const ratingStr = input.rating.toFixed(4);
  const identityKey = buildEloSnapshotIdentityKey({
    teamId: input.teamId,
    snapshotAt: input.snapshotAt,
    rating: ratingStr,
    provenance,
  });
  const db = getDb();
  try {
    await db.insert(eloSnapshots).values({
      sportId: input.sportId,
      teamId: input.teamId,
      sourceId: input.sourceId,
      rating: ratingStr,
      snapshotAt: input.snapshotAt,
      observedAt: input.observedAt,
      availableAt: input.availableAt,
      ingestedAt: new Date(),
      rawPayloadId: input.rawPayloadId ?? null,
      temporalPrecision: input.temporalPrecision ?? "dataset_window",
      provenance,
      identityKey,
    });
    return { stored: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { stored: false };
    }
    throw error;
  }
}

export async function insertFeatureObservation(input: {
  eventId: string;
  sportId: string;
  featureKey: string;
  featureValueNumeric?: number | null;
  featureValueText?: string | null;
  featureValueJson?: unknown;
  observedAt: Date;
  availableAt: Date;
  sourceId?: string | null;
  temporalPrecision?: string;
  featureStatus: string;
  rawPayloadId?: string | null;
}): Promise<{ stored: boolean }> {
  const valueFingerprint = [
    input.featureValueNumeric ?? "",
    input.featureValueText ?? "",
    input.featureValueJson === undefined
      ? ""
      : JSON.stringify(input.featureValueJson),
  ].join("#");
  const identityKey = buildFeatureObservationIdentityKey({
    eventId: input.eventId,
    featureKey: input.featureKey,
    availableAt: input.availableAt,
    featureStatus: input.featureStatus,
    valueFingerprint,
  });
  const db = getDb();
  try {
    await db.insert(featureObservations).values({
      eventId: input.eventId,
      sportId: input.sportId,
      featureKey: input.featureKey,
      featureValueNumeric:
        input.featureValueNumeric === null || input.featureValueNumeric === undefined
          ? null
          : input.featureValueNumeric.toFixed(8),
      featureValueText: input.featureValueText ?? null,
      featureValueJson: input.featureValueJson ?? null,
      observedAt: input.observedAt,
      availableAt: input.availableAt,
      ingestedAt: new Date(),
      sourceId: input.sourceId ?? null,
      rawPayloadId: input.rawPayloadId ?? null,
      temporalPrecision: input.temporalPrecision ?? "exact",
      featureStatus: input.featureStatus,
      identityKey,
    });
    return { stored: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { stored: false };
    }
    throw error;
  }
}

export async function listEloAsOf(input: {
  teamId: string;
  asOf: Date;
  allowProvisional?: boolean;
}): Promise<Array<typeof eloSnapshots.$inferSelect>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(eloSnapshots)
    .where(
      and(
        eq(eloSnapshots.teamId, input.teamId),
        lte(eloSnapshots.availableAt, input.asOf),
      ),
    )
    .orderBy(sql`${eloSnapshots.availableAt} desc`)
    .limit(20);
  return rows.filter((r) => {
    if (input.allowProvisional) return true;
    return r.provenance === "official_clubelo";
  });
}

export async function countHistoricalTruthTables(): Promise<{
  eventOutcomes: number;
  eloSnapshots: number;
  featureObservations: number;
}> {
  const db = getDb();
  const [o] = await db.select({ n: sql<number>`count(*)::int` }).from(eventOutcomes);
  const [e] = await db.select({ n: sql<number>`count(*)::int` }).from(eloSnapshots);
  const [f] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(featureObservations);
  return {
    eventOutcomes: Number(o?.n ?? 0),
    eloSnapshots: Number(e?.n ?? 0),
    featureObservations: Number(f?.n ?? 0),
  };
}

export async function getFootballSportId(): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(sports)
    .where(eq(sports.slug, "football"))
    .limit(1);
  return rows[0]?.id ?? null;
}
