# TASK 030 — FINAL PRE-MATCH EDGE LAB

VERDICT: NO_DEMONSTRATED_EDGE
PRODUCTION: NOT_DEPLOYABLE
winner = null · real_money = false · auto_promotion = false · PROMOTION = BLOCKED

STRICT EVENTS: 10499
TEST: 1756 · HOLDOUT: 2801
FROZEN 028 SHA-256: 6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b
OBSERVED SHA-256: 6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b
T-24h MOVEMENT ROWS: 199047 SHA c33642c097183d3bff3757fb09e501c22182826d5d652de12da7bfcf631ef21d
FEATURE STATUS: elo=AVAILABLE · form=AVAILABLE · schedule=AVAILABLE · history=AVAILABLE · movement=AVAILABLE
SELECTED FAMILIES (VAL only): schedule, movement
PREDICTIVE GATE: false
FINGERPRINT: ac2ccb13090f86c0007fa4a00cf5ed6f7033097c106980568948fad09ef603f0

| Modello | Test Brier | Δ vs Market | Test LogLoss | Holdout Brier | Significativo | ROI | Max DD | Verdict |
|---------|-----------:|------------:|-------------:|--------------:|---------------|----:|-------:|---------|
| MARKET | 0.198778 | baseline | 0.996355 | 0.197517 | — | — | — | BASELINE |
| MARKET+ELO | 0.198775 | -0.000002 | 0.996343 | 0.197519 | no | — | — | ΔBrier < 0 not Holm-significant |
| MARKET+FORM | 0.198751 | -0.000027 | 0.996314 | 0.197578 | no | — | — | ΔBrier < 0 not Holm-significant |
| MARKET+HISTORY | 0.198687 | -0.000091 | 0.996014 | 0.197515 | no | — | — | ΔBrier < 0 not Holm-significant |
| MARKET+SCHEDULE | 0.198808 | 0.000031 | 0.996500 | 0.197510 | no | — | — | does not beat MARKET |
| MARKET+MOVEMENT | 0.198778 | 0.000000 | 0.996357 | 0.197517 | no | — | — | does not beat MARKET |
| MARKET+ALL | 0.198808 | 0.000030 | 0.996497 | 0.197511 | no | — | — | does not beat MARKET |

MARKET+ALL ΔBrier 95% CI: [-0.000140, 0.000079]

## ANNUAL BANKROLL

Staking runs only after EDGE_DEMONSTRATED. No post-hoc staking search.

| Anno | Start | Bets | End | P/L | ROI | Max DD | Stato |
|-----:|------:|-----:|----:|----:|----:|-------:|--------|
| 2001 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2002 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2003 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2004 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2005 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2006 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2007 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2008 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2009 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2010 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2011 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2012 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2013 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2014 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2015 | 1000 | 0 | — | — | — | — | NO_EDGE |
| 2016 | 1000 | 0 | — | — | — | — | NO_EDGE |
| 2017 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2018 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2019 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2020 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2021 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2022 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2023 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2024 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2025 | 1000 | 0 | — | — | — | — | INSUFFICIENT_DATA |
| 2026 | 1000 | 0 | — | — | — | — | INCOMPLETE |

### VERDETTO SCIENTIFICO

NO_DEMONSTRATED_EDGE

## HOLM (TEST ΔBrier market − model, one-sided)

- market_elo: raw_p=0.131868 adj=0.659341 rejected=false
- market_form: raw_p=0.303696 adj=1 rejected=false
- market_history: raw_p=0.025974 adj=0.155844 rejected=false
- market_schedule: raw_p=0.728272 adj=1 rejected=false
- market_movement: raw_p=0.833167 adj=1 rejected=false
- market_all: raw_p=0.744256 adj=1 rejected=false

## 12 ANSWERS

1. Beat the market with available STRICT information? **no**
2. Incremental family selected on VAL: schedule, movement
3. ΔBrier MARKET+ALL TEST: 0.000030
4. ΔLogLoss MARKET+ALL TEST: 0.000142
5. Holm-significant? no
6. HOLDOUT ΔBrier ALL: -0.000006 · project 2020+ empty
7. Economic value? not staked (gate failed or no bets)
8. Capital per year: End = — (no qualified bets)
9. Drawdown: —
10. Declare an edge? **NO_DEMONSTRATED_EDGE**
11. Production: **NOT_DEPLOYABLE**
12. Missing for a real claim: LEVEL A quote clocks, MATCH_EXACT injuries/lineups, 2017–2025 STRICT quotes+kickoff, 2020+ HOLDOUT
