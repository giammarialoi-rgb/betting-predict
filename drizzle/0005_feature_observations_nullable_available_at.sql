-- Additive: CONTEXT / NOT_ELIGIBLE features may have no demonstrated publication clock.
-- Do not invent available_at from scrape time or kickoff.
ALTER TABLE "feature_observations" ALTER COLUMN "available_at" DROP NOT NULL;
