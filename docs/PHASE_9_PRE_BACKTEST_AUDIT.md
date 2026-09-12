# Phase 9 — Pre-backtest audit

**Written:** 2026-09-12  
**HEAD:** `91ee590` (main after Phase 8 mega)  
**Storage SoT:** filesystem `StorageProvider` only. **NEON NON UTILIZZATO.**  
**Principle:** prove on the past before authorizing the future. SEEK TRUTH, not a prettier bankroll.

This audit is a location / quantity / leakage inventory. It is **not** a claim that any model is ready, profitable, or production-verified.

---

## 1. Executive inventory (this VM)

| Store | Path | Present on this VM? | Role | Temporal status |
|---|---|---|---|---|
| Lab B events | `audit/external/task-044/events.jsonl` | **No** (`audit/external/` gitignored; directory empty/absent) | Live/research events | N/A |
| Predictions | `audit/external/task-044/predictions.jsonl` | **No** | Persisted inferences | N/A |
| Results / settlements | `audit/external/task-044/settlements.jsonl` | **No** | Settlement ledger | N/A |
| Observations | `audit/external/task-044/research-observations.jsonl` | **No** | Research provenance | N/A |
| Research queue | `audit/external/task-044/research-queue.json` | **No** | Upcoming queue | N/A |
| Dossiers / runtime mirror | `audit/external/task-044/mirror/` | **No** | UI mirror | N/A |
| PI matches | `audit/external/task-044/predictive-intelligence/datasets/matches.jsonl` | **No** | Normalised FDouk rows | N/A |
| Light analyses | `data/light-analysis/analyses.jsonl` | **No** (`data/light-analysis/` gitignored, absent) | Analizzati | N/A |
| Light FDouk cache | `data/light-analysis/history.json` | **No** | HTTP history cache | N/A |
| Club-Football Matches.csv | `audit/external/Club-Football-Match-Data/data/Matches.csv` | **No** (gitignored clone) | 238,858-row forensic corpus | DATE_ONLY / odds TEMPORALLY_UNKNOWN |
| ClubElo CSV | `data/clubelo/*.csv` | **No** (gitignored) | Elo as-of | DATE_ONLY when file exists |
| FDouk acquisition folder | `data/acquisition/` | **No** (gitignored) | Raw CSVs | N/A |
| PI raw cache | `…/predictive-intelligence/datasets/raw/{E0,SP1,D1,I1,F1}-{season}.csv` | **No** | HTTP/cache raw | N/A |
| Committed FDouk sample | `src/audit/club-football-match-data/fixtures/matches_sample.csv` | **Yes** (~8 rows) | Parser fixture only | Not a backtest corpus |
| Committed audit summaries | `audit/club-football-match-data/*.csv|json` | **Yes** | Forensic profiles of the *missing* clone | Research only |
| Task artifacts | `artifacts/task-*`, `artifacts/phase-5|6|7|8/` | **Yes** | Prior lab reports | Not decision-time features |
| Data pointers | `data/manifests/*`, `data/raw/pointers.json` | **Yes** | GitHub harvest pointers; clones gitignored | Not loaded into STRICT_AS_OF |

**Conclusion before fetch:** this VM has **no usable historical match corpus on disk**. Phase 8 already documented the same gap (FDouk 0/20, no PI `matches.jsonl`). Phase 9 must use the **already-wired HTTP Football-Data.co.uk path** (`importFootballDataDataset` → `downloadFootballDataCsv` / `fetchFootballDataHistory`). Do not invent rows. If HTTP fails, the backtest must stop honestly.

---

## 2. Historical events / predictions / results / observations

### 2.1 Lab B (Phase 8 SoT)

Canonical root: `audit/external/task-044/` (`permanentRoot044()`).

| Ledger | Fields (schema) | Quantity here | Date range here |
|---|---|---|---|
| `events.jsonl` | event_id, home, away, kickoff, league, sport | 0 | — |
| `quotes.jsonl` | event_id, bookmaker, market, selection, price, asOf | 0 | — |
| `predictions.jsonl` | event_id, model_version, probs, features_version | 0 | — |
| `locks.jsonl` | event_id, locked_at | 0 | — |
| `settlements.jsonl` | event_id, fthg, ftag, ftr, settled_at | 0 | — |
| `learning-cases.jsonl` | case_id, prediction, actual, auto_applied=false | 0 | — |
| `research-observations.jsonl` | source, available_at, fields, provenance | 0 | — |
| `research-status.jsonl` | source cycle outcomes | 0 | — |
| `journal.jsonl` | append-only ops | 0 | — |

Phase 8 final report (other host, 2026-09-11): 69 queued upcoming, 20 researched, 84 observations in-cycle, **0 independent probabilities**, **0 settlements**. Those files are not in git.

### 2.2 Predictive Intelligence store

