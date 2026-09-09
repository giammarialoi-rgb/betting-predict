# TASK 047 — Universal Live Coverage + Market Intelligence

## FINAL VERDICT

```
FINAL_VERDICT: UNIVERSAL_LIVE_COVERAGE_READY
MODEL_EDGE: UNKNOWN
CAPITAL: CLOSED
REAL_MONEY: false
AUTO_PROMOTION: false
LAB_A_MUTATION: false
REPRODUCIBILITY: PASS
LEAKAGE: PASS
TOTAL_EVENTS: 233
SEED_EVENTS: 114
DISCOVERED_LIVE_EVENTS: 119
CATALOG_CAP: false
TENNIS_STATUS: TENNIS_PROVIDER_UNAVAILABLE
MARKETS_OBSERVED: 1X2,AH,H2H_LAY,OU
HORIZONS: today=7 24h=7 72h=36 7d=138
```

## What shipped

- `src/domain/eval/factory-047/` — budget priority firewall, market catalog, coverage bins, structured WHY, post-lock isolation, backward search, learning cases, pattern aggregation, ranking boards, coverage cycle
- Daemon (`permanent-live-run`) and once-shot use `runCoverage047Cycle` (Lab B only)
- Control Center `/actuarial-lab/live-total` horizons, tennis discovery status, markets observed, multi-rank TOP boards, learning patterns
- Event detail lifecycle + structured WHY + prediction vs actual
- Lab A remains READ_ONLY (114/114)
- Seed 114 is not a catalog cap
- Tennis: when provider keys = 0 → `TENNIS_PROVIDER_UNAVAILABLE` / Control Center `TENNIS DISCOVERY: BLOCKED / 0 AVAILABLE` (no synthetic data)
- Capital closed; no auto-promotion; no TASK 048

## Commands

```bash
pnpm test
pnpm lint
pnpm lab:task-047          # disk-only cycle + verdict
pnpm audit:task-047
pnpm task:047              # disk-only coverage cycle
pnpm permanent-live:once --discover   # optional live Odds pull under budget
```

## Artifacts

`artifacts/task-047/task-047-result.json`, `task-047-verdict.txt`
