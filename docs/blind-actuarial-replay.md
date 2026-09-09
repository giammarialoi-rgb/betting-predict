# Blind Actuarial Historical Replay (TASK 017)

Measure what the algorithm is worth **today**, with solar-year bankrolls of 1,000 credits and a hard blind protocol.

## Run

```bash
pnpm lab:blind-actuarial
```

Opens UI: `/actuarial-lab`

## Absolute rules

- No look-ahead / result leak
- LOCK before outcome reveal
- No random split; holdout sacred (`HOLDOUT_TOUCHED=false`)
- No fabricated timestamps / reliability / edge
- Masaniello = challenger only
- HISTORICAL ≠ SIMULATED stress

## Data honesty

| Source | Role |
|--------|------|
| Offline E0 pack 2019–2024 | PRIMARY blind bankroll |
| Club-Football-Match-Data | SECONDARY / BENCHMARK — audit catalogued; external clone not required in-repo; undocumented odds clocks excluded from STRICT stakes |
| football-data.co.uk live | May be BLOCKED (e.g. 503) — does not invent rows |

Years without primary usable events → `INSUFFICIENT_DATA` (not filled).

## Algorithm status

Prefer `E_DATA_INSUFFICIENT` or `A_NO_EVIDENCE_OF_ADVANTAGE` over a beautiful lie.
