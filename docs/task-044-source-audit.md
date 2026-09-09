# TASK 044 — Source audit

| Adapter role | Current binding |
|--------------|-----------------|
| EVENT_SOURCE | The Odds API via Lab A events (read-only sync) |
| ODDS_SOURCE | Lab A quotes STRICT 1X2 (+ taxonomy for more markets when present) |
| RESULT_SOURCE | Lab A settlements |
| STATISTICS_SOURCE | not yet wired (architecture reserved) |
| NEWS_SOURCE | CONTEXT_ONLY if added later |

Calendar sources must not be treated as odds sources.
