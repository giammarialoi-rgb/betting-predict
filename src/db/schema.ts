import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const licenseClassEnum = pgEnum("license_class", [
  "official_api",
  "public_endpoint",
  "dataset",
  "website",
  "scraping_candidate",
  "license_sensitive",
  "unknown",
]);

export const ingestionRunStatusEnum = pgEnum("ingestion_run_status", [
  "running",
  "succeeded",
  "failed",
  "partial",
]);

export const sourceEntityTypeEnum = pgEnum("source_entity_type", [
  "competition",
  "team",
  "event",
]);

export const sports = pgTable("sports", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const dataSources = pgTable("data_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  licenseClass: licenseClassEnum("license_class").notNull(),
  reliabilityScore: integer("reliability_score"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const ingestionRuns = pgTable("ingestion_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => dataSources.id),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: ingestionRunStatusEnum("status").notNull().default("running"),
  requestMeta: jsonb("request_meta").$type<Record<string, unknown>>(),
  recordsReceived: integer("records_received").notNull().default(0),
  recordsStored: integer("records_stored").notNull().default(0),
  recordsRejected: integer("records_rejected").notNull().default(0),
  errorMessage: text("error_message"),
});

export const rawPayloads = pgTable(
  "raw_payloads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => ingestionRuns.id),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => dataSources.id),
    externalId: text("external_id").notNull(),
    payloadJson: jsonb("payload_json").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    sourcePublishedAt: timestamp("source_published_at", { withTimezone: true }),
    contentHash: text("content_hash").notNull(),
  },
  (table) => [
    uniqueIndex("raw_payloads_source_external_hash_uidx").on(
      table.sourceId,
      table.externalId,
      table.contentHash,
    ),
  ],
);

export const asOfSnapshots = pgTable("as_of_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  label: text("label").notNull(),
  watermarkT: timestamp("watermark_t", { withTimezone: true }).notNull(),
});

