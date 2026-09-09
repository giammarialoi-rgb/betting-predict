# TASK 012 — Schema check

**Decision: NO MIGRATION.**

Existing Neon tables (`market_snapshots`, `event_outcomes`, `elo_snapshots`, `feature_observations`, `events`, `bookmakers`, `data_sources`) remain sufficient for:

- multi-market coverage matrices (in-memory / JSON artifacts)
- ClubElo asOf selection
- experiment manifests under `experiments/`
- blind bankroll replay (pure domain)

Future candidates (see `docs/task-012-schema-proposal.md`) require explicit approval before apply.
