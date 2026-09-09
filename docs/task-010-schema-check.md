# TASK 010 — Schema check

**Decision: NO MIGRATION.**

Existing Neon tables are sufficient for Real Truth Lab V1:

- `events`, `teams`, `competitions`
- `market_snapshots` (multi-market, bookmaker, observation_kind, temporal_precision)
- `event_outcomes`, `elo_snapshots`, `feature_observations`
- `bookmakers`, `data_sources`

Experiment manifests, coverage reports, prediction/evaluation/error records, and research explanations are versioned as in-memory / JSON artifacts under `experiments/` and domain modules — not new tables.

If TASK 011 needs durable experiment-run storage, propose additive tables then.
