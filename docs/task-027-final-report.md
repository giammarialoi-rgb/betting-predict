TASK 027
DATA BREAKTHROUGH REPORT
STRICT EVENTS: 10499
STRICT QUOTES: 31497
MATCH_EXACT: 10499
MODEL_READY: false
YEARS_TESTABLE: 2015,2016
TOTAL DECISIONS: 10499
TOTAL BETS: 8
VERDICT: BREAKTHROUGH / NO_EDGE

| Anno | Dataset | STRICT events | Decisions | Bets | Start | End | P/L | ROI | Max DD | Brier | LogLoss | Strategy | Status |
|------|---------|--------------:|----------:|-----:|------:|----:|----:|----:|-------:|------:|--------:|----------|--------|
| 2001 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2002 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2003 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2004 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2005 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2006 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2007 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2008 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2009 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2010 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2011 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2012 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2013 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2014 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2015 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 2381 | 2381 | 4 | 1000 | 981.5585 | -18.4415 | -0.0184 | 0.0377 | 0.2177 | 1.0784 | actuarial_v1 | VALID |
| 2016 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 8118 | 8118 | 4 | 1000 | 952.0307 | -47.9693 | -0.0480 | 0.0480 | 0.2155 | 1.0700 | actuarial_v1 | VALID |
| 2017 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2018 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2019 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2020 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2021 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2022 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2023 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2024 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2025 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INSUFFICIENT_DATA |
| 2026 | Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff | 0 | 0 | 0 | 1000 | — | — | — | — | — | — | — | INCOMPLETE |

## WHAT WE FOUND

Kaggle dataset `austro/beat-the-bookie-worldwide-football-dataset` v2 is a public redistribution of BeatTheBookie `odds_series` / `odds_series_b` (hourly LOCF, 32 bookmakers, 72 bins). Match files carry naive `match_datetime` without a documented timezone, so that clock is LEVEL C / TEMPORALLY_UNKNOWN and is not used as UTC.

soccer-dataset `fixtures.parquet` documents `date_utc` as UTC. Unique MATCH_EXACT on calendar date + home slug + away slug, excluding midnight placeholders, plus PHP `hours_before` bins, yields LEVEL B STRICT events: quote = kickoff_utc − N hours, with N documented by `generate_odds_series_csv.php`.

Production STRICT count in this run: 10499.

## WHAT WE COULD ACTUALLY USE

- LEVEL B CAPITAL_STRICT: MATCH_EXACT ∧ soccer UTC kickoff SOURCE (non-midnight) ∧ PHP bin hours_before≥1 ∧ 1X2 prices>1 ∧ quote < kickoff.
- Frozen model `elo` (expanding Elo from STRICT results after LOCK only), threshold 0.03 predeclared.
- Primary risk `actuarial_v1` (capped Kelly). Flat / fractional Kelly / risk-capped Kelly compared; Masaniello challenger only.
- Features at asOf: expanding form, Elo, frequency, rest days proxy via lastTs, market price / overround. No news FACT. No Club Odd* clocks.

## WHAT REMAINS RESEARCH ONLY

- BeatTheBookie naive `match_datetime` (TZ undocumented).
- TilenKopac `closing_odds.csv` DATE_ONLY.
- Club-Football Odd* DATE_ONLY; Form*/C_* forbidden.
- soccer-dataset `odds.known_at` equals kickoff (closing).
- Kaggle AH 90-match sample (license UNKNOWN, no kickoff).
- Zenodo UCD DATE_ONLY.
- Betfair Historic official archive (ACCESS_BLOCKED). GitHub MIRROR n=1 not licensed for capital.
- 5Dollar / OddsPapi 401 (no signup).
- Dropbox/Drive SQL dumps (ACCESS_BLOCKED). Wayback CDX empty.

## SOURCES

See `docs/task-027-source-hunt.csv`. Primary usable: Kaggle austro + soccer-dataset UTC overlay. Upstream code: Lisandro79/BeatTheBookie GPL-3.0.

## TEMPORAL AUDIT

- LEVEL A: not available (no documented TZ on BTB `odds_datetime`).
- LEVEL B: PHP relative hours-before + soccer UTC kickoff. Z appended because soccer-dataset dictionary states UTC, not because we assumed Europe/Rome or Europe/London.
- T-1h observed on STRICT rows (`hours_before=1`, PHP bin 70). T-72h does not exist (bins are 71h…0h). Sub-hour windows do not exist. No interpolation.
- FT/HT/scores enter only after LOCK.

## BLIND-LEAKAGE AUDIT

Hostile battery: 16/16 throw as required.
HOLDOUT_TOUCHED=false. CLV not in DecisionContext. DATE_ONLY not promoted. Assumed TZ rejected.

## MODEL COMPARISON

Diagnostic Brier/LogLoss on the walk-forward STRICT stream. Frozen capital model is `elo`. No winner from PnL. No HOLDOUT selection.

- market_devig: n=10499 Brier=0.1977 LogLoss=0.9925
- market_elo_form: n=10499 Brier=0.2025 LogLoss=1.0158
- market_elo: n=10499 Brier=0.2028 LogLoss=1.0173
- elo_form: n=10499 Brier=0.2146 LogLoss=1.0664
- form: n=10499 Brier=0.2148 LogLoss=1.0719
- home_advantage: n=10499 Brier=0.2159 LogLoss=1.0714
- elo: n=10499 Brier=0.2160 LogLoss=1.0719
- frequency: n=10499 Brier=0.2160 LogLoss=1.0764
- poisson: n=8096 Brier=0.2192 LogLoss=1.0880

## RISK COMPARISON

- flat: 2015 end=987.76; 2016 end=960.60
- fractional_kelly: 2015 end=972.86; 2016 end=940.20
- risk_capped_kelly: 2015 end=981.56; 2016 end=952.03
- actuarial_v1 (primary, not elected from PnL): 2015 end=981.56; 2016 end=952.03
- masaniello: challenger_only
- rho: UNKNOWN (conservative caps only)
- winner: null

## STATISTICAL SIGNIFICANCE

- bets=8 hit_rate=0.1250
- bootstrap mean PnL/bet CI: [-16.0954, 1.1833] mean=-8.3014
- permutation p (sign-flip): 0.1179
- Bonferroni α/m = 0.003846 (m=13)
- any_significant after correction: false
- HOLDOUT STRICT bets: 0 (2015–2016 are TRAIN years; VAL/TEST/HOLDOUT have zero series coverage)

## FINAL SCIENTIFIC VERDICT

NO_EDGE

No scientific claim of a beatable market. MODEL_READY remains false. winner=null. real_money=false.

STRICT ≥ 100 was reached via LEVEL B overlay; VAL/TEST/HOLDOUT still have zero STRICT coverage so the result is not out-of-sample confirmed.
