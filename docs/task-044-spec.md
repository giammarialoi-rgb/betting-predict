# TASK 044 — Spec (integrated)

Permanent prospective lab (**Lab B**) integrated with scientific **Lab A** (TASK 039/040/041).

## Labs

| Lab | Path | Role |
|-----|------|------|
| A | `audit/external/task-039` | 114 LOCKED events — READ_ONLY from 044 |
| B | `audit/external/task-044` | Permanent live intelligence (= `permanent-live` alias) |

## Cycle

DISCOVER → INGEST → ANALYZE → PREDICT → LOCK → MONITOR → RESULT → AUTOPSY → LEARN

## Hard rules

- No post-lock mutation of PredictionRecord / Lab A decisions
- `available_at ≠ collected_at`
- NO_BET is a valid PredictionRecord
- No synthetic data, no real money, no auto-promotion
- FINAL_VERDICT starts as `PROSPECTIVE_LAB_FOUNDATION` — never claim EDGE from infrastructure alone
- Do not open TASK 045 automatically

## Commands

See `docs/task-044-live-operations.md`.
