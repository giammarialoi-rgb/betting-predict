# TASK 041 — Data lineage

| artifact | path |
|---|---|
| source of truth | `audit/external/task-039/` |
| recover locks (040) | `decisions.jsonl` + `artifacts/task-040/locked_decisions.jsonl` |
| close artifacts | `artifacts/task-041/` |
| result | `artifacts/task-041-result.json` |

Append-only quotes. `available_at` = source `last_update`. `collected_at` never replaces quote clock.
Settlement ledger is separate from DecisionContext.
TASK_031_BASE is REFERENCE only — not counted as new STRICT live.

Adapter: `close-041/v1`. Dataset fingerprint: `a119ab5e11dbd9d0c576d04b6d61687b048037a366c6bb428ddd73eb4e6eb05e`.
