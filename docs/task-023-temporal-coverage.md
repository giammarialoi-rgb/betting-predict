# TASK 023 — Temporal coverage (MATCH_ODDS HOME/DRAW/AWAY)

Coverage = fraction of the three MATCH_ODDS selections that have a **PREMATCH** last-traded tick with `publishTime ≤ asOf`. No interpolation. No future tick. `asOf = kickoff − requested`.

Event: Middlesbrough v Man City kickoff 2017-04-30T13:05:00.000Z

| Window | Requested | Available | Coverage |
|---|---:|---:|---:|
| 72h | 3 | 0 | 0.000 |
| 48h | 3 | 1 | 0.333 |
| 24h | 3 | 1 | 0.333 |
| 12h | 3 | 1 | 0.333 |
| 6h | 3 | 1 | 0.333 |
| 3h | 3 | 2 | 0.667 |
| 1h | 3 | 3 | 1.000 |
| 30m | 3 | 3 | 1.000 |
| 15m | 3 | 3 | 1.000 |
| 5m | 3 | 3 | 1.000 |
| 1m | 3 | 3 | 1.000 |

## HOME last observation vs requested (no interpolation)

| Window | Requested sec | Exists | Actual timestamp | Seconds before kickoff | Delta sec | Price | Depth |
|---|---:|---|---|---:|---:|---|---:|
| 72h | 259200 | false | — | — | — | false | — |
| 48h | 172800 | false | — | — | — | false | — |
| 24h | 86400 | false | — | — | — | false | — |
| 12h | 43200 | false | — | — | — | false | — |
| 6h | 21600 | false | — | — | — | false | — |
| 3h | 10800 | true | 2017-04-30T09:02:08.269Z | 14571.731 | 3771.7309999999998 | true | — |
| 1h | 3600 | true | 2017-04-30T11:10:52.099Z | 6847.901 | 3247.901 | true | — |
| 30m | 1800 | true | 2017-04-30T12:12:52.809Z | 3127.191 | 1327.1909999999998 | true | — |
| 15m | 900 | true | 2017-04-30T12:12:52.809Z | 3127.191 | 2227.191 | true | — |
| 5m | 300 | true | 2017-04-30T12:59:53.411Z | 306.589 | 6.588999999999999 | true | — |
| 1m | 60 | true | 2017-04-30T13:02:53.487Z | 126.513 | 66.513 | true | — |

Delta = actual_seconds_before_kickoff − requested. Positive means the last usable tick is *earlier* than the window (stale but temporally legal). BASIC has no ladder: depth is —.
