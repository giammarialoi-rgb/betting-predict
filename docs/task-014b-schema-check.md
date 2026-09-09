# TASK 014-B — Schema check

**Decision: NO MIGRATION.**

Acquisition results, market observations, quality matrices, and ClubElo
snapshots for this task live in domain modules + `experiments/` +
`docs/task-014b-*.md`. Existing Neon tables (`raw_payloads`,
`market_snapshots`, `elo_snapshots`, `event_outcomes`) remain sufficient
when persisting via existing ingest paths.

If a new general-purpose stats table is required later → separate proposal.
