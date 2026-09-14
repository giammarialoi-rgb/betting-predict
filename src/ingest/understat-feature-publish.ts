/**
 * Persist Understat xG research observations into Neon `data_sources` + `feature_observations`.
 *
 * available_at stays null (publication clock not demonstrated) → NOT_ELIGIBLE / CONTEXT.
 * Values are never invented; missing keys are omitted. Does not enter the independent model.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  competitions,
  dataSources,
  events,
  sourceEntityMap,
  teams,
} from "@/db/schema";
import { UNDERSTAT_XG_FEATURE_KEYS } from "@/domain/eval/data-intelligence/research/understat-league";
import { normalizeTeamName } from "@/domain/eval/data-intelligence/research/identity-normalize";
import type { ResearchObservation } from "@/domain/eval/data-intelligence/research/observations-store";
import {
  getFootballSportId,
  insertFeatureObservation,
} from "@/ingest/historical-truth";
import { seedSportsFromCatalog } from "@/ingest/seed";

export const UNDERSTAT_DATA_SOURCE_SLUG = "understat";

export type UnderstatPublishEvent = {
  event_id: string;
  home: string;
  away: string;
  competition?: string | null;
  kickoff_utc?: string | null;
  sport?: string | null;
};

export type UnderstatPublishResult = {
  attempted: boolean;
  source_id: string | null;
  event_uuid: string | null;
  stored: number;
  skipped: number;
  reason: string | null;
};

export type UnderstatFeaturePersistRow = {
  featureKey: string;
  featureValueNumeric: number;
  observedAt: Date;
  availableAt: Date | null;
  featureStatus: "ELIGIBLE" | "NOT_ELIGIBLE";
  temporalPrecision: "date_only" | "unknown";
  featureValueJson: {
    eligibility: "ELIGIBLE" | "NOT_ELIGIBLE";
    context_status: "MODEL" | "CONTEXT";
    enters_independent_model: boolean;
    lab_b_event_id: string;
    source_event_id: string | null;
    target_event_id: string | null;
    source_url: string | null;
    extraction_method: string;
    derived_from: string[];
  };
};

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
  return /duplicate key|23505|unique constraint|_identity_uidx|_uidx/i.test(parts.join(" | "));
}

export function isUnderstatXgObservation(row: Pick<ResearchObservation, "source" | "feature_key" | "value">): boolean {
  if (row.source !== UNDERSTAT_DATA_SOURCE_SLUG) return false;
  if (!(UNDERSTAT_XG_FEATURE_KEYS as readonly string[]).includes(row.feature_key)) return false;
  return typeof row.value === "number" && Number.isFinite(row.value);
}

export function researchObservationsFromDossierFeatures(input: {
  eventId: string;
  features: Array<{
    name: string;
    value: number | string | null;
    source: string;
    observed_at?: string | null;
    available_at?: string | null;
    derived_from?: string[];
  }>;
  sourceUrl?: string | null;
  observedAtFallback: string;
}): ResearchObservation[] {
  const out: ResearchObservation[] = [];
  for (const f of input.features) {
    if (f.source !== UNDERSTAT_DATA_SOURCE_SLUG) continue;
    if (!(UNDERSTAT_XG_FEATURE_KEYS as readonly string[]).includes(f.name)) continue;
    if (typeof f.value !== "number" || !Number.isFinite(f.value)) continue;
    out.push({
      event_id: input.eventId,
      feature_key: f.name,
      value: f.value,
      source: UNDERSTAT_DATA_SOURCE_SLUG,
      source_url: input.sourceUrl ?? null,
      observed_at: f.observed_at ?? input.observedAtFallback,
      available_at: f.available_at ?? null,
      extraction_method: "understat_getLeagueData_prior_only",
      confidence: null,
      status: "REAL",
      kind: "HISTORICAL_PRIOR",
      derived_from: f.derived_from,
      enters_independent_model: false,
      target_event_id: input.eventId,
    });
  }
  return out;
}
export function understatXgPersistRows(observations: ResearchObservation[]): UnderstatFeaturePersistRow[] {
  const out: UnderstatFeaturePersistRow[] = [];
  const seen = new Set<string>();
  for (const row of observations) {
    if (!isUnderstatXgObservation(row)) continue;
    if (seen.has(row.feature_key)) continue;
    seen.add(row.feature_key);
    const observedAt = new Date(row.observed_at);
    if (!Number.isFinite(observedAt.getTime())) continue;
    const availableAt =
      row.available_at && Number.isFinite(Date.parse(row.available_at))
        ? new Date(row.available_at)
        : null;
    const eligible = availableAt != null && row.enters_independent_model === true;
    out.push({
      featureKey: row.feature_key,
      featureValueNumeric: row.value as number,
      observedAt,
      availableAt,
      featureStatus: eligible ? "ELIGIBLE" : "NOT_ELIGIBLE",
      temporalPrecision: eligible ? "date_only" : "unknown",
      featureValueJson: {
        eligibility: eligible ? "ELIGIBLE" : "NOT_ELIGIBLE",
        context_status: eligible ? "MODEL" : "CONTEXT",
        enters_independent_model: eligible,
        lab_b_event_id: row.event_id,
        source_event_id: row.source_event_id ?? null,
        target_event_id: row.target_event_id ?? row.event_id,
        source_url: row.source_url,
        extraction_method: row.extraction_method,
        derived_from: row.derived_from ?? [],
      },
    });
  }
  return out;
}

export async function ensureUnderstatDataSource(): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null;
  const db = getDb();
  const existing = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.slug, UNDERSTAT_DATA_SOURCE_SLUG))
    .limit(1);
  if (existing[0]) {
    if (existing[0].licenseClass === "unknown" || existing[0].name.toLowerCase().includes("mock")) {
      await db
        .update(dataSources)
        .set({
          name: "Understat",
          licenseClass: "public_endpoint",
          reliabilityScore: null,
        })
        .where(eq(dataSources.id, existing[0].id));
    }
    return existing[0].id;
  }
  try {
    const [row] = await db
      .insert(dataSources)
      .values({
        slug: UNDERSTAT_DATA_SOURCE_SLUG,
        name: "Understat",
        licenseClass: "public_endpoint",
        reliabilityScore: null,
      })
      .returning({ id: dataSources.id });
    return row?.id ?? null;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const [again] = await db
      .select()
      .from(dataSources)
      .where(eq(dataSources.slug, UNDERSTAT_DATA_SOURCE_SLUG))
      .limit(1);
    return again?.id ?? null;
  }
}

let availableAtNullEnsured = false;

/** Honest null available_at for CONTEXT features — additive, idempotent. */
export async function ensureFeatureObservationsNullableAvailableAt(): Promise<void> {
  if (availableAtNullEnsured || !process.env.DATABASE_URL) return;
  const { neon } = await import("@neondatabase/serverless");
  const sqlClient = neon(process.env.DATABASE_URL);
  await sqlClient`ALTER TABLE feature_observations ALTER COLUMN available_at DROP NOT NULL`;
  availableAtNullEnsured = true;
}

