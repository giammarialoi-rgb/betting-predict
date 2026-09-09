# TASK 042 — Collector ops

## Commands

```bash
pnpm collector:task-042:once
pnpm collector:task-042:start
pnpm collector:task-042:stop
pnpm collector:task-042:status
pnpm collector:task-042:logs
pnpm collector:task-042:install
pnpm collector:task-042:uninstall
```

## Dashboard

Open `/actuarial-lab/collector` (refresh ~20s). Reads `/api/collector-042/status` only.

## Persist paths

| file | purpose |
|---|---|
| `collector.lock` | single instance PID |
| `collector-status.json` | heartbeat |
| `credit-state.json` | budget |
| `collector-meta.json` | discovery/backoff/lab trigger |
| `collector.log` | synthetic cycle log |
| `collector-stdout.log` / `collector-stderr.log` | daemon streams |
