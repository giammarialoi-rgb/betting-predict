# TASK 017 — Report

## Status

**DONE** — measurement lab on real available data. **No migration.**

## Deliverables

| Item | Path |
|------|------|
| Experiment | `experiments/exp_017_blind_actuarial_replay_v1.json` |
| Lab | `src/domain/eval/actuarial-017/` |
| CLI | `pnpm lab:blind-actuarial` |
| UI | `/actuarial-lab` |
| Audits | `audit/task-017-*.json` |
| Docs | `docs/blind-actuarial-replay.md`, `docs/algorithm-current-status.md` |

## Main finding

Primary blind bankroll uses the E0 offline pack (2019–2024). Years 2001–2018 are `INSUFFICIENT_DATA` / secondary-catalogued-only. Algorithm status defaults to **E_DATA_INSUFFICIENT** (honest).

Club-Football-Match-Data remains **SECONDARY**; external CSV not vendored; C_*/Form*/undocumented odds excluded from STRICT path.

## Gates

| Gate | Result |
|------|--------|
| Blind LOCK | PASS |
| HOLDOUT_TOUCHED | false |
| winner / auto-promote | null / false |
| Fabricated 2001 rows | NO |
| migration | NONE |
