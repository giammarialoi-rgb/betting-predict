# TASK 031 — FINAL DATA BREAKTHROUGH / STRICT CAPITAL REPLAY

FINAL VERDICT: BREAKTHROUGH_NO_EDGE
MODEL_READY: true
CAPITAL_TEST: false
STRICT_EVENTS: 10499
ADDED_STRICT: 0
WINNER: null
REAL_MONEY: false
AUTO_PROMOTION: false
PREDICTIVE_GATE (frozen TASK 030): false
TASK 030 VERDICT: NO_DEMONSTRATED_EDGE
FINGERPRINT: 8b4e64168ffdeea7e1713f6ec8f73d4874dd09ae5a5d06864dc2c35d1db27e14

DATASET_031_BASE SHA-256: 6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b

## COSA ABBIAMO DAVVERO

1. DATASET DISPONIBILE: frozen BeatTheBookie/Kaggle austro T-1h overlay + research files (Julien sample, 5dollar opening/closing, football-data DATE_ONLY).
2. DATASET STRICT: 10499 events LEVEL_B MATCH_EXACT 1X2 T-1h (2015-09-01T00:10:00.000Z → 2016-11-19T12:30:00.000Z).
3. DATASET RESEARCH: Julien naive TZ (2 matches), 5dollar opening/closing (50 fixtures), football-data/Zenodo/Club-Football DATE_ONLY.
4. MODEL_READY: true
5. ANNI TESTABILI: 2015, 2016
6. ANNI NON TESTABILI: 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026
7. BET REALMENTE ESEGUITE NEL REPLAY: 0
8. P/L: — (no stakes; gate closed)
9. EDGE: no demonstrated edge vs MARKET_DEVIG (TASK 030 frozen residual; Holm 0 rejections on TEST).
10. SIGNIFICATIVITÀ: Holm-Bonferroni on TEST ΔBrier; see table. 95% CI MARKET+ALL: [-0.000140, 0.000079]
11. LIMITAZIONI: no 2020+ STRICT quotes+kickoff publicly acquired without account/key/purchase; DATE_ONLY sources not promoted; Julien TZ not invented; TASK 030 model not retuned on TEST/HOLDOUT.

## Models vs MARKET_DEVIG (frozen TASK 030, TEST)

| Modello | Test Brier | Δ vs Market | Test LogLoss | Holdout Brier | Holm | Verdict |
|---------|-----------:|------------:|-------------:|--------------:|------|---------|
| MARKET_DEVIG | 0.198778 | baseline | 0.996355 | 0.197517 | — | BASELINE |
| MARKET+ELO | 0.198775 | -0.000002 | 0.996343 | 0.197519 | no | ΔBrier < 0 not Holm-significant |
| MARKET+FORM | 0.198751 | -0.000027 | 0.996314 | 0.197578 | no | ΔBrier < 0 not Holm-significant |
| MARKET+HISTORY | 0.198687 | -0.000091 | 0.996014 | 0.197515 | no | ΔBrier < 0 not Holm-significant |
| MARKET+SCHEDULE | 0.198808 | 0.000031 | 0.996500 | 0.197510 | no | does not beat MARKET |
| MARKET+MOVEMENT | 0.198778 | 0.000000 | 0.996357 | 0.197517 | no | does not beat MARKET |
| MARKET+ALL | 0.198808 | 0.000030 | 0.996497 | 0.197511 | no | does not beat MARKET |

## Annual capital

| Anno | STRICT | Decisioni | Bets | Start | End | P/L | ROI | Max DD | Modello | Stato |
|------|-------:|----------:|-----:|------:|----:|----:|----:|--------:|---------|-------|
| 2001 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2002 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2003 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2004 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2005 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2006 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2007 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2008 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2009 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2010 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2011 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2012 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2013 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2014 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2015 | 2381 | 2381 | 0 | 1000 | — | — | — | — | MARKET_DEVIG | PARTIAL_DATA |
| 2016 | 8118 | 8118 | 0 | 1000 | — | — | — | — | MARKET_DEVIG | PARTIAL_DATA |
| 2017 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2018 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2019 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2020 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2021 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2022 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2023 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2024 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2025 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2026 YTD | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |


No TASK 032 is opened. Residual 2020+ coverage requires a licensed LEVEL_A dump (Betfair Historic login or a paid odds-history API), not a new model.