async function lookupMapped(input: {
  sourceId: string;
  entityType: "competition" | "team" | "event";
  providerEntityId: string;
}): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(sourceEntityMap)
    .where(
      and(
        eq(sourceEntityMap.sourceId, input.sourceId),
        eq(sourceEntityMap.entityType, input.entityType),
        eq(sourceEntityMap.providerEntityId, input.providerEntityId),
      ),
    )
    .limit(1);
  return row?.canonicalId ?? null;
}

async function ensureMapped(input: {
  sourceId: string;
  entityType: "competition" | "team" | "event";
  providerEntityId: string;
  insertRow: () => Promise<string>;
}): Promise<string> {
  const existing = await lookupMapped(input);
  if (existing) return existing;
  const canonicalId = await input.insertRow();
  const db = getDb();
  try {
    await db.insert(sourceEntityMap).values({
      sourceId: input.sourceId,
      entityType: input.entityType,
      providerEntityId: input.providerEntityId,
      canonicalId,
    });
    return canonicalId;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const again = await lookupMapped(input);
    if (again) return again;
    throw error;
  }
}

async function ensureResearchEvent(input: {
  sourceId: string;
  event: UnderstatPublishEvent;
}): Promise<{ eventUuid: string; sportId: string } | { reason: string }> {
  await seedSportsFromCatalog();
  const sportId = await getFootballSportId();
  if (!sportId) return { reason: "sports.slug=football missing after seed" };

  const kickoffRaw = input.event.kickoff_utc;
  const kickoff = kickoffRaw ? new Date(kickoffRaw) : null;
  if (!kickoff || !Number.isFinite(kickoff.getTime())) {
    return { reason: "kickoff_utc missing or invalid — cannot create events row" };
  }

  const now = new Date();
  const db = getDb();
  const compKey = `labb-comp:${String(input.event.competition ?? "football").trim() || "football"}`;
  const competitionId = await ensureMapped({
    sourceId: input.sourceId,
    entityType: "competition",
    providerEntityId: compKey,
    insertRow: async () => {
      const [row] = await db
        .insert(competitions)
        .values({
          sportId,
          name: String(input.event.competition ?? "football").trim() || "football",
          country: null,
          season: null,
          observedAt: now,
          ingestedAt: now,
          availableAt: now,
        })
        .returning({ id: competitions.id });
      return row!.id;
    },
  });

  const homeKey = `labb-team:${normalizeTeamName(input.event.home)}`;
  const awayKey = `labb-team:${normalizeTeamName(input.event.away)}`;
  const homeTeamId = await ensureMapped({
    sourceId: input.sourceId,
    entityType: "team",
    providerEntityId: homeKey,
    insertRow: async () => {
      const [row] = await db
        .insert(teams)
        .values({
          sportId,
          name: input.event.home,
          observedAt: now,
          ingestedAt: now,
          availableAt: now,
        })
        .returning({ id: teams.id });
      return row!.id;
    },
  });
  const awayTeamId = await ensureMapped({
    sourceId: input.sourceId,
    entityType: "team",
    providerEntityId: awayKey,
    insertRow: async () => {
      const [row] = await db
        .insert(teams)
        .values({
          sportId,
          name: input.event.away,
          observedAt: now,
          ingestedAt: now,
          availableAt: now,
        })
        .returning({ id: teams.id });
      return row!.id;
    },
  });

  const eventKey = `labb-event:${input.event.event_id}`;
  const eventUuid = await ensureMapped({
    sourceId: input.sourceId,
    entityType: "event",
    providerEntityId: eventKey,
    insertRow: async () => {
      const [row] = await db
        .insert(events)
        .values({
          sportId,
          competitionId,
          homeTeamId,
          awayTeamId,
          scheduledStartAt: kickoff,
          status: "SCHEDULED",
          observedAt: now,
          ingestedAt: now,
          availableAt: now,
        })
        .returning({ id: events.id });
      return row!.id;
    },
  });

  return { eventUuid, sportId };
}

