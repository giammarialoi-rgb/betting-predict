# TASK 025 — temporal audit

| Source | Kickoff | Quote | Relation | Class |
|---|---|---|---|---|
| Betfair MIRROR | 2017-04-30T13:05:00.000Z | 2017-04-30T11:10:52.099Z | QUOTE_BEFORE_KICKOFF | A_STRICT |
| Kaggle weekly | SCHEDULED_OFF naive | FIRST/LATEST_TAKEN naive | order on dataset clock only | B unless ISO offset proven |
| Club Odd* | DATE_ONLY | none | UNKNOWN | C_RESEARCH_ONLY |
| soccer-dataset known_at | mixed | equals date_utc | not < kickoff | C / D for capital |

## Time-to-kickoff (M001 HOME LTP, observed only)

| Bucket | Observed | Price | Timestamp |
|---|---|---:|---|
| T-72h | no | — | — |
| T-48h | no | — | — |
| T-24h | no | — | — |
| T-12h | no | — | — |
| T-6h | no | — | — |
| T-3h | yes | 12 | 2017-04-30T09:02:08.269Z |
| T-1h | yes | 14.5 | 2017-04-30T11:10:52.099Z |
| T-30m | yes | 12.5 | 2017-04-30T12:12:52.809Z |
| T-15m | yes | 12.5 | 2017-04-30T12:12:52.809Z |
| T-5m | yes | 12 | 2017-04-30T12:59:53.411Z |
| T-1m | yes | 14 | 2017-04-30T13:02:53.487Z |

Movement (first vs last observed HOME price): up magnitude=2 n=6

CLV is diagnostic after LOCK, never a DecisionContext feature.
