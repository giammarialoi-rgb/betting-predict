# TASK 052 — Duplicate event keys + live UI robustness

## FINAL VERDICT

```
UI_STATUS: PASS
DUPLICATE_KEYS: 0
DUPLICATE_EVENT_IDS_HANDLED: true
NEXT_EVENTS_RENDER: PASS
EVENT_DETAIL_RENDER: PASS
TEST: 522 pass
LINT: pass (warnings only)
LAB_A_MUTATION: false
CAPITAL: CLOSED
REAL_MONEY: false
AUTO_PROMOTION: false
LEAKAGE: PASS
REPRODUCIBILITY: PASS
FINAL_VERDICT: UI_ROBUSTNESS_READY
```

## Cause (type B — accidental)

Lab B `events.jsonl` contained **60 duplicated `event_id` values** (445 lines / 385 unique). Duplicates shared the same fingerprint — concurrent appenders wrote the same event twice. Not distinct multi-market rows.

`event_id` remains canonical. Store left append-only (not rewritten).

## Fix

1. `buildNextEvents046` — last-wins dedupe by `event_id` for dashboard rows
2. `reactListKey052` — composite React keys on Control Center + event detail (UI-only; index fallback)
3. Tests in `task-052-ui-keys.test.ts`

## Smoke

- `/api/permanent-live/status` — next_events 50 unique / 0 dups, `api_calls_ui: 0`
- event detail API 200
- `/actuarial-lab/live-total` renders

## Non-goals

No predictor / collector / Lab A / LOCK / capital / model changes. No TASK 053.

## Commands

```bash
pnpm lab:task-052
pnpm audit:task-052
pnpm test
pnpm lint
```
