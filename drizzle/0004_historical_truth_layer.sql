CREATE TABLE "event_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"sport_id" uuid NOT NULL,
	"home_score" integer NOT NULL,
	"away_score" integer NOT NULL,
	"result_code" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone NOT NULL,
	"raw_payload_id" uuid,
	"identity_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elo_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sport_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"rating" numeric(12, 4) NOT NULL,
	"snapshot_at" timestamp with time zone NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone NOT NULL,
	"raw_payload_id" uuid,
	"temporal_precision" text DEFAULT 'dataset_window' NOT NULL,
	"provenance" text DEFAULT 'unknown' NOT NULL,
	"identity_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"sport_id" uuid NOT NULL,
	"feature_key" text NOT NULL,
	"feature_value_numeric" numeric(18, 8),
	"feature_value_text" text,
	"feature_value_json" jsonb,
	"observed_at" timestamp with time zone NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone NOT NULL,
	"source_id" uuid,
	"raw_payload_id" uuid,
	"temporal_precision" text DEFAULT 'exact' NOT NULL,
	"feature_status" text NOT NULL,
	"identity_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_outcomes" ADD CONSTRAINT "event_outcomes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_outcomes" ADD CONSTRAINT "event_outcomes_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_outcomes" ADD CONSTRAINT "event_outcomes_raw_payload_id_raw_payloads_id_fk" FOREIGN KEY ("raw_payload_id") REFERENCES "public"."raw_payloads"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "elo_snapshots" ADD CONSTRAINT "elo_snapshots_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "elo_snapshots" ADD CONSTRAINT "elo_snapshots_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "elo_snapshots" ADD CONSTRAINT "elo_snapshots_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "elo_snapshots" ADD CONSTRAINT "elo_snapshots_raw_payload_id_raw_payloads_id_fk" FOREIGN KEY ("raw_payload_id") REFERENCES "public"."raw_payloads"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "feature_observations" ADD CONSTRAINT "feature_observations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "feature_observations" ADD CONSTRAINT "feature_observations_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "feature_observations" ADD CONSTRAINT "feature_observations_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "feature_observations" ADD CONSTRAINT "feature_observations_raw_payload_id_raw_payloads_id_fk" FOREIGN KEY ("raw_payload_id") REFERENCES "public"."raw_payloads"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "event_outcomes_identity_uidx" ON "event_outcomes" USING btree ("identity_key");
--> statement-breakpoint
CREATE INDEX "event_outcomes_event_available_idx" ON "event_outcomes" USING btree ("event_id","available_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "elo_snapshots_source_identity_uidx" ON "elo_snapshots" USING btree ("source_id","identity_key");
--> statement-breakpoint
CREATE INDEX "elo_snapshots_team_available_idx" ON "elo_snapshots" USING btree ("team_id","available_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "feature_observations_identity_uidx" ON "feature_observations" USING btree ("identity_key");
--> statement-breakpoint
CREATE INDEX "feature_observations_event_asof_idx" ON "feature_observations" USING btree ("event_id","available_at","feature_key");
