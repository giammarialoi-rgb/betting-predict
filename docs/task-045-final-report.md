# TASK 045 — Final report

## Problem closed

**114 was seed, not a cap.** After `permanent-live:discover --force`:

| Metric | Value |
|--------|------:|
| TOTAL_EVENTS | **233** |
| SEED_EVENTS | 114 |
| DISCOVERED_LIVE_EVENTS | **119** |
| SOCCER_EVENTS | 233 |
| TENNIS_EVENTS | 0 (no active `tennis_*` keys in provider catalog at pull time) |
| PREDICTIONS | 575 |
| LOCKS (Lab B) | 114 |
| MARKETS_OBSERVED | 4 |
| CREDITS_REMAINING | 330 |
| LAB_A events/decisions | **114 / 114** (untouched) |
| FINAL_VERDICT | **PERMANENT_LIVE_READY** |
| MODEL_EDGE | UNKNOWN |
| CAPITAL | CLOSED |
| REAL_MONEY | false |
| AUTO_PROMOTION | false |
| LEAKAGE | PASS |

## Fix during task

Odds multi-market request initially included `btts` → provider ERROR. Corrected to `h2h,spreads,totals` (real markets only).

## Growth path

```
114 (seed)
→ 233 (after first factory discovery)
→ … continues with permanent-live:start / discover
```

## Commands

```
pnpm permanent-live:discover --force
pnpm permanent-live:collect
pnpm permanent-live:analyze
pnpm permanent-live:start
pnpm lab:task-045
pnpm task:045
pnpm audit:task-045
```

UI: `/actuarial-lab/live-total` · API: `/api/permanent-live/status`

TASK 046 not opened.
