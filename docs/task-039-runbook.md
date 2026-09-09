# TASK 039 — Runbook

1. Put `THE_ODDS_API_KEY=` in `.env.local`. Never commit it.
2. `pnpm collect:task-039` — one cycle.
3. `pnpm collect:task-039:loop` — keep collecting.
4. `pnpm lab:task-039` — verdict + artifacts.

If the key is missing the collector exits 0 with LIVE_NOT_CONFIGURED. No synthetic quotes.
Next step after a key exists: COLLECT → LOCK → REVEAL → SETTLE → TEST → HOLDOUT → VERDICT.
Do not open TASK 040. Do not hunt historical archives.
