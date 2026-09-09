# TASK 051 — Architecture

## Labs

| Lab | Path | Role |
|-----|------|------|
| A | `audit/external/task-039` | Scientific seed — **READ_ONLY** |
| B | `audit/external/task-044` | Permanent prospective store |
| Brain | `audit/external/task-044/brain/` | Daemon state, heartbeat, activity, locks |

TASK 051 adds layers on Lab B only. Never mutates Lab A, TASK_031_BASE, or existing LOCKs.

## Process model

```
Windows logon / pnpm brain:start
        ↓
brain-watchdog.ts  (PID in brain/watchdog.lock)
        ↓ spawns / restarts
brain-worker.ts    (PID in brain/worker.lock)
        ↓ loop
runBrainCycle051 → planCycle051 → runMassive049Cycle (+ paper ledger)
```

Cursor and terminals are not required after start. Watchdog restarts a dead worker.

## Priority scheduler

P0 settlement → P5 pre-lock refresh → P1 next 24h → P2 next 72h → P4 discovery. Adaptive sleep (60s–15m).

## Scientific firewall

- Capital CLOSED, REAL_MONEY false, AUTO_PROMOTION false
- Paper bets virtual only (`paper-bets.jsonl`)
- No auto model promotion after single errors
- UI / observatory: zero Odds API calls (`api_calls_ui: 0`)
- Lab/audit cycles use `allowDiscover: false` by default

## Code home

`src/domain/eval/brain-051/` — config, scheduler, health, cycle, paper, integrity, observatory, lab, audit.
