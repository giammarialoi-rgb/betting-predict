# TASK 042 — Final report

## Architecture

- **Store of truth:** `audit/external/task-039/` (unchanged append-only)
- **Daemon:** `src/scripts/collector-task-042-run.ts` (Cursor-independent)
- **Once:** `src/scripts/collector-task-042-once.ts`
- **Governor / plan / API / heartbeat / lock:** `src/domain/eval/collector-042/`
- **Windows:** `scripts/*-task-042.ps1` + Scheduled Task `BettingPredict-Collector042`
- **Monitor:** `/actuarial-lab/collector` ← `/api/collector-042/status` (persisted JSON only)

## Autostart

1. `pnpm collector:task-042:install`
   - prefers `schtasks` ONLOGON
   - if denied / path issues → **Startup folder shortcut** (no admin)
2. `pnpm collector:task-042:start` → detached daemon (verified RUNNING)
3. Single-instance via `collector.lock` (PID alive check)

**Verified this session:** daemon RUNNING, lockAlive=true, idle settle-only, 0 API credits spent on once/idle cycles.

## Budget governor

Env (defaults):

| var | default |
|---|---|
| TASK_042_MONTHLY_CREDIT_LIMIT | 500 |
| TASK_042_SAFE_REMAINING | 100 |
| TASK_042_MAX_CREDITS_PER_RUN | 20 |
| TASK_042_POLL_MINUTES | 15 |
| TASK_042_DISCOVERY_HOURS | 12 |
| TASK_042_BOOTSTRAP_REMAINING / USED | optional account snapshot |

Provider headers `x-requests-remaining|used|last` captured when present → `credit-state.json`.

**Event-aware default:** with ≥100 LOCKED and future kickoffs → **SETTLE_ONLY / idle** (0 odds catalog credits). Scores pulled only for sports with past-kickoff unsettled locked events. Full 6-sport discovery only when due/forced and locked &lt; target.

Legacy loop cost ~12 credits/cycle (6×uk,eu×h2h) — **disabled by default** in 042 plan.

## Scientific gates (unchanged)

- LOCK immutable; AS_OF T−1h; FT/HT only in settlement
- TASK_031_BASE / MARKET_DEVIG / models / staking untouched
- TASK 041 lab auto-spawn when SETTLED ≥ 100
- No TASK 043

## Files

See `docs/task-042-collector.md`, `docs/task-042-budget.md`, `docs/task-042-recovery.md`, `docs/task-042-preflight.md`.
