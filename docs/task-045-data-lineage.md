# TASK 045 — Data lineage

| Stream | Path | Writer |
|--------|------|--------|
| Lab A scientific | `audit/external/task-039` | collector-042 only |
| Lab B factory | `audit/external/task-044` | factory-045 + permanent-044 |
| Seed import | Lab A → Lab B | `origin=LAB_A_SEED` |
| Live discovery | Odds API → Lab B | `origin=DISCOVERED_LIVE` |

Clocks: `available_at` from provider `last_update`; `collected_at` = retrieval. Never equate them for STRICT.
