# TASK 043 — Preflight (no API)

Store: `audit/external/task-039/`

| metric | value |
|---|---|
| events | 114 |
| quotes | 72012 |
| decisions (LOCK) | 114 |
| settlements | 0 |
| sports | soccer only (6 leagues) |
| markets | 1X2 only |
| collector | RUNNING (042) |
| credits remaining | 402 |

## Decisions

- Reuse 039 store for events/quotes/locks/settlements (**immutable LOCKs**).
- Write 043 artifacts under `audit/external/task-043/` (catalog, predictions, snapshots, triangulation, autopsy, learning, daily reports).
- Do **not** rewrite `decisions.jsonl` / TASK_031_BASE / 040–042 scientific verdicts.
- Tennis + multi-market discovery is budget-gated via 042 governor; preflight spent **0** credits.
- MODEL_v1 starts as **MARKET_ONLY** (model_prob = MARKET_DEVIG) until live feature vectors exist — no fabricated edge.
