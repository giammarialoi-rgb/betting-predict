# TASK 023 — Blind LOCK / CLV / capital

**Verdict: PARTIAL_STRICT**

Pipeline: EVENT → AS_OF (T-1h) → LOAD PREMATCH SNAPSHOT (`timestamp ≤ asOf`) → FEATURES → MARKET DE-VIG → MODEL_0 → EVIDENCE → RISK → LOCK → OUTCOME REVEAL → SETTLEMENT / CLV.

Before LOCK the decision payload has no FT, HT, settlement, WINNER, closing price, in-play ticks, or future snapshots.

```
event Middlesbrough v Man City
asOf 2017-04-30T12:05:00.000Z
decision NO_BET (NO_BET_MODEL: declared_edge=false)
stake 0
locked true revealed true
settlement winner (post-LOCK) DRAW
CLV HOME implied_delta 0.0024630541871921152 entry 14.5 close 14 used_in_decision=false
```

## Hostile leakage A–H

| Attack | HARD FAIL |
|---|---|
| A | yes |
| B | yes |
| C | yes |
| D | yes |
| E | yes |
| F | yes |
| G | yes |
| H | yes |

## Evidence (TASK 015)

HOME — Probability: n/a — Evidence strength: INSUFFICIENT
Context: Betfair Exchange MATCH_ODDS last traded at asOf (H 14.5 / D 6.4 / A 1.31); BASIC has no ladder/volume; 10 PREMATCH LTP ticks with publishTime < marketStartTime

## Information set at asOf

| Key | Available | availableAt | precision |
|---|---|---|---|
| market | true | 2017-04-30T12:05:00.000Z | exact |
| team_historical_form | false | — | unknown |
| elo | false | — | unknown |
| rest | false | — | unknown |
| schedule | true | 2017-04-30T13:05:00.000Z | exact |
| injury | false | — | unknown |
| lineup | false | — | unknown |
| weather | false | — | unknown |
| news | false | — | unknown |
| market_movement_to_asof | true | 2017-04-30T12:05:00.000Z | exact |

## Models (diagnostic only; winner = null)

| Model | n | Brier | LogLoss | CLV | ROI | Significant | Capital |
|---|---:|---:|---:|---:|---:|---|---|
| MODEL_0_MARKET_ONLY | 1 | 0.4366669837360098 | 1.8448065113795193 | 0.0024630541871921152 | — | false | false |
| MODEL_1_ELO | 0 | — | — | — | — | false | false |
| MODEL_2_FORM | 0 | — | — | — | — | false | false |
| MODEL_3_ELO_FORM | 0 | — | — | — | — | false | false |
| MODEL_4_MARKET_ELO | 0 | — | — | — | — | false | false |
| MODEL_5_MARKET_ELO_FORM | 0 | — | — | — | — | false | false |
| MODEL_6_POISSON | 0 | — | — | — | — | false | false |

ROI is not an edge. n=1 cannot calibrate. Models 1–6 are INSUFFICIENT without Elo/form/goals in this file.

## Annual capital (start 1000 / solar year, no carry)

| YEAR | EVENTS | STRICT EVENTS | DECISIONS | BETS | NO BET | START | END | P/L | ROI | MAX DD | TOTAL EXPOSURE | CLV | Brier | LogLoss | POLICY | STATUS |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| 2017 | 1 | 1 | 1 | 0 | 1 | 1000 | — | — | — | — | — | — | — | — | no_bet | INSUFFICIENT_DATA |
| 2018 | 0 | 0 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | no_bet | NOT_ACQUIRED |
| 2019 | 0 | 0 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | no_bet | NOT_ACQUIRED |
| 2020 | 0 | 0 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | no_bet | NOT_ACQUIRED |

If insufficient: END = **—**, never silent 1000 → 1000. Risk compared (all unused): Flat, Fractional Kelly, Risk-Capped Kelly, Actuarial V1. Masaniello = challenger. **winner = null**.

## Walk-forward

- TRAIN 2017
- VALIDATION 2018
- TEST 2019
- HOLDOUT 2020 (sacred, unused for selection)

## Statistical control

- sample size for capital: 1 event (insufficient)
- Bonferroni α 0.05 / 7 tests = 0.0071428571428571435
- any_significant: false
- no edge claim
