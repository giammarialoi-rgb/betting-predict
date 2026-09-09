# TASK 053 — Full autonomous multi-sport live brain

## FINAL VERDICT

`UNIVERSAL_MASSIVE_LIVE_READY`

Reinforced Control Center (SYSTEM / CURRENT WORK / SportAdapter / health) without opening TASK 054.

## Hard guarantees

- Lab A READ_ONLY (`audit/external/task-039`)
- Lab B append-only (`audit/external/task-044`)
- No artificial event caps (budget / rate / validity only)
- `REAL_MONEY=false` · `AUTO_PROMOTION=false` · `MODEL_EDGE=UNKNOWN` until SETTLED≥100
- `open_task_054=false` in exp/lab (do not auto-open 054 from this path)
- Zero Odds API from browser

## New / reinforced surfaces

| Piece | Path |
|-------|------|
| SportAdapter | `src/domain/eval/bankroll-053/sport-adapter.ts` |
| Source health registry | `manifests/source-health.json` |
| WHY machine | `why-machine.ts` (MODEL_MIRRORS_MARKET → NO_BET, no invented edge) |
| Challenger shadow | `challenger.ts` (no auto-promotion) |
| SYSTEM / CURRENT WORK | Control Center + `system.ts` |
| Health | `/api/permanent-live/health` · `/actuarial-lab/live-total/health` · `pnpm permanent-live:health` |

## Commands

```bash
pnpm lab:task-053
pnpm audit:task-053
pnpm permanent-live:status
pnpm permanent-live:health
pnpm permanent-live:start
pnpm brain:status
```

## Sport status semantics

- `AVAILABLE` / `ACTIVE_DATA` — data present
- `EMPTY_WINDOW` / `ACTIVE_EMPTY` — provider OK, no events in window
- `PROVIDER_UNAVAILABLE` / `UNAVAILABLE` — not the same as zero events
- `BUDGET_BLOCKED` / `RATE_LIMITED` — explicit

Never silent `0` without status.