Path: `{labB}/predictive-intelligence/`.

| Artifact | Purpose | Here |
|---|---|---|
| `datasets/matches.jsonl` | Normalised FDouk `PiMatchRow` | missing |
| `datasets/raw/*.csv` | Cached season×division CSVs | missing |
| `dataset-manifest.json` | Import provenance | missing |
| `models/*.json` | Poisson / logistic artifacts | missing |
| `validation-report.json` | Walk-forward | missing |
| `model-manifest.json` | Versioned models | missing |
| `learning/cases.jsonl` | Offline learning cases | missing |

Configured fetch universe (code, not data):

- Divisions: `E0, SP1, D1, I1, F1` (`PI_DIVISIONS`)
- Seasons: `1920, 2021, 2122, 2223, 2324, 2425` (`PI_SEASONS`)
- Holdout season lock: `2324` (`PI_HOLDOUT_SEASON`)

Expected row order of magnitude **if** HTTP succeeds: ~5 leagues × ~380 matches × 6 seasons ≈ **10k–12k** finished matches with 1X2 + optional shots/corners/cards + DATE_ONLY open/close odds.

### 2.3 Light-analysis HTTP history

Code: `src/domain/eval/light-analysis/fetch-history.ts`.

- Divisions: `E0 E1 SP1 I1 I2 D1 D2 F1 N1 P1 SC0 B1`
- Seasons: current + previous FDouk season codes (today 2026-09-12 → `2526` + `2425`)
- Rows: `home, away, date, home_goals, away_goals, corners?, league` — **odds parsed then ignored**
- Cache: memory → `/tmp/betmind-light-history.json` → `data/light-analysis/history.json` (no Neon)

This is a **supplement / freshness** path, not the primary multi-season OOS corpus. Phase 9 uses it only if PI import is empty and light HTTP returns finished matches.

---

## 3. CSV paths (wired vs present)

### 3.1 football-data.co.uk

| Mechanism | URL / path | Wired? | On disk? |
|---|---|---|---|
| PI download | `https://football-data.co.uk/mmz4281/{season}/{div}.csv` then `www.` | **Yes** (`dataset/download.ts`) | No cache |
| Light fetch | same hosts, 12 divisions × 2 seasons | **Yes** | No cache |
| Ingest adapter | `src/providers/football-data-co-uk/` | **Yes** (parser/ingest) | No local pack |
| Script | `pnpm ingest:football-data-co-uk` | Yes | Needs files |
| Foundation copy | `audit/external/task-044/data-foundation/football-data/` | Yes (read if present) | **No** |

**Fields after `normalizeFootballDataCsv` (PiMatchRow):**

- Identity: `canonical_id`, `season`, `league`, `match_date`, `event_time` (Time if present else noon UTC), `home/away` + ids
- Results: `fthg, ftag, ftr` (required); `hthg, htag, htr` optional
- Stats: `hs, as, hst, ast, hc, ac, hy, ay, hr, ar` optional
- Open odds (market baseline / value **only**): `odds_open.B365|PS|Avg` from `B365H/D/A`, `PSH/D/A`, `AvgH/D/A`
- Close odds (CLV **research only**): `research_odds_close.B365C|PSC`
- Temporal: `result_available_at` = **next UTC day 00:00** (DATE_ONLY conservative); `label_time` same

**Not extracted today:** Over/Under 2.5 book columns (`B365>2.5`, `Avg>2.5`, …), AH, corners/cards odds. Those columns may exist in raw CSV; Phase 9 may parse them as **optional overlay** without changing the Phase 8 adapter.

### 3.2 Club-Football-Match-Data

| Item | Value |
|---|---|
| Clone path | `audit/external/Club-Football-Match-Data/` (gitignored) |
| Documented size | Matches.csv **238,858** rows, 48 cols, 2000-07-28 → 2026-09-03; Elo 273,972 |
| Sample in git | `src/audit/club-football-match-data/fixtures/matches_sample.csv` (tiny) |
| TASK 018 policy | Closing/match-row odds **TEMPORALLY_UNKNOWN → NO BET** in STRICT_AS_OF |
| Form columns | Precomputed Form3/5 — **must reconstruct** from prior FT only; do not trust as decision-time |

**This VM:** clone absent. Phase 9 does **not** invent 238k rows. If the clone appears later, it remains research/benchmark unless each field has a demonstrated `available_at`.

### 3.3 Lab / data / artifacts / audit (committed)

