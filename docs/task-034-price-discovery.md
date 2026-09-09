# TASK 034 — Price discovery

## Overround (TRAIN)

- mean: 0.035754
- median: 0.025447
- p10: 0.019738
- p25: 0.021895
- p75: 0.031464
- p90: 0.092567
- max: 0.156085

## Cross-book (all STRICT events with ≥2 books at T-1h)

- n_multi: 10391
- mean CV home: 0.036203
- mean range home: 0.508205
- mean entropy home: 4.312286

## Favorite odds bands (TEST, market Brier)

| Band | N | Brier |
|---|---:|---:|
| 1.50–1.80 | 333 | 0.179730 |
| 2.20–3.00 | 621 | 0.219554 |
| <1.50 | 275 | 0.142684 |
| 1.80–2.20 | 527 | 0.215602 |

## Favorite-longshot bins (TEST, all 1X2 legs)

| Bin | N | Mean implied | Observed | Residual |
|---:|---:|---:|---:|---:|
| 0–0.1 | 125 | 0.075367 | 0.088000 | 0.012633 |
| 0.1–0.2 | 631 | 0.157751 | 0.120444 | -0.037307 |
| 0.2–0.3 | 1991 | 0.258299 | 0.271220 | 0.012922 |
| 0.3–0.4 | 1122 | 0.338430 | 0.340463 | 0.002033 |
| 0.4–0.5 | 654 | 0.448143 | 0.432722 | -0.015421 |
| 0.5–0.6 | 371 | 0.546888 | 0.544474 | -0.002413 |
| 0.6–0.7 | 248 | 0.647205 | 0.649194 | 0.001988 |
| 0.7–0.8 | 101 | 0.746188 | 0.752475 | 0.006287 |
| 0.8–0.9 | 23 | 0.841551 | 1 | 0.158449 |
| 0.9–1 | 2 | 0.919387 | 1 | 0.080613 |

## Movement patterns (frozen before TEST; T-24→T-1h only)

| Pattern | N | Brier | Note |
|---|---:|---:|---|
| steam | 424 | 0.199558 | T-24→T-1h only |
| reverse_steam | 290 | 0.210320 | T-24→T-1h only |
| drift | 418 | 0.198902 | T-24→T-1h only |
| stability | 287 | 0.192963 | T-24→T-1h only |
| no_second_snapshot | 337 | 0.192660 | T-24 overlay missing |
| late_reversal | 0 | — | window coverage 0 — not interpolated |
| t1_to_kickoff | 0 | — | window coverage 0 — not interpolated |

CLV: NOT_COMPUTABLE_LAST_QUOTE_IS_AS_OF (AS_OF = last observed pre-kickoff quote; T-24 is earlier, not close).

Best-price mixes books; it is not an executable parlay. EXECUTION_COST_UNKNOWN.
