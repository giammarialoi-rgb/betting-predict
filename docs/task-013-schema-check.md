# TASK 013 — Schema check

**Decision: NO MIGRATION.**

Existing tables remain sufficient for Blind Market Lab V1:

- `raw_payloads` — hash + raw CSV persistence
- `market_snapshots` — quotes
- `event_outcomes` / `elo_snapshots` / `feature_observations` — truth layer
- in-memory / JSON experiment artifacts under `experiments/`

Future candidates (coverage matrix persistence, correlation exposures,
challenger comparison runs) stay in `docs/task-013-schema-proposal.md`
and require explicit approval before apply.
