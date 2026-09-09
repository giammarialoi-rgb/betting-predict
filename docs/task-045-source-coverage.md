# TASK 045 — Source coverage

- Catalog: `GET /v4/sports` (active keys only)
- Soccer: all active `soccer_*` (budget-capped per cycle)
- Tennis: all active `tennis_*` when provider exposes them; else `SPORT_UNAVAILABLE` / `TENNIS_NO_ACTIVE_KEYS_IN_PROVIDER`
- Markets requested: soccer/tennis `h2h,spreads,totals` — do not request unsupported keys (e.g. invalid `btts` caused provider ERROR). Absent markets stay unavailable (not invented).
- In-play excluded from pre-match Lab B predictions
