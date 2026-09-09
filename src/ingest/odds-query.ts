import { and, asc, count, desc, eq, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  bookmakers,
  dataSources,
  events,
  marketSnapshots,
} from "@/db/schema";
import { assertAsOf } from "@/lib/as-of";
import { parseOddsDecimal } from "@/domain/odds/math";
import {
  assertTemporalPrecision,
  canSatisfyPrecision,
  type TemporalPrecision,
} from "@/domain/odds/temporal";
import { FOOTBALL_DATA_CO_UK_SOURCE_ID } from "@/providers/football-data-co-uk/bookmakers";

export type MarketSnapshotRow = typeof marketSnapshots.$inferSelect;

export type MarketSnapshotAsOfResult = {
  rows: MarketSnapshotRow[];
  /** Present when requirePrecision=any and any unknown-precision row is included. */
  temporalLimitation: string | null;
};

export async function countMarketSnapshots(): Promise<number> {
  const db = getDb();
  const [row] = await db.select({ value: count() }).from(marketSnapshots);
  return Number(row?.value ?? 0);
}

export async function countFootballDataCoUkSnapshots(): Promise<number> {
  const db = getDb();
  const [source] = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.slug, FOOTBALL_DATA_CO_UK_SOURCE_ID));
  if (!source) {
    return 0;
  }
  const [row] = await db
    .select({ value: count() })
    .from(marketSnapshots)
    .where(eq(marketSnapshots.sourceId, source.id));
  return Number(row?.value ?? 0);
}

/**
 * Snapshots knowable at asOf (available_at <= asOf).
 *
 * requirePrecision:
 * - exact → unknown-precision rows are excluded; if caller asserts on them, throws
 * - any → unknown rows allowed; result.temporalLimitation documents the limit
 */
export async function listMarketSnapshotsAsOf(input: {
  asOf: Date;
  eventId?: string;
  requirePrecision?: "exact" | "any";
}): Promise<MarketSnapshotRow[]> {
  const result = await listMarketSnapshotsAsOfWithMeta(input);
  return result.rows;
}

export async function listMarketSnapshotsAsOfWithMeta(input: {
  asOf: Date;
  eventId?: string;
  requirePrecision?: "exact" | "any";
}): Promise<MarketSnapshotAsOfResult> {
  const requirePrecision = input.requirePrecision ?? "any";
  const db = getDb();
  const rows = input.eventId
    ? await db
        .select()
        .from(marketSnapshots)
        .where(
          and(
            eq(marketSnapshots.eventId, input.eventId),
            lte(marketSnapshots.availableAt, input.asOf),
          ),
        )
        .orderBy(asc(marketSnapshots.availableAt))
    : await db
        .select()
        .from(marketSnapshots)
        .where(lte(marketSnapshots.availableAt, input.asOf))
        .orderBy(asc(marketSnapshots.availableAt));

  const filtered = rows.filter((row) => {
    try {
      assertAsOf(input.asOf, row.availableAt);
    } catch {
      return false;
    }
    return canSatisfyPrecision(
      row.temporalPrecision as TemporalPrecision,
      requirePrecision,
    );
  });

  const hasUnknown = filtered.some(
    (row) => (row.temporalPrecision as TemporalPrecision) !== "exact",
  );

  return {
    rows: filtered,
    temporalLimitation: hasUnknown
      ? "Includes rows with temporal_precision=unknown (calendar-date anchor; actual observation/availability time unknown). Not valid for intraday exact AS-OF."
      : null,
  };
}

export type ClosingLineQuery = {
  eventId: string;
  bookmakerId: string;
  marketType: string;
  selectionSide: string;
  line?: string | null;
  asOf?: Date;
  requirePrecision?: "exact" | "any";
};

/**
 * Exact-tick closing helper (TASK 005 semantics).
 * Prefer getDatasetClosingOdds for football-data.co.uk dataset_close rows.
 */
export async function selectClosingLine(
  query: ClosingLineQuery,
): Promise<MarketSnapshotRow | null> {
  const db = getDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, query.eventId));
  if (!event) {
    return null;
  }

  const asOf = query.asOf ?? event.scheduledStartAt;
  const cutoff =
    asOf.getTime() < event.scheduledStartAt.getTime()
      ? asOf
      : event.scheduledStartAt;
  const requirePrecision = query.requirePrecision ?? "any";

  const rows = await db
    .select()
    .from(marketSnapshots)
    .where(
      and(
        eq(marketSnapshots.eventId, query.eventId),
        eq(marketSnapshots.bookmakerId, query.bookmakerId),
        eq(marketSnapshots.marketType, query.marketType),
        eq(marketSnapshots.selectionSide, query.selectionSide),
        lte(marketSnapshots.availableAt, cutoff),
      ),
    )
    .orderBy(desc(marketSnapshots.availableAt));

  const matched = rows.find((row) => {
    if ((row.line ?? null) !== (query.line ?? null)) {
      return false;
    }
    if (row.observationKind === "dataset_open" || row.observationKind === "dataset_close") {
      return false;
    }
    try {
      assertAsOf(cutoff, row.availableAt);
    } catch {
      return false;
    }
    return canSatisfyPrecision(
      row.temporalPrecision as TemporalPrecision,
      requirePrecision,
    );
  });

  return matched ?? null;
}

