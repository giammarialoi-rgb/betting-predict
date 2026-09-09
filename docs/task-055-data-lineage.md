# TASK 055 — Data lineage

## Unit

`event → market → line → selection → bookmaker → asOf → price`

## Lineage steps (catalog-055)

SOURCE → OBSERVATION → SNAPSHOT → FEATURE → ANALYSIS → PREDICTION → DECISION → LOCK → RESULT → AUTOPSY → LEARNING

Lock step carries `no_retroactive_prediction_edit`.

## Observability files (Lab B)

- `latest.json`, `health.json`, `current-work.json`
- `budget-state.json`, `source-health.json`, `coverage.json`
- `market_catalog.json` (observed markets only)
- append-only: `snapshots.jsonl`, `decisions.jsonl`, `settlements.jsonl`, `autopsies.jsonl`, `learning-cases.jsonl`, `counterfactuals.jsonl`, `updates.jsonl`, `daily-rankings.jsonl`, `model-runs.jsonl`
- `error-patterns.json`

Each record should carry `schema_version` / `created_at` / `source` / `event_id` where applicable.

## available_at vs collected_at

Scientific reconstruction uses `available_at`. Collection time is provenance only. Missing bins stay null — no interpolation.
