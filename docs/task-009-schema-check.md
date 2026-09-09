# TASK 009 — Schema check

**Decision:** NO migration.

Existing tables (`event_outcomes`, `elo_snapshots`, `feature_observations`, `market_snapshots`) plus in-memory lab dataset are sufficient for the Historical Evaluation Lab.

Experiment versioning is persisted as versioned JSON under `experiments/` (not Neon) to avoid unapproved schema changes.
