# TASK 047 — Architecture notes

## Labs

| Lab | Path | Role |
|-----|------|------|
| A | `audit/external/task-039` | Scientific 114 LOCKED — READ_ONLY |
| B | `audit/external/task-044` | Permanent Live / prospective DB |

## Cycle priority (budget)

1. Settlement  
2. Imminent locks  
3. Snapshots of known events  
4. Discovery TODAY → 24H → 72H → 7D  
5. Extra sports  

`STOP_GRACEFULLY` if remaining would fall below `SAFE_REMAINING`.

## Append-only ledgers (Lab B)

events, quotes, markets, predictions, locks, updates (post-lock), settlements, autopsies, structured-why, backward-search, learning-cases, coverage-bins, daily-rankings, patterns manifest.

## Temporal rules

- `available_at` ≠ `collected_at`
- Coverage bin TRUE only with real quote in window
- LOCK immutable; post-lock is observational only
- Learning / patterns are OBSERVATION_ONLY until sufficient n
