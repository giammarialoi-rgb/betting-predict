# Actuarial Bankroll Lab

Blind historical capital-management laboratory (TASK 016).

## Run

```bash
pnpm lab:actuarial-replay
```

## Policies compared (winner = null)

| Policy | Role |
|--------|------|
| Flat | Diagnostic fixed fraction |
| Fractional Kelly | `f* × fractional_factor` (`factor < 1`) |
| Risk-Capped Kelly | Primary candidate — caps + drawdown reduction |
| Actuarial V1 | Uncertainty / correlation / evidence penalties; may `NO_POSITION` |
| Masaniello | Challenger only — simplified cycle, not dogma |

## Dataset honesty

Primary pack: `real_truth_lab_v1_e0_2019_2024`.

| Years | Status |
|-------|--------|
| 2001–2018 | `INSUFFICIENT_HISTORY` |
| 2019–2024 | Evaluated when events exist |
| 2025–2026 | `INCOMPLETE_YEAR` / no pack events |

Markets beyond `result` are `BLOCKED` until MODEL_READY observations exist. No invented odds.

## Metrics

Historical observed metrics (CAGR, DD, VaR/CVaR historical simulation, etc.) are diagnostics — not promises.

Monte Carlo bootstrap is labeled `SIMULATED` and kept separate.
