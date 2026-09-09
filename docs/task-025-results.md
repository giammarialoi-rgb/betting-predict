# TASK 025 — Real data turnaround lab

**TASK 025 VERDICT: INSUFFICIENT_DATA**

winner = null · real_money = false · declared_edge = false · HOLDOUT sacred

## Photograph

```
THIS IS EVERYTHING WE HAVE
↓
THIS IS STRICT-USABLE
↓
THIS IS RESEARCH-ONLY
↓
THIS IS WHAT WE TESTED
↓
THIS IS THE RESULT
↓
THIS IS EXACTLY WHAT IS MISSING
```

## The 12 numbers

| # | Question | Answer |
|---|---|---|
| 1 | Matches really in hand (Club this run / overlapping listed) | 238858 / 918359 |
| 2 | With odds (Club Odd* this run) | 1270866 listed overlapping; Club with_odds=235806 |
| 3 | With timestamp (exact quote clock) | 1 STRICT event(s); 3 MATCH_ODDS legs |
| 4 | AS_OF usable (STRICT) | 1 |
| 5 | Model decisions | 1 |
| 6 | BET candidates | 0 |
| 7 | Annual P/L from 1000 | — (not 1000→1000) |
| 8 | Best staking | null (no winner) |
| 9 | Drawdown | — |
| 10 | Beats market? | not testable on STRICT n=1; research market_brier=0.200603738196271 vs frequency_brier=0.21583692037302485 |
| 11 | Where it works/fails | STRICT: n=1 EPL 2017-04-30 only. Research coverage = observed Club divisions, not a catalog. |
| 12 | If it doesn't work, why | STRICT n=1; declared_edge=false; DATE_ONLY cannot enter capital; Kaggle week has no TZ so not STRICT; UCD Advanced not public |

## We have

- 1 STRICT MATCH_ODDS event (Betfair BASIC GitHub MIRROR)
- 238858 Club-Football matches RESEARCH_ONLY
- 186813 soccer-dataset fixtures with odds (closing known_at; 673966 fixtures-parquet rows)
- 479440 BeatTheBookie closing DATE_ONLY (if cached)
- Kaggle zygmunt/betfair-sports bulk: 1306748 rows, 23423 soccer events, classes {"A_STRICT":0,"B_RESEARCH_TEMPORAL":150837,"C_RESEARCH_ONLY":0,"D_INVALID":1155911} (license Other, gitignored)

## STRICT usable

| M001 | EPL | 2017-04-30T13:05:00.000Z | 2017-04-30T11:10:52.099Z | Δ -6848s | MIRROR |

## Research only

- Club-Football: events=238858 with_odds=235806 decisions_diag=235777 illegal_edge_if_date_only_were_strict=84088 bets=0
- market_brier=0.200603738196271 frequency_brier=0.21583692037302485 form_brier=0.21318881988444394 elo_brier=0.20753915349161814 poisson_brier=0.2177489471009106
- Kaggle weekly bulk acquired: true (schema fixture rows=1306748, classes {"A_STRICT":0,"B_RESEARCH_TEMPORAL":150837,"C_RESEARCH_ONLY":0,"D_INVALID":1155911})

## Tested

- Two-stage market_devig → edge gate on M001 → NO_BET
- Hostile leakage A–O
- TTK buckets on the BASIC stream
- CLV diagnostic after LOCK (not in DecisionContext)
- Club-Football expanding-window Brier (not capital)

Blind decision: **NO_BET** (declared_edge=false) candidate=false

## Result

- Scientific verdict: **INSUFFICIENT_DATA**
- STRICT n=1 / gate 100
- Bonferroni α/9 = 0.005555555555555556 — any_significant=false
- Monte Carlo simulated=false (No historical bets — Monte Carlo cannot create edge)

## Missing

- Betfair BASIC bulk ≥100 MATCH_ODDS events with quote_timestamp < kickoff
- Timezone-proven clocks on the Kaggle week (or official Betfair BASIC ≥100 events)
- UCD/Whelan Advanced 2022–2024 files (not posted)
- football-data.co.uk live CSV if 503

## PRIMARY BLOCKER

Official Betfair Historic BASIC bulk (account login, credentials not used). UCD 2022–2024 Advanced is not public. Kaggle week is at most RESEARCH_TEMPORAL unless timezone-proven.
