# TASK 032 — INCREMENTAL EDGE FINAL EXPERIMENT

### VERDETTO SCIENTIFICO

NO_DEMONSTRATED_EDGE

### MODELLO PROMOSSO

model = null

### CAPITAL STATUS

QUALIFIED = false

### REAL MONEY

false

### AUTO PROMOTION

false

DATASET: TASK_031_BASE `6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b`
STRICT_EVENTS: 10499
BASELINE: MARKET_DEVIG
SELECTED ON VAL: market_schedule
HOLDOUT_STATUS: EMPTY (2020+ events = 0)
FEATURE FP: dda05a9ad1c003b37716f8dc7e4b3040fad4f6b429256b05cb5a304b27bc6864
PREDICTIONS FP: 96c9a991c6cdc83fc7b7a4bce7bee1cdb423e9b82844e1cf610ddebb397eb1b6
FINGERPRINT: fd252d57021317754e2a056b3b59fc11e9df108ac7aaa00e95481caa5a383239

TEST n=1756 · VAL n=2295 · TRAIN n=3647

Corpus HOLDOUT 2016 is scored only as a descriptive leftover of the 031 split. It is **not** a 2020+ HOLDOUT and was not used to confirm edge.

| Modello | Test Brier | Δ vs Market | LogLoss | Δ LogLoss | 95% CI ΔBrier | Holm p | Holdout | Verdict |
|---|---:|---:|---:|---:|---|---:|---|---|
| MARKET_DEVIG | 0.198778 | baseline | 0.996355 | baseline | — | — | EMPTY | BASELINE |
| MARKET+ELO | 0.198774 | -0.000004 | 0.996334 | -0.000021 | [-0.000012, 0.000003] | 0.791209 | EMPTY | NON_INFERIOR |
| MARKET+FORM | 0.198746 | -0.000031 | 0.996293 | -0.000061 | [-0.000148, 0.000104] | 0.920080 | EMPTY | NON_INFERIOR |
| MARKET+HISTORY | 0.198678 | -0.000099 | 0.995990 | -0.000365 | [-0.000198, 0.000019] | 0.257742 | EMPTY | NON_INFERIOR |
| MARKET+SCHEDULE | 0.198811 | 0.000034 | 0.996507 | 0.000152 | [-0.000073, 0.000134] | 1 | EMPTY | NON_INFERIOR |
| MARKET+MOVEMENT | 0.198778 | 0.000000 | 0.996356 | 0.000001 | [-0.000001, 0.000001] | 1 | EMPTY | NON_INFERIOR |
| MARKET+ALL | 0.198674 | -0.000104 | 0.996025 | -0.000330 | [-0.000226, 0.000030] | 0.574426 | EMPTY | NON_INFERIOR |

## Stress (VAL-selected on TEST)

selected: market_schedule
CI95 ΔBrier (10k): [-0.000073, 0.000134]
CI95 ΔLogLoss (10k): [-0.000359, 0.000615]
FRAGILE: false — no 1% concentration flip, or no negative ΔBrier to concentrate
missing-feature (x=0 → market): ΔBrier 0


## Bankroll

QUALIFIED=false. BET_COUNT=0. End = —. No silent 1000→1000.

| Anno | STRICT | Bets | Start | End | P/L | ROI | Max DD | Status |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 2001 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2002 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2003 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2004 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2005 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2006 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2007 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2008 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2009 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2010 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2011 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2012 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2013 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2014 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2015 | 2381 | 0 | 1000 | — | — | — | — | NO_EDGE |
| 2016 | 8118 | 0 | 1000 | — | — | — | — | NO_EDGE |
| 2017 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2018 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2019 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2020 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2021 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2022 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2023 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2024 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2025 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |
| 2026 | 0 | 0 | 1000 | — | — | — | — | INSUFFICIENT_DATA |

No TASK 033 is opened. The predictive lab on DATASET_031_BASE is closed if the verdict is NO_DEMONSTRATED_EDGE.
