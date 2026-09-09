# TASK 022 — Historical odds recovery & blind capital lab

**Verdict: NO_DEMONSTRATED_EDGE**

BeatTheBookie was inspected from the live GitHub repository (README + PHP generators) and from an acquired `closing_odds.csv` (TilenKopac GitHub copy of the Kaggle redistribution). Dropbox returned an HTML interstitial; Kaggle zip requires login. Bulk `odds_series` TXT files were **not** acquired. Kaggle and TilenKopac are the **same upstream cluster** — not independent sources.

TilenKopac/beat-the-bookie-kaggle closing_odds.csv is a Kaggle austro redistribution of BeatTheBookie — same upstream cluster, not an independent source. GitHub README 880,494 matches (2000–2015) is the SQL dump; this CSV is the paper subset (479,440; 2005–2015). odds_series TXT bulk was not acquired (Dropbox HTML/403, Kaggle zip requires login).

```
closing_rows=479440; series_bulk=false; DATE_ONLY dominant; hourly relative fixture only
STRICT quotes: 0
Bets: 0
winner = null
```

| Periodo | Eventi | Quote | Mercati | Bookmaker | Timestamp | STRICT | MODEL_READY | Stato |
|---|---:|---:|---|---|---|---:|---|---|
| 2000–2015 (README SQL dump) | 0 | 0 | 1X2 (documented) | up to 32 (documented) | odds_datetime in SQL — not acquired | 0 | no | NOT_ACQUIRED |
| 2005–2015 (closing_odds.csv) | 479440 | 0 | 1X2 | 29 top_bookie labels; avg/max research-only | DATE_ONLY | 0 | no | RESEARCH_ONLY |
| 2015–2016 (odds_series) | 0 | 10 | 1X2 | 32 documented | RELATIVE_TO_KICKOFF_APPROX (hourly; TZ unknown) | 0 | no | SERIES_BULK_NOT_ACQUIRED; fixture STRICT_CANDIDATE |
| 2016 (odds_series_b) | 0 | 0 | 1X2 (documented) | 32 documented | same hourly generator | 0 | no | NOT_ACQUIRED |

## Diagnostic A–G (odds_series generator + fixture)

- A) Time series exists in the **generator**: yes (hourly LOCF). Bulk files acquired: **no**.
- B) Granularity: hourly (60 min LOCF bins; 72 samples at kickoff-71h … kickoff-0h)
- C) Absolute timestamp: **false**
- D) Relative-to-kickoff exact (seconds): **false** (hourly bins = APPROX)
- E) Reconstruct asOf: **false** (timezone undocumented)
- F) Reconstruct first price in a file: **true** (oldest non-nan bin; LOCF may predate the 71h window)
- G) Horizons:
  - 72h: bin_exists=false reconstructable=false measured_non_nan=0
  - 48h: bin_exists=true reconstructable=true measured_non_nan=1
  - 24h: bin_exists=true reconstructable=true measured_non_nan=1
  - 12h: bin_exists=true reconstructable=true measured_non_nan=1
  - 6h: bin_exists=true reconstructable=true measured_non_nan=1
  - 3h: bin_exists=true reconstructable=true measured_non_nan=1
  - 1h: bin_exists=true reconstructable=true measured_non_nan=3
  - 30m: bin_exists=false reconstructable=false measured_non_nan=0
  - 15m: bin_exists=false reconstructable=false measured_non_nan=0
  - 5m: bin_exists=false reconstructable=false measured_non_nan=0

PHP t_* bug: generate_closing_odds_csv.php inserts sizeof($diff_win_*) instead of $diff_win_* — t_* in generated SQL stats must not be trusted as seconds

## Acquisition

- local-cache-tilenkopac-closing_odds.csv: acquired=true status=200 materialized C:\Users\giamm\Desktop\app previsioni sportive\betting predict\audit\external\task-022\closing_odds.csv; sha256=a2f4083aea15ca7cfcc6abb6db9849108a1974fb0b4145171033e4e51d469fc4; Kaggle redistribution same cluster
- dropbox-closing_odds.zip: acquired=false status=200 HEAD ok — body not ingested in this probe
- kaggle-zip-v2: acquired=false status=404 HEAD 404
- google-drive-folder: acquired=false status=200 HEAD ok — body not ingested in this probe

closing sha256: a2f4083aea15ca7cfcc6abb6db9849108a1974fb0b4145171033e4e51d469fc4

CSV is paper subset 479,440 (2005–2015), not README 880,494 (2000–2015 SQL)

Kaggle card 479,440 / 818 leagues / 2005-01-01; measured dateMax=2015-06-30 vs card 2015-07-30

## Matching (STRICT uses MATCH_EXACT only)

- FD events in corpus: 13247
- Club-Football index: 238858
- OpenLigaDB: not in local corpus this run (results API only; no odds)
- MATCH_EXACT: 14823
- MATCH_PROBABLE: 35392
- MATCH_AMBIGUOUS: 3576
- MATCH_FAILED: 425649

## SCIENTIFIC VERDICT

- DATA AVAILABLE: closing_rows=479440; series_bulk=false; DATE_ONLY dominant; hourly relative fixture only
- STRICT EVENTS: 0
- STRICT QUOTES: 0
- MODEL_READY MARKETS: none
- YEARS TESTABLE: none
- YEARS INSUFFICIENT: 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016
- TOTAL BLIND DECISIONS: 0
- TOTAL BETS: 0
- PROFITABLE YEARS: none
- LOSING YEARS: none
- NO-BET YEARS: 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016
- BEST MODEL: null
- BEST RISK POLICY: null
- STATISTICAL SIGNIFICANCE: none
- HOLDOUT STATUS: SACRED
- AUTO-PROMOTION: FALSE
- REAL MONEY: FALSE
- NO_DEMONSTRATED_EDGE