| Path | What it is | Backtest use |
|---|---|---|
| `data/strict/index.json` | `CAPITAL_STRICT` pointer; `task_031_base_counted: false`; live_events 0 | No matches |
| `data/manifests/*.json` | Harvest SHAs (Betfair dumps, Odds API, …) | Pointers only; blobs gitignored |
| `data/raw/pointers.json` | Clone index | No local blobs |
| `audit/club-football-match-data-*` | Column/coverage/leakage profiles | Documentation |
| `audit/task-017|018-*.json` | Prior actuarial/leakage labs | Do not reuse as features |
| `artifacts/phase-8/*` | Phase 8 cycle (20 events, 0 preds) | Context |
| `artifacts/task-031/*` | Frozen 031 fingerprints | Do not mutate |

---

## 4. Model inventory (code)

All live under `src/domain/eval/predictive-intelligence/models/`. Odds are forbidden in feature bags (`MARKET_INPUT_FORBIDDEN`).

| ID | File | Gate | Inputs | Status on this host |
|---|---|---|---|---|
| `INDEPENDENT_POISSON_v1` | `poisson-independent.ts` | train N ≥ 20 (multi-model list) | as-of attack/defence/form; optional Elo/injuries if ELIGIBLE | **CURRENT_PRODUCTION** pointer (live champion). No trained artifact here. |
| `DIXON_COLES_v1` | `dixon-coles.ts` | N ≥ 40 | λ_home, λ_away + ρ on low-score cells | Implemented; not trained here |
| `NEGBIN_v1` | `negbin.ts` | N ≥ 80 **and** goal variance > 1.15× mean | λ + r | Implemented; skip if Poisson-like |
| `INDEPENDENT_LOGISTIC_v1` | `logistic-challenger.ts` | N ≥ 40 + trained weights | z-scored **non-odds** keys | Challenger; no weights file here |
| `GBM_STUMPS_v1` | `gbm-stumps.ts` | N ≥ 200 and ≥ 6 keys | same keys, 8 stumps | Implemented; not trained here |
| `NAIVE_LEAGUE_FREQ_v1` | `naive.ts` | — | as-of league H/D/A frequencies | Baseline |
| `MARKET_DEVIG_BASELINE` | `market-baseline.ts` | open triple present | **OPEN odds only** | **Non-independent benchmark** |

Registry today (`promotion-registry.ts`): stages `CANDIDATE → TRAINED → VALIDATED → OOS → SHADOW|REJECTED`. `auto_promotion: false`. `production` never flipped to true by code. Phase 8 `decidePromotionStage` **cannot** emit `PROMOTED`.

**Phase 9 must add** explicit statuses: `EXPERIMENTAL | VALIDATED | CANDIDATE | PROMOTED | RETIRED | INSUFFICIENT_EVIDENCE` without lowering that gate. `PROMOTED = 0` is a valid outcome. Live inference stays `INDEPENDENT_POISSON_v1` until documented criteria are met.

Walk-forward already exists (`validation/walk-forward.ts`): season folds, holdout `2324` blind until `evaluateHoldout=true`. Phase 8 **did not re-run** it here (no matches). Phase 9 re-runs on fetched history with **multiple dated OOS windows**, all models gated, value thresholds chosen on TRAIN/VAL only.

---

## 5. Markets actually implementable (given FDouk fields)

Settlement from `fthg/ftag` (always present on a valid `PiMatchRow`):

| Market | Implementable? | How | Historical odds on PiMatchRow? |
|---|---|---|---|
| 1X2 | **Yes** | `ftr` | Yes — open B365/PS/Avg when columns exist |
| Double chance (1X / 12 / X2) | **Yes** | derived from `ftr` | **No** dedicated DC prices |
| DNB | **Yes** | void on draw | **No** dedicated DNB prices |
| BTTS | **Yes** | both teams > 0 | **No** |
| O/U 0.5–3.5 | **Yes** | `fthg+ftag` vs line | **Maybe in raw CSV** (`B365>2.5` …); not on `PiMatchRow` |
| Multigol (1-2, 1-3, 2-3, 2-4) | **Yes** | total goals band | **No** |
| Team goals (home/away over 0.5/1.5) | **Yes** | `fthg` / `ftag` | **No** |
| Corners | **Conditional** | `hc+ac` when both non-null | **No** |
| Cards | **Conditional** | `hy+ay` (+ reds) when non-null | **No** |

**Rule:** model quality (logloss/Brier/…) may be computed whenever settlement exists. **ROI / value** only when a real historical price exists for that selection. Missing price → `INSUFFICIENT_EVIDENCE` for profitability, not a fabricated quote.

Goal-matrix models (Poisson / Dixon–Coles / NegBin) can emit derived market probabilities from λ. Logistic / GBM emit **1X2 only** unless a separate head is trained — Phase 9 will **not** invent BTTS/O/U heads for them.

---

## 6. Missing data (do not invent)

