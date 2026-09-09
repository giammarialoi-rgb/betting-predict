# TASK 020 — Blind capital protocol

RAW → FILTER asOf → DecisionContext → features → frozen frequency model → evidence → risk → LOCK → REVEAL → settlement → bankroll.

- Outcome is inaccessible before LOCK.
- CLOSE never enters DecisionContext.
- DATE_ONLY / DATASET_WINDOW / UNKNOWN never satisfy STRICT capital.
- Bankroll starts at 1000 each solar year and does not roll.
- Bankroll is clamped at 0 (never negative).
- Frozen model `frequency` is predeclared before HOLDOUT.
- rho = UNKNOWN → conservative same-event cap.
- winner = null, real_money = false, auto_promote = false.