export const competitions = pgTable("competitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sportId: uuid("sport_id")
    .notNull()
    .references(() => sports.id),
  name: text("name").notNull(),
  country: text("country"),
  season: text("season"),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull(),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
  rawPayloadId: uuid("raw_payload_id").references(() => rawPayloads.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  sportId: uuid("sport_id")
    .notNull()
    .references(() => sports.id),
  name: text("name").notNull(),
  country: text("country"),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull(),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
  rawPayloadId: uuid("raw_payload_id").references(() => rawPayloads.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  sportId: uuid("sport_id")
    .notNull()
    .references(() => sports.id),
  competitionId: uuid("competition_id")
    .notNull()
    .references(() => competitions.id),
  homeTeamId: uuid("home_team_id")
    .notNull()
    .references(() => teams.id),
  awayTeamId: uuid("away_team_id")
    .notNull()
    .references(() => teams.id),
  scheduledStartAt: timestamp("scheduled_start_at", {
    withTimezone: true,
  }).notNull(),
  status: text("status").notNull(),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull(),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
  rawPayloadId: uuid("raw_payload_id").references(() => rawPayloads.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sourceEntityMap = pgTable(
  "source_entity_map",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => dataSources.id),
    entityType: sourceEntityTypeEnum("entity_type").notNull(),
    providerEntityId: text("provider_entity_id").notNull(),
    canonicalId: uuid("canonical_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("source_entity_map_source_type_provider_uidx").on(
      table.sourceId,
      table.entityType,
      table.providerEntityId,
    ),
  ],
);

/** Bookmaker/operator that offers a price. Distinct from data_sources (technical origin). */
export const bookmakers = pgTable("bookmakers", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Append-only market price observation.
 * event_time ≠ observed_at ≠ available_at ≠ ingested_at.
 * Never update an existing row; insert a new snapshot instead.
 */
export const marketSnapshots = pgTable(
  "market_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => dataSources.id),
    bookmakerId: uuid("bookmaker_id")
      .notNull()
      .references(() => bookmakers.id),
    marketType: text("market_type").notNull(),
    selectionSide: text("selection_side").notNull(),
    selectionRef: text("selection_ref"),
    line: text("line"),
    oddsDecimal: numeric("odds_decimal", { precision: 12, scale: 6 }).notNull(),
    /**
     * exact_tick = real observation clock (mock / future feeds)
     * dataset_open / dataset_close = football-data.co.uk column class
     */
    observationKind: text("observation_kind").notNull().default("exact_tick"),
    /**
     * exact = observed_at/available_at are real clocks
     * unknown = calendar-date anchor only; actual quote time unknown
     * dataset_window = reserved for documented collection windows (unused in TASK 006)
     */
    temporalPrecision: text("temporal_precision").notNull().default("exact"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull(),
    rawPayloadId: uuid("raw_payload_id").references(() => rawPayloads.id),
    identityKey: text("identity_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("market_snapshots_source_identity_uidx").on(
      table.sourceId,
      table.identityKey,
    ),
    index("market_snapshots_event_available_idx").on(
      table.eventId,
      table.availableAt,
    ),
    index("market_snapshots_event_book_market_available_idx").on(
      table.eventId,
      table.bookmakerId,
      table.marketType,
      table.availableAt,
    ),
    index("market_snapshots_event_kind_book_idx").on(
      table.eventId,
      table.observationKind,
      table.bookmakerId,
    ),
  ],
);

/**
 * Append-only observed match outcome (facts only — never features).
 * Corrections = future versioning (out of scope); do not UPDATE rows.
 */
export const eventOutcomes = pgTable(
  "event_outcomes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    sportId: uuid("sport_id")
      .notNull()
      .references(() => sports.id),
    homeScore: integer("home_score").notNull(),
    awayScore: integer("away_score").notNull(),
    /** HOME | DRAW | AWAY */
    resultCode: text("result_code").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull(),
    rawPayloadId: uuid("raw_payload_id").references(() => rawPayloads.id),
    identityKey: text("identity_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("event_outcomes_identity_uidx").on(table.identityKey),
    index("event_outcomes_event_available_idx").on(
      table.eventId,
      table.availableAt,
    ),
  ],
);

/**
 * Append-only Elo rating snapshots from an identified source (e.g. ClubElo).
 * snapshot_at = rating epoch; available_at = when knowable for AS-OF.
 */
export const eloSnapshots = pgTable(
  "elo_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sportId: uuid("sport_id")
      .notNull()
      .references(() => sports.id),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => dataSources.id),
    rating: numeric("rating", { precision: 12, scale: 4 }).notNull(),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull(),
    rawPayloadId: uuid("raw_payload_id").references(() => rawPayloads.id),
    temporalPrecision: text("temporal_precision").notNull().default("dataset_window"),
    /** official_clubelo | provisional_blocked | unknown */
    provenance: text("provenance").notNull().default("unknown"),
    identityKey: text("identity_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("elo_snapshots_source_identity_uidx").on(
      table.sourceId,
      table.identityKey,
    ),
    index("elo_snapshots_team_available_idx").on(
      table.teamId,
      table.availableAt,
    ),
  ],
);

/**
 * Append-only feature observations for Blind Historical Replay.
 * Extensible values: numeric / text / json — no one-column-per-feature schema.
 */
export const featureObservations = pgTable(
  "feature_observations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    sportId: uuid("sport_id")
      .notNull()
      .references(() => sports.id),
    featureKey: text("feature_key").notNull(),
    featureValueNumeric: numeric("feature_value_numeric", {
      precision: 18,
      scale: 8,
    }),
    featureValueText: text("feature_value_text"),
    featureValueJson: jsonb("feature_value_json"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull(),
    sourceId: uuid("source_id").references(() => dataSources.id),
    rawPayloadId: uuid("raw_payload_id").references(() => rawPayloads.id),
    temporalPrecision: text("temporal_precision").notNull().default("exact"),
    /**
     * VALID | MISSING | FORBIDDEN | INSUFFICIENT_HISTORY | TEMPORAL_UNKNOWN
     */
    featureStatus: text("feature_status").notNull(),
    identityKey: text("identity_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("feature_observations_identity_uidx").on(table.identityKey),
    index("feature_observations_event_asof_idx").on(
      table.eventId,
      table.availableAt,
      table.featureKey,
    ),
  ],
);