export async function publishUnderstatXgObservations(input: {
  observations: ResearchObservation[];
  event: UnderstatPublishEvent;
}): Promise<UnderstatPublishResult> {
  const empty: UnderstatPublishResult = {
    attempted: false,
    source_id: null,
    event_uuid: null,
    stored: 0,
    skipped: 0,
    reason: null,
  };
  if (!process.env.DATABASE_URL) {
    return { ...empty, reason: "DATABASE_URL not set" };
  }

  const rows = understatXgPersistRows(input.observations);
  try {
    await ensureFeatureObservationsNullableAvailableAt();
  } catch (error) {
    console.warn(
      "[understat-neon] available_at nullability ensure failed:",
      error instanceof Error ? error.message : error,
    );
  }

  let sourceId: string | null = null;
  try {
    sourceId = await ensureUnderstatDataSource();
  } catch (error) {
    return {
      ...empty,
      attempted: true,
      reason: `ensureUnderstatDataSource: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!sourceId) {
    return { ...empty, attempted: true, reason: "understat data_sources row not created" };
  }

  if (!rows.length) {
    return {
      attempted: true,
      source_id: sourceId,
      event_uuid: null,
      stored: 0,
      skipped: 0,
      reason: "no numeric Understat xG observations to persist",
    };
  }

  let resolved: { eventUuid: string; sportId: string };
  try {
    const got = await ensureResearchEvent({ sourceId, event: input.event });
    if ("reason" in got) {
      return {
        attempted: true,
        source_id: sourceId,
        event_uuid: null,
        stored: 0,
        skipped: rows.length,
        reason: got.reason,
      };
    }
    resolved = got;
  } catch (error) {
    return {
      attempted: true,
      source_id: sourceId,
      event_uuid: null,
      stored: 0,
      skipped: rows.length,
      reason: `ensureResearchEvent: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  let stored = 0;
  let skipped = 0;
  for (const row of rows) {
    try {
      const result = await insertFeatureObservation({
        eventId: resolved.eventUuid,
        sportId: resolved.sportId,
        featureKey: row.featureKey,
        featureValueNumeric: row.featureValueNumeric,
        featureValueJson: row.featureValueJson,
        observedAt: row.observedAt,
        availableAt: row.availableAt,
        sourceId,
        temporalPrecision: row.temporalPrecision,
        featureStatus: row.featureStatus,
      });
      if (result.stored) stored += 1;
      else skipped += 1;
    } catch (error) {
      skipped += 1;
      console.warn(
        `[understat-neon] feature_observations insert failed key=${row.featureKey}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    attempted: true,
    source_id: sourceId,
    event_uuid: resolved.eventUuid,
    stored,
    skipped,
    reason: stored === 0 && skipped > 0 ? "all rows skipped (duplicate or insert error)" : null,
  };
}
