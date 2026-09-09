# Sample cross-validation report

**Audit task:** 006-A  
**Date:** 2026-09-06  
**Repo commit:** `25882a58a736daf7ece3781940eac17ae1117a66`

## Goal

Compare a small sample of Club Football Match Data fields against original sources Football-Data.co.uk and ClubElo — without validating the entire archive.

## Live original sources

| Endpoint | Result |
|----------|--------|
| `https://www.football-data.co.uk/notes.txt` | HTTP **503** |
| `https://www.football-data.co.uk/mmz4281/2324/E0.csv` | HTTP **503** |
| `http://api.clubelo.com/ManUnited` | HTTP **502** |

**Status:** `ORIGINAL_SOURCE_CROSSCHECK_BLOCKED` (network failure on originals).  
The Club Football repository itself **was** downloadable from GitHub; quantitative work used the local clone under `audit/external/` (gitignored).

No fabricated “matching” values were invented for blocked endpoints.

## Local consistency checks (repository-internal)

### Sample A — E0 2023-08-11 Burnley vs Man City

From `Matches.csv`:

| Field | Value |
|-------|-------|
| FTResult | A (0-3) |
| OddHome / OddDraw / OddAway | 9.02 / 5.35 / 1.35 |
| HomeElo / AwayElo | 1726.42 / 2077.27 |
| Form3Home | 9.0 |

From `EloRatings.csv` (latest snapshot with `date <= 2023-08-11`):

| Club | Snapshot date | Elo |
|------|---------------|-----|
| Burnley | 2023-08-01 | 1726.42 |
| Man City | 2023-08-01 | 2077.27 |

**Result:** **PASS** — match-row Elo equals bi-monthly snapshot on/before match date for this sample.

### Sample B — cluster blank tail

Latest 8,301 match rows: `C_LTH` blank for **8,301 / 8,301**.  
**Result:** **PASS** vs README claim.

### Sample C — provisional Elo presence

EloRatings rows with `date >= 2025-06-15`: **28,939**.  
**Result:** **PASS** vs README provisional continuation claim (values not re-derived here).

## Implications

1. Cannot currently certify Bet365 odds equality vs football-data.co.uk CSVs while that host returns 503.  
2. Internal Elo join evidence supports `dataset_window` semantics for pre-provisional rows.  
3. Re-run this report when FD.co.uk and ClubElo respond HTTP 200; store `retrieved_at` per attempt.

## Reproduction

```bash
pnpm exec tsx src/audit/club-football-match-data/run-audit.ts
```

Requires a local clone at `audit/external/Club-Football-Match-Data` (not committed).
