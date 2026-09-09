# TASK 044 — Data lineage

## Sources

- **EVENT_SOURCE / ODDS_SOURCE**: Lab A observation store (`task-039`) populated by collector 042 / Odds API
- **RESULT_SOURCE**: settlement scores via Lab A settle path
- **Lab B writes**: `audit/external/task-044/*.jsonl` only

## Clocks

| Field | Meaning |
|-------|---------|
| `available_at` | Source timestamp when quote/feature existed |
| `collected_at` | Retrieval clock — never used as available_at for STRICT |
| `lock_timestamp` | T−1h DecisionContext freeze |

## Info classes

1. `INFORMATION_AVAILABLE_BEFORE_LOCK`
2. `INFORMATION_AVAILABLE_AFTER_LOCK` (monitor only)
3. `RESULT_INFORMATION`
4. `POST_EVENT_ANALYSIS` (autopsy/counterfactual — never rewrites LOCK)

## Fingerprints

Events/quotes deduped by content fingerprint. Predictions append-only (`prediction_seq`).
