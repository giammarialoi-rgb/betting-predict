# TASK 055 — Architecture

## Labs

- **Lab A** `audit/external/task-039` — scientific 114 LOCKED events — immutable.
- **Lab B** `audit/external/task-044` — permanent-live append-only operational store.

## Process topology

```
Windows Autostart (Task Scheduler XML and/or Startup .lnk)
  → scripts/start-supervisor.ps1
    → supervisor (atomic lock, heartbeat, heal)
      → brain worker (cycle: discovery → analysis → lock → settle → autopsy → learning)
```

IDLE / SLEEP / PAUSED_BUDGET ≠ DEAD. Dead = PID gone or heartbeat past stale threshold.

## Data plane

| Layer | Module |
|-------|--------|
| Discovery adapters | `src/services/sources/*`, registry-055 |
| Sport diagnostics | bankroll-053 sport adapters / sports-registry |
| Multi-market catalog | factory-047 market-catalog → `market_catalog.json` |
| Decision engine | factory-048 + MODEL_v2_DECISION_ENGINE |
| WHY | factory-047/048 structured WHY |
| Lock / firewall | prospective-036 + permanent-044 firewall |
| Paper capital | bankroll-053 |
| Multi-source catalog | catalog-055 |
| Supervisor | supervisor-054 |
| Brain | brain-051 |
| Consolidation gates | catalog-055/consolidation.ts |

## Temporal firewall

- `available_at` ≠ `collected_at`
- Pre-lock data may enter DecisionContext
- Post-lock snapshots isolated
- Post-event only for settlement / autopsy / learning
- Never invent quotes, markets, edge, or missing snapshots

## UI / API

Browser → `/api/permanent-live/status|health` → disk observatory only (`API_CALLS_UI=0`).
