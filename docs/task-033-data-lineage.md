# TASK 033 — Data lineage

## Immutable 1X2 reference (not copied)

- TASK_031_BASE SHA-256: `6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b`
- File: `audit/external/task-027/strict-candidates.csv`
- Quotes expansion: `artifacts/task-031/quotes.csv` (1X2 only, EXACT_RELATIVE T−1h)
- Provenance: Kaggle austro / BeatTheBookie odds_series LEVEL B + soccer-dataset UTC kickoff. Cluster: REDISTRIBUTION of Lisandro79/BeatTheBookie (GPL-3.0).

## Exchange MIRROR (LEVEL_A clock, not capital)

- petermclagan football-basic-sample (GitHub MIRROR of Betfair Historic BASIC)
- Clock: `pt` (epoch ms) vs `marketTime` ISO-Z; timezone field Europe/London is not used to invent UTC.
- Official cluster: ACCESS_BLOCKED (historicdata.betfair.com login).

## Research-only (not STRICT capital)

- zygmunt/betfair-sports weekly CSV: naive FIRST_TAKEN / SCHEDULED_OFF, license Other, one week, no TZ.
- TilenKopac closing_odds.csv: DATE_ONLY 1X2.
- Club-Football Matches.csv: DATE_ONLY 1X2/OU2.5/AH; Form*/C_* forbidden.
- Zenodo 12673394: football-data lineage DATE_ONLY.
- soccer-dataset odds.parquet: known_at = kickoff.
- Kaggle AH 90-match sample: compact clock, kickoff absent, license UNKNOWN.

## TASK 033 dataset

- id: TASK_033_STRICT_MARKETS
- Does not rewrite TASK 027/028/030/031 files.
- Fingerprint: `ba1a74139bed1f8a4c369e2438eb89031df71270f36143a591b008cd96f7c88a`
