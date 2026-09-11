/**
 * Neon persistence for the free acquisition engine.
 * Registers real data_sources. Elo snapshots for ClubElo. Feature rows only
 * when a football sport + event UUID can be created without inventing scores.
 */
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { dataSources } from "@/db/schema";
import type { LicenseClass } from "@/domain/alignment-ids";
import { appendQuote044, loadStore044 } from "@/domain/eval/permanent-044/store";
import {
  ensureClubEloDataSource,
  getFootballSportId,
  insertEloSnapshot,
  insertFeatureObservation,
} from "@/ingest/historical-truth";
import { seedSportsFromCatalog } from "@/ingest/seed";
import { identitySlug } from "@/domain/eval/data-intelligence/research/identity-normalize";
import type { AcquisitionRecord } from "@/domain/eval/acquisition-engine/types";

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
  return /duplicate key|23505|unique constraint|_uidx/i.test(parts.join(" | "));
}

export async function ensureAcquisitionDataSource(input: {
  slug: string;
  name: string;
  licenseClass: LicenseClass;
}): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null;
  if (input.slug === "clubelo") {
    try {
      return await ensureClubEloDataSource();
    } catch (e) {
      console.warn("[acquisition-neon] clubelo source", e instanceof Error ? e.message : e);
      return null;
    }
  }
  const db = getDb();
  const existing = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.slug, input.slug))
    .limit(1);
  if (existing[0]) {
    if (existing[0].licenseClass === "unknown" || existing[0].name.toLowerCase().includes("mock")) {
      await db
        .update(dataSources)
        .set({
          name: input.name,
          licenseClass: input.licenseClass,
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
        slug: input.slug,
        name: input.name,
        licenseClass: input.licenseClass,
        reliabilityScore: null,
      })
      .returning({ id: dataSources.id });
    return row?.id ?? null;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const [again] = await db
      .select()
      .from(dataSources)
      .where(eq(dataSources.slug, input.slug))
      .limit(1);
    return again?.id ?? null;
  }
}

export async function persistClubEloRatings(input: {
  ratings: Array<{ teamName: string; rating: number; availableAt: Date; snapshotAt: Date }>;
  observedAt: Date;
  maxRows?: number;
}): Promise<{ stored: number; reason: string | null }> {
  if (!process.env.DATABASE_URL) return { stored: 0, reason: "DATABASE_URL not set" };
  try {
    await seedSportsFromCatalog();
    const sportId = await getFootballSportId();
    const sourceId = await ensureAcquisitionDataSource({
      slug: "clubelo",
      name: "ClubElo",
      licenseClass: "public_endpoint",
    });
    if (!sportId || !sourceId) {
      return { stored: 0, reason: "sports or data_sources row missing" };
    }
    const cap = input.maxRows ?? 40;
    let stored = 0;
    for (const row of input.ratings.slice(0, cap)) {
      const teamId = identitySlug(row.teamName);
      if (!teamId) continue;
      const res = await insertEloSnapshot({
        sportId,
        teamId,
        sourceId,
        rating: row.rating,
        snapshotAt: row.snapshotAt,
        observedAt: input.observedAt,
        availableAt: row.availableAt,
        temporalPrecision: "dataset_window",
        provenance: "official_clubelo",
      });
      if (res.stored) stored += 1;
    }
    return { stored, reason: null };
  } catch (e) {
    return { stored: 0, reason: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Persist CONTEXT / NOT_ELIGIBLE observations only when an existing event UUID
 * is supplied. Never invents scores or available_at.
 */
export async function persistAcquisitionFeatures(input: {
  sourceSlug: string;
  sourceName: string;
  licenseClass: LicenseClass;
  eventUuid: string;
  records: AcquisitionRecord[];
}): Promise<{ stored: number; reason: string | null }> {
  if (!process.env.DATABASE_URL) return { stored: 0, reason: "DATABASE_URL not set" };
  try {
    await seedSportsFromCatalog();
    const sportId = await getFootballSportId();
    const sourceId = await ensureAcquisitionDataSource({
      slug: input.sourceSlug,
      name: input.sourceName,
      licenseClass: input.licenseClass,
    });
    if (!sportId || !sourceId) {
      return { stored: 0, reason: "sports or data_sources row missing" };
    }
    let stored = 0;
    for (const rec of input.records) {
      if (rec.value == null) continue;
      const numeric = typeof rec.value === "number" && Number.isFinite(rec.value) ? rec.value : null;
      const text = typeof rec.value === "string" ? rec.value : null;
      if (numeric == null && text == null) continue;
      const res = await insertFeatureObservation({
        eventId: input.eventUuid,
        sportId,
        featureKey: rec.feature_key,
        featureValueNumeric: numeric,
        featureValueText: text,
        featureValueJson: {
          eligibility: rec.feature_status,
          context_status: rec.feature_status === "VALID" ? "REAL" : "CONTEXT",
          enters_independent_model: false,
          source_url: rec.source_url,
          extraction_method: rec.extraction_method,
          identity_status: rec.identity_status,
        },
        observedAt: new Date(rec.observed_at),
        availableAt: rec.available_at ? new Date(rec.available_at) : null,
        sourceId,
        temporalPrecision: rec.temporal_precision,
        featureStatus: rec.feature_status,
      });
      if (res.stored) stored += 1;
    }
    return { stored, reason: null };
  } catch (e) {
    return { stored: 0, reason: e instanceof Error ? e.message : String(e) };
  }
}

export async function registerAcquisitionSource(input: {
  slug: string;
  name: string;
  licenseClass: LicenseClass;
}): Promise<{ source_registered: boolean; elo_stored: number; features_stored: number; reason: string | null }> {
  try {
    const id = await ensureAcquisitionDataSource(input);
    return {
      source_registered: Boolean(id),
      elo_stored: 0,
      features_stored: 0,
      reason: id ? null : "DATABASE_URL not set or insert failed",
    };
  } catch (e) {
    return {
      source_registered: false,
      elo_stored: 0,
      features_stored: 0,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Compare-only 1X2 into Lab B quotes.jsonl. Never MODEL. Never invents a missing leg.
 */
export function persistCompareOnlyQuotes(input: {
  labBRoot: string;
  eventId: string;
  bookmaker: string;
  source: string;
  home: number;
  draw: number;
  away: number;
  collectedAt: string;
}): { stored: number; reason: string | null } {
  if (!(input.home > 1) || !(input.draw > 1) || !(input.away > 1)) {
    return { stored: 0, reason: "incomplete_1x2" };
  }
  try {
    const store = loadStore044(input.labBRoot);
    let stored = 0;
    for (const [selection, price] of [
      ["HOME", input.home],
      ["DRAW", input.draw],
      ["AWAY", input.away],
    ] as const) {
      const fingerprint = createHash("sha256")
        .update(
          ["acq-market", input.eventId, input.bookmaker, selection, String(price), input.collectedAt, input.source].join("|"),
        )
        .digest("hex");
      const res = appendQuote044(store, {
        event_id: input.eventId,
        bookmaker: input.bookmaker,
        market: "1X2",
        market_group: "1X2",
        market_type: "1X2",
        selection,
        line: null,
        price,
        available_at_utc: null,
        collected_at_utc: input.collectedAt,
        source: input.source,
        market_available: true,
        fingerprint,
      });
      if (res === "ok") stored += 1;
    }
    return { stored, reason: null };
  } catch (e) {
    return { stored: 0, reason: e instanceof Error ? e.message : String(e) };
  }
}