| Gap | Effect |
|---|---|
| No local FDouk / Club-Football / ClubElo files | Must HTTP-fetch FDouk or declare empty |
| No Lab B predictions/settlements | Cannot grade live BetMind paper bets; OOS is **archive replay** only |
| No xG / injuries / lineups / PPDA as-of | Features stay UNAVAILABLE; models must run without them |
| No corners/cards odds | Corners/cards = quality-only, no ROI |
| No DC/DNB/BTTS/multigol odds | Those markets = quality-only unless overlay finds a real column |
| Close odds | CLV research only; **never** in `DecisionContext` / feature vector |
| Club-Football Odd* / Form* | TEMPORALLY_UNKNOWN / reconstructed-only |
| Neon / DATABASE_URL | Ignored even if present |

---

## 7. Quality issues

1. **DATE_ONLY:** FDouk dates without reliable kickoff → feature cutoff = calendar day 00:00 UTC; same-day results excluded. Ugly and conservative (TASK 019).
2. **Time column** present on later seasons → `event_time` more precise, but `result_available_at` still next-day (do not loosen).
3. **Open vs close:** `B365` vs `B365C` — open used for market baseline; close is research. Some files lack Avg/PS.
4. **Division coverage:** PI locks five top flights only. Light path has more divisions but only ~2 seasons and no odds in its row type.
5. **Team IDs:** alias map + `raw:` fallback; H2H/form can fragment on spelling.
6. **Early-season form:** L3/L5/L10 missing until priors exist — explicit nulls, no future imputation.
7. **Overdispersion:** NegBin must refuse Poisson-like samples.
8. **Empty Lab B:** UI `/conclusi` and learning cases will stay empty; that is honest.

---

## 8. Leakage risks (must stay blocked)

| Risk | Existing control | Phase 9 extra |
|---|---|---|
| Target match in features | `assertNoFutureLeakage` / exclude `canonical_id` | re-assert on every OOS row |
| Result after cutoff | `priorMatchesAsOf` uses `result_available_at < cutoff` | firewall + tests |
| Same-day DATE_ONLY | cutoff = `match_dateT00:00Z` | do not switch to kickoff-as-availability |
| Closing odds in features | `assertNoClosingOddsInPredictionContext` | reject any `*C` / `research_odds_close` key |
| Any odds in independent vector | `assertNoMarketInputsInPredictionContext` | odds only after independent p̂ |
| Random split | `assertNotRandomTemporalSplit` | Phase 9 split builder throws on `random` |
| Holdout peeking | PI holdout `2324` blind in train | Phase 9: threshold on TRAIN/VAL only; last window OOS |
| Club-Football Form/Elo-on-row | TASK 018 reconstruct / unknown | do not load clone into STRICT_AS_OF |
| Post-event news / xG | UNAVAILABLE placeholders | stay out of bag |
| Single-ROI promotion | `auto_promotion: false` | explicit policy; PROMOTED=0 valid |

---

## 9. Wired public historical fetch (search result)

Before declaring “no data”, these **existing** HTTP paths must be tried (ordinary GET, no WAF bypass):

1. **`downloadFootballDataCsv` / `importFootballDataDataset`** — primary Phase 9 corpus (odds + stats + 6 seasons × 5 leagues).
2. **`fetchFootballDataHistory` / `loadLightHistory`** — 12 divisions × 2 seasons, results only.
3. **`fetchOpenFootballHistory`** — finished matches from OpenFootball JSON packs (no odds).
4. Local fallbacks if they appear: PI raw cache, `data-foundation/football-data`, Club-Football clone, `loadHistoricalMatches` disk scan.

Phase 8 mega-verify on another host: FDouk **0/20**. This host may differ. Success is measured by **parsed rows with both teams + FT goals**, not HTTP 200.

---

## 10. Audit quantities (pre-fetch)

| Metric | Value |
|---|---|
| Finished matches on disk usable for OOS | **0** |
| Date range on disk | **none** |
| Lab B predictions / settlements | **0 / 0** |
| PI model artifacts | **0** |
| PROMOTED models | **0** |
| CURRENT_PRODUCTION id | `INDEPENDENT_POISSON_v1` (code default, not re-validated here) |
| Neon | **not used** |

Post-fetch numbers belong in `artifacts/phase-9/dataset-manifest.json` and the final report — not invented here.

---

## 11. What Phase 9 will do next

1. Fetch via existing FDouk HTTP import (and light/OpenFootball only as documented supplements).
2. Build FEATURES(T) with `previous.result_available_at < target.feature_cutoff`; timestamps when Time exists; else DATE_ONLY.
3. Chronological / walk-forward splits only; persist exact window dates.
4. Baselines first; market baseline separate.
5. Evaluate each model **only** if its data gate passes.
6. Separate **model quality** from **betting profitability**.
7. Value vs real open odds; edge grid 1/2/3/5/7/10% chosen on TRAIN/VAL, verified OOS.
8. Market discovery where settlement exists; ROI only where prices exist.
9. No auto-promote. Keep live Poisson until criteria met.
