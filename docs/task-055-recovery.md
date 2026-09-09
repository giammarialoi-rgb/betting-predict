# TASK 055 — Recovery

## Supervisor heal

`supervisor-054`: atomic PID locks, journal, spawn cooldown, store snapshot recovery, no duplicate workers.

## Restart semantics

On worker death during DISCOVERY / ANALYSIS / LOCK / SETTLEMENT / AUTOPSY / LEARNING:

1. Supervisor detects dead PID or stale heartbeat
2. Status → RECOVERING (not silent DEAD if supervisor alive)
3. Respawn worker after cooldown
4. Idempotent appends — locks immutable; never rewrite past LOCK

## Autostart recovery (no Cursor)

After Windows login, Startup shortcut and/or Task Scheduler runs `start-supervisor.ps1` with quoted paths.

Verify: `pnpm permanent-live:supervisor:verify-autostart`

Manual recover: `pnpm permanent-live:supervisor:recover`

## Store

Lab B append-only JSONL. Recovery never mutates Lab A.
