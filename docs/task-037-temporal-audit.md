# TASK 037 — Temporal audit

| clock | rule |
|---|---|
| quote_timestamp | source publish only |
| collector scraped_date | never a quote clock |
| opening/closing labels | DATE_ONLY |
| calendar date | DATE_ONLY |
| naive datetime | NAIVE_DATETIME |
| T−1h | last observation ≤ kickoff−3600s, no interpolation |

No GitHub soccer file satisfied LEVEL_A/B + MATCH_EXACT + T−1h at n≥100.
