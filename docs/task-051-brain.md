# TASK 051 — Brain (daemon)

## Commands

```bash
pnpm brain:install     # Task Scheduler ONLOGON + Startup shortcut fallback
pnpm brain:uninstall
pnpm brain:start       # start watchdog (spawns worker)
pnpm brain:stop
pnpm brain:restart
pnpm brain:status
pnpm brain:logs
pnpm brain:once        # single disk cycle (no discover)
pnpm brain:once --discover   # optional live pull
```

## State files (Lab B)

- `brain/brain-state.json` — status, PIDs, cycles, errors, restarts
- `brain/heartbeat.json` — worker heartbeat
- `brain/worker.lock` / `brain/watchdog.lock`
- `brain/activity-feed.jsonl` — persistent activity
- `brain/logs/brain.log`

## Recovery

- Stale lock files cleared when PID is dead
- Restart increments `restart_count`
- Cycles are idempotent via Lab B fingerprint dedupe (events/quotes/locks/settlements)
- Graceful SIGINT/SIGTERM clears locks and marks STOPPED

## Independence

After `brain:install` + reboot (or `brain:start`), closing Cursor does not stop the brain.
