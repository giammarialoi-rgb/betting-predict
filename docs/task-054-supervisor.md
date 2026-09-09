# TASK 054 — 24/7 Supervisor

## Role

Persistent **SUPERVISOR** process monitors the **WORKER** (brain-worker), detects death/stale heartbeat, and self-heals with cooldown.

Cursor is **not** required at runtime.

## Commands

```bash
pnpm permanent-live:supervisor:start
pnpm permanent-live:supervisor:stop
pnpm permanent-live:supervisor:status
pnpm permanent-live:supervisor:logs
pnpm permanent-live:supervisor:recover
pnpm permanent-live:supervisor:install   # Task Scheduler ONLOGON + Startup shortcut
pnpm permanent-live:supervisor:uninstall
```

## Locks

- `audit/external/task-044/supervisor/supervisor.lock` — single supervisor
- `audit/external/task-044/brain/worker.lock` — single worker (`role: worker`)

Spawn cooldown: 90s (no duplicate workers).

## Official statuses

NORMAL · IDLE · WORKING · PAUSED_BUDGET · PAUSED_PROVIDER · RESTARTING · RECOVERING · DEGRADED · DEAD

**IDLE ≠ DEAD.** **PAUSED_BUDGET ≠ crash.**

## Autostart

`install-supervisor.ps1` creates:

1. Windows Task Scheduler `BettingPredict-Supervisor054` (ONLOGON) when permitted
2. Startup folder shortcut fallback

ACTIVE_MECHANISM is printed at install time.
