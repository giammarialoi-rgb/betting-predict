# TASK 026 — temporal audit

DATE_ONLY, OPEN/CLOSE without a clock, scrape date, file mtime, dataset publication date, assumed-before-kickoff are never STRICT_AS_OF.

| Source | Kickoff | Quote | Precision | Origin | Relation | Level |
|---|---|---|---|---|---|---|
| Betfair MIRROR | 2017-04-30T13:05:00.000Z | 2017-04-30T11:10:52.099Z | EXACT_TIMESTAMP | SOURCE | QUOTE_BEFORE_KICKOFF | RESEARCH_STRICT |
| Kaggle AH sample | missing in file | YYYYMMDDHHmmss UTC (claimed) | EXACT_TIMESTAMP | SOURCE | KICKOFF_MISSING | RESEARCH_STRICT (not capital) |
| Zenodo UCD | match date / kickoff Time | none | DATE_ONLY | SOURCE | NOT_A_QUOTE_CLOCK | RESEARCH_DATE_ONLY |

## STRICT entry windows (Betfair M001 HOME LTP, observed only)

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

Kaggle AH windows vs kickoff: all false — kickoff not in file, so T-Xh cannot be proven.
