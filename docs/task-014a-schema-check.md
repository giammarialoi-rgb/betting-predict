# TASK 014-A — Schema check

**Decision: NO MIGRATION.**

Source Intelligence V1 lives in domain modules + JSON artifacts under
`experiments/`. No Neon tables required for the 500+ candidate catalog,
independence clusters, value scores, or DATA_GAP rankings.

See `docs/task-014a-schema-proposal.md` for optional future persistence.
