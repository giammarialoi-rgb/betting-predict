# TASK 028 — SCIENTIFIC VALIDATION

## FINAL VERDICT

VERDICT: NO_SIGNAL

DATASET:
STRICT EVENTS: 10499
MARKETS: 1X2
PERIOD: 2015-09-01T00:10:00.000Z → 2016-11-19T12:30:00.000Z

TEST EVENTS: 1756
HOLDOUT EVENTS: 2801

TOTAL DECISIONS: 10499
TOTAL BETS: 4083

MARKET BRIER: 0.1988
MODEL BRIER: 0.2197

MARKET LOGLOSS: 0.9964
MODEL LOGLOSS: 1.0877

TEST ROI: -0.4449
HOLDOUT ROI: -0.3911

95% CI: [-1.3562, 0.1725]

ADJUSTED P-VALUE: 1

MAX DRAWDOWN: 0.9165

BEST MODEL: null

AUTO PROMOTION: false

REAL MONEY: false

| Anno | STRICT | Decisions | Bets | Start € | End € | P/L € | ROI | Max DD | Brier Market | Brier Model | LogLoss Market | LogLoss Model | Status |
|------|-------:|----------:|-----:|--------:|------:|------:|----:|-------:|-------------:|------------:|---------------:|--------------:|--------|
| 2001 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2002 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2003 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2004 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2005 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2006 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2007 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2008 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2009 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2010 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2011 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2012 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2013 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2014 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2015 | 2381 | 2381 | 834 | 1000 | 456.6443 | -543.3557 | -0.5434 | 0.5523 | 0.1993 | 0.2177 | 0.9998 | 1.0784 | VALID |
| 2016 | 8118 | 8118 | 3249 | 1000 | 113.6239 | -886.3761 | -0.8864 | 0.9165 | 0.1972 | 0.2155 | 0.9903 | 1.0700 | VALID |
| 2017 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2018 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2019 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2020 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2021 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2022 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2023 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2024 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2025 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2026 | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | — | INCOMPLETE |

| Periodo | Model | Bets | ROI | 95% CI | Brier | LogLoss | Adj. p | Verdict |
|---------|-------|-----:|----:|--------|------:|--------:|-------:|---------|
| TEST | elo (frozen) | 756 | -0.4449 | [-1.3562, 0.1725] | 0.2197 | 1.0877 | 1 | NO_SIGNAL |
| HOLDOUT (corpus) | elo (frozen) | 1222 | -0.3911 | [-0.6638, -0.0174] | 0.2153 | 1.0695 | — | confirmatory |
| HOLDOUT (project 2020+) | — | 0 | — | — | — | — | — | INSUFFICIENT_DATA |

| Modello | Test Brier | Holdout Brier | Test ROI | Holdout ROI | Calibration ECE | Significant | Robust | Promotion |
|---------|-----------:|--------------:|---------:|------------:|----------------:|-------------|--------|-----------|
| market_devig | 0.1988 | 0.1975 | — | — | 0.0127 | false | false | false |
| frequency | 0.2152 | 0.2156 | — | — | 0.0132 | false | false | false |
| elo | 0.2197 | 0.2153 | -0.4449 | -0.3911 | 0.0242 | false | false | false |
| form | 0.2165 | 0.2137 | — | — | 0.0167 | false | false | false |
| poisson | 0.2269 | 0.2175 | — | — | 0.0897 | false | false | false |
| logistic | 0.2106 | 0.2079 | — | — | 0.0391 | false | false | false |
| ensemble | 0.2090 | 0.2068 | — | — | 0.0673 | false | false | false |

## CURRENT SCIENTIFIC VALUE

Prediction: frozen Elo Brier on TEST is 0.2197 vs frequency 0.2152 and vs market 0.1988.

Market-relative value: market de-vig is the best probability on TEST among the predeclared set. Ablation:
- market_only: n=1756 Brier=0.1988 LogLoss=0.9964 ECE=0.0127 slope=1.0054
- market_elo: n=1756 Brier=0.2049 LogLoss=1.0261 ECE=0.0489 slope=1.6238
- market_form: n=1756 Brier=0.2040 LogLoss=1.0220 ECE=0.0388 slope=1.6718
- market_history: n=1756 Brier=0.2032 LogLoss=1.0182 ECE=0.0646 slope=2.0091
- market_all: n=1756 Brier=0.2042 LogLoss=1.0233 ECE=0.0466 slope=1.6699

Economic value: TEST frozen-protocol ROI -0.4449 on 756 bets; corpus HOLDOUT ROI -0.3911 on 1222 bets. Friction stress (TEST net ROI): 0.0%→-0.4449; 0.5%→-0.4608; 1.0%→-0.4766; 2.0%→-0.5082; 3.0%→-0.5398. EXECUTION_COST_UNKNOWN.

Statistical support: Holm–Bonferroni family=TEST_brier_model_minus_market_onesided_model_better n=7. Elo adjusted p=1. Block bootstrap (calendar week, seed=28).

Robustness: project calendar HOLDOUT 2020+ has 0 STRICT events. Corpus HOLDOUT exists but promotion requires the project holdout as well. Single snapshot T-1h only. CLV_UNAVAILABLE.

Current deployability: not deployable. winner=null. real_money=false. NO_PROMOTION.

Recommended action: treat the book 1X2 de-vig as the probability engine; do not spend further effort on catalog expansion to avoid NO_EDGE; do not retune on TEST/HOLDOUT.

## WHAT WE KNOW

- Frozen STRICT file sha256=6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b events=10499 fixture=false.
- Only T-1h quotes exist in this file. Other requested windows have coverage 0 (no interpolation).
- Logistic was fit on TRAIN only (3647 events) then frozen.

## WHAT WE DO NOT KNOW

- Timezone of BeatTheBookie raw odds_datetime (LEVEL A still unavailable).
- True closing line / CLV path (single snapshot).
- Slippage and limits (EXECUTION_COST_UNKNOWN).
- Injuries, lineups, news FACT relations.

## WHAT FAILED

- does not improve market baseline on TEST
- not replicated on corpus HOLDOUT
- TEST ROI 95% CI not strictly positive
- multiple-testing correction not passed
- project calendar HOLDOUT 2020+ has zero STRICT events
- not shown independent of a single season

## WHAT WORKED

- Temporal freeze, expanding Elo/form, de-vig benchmark, Holm correction, annual 1000 reset.
- Market probabilities are well-calibrated relative to Elo/form/poisson on this corpus.

## WHAT ADDS INFORMATION TO MARKET

- None of the predeclared ablations beat market de-vig on TEST Brier.

## WHAT DOES NOT

- Frozen Elo, form, poisson, frequency as replacements for the book.
- Context/news/movement features: not present at asOf in this file (TEMPORAL_LIMIT / INSUFFICIENT).

## WHETHER EDGE EXISTS

No demonstrated economic edge vs available T-1h book prices under the frozen 0.03 rule.

## WHETHER EDGE IS SIGNIFICANT

No Holm rejection supporting model-better-than-market for the frozen Elo primary, and ROI CI is not a confirmed positive edge.

## WHETHER EDGE SURVIVES HOLDOUT

Project HOLDOUT 2020+: no data. Corpus HOLDOUT is confirmatory only and does not unlock promotion.

## WHETHER EDGE IS ECONOMICALLY USABLE

No.

## NEXT ACTION

Do not start a new acquisition task to escape this verdict. Do not retune threshold/staking on TEST or HOLDOUT. If work continues, it should be new temporally valid features with a frozen protocol — not p-hacking this file.