export async function selectOpeningLine(
  query: ClosingLineQuery,
): Promise<MarketSnapshotRow | null> {
  const db = getDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, query.eventId));
  if (!event) {
    return null;
  }

  const asOf = query.asOf ?? event.scheduledStartAt;
  const cutoff =
    asOf.getTime() < event.scheduledStartAt.getTime()
      ? asOf
      : event.scheduledStartAt;
  const requirePrecision = query.requirePrecision ?? "any";

  const rows = await db
    .select()
    .from(marketSnapshots)
    .where(
      and(
        eq(marketSnapshots.eventId, query.eventId),
        eq(marketSnapshots.bookmakerId, query.bookmakerId),
        eq(marketSnapshots.marketType, query.marketType),
        eq(marketSnapshots.selectionSide, query.selectionSide),
        lte(marketSnapshots.availableAt, cutoff),
      ),
    )
    .orderBy(asc(marketSnapshots.availableAt));

  const matched = rows.find((row) => {
    if ((row.line ?? null) !== (query.line ?? null)) {
      return false;
    }
    if (row.observationKind === "dataset_open" || row.observationKind === "dataset_close") {
      return false;
    }
    try {
      assertAsOf(cutoff, row.availableAt);
    } catch {
      return false;
    }
    return canSatisfyPrecision(
      row.temporalPrecision as TemporalPrecision,
      requirePrecision,
    );
  });

  return matched ?? null;
}

/**
 * Closing odds classified by the dataset (observation_kind = dataset_close).
 * Does NOT use "last inserted row".
 */
export async function getDatasetClosingOdds(query: {
  eventId: string;
  bookmakerId: string;
  marketType: string;
  selectionSide: string;
  line?: string | null;
  requirePrecision?: "exact" | "any";
}): Promise<MarketSnapshotRow | null> {
  const requirePrecision = query.requirePrecision ?? "any";
  const db = getDb();
  const rows = await db
    .select()
    .from(marketSnapshots)
    .where(
      and(
        eq(marketSnapshots.eventId, query.eventId),
        eq(marketSnapshots.bookmakerId, query.bookmakerId),
        eq(marketSnapshots.marketType, query.marketType),
        eq(marketSnapshots.selectionSide, query.selectionSide),
        eq(marketSnapshots.observationKind, "dataset_close"),
      ),
    )
    .orderBy(desc(marketSnapshots.availableAt));

  const matched = rows.find((row) => {
    if ((row.line ?? null) !== (query.line ?? null)) {
      return false;
    }
    if (requirePrecision === "exact") {
      assertTemporalPrecision(
        row.temporalPrecision as TemporalPrecision,
        "exact",
      );
    }
    return true;
  });

  return matched ?? null;
}

export async function getDatasetOpeningOdds(query: {
  eventId: string;
  bookmakerId: string;
  marketType: string;
  selectionSide: string;
  line?: string | null;
  requirePrecision?: "exact" | "any";
}): Promise<MarketSnapshotRow | null> {
  const requirePrecision = query.requirePrecision ?? "any";
  const db = getDb();
  const rows = await db
    .select()
    .from(marketSnapshots)
    .where(
      and(
        eq(marketSnapshots.eventId, query.eventId),
        eq(marketSnapshots.bookmakerId, query.bookmakerId),
        eq(marketSnapshots.marketType, query.marketType),
        eq(marketSnapshots.selectionSide, query.selectionSide),
        eq(marketSnapshots.observationKind, "dataset_open"),
      ),
    )
    .orderBy(asc(marketSnapshots.availableAt));

  const matched = rows.find((row) => {
    if ((row.line ?? null) !== (query.line ?? null)) {
      return false;
    }
    if (requirePrecision === "exact") {
      assertTemporalPrecision(
        row.temporalPrecision as TemporalPrecision,
        "exact",
      );
    }
    return true;
  });

  return matched ?? null;
}

export async function getBookmakerBySlug(slug: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(bookmakers)
    .where(eq(bookmakers.slug, slug));
  return row ?? null;
}

export function snapshotOddsNumber(row: MarketSnapshotRow): number {
  return parseOddsDecimal(row.oddsDecimal);
}
