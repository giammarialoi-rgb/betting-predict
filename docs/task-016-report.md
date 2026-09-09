# TASK 016 — Blind Actuarial Bankroll Lab V1 — Report

## Status

**DONE** (in-memory ledger; **no migration**).

## Config

`experiments/exp_016_actuarial_bankroll_v1.json` — immutable; `winner: null`; `auto_promotion: false`.

## Code

| Area | Path |
|------|------|
| Blind replay | `src/domain/eval/bankroll/blind-replay.ts` |
| Config | `src/domain/eval/bankroll/exp016-config.ts` |
| Leakage | `src/domain/eval/bankroll/leakage.ts` |
| Ledger | `src/domain/risk/bankroll/ledger.ts` |
| Policies | `src/domain/risk/bankroll/policies.ts` |
| Actuarial engine | `src/domain/risk/actuarial/engine.ts` |
| Metrics / MC | `src/domain/risk/actuarial/metrics.ts`, `monte-carlo.ts` |
| Correlation guard | `src/domain/risk/correlation/guard.ts` |
| CLI | `pnpm lab:actuarial-replay` |
| Tests | `src/domain/eval/bankroll/bankroll-016.test.ts` |

## Scientific limits (documented, not invented around)

- Pack covers E0 **2019–2024** only (~61 events) — not full 2001→today DB.
- `declared_edge=false` — champion is market de-vig; Kelly often small; Flat is diagnostic.
- Corners/cards/BTTS/etc. **BLOCKED**.
- `sourceReliability=null`.

## Acceptance

| Gate | Result |
|------|--------|
| Blind LOCK before reveal | PASS |
| Anti-cheating leakage tests | PASS |
| Solar year start 1000 | PASS |
| 4+ policies compared | PASS |
| Ledger reconcile | PASS |
| Evidence gate 015 | PASS |
| winner / auto-promote | null / false |
| migration | NONE |
