# TASK 029 — INFORMATIONAL EDGE DISCOVERY

VERDICT: NO_INCREMENTAL_INFORMATION

STRICT EVENTS: 10499
TEST EVENTS: 1756
HOLDOUT EVENTS: 2801
FROZEN 028 SHA-256: 6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b
OBSERVED SHA-256: 6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b
T-1h MULTI-BOOK ROWS: 217871 (coverage TEST n≥2: 0.988041)
SELECTED FAMILIES (VAL only): schedule
PREDICTIVE GATE: false
PROMOTION: BLOCKED
winner = null · real_money = false · auto_promote = false

| Modello | N TEST | Brier | LogLoss | Δ Brier vs Market | ROI | 95% CI | Verdict |
|---------|-------:|------:|--------:|------------------:|----:|--------|---------|
| market_only | 1756 | 0.198778 | 0.996355 | baseline | — | — | BASELINE |
| market_elo | 1756 | 0.198774 | 0.996337 | -0.000004 | — | — | ΔBrier < 0 but not Holm-significant |
| market_form | 1756 | 0.198743 | 0.996279 | -0.000034 | — | — | ΔBrier < 0 but not Holm-significant |
| market_schedule | 1756 | 0.198808 | 0.996495 | 0.000031 | — | — | does not beat MARKET_ONLY |
| market_disagreement | 1756 | 0.198876 | 0.996840 | 0.000099 | — | — | does not beat MARKET_ONLY |
| market_news | 1756 | 0.198778 | 0.996355 | 0 | — | — | identical to market |
| market_weather | 1756 | 0.198778 | 0.996355 | 0 | — | — | identical to market |
| market_all_safe | 1756 | 0.198808 | 0.996495 | 0.000031 | — | [-0.000134, 0.000090] | does not beat MARKET_ONLY |
| ensemble | 1756 | 0.198791 | 0.996415 | 0.000013 | — | — | does not beat MARKET_ONLY |

M7 ΔBrier 95% CI: [-0.000134, 0.000090]

## ANNUAL BANKROLL

Staking runs only after the predictive gate. No model was auto-staked from TEST ROI.

| Year | Start | Bets | End | P/L | ROI | Max DD | Status |
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

## DATASET_029_A (overlay, not a silent 028 replace)

- file: audit/external/task-029/books-t1h.csv
- SHA-256: ff4f3323e9f5b9ff0214c409d4ab6ca177b0a259eb5eec99cfa67fb543f9a9ab
- book-rows: 217871
- join: frozen match_id (MATCH_EXACT only)
- temporal: same PHP hours_before=1 bin as TASK 028
- 2017–2025 STRICT quotes+kickoff: not in this overlay

## ABLATION (VALIDATION, selection frozen before TEST)

| Family removed / solo | VAL ΔBrier vs Market | Label |
|-----------------------|---------------------:|-------|
| MARKET+elo | 0.000002 | HARMFUL |
| MARKET+form | 0.000026 | HARMFUL |
| MARKET+schedule | -0.000006 | CANDIDATE_SIGNAL |
| MARKET+disagreement | 0.000036 | HARMFUL |
| MARKET+news | 0 | NO_INCREMENTAL_VALUE |
| MARKET+weather | 0 | NO_INCREMENTAL_VALUE |

Leave-one-family-out of ALL_SAFE is the same as MARKET+remaining when at most one family is selected; with none selected, ALL_SAFE = MARKET_ONLY.

## WHAT WE ADDED

- Residual MARKET+X (not 50/50 mix).
- T-1h bookmaker disagreement from the same BeatTheBookie dump (overlay, not a silent 028 replace).
- Lagged Elo / form / schedule reconstructed with kickoff < asOf.
- News/weather: coverage 0 in STRICT (CONTEXT / DATE_ONLY / unpaid archives).
- 2017–2025 STRICT quotes+kickoff: not acquired (Football Charts paid; Betfair account; football-data.co.uk DATE_ONLY).

## ROBUSTNESS

No predictive gate, so no economic robustness slices. Diagnostic only:
- Elo TEST ΔBrier -0.000004 → HOLDOUT 0.000004 (reverses).
- Form TEST ΔBrier -0.000034 → HOLDOUT 0.000062 (reverses).
- Schedule (VAL-selected) TEST ΔBrier 0.000031 (worse than market).
- Disagreement TEST ΔBrier 0.000099 (HARMFUL).
- Holm rejections: 0. No LOCAL_SIGNAL claimed for a single league or bookmaker.

## FAMILY LABELS (VALIDATION, not TEST selection of winner)

- elo: HARMFUL
- form: HARMFUL
- schedule: CANDIDATE_SIGNAL
- disagreement: HARMFUL
- news: NO_INCREMENTAL_VALUE
- weather: NO_INCREMENTAL_VALUE

## HOLM

- market_elo: raw_p=0.091908 adj=0.735265 rejected=false
- market_form: raw_p=0.263736 adj=1 rejected=false
- market_schedule: raw_p=0.744256 adj=1 rejected=false
- market_disagreement: raw_p=0.973027 adj=1 rejected=false
- market_news: raw_p=0.960040 adj=1 rejected=false
- market_weather: raw_p=0.960040 adj=1 rejected=false
- market_all_safe: raw_p=0.744256 adj=1 rejected=false
- ensemble: raw_p=0.711289 adj=1 rejected=false

## 30-SECOND ANSWERS

1. STRICT events: 10499
2. Usable TEST: 1756
3. Added: disagreement overlay + lagged schedule/form/elo residual
4. Beats market? no
5. ΔBrier M7 TEST: 0.000031
6. Credible? Holm rejections=0
7. HOLDOUT project 2020+: empty. PROMOTION BLOCKED. Corpus HOLDOUT ΔBrier=-0.000011
8. 1000/year: End=— (no qualified staking)
9. Testable years: 2015–2016 only
10. Missing: LEVEL A clocks, injuries/lineups, weather MATCH_EXACT, 2017+ STRICT quotes
