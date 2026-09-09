ALTER TABLE "market_snapshots" ADD COLUMN "observation_kind" text DEFAULT 'exact_tick' NOT NULL;--> statement-breakpoint
ALTER TABLE "market_snapshots" ADD COLUMN "temporal_precision" text DEFAULT 'exact' NOT NULL;--> statement-breakpoint
CREATE INDEX "market_snapshots_event_kind_book_idx" ON "market_snapshots" USING btree ("event_id","observation_kind","bookmaker_id");