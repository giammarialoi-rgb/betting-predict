# TASK 011 — Schema check

**Decision: NO MIGRATION applied.**

Existing tables already support the multi-market research stack:

| Need | Existing |
| --- | --- |
| SOURCE ≠ BOOKMAKER | `data_sources`, `bookmakers` |
| market + line + selection + book + time | `market_snapshots` |
| outcomes / Elo / features | `event_outcomes`, `elo_snapshots`, `feature_observations` |
| events | `events`, `teams`, `competitions` |

Registries, consensus, edge levels, top-10, challenger records, and risk interfaces are **in-memory / domain modules** (plus `experiments/*.json`).

See `docs/task-011-schema-proposal.md` for **future** additive tables — not to be applied without approval.
