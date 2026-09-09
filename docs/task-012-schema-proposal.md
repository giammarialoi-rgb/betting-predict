# TASK 012 — Schema proposal (NOT applied)

Optional additive tables for a later approved migration:

| Table | Purpose |
| --- | --- |
| `market_coverage_rows` | Persist coverage matrix status per sport/market/line |
| `bookmaker_coverage_rows` | Verified bookmaker×market observability |
| `player_observations` | Minutes/shots/availability_at |
| `information_events` | Injuries/lineups/news with published_at/available_at |
| `weather_forecasts` | forecast_available_at vs event_time |
| `bankroll_replay_runs` | Durable blind risk simulations |

**Do not apply** until approved. TASK 012 uses domain modules + `experiments/`.
