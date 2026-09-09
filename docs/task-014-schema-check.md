# TASK 014 — Schema check

**Decision: NO MIGRATION.**

Existing Neon tables + in-memory/JSON experiment artifacts remain sufficient for:

- SourceAvailabilityMatrix (domain registry + runtime status)
- Blind football attack lab metrics (`experiments/`)
- Risk budget paper stakes (ephemeral)
- Market coverage / bookmaker coverage matrices

Future tables (see `task-014-schema-proposal.md`) require explicit approval.
