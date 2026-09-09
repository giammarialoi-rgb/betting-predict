# TASK 044 — Data architecture

Canonical store: `audit/external/task-044/`

Ledgers (append-only): events, markets, quotes, snapshots, predictions, updates, locks, settlements, autopsies, learning-candidates, learning-cases, error-patterns, model-runs, daily-rankings, source-health, journal.

Dirs: `schema/`, `manifests/`, `checkpoints/`, `event_catalog/`, `daily-reports/`.

Alias: `audit/external/permanent-live/README.md` → points here.

Lab A `task-039` never rewritten by 044 cycles.
