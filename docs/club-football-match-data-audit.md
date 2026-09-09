# Club Football Match Data — Forensic Audit

**Task:** 006-A (audit only)  
**Analysis date:** 2026-09-06  
**Repository:** https://github.com/xgabora/Club-Football-Match-Data.git  
**Branch:** `main`  
**Commit SHA:** `25882a58a736daf7ece3781940eac17ae1117a66`  
**Retrieved at:** `2026-09-06T19:35:29.554Z`  
**Dataset version label:** `main@shallow`  
**Repo license (packaging):** MIT (Copyright 2025 xgabora)  
**Decision gate:** **YELLOW**

This audit treats the repository as a *candidate* source under Sports Prediction Engine constraints (`event_time` ≠ `observed_at` ≠ `available_at` ≠ `ingested_at`). It is **not** automatically trusted.

No Neon migration, schema change, production import, model, ROI, or prediction was performed.

---

## 1. Repository discovery

| Item | Value |
|------|--------|
| URL | https://github.com/xgabora/Club-Football-Match-Data |
| Structure | `README.md`, `LICENSE`, `data/Matches.csv`, `data/EloRatings.csv` |
| Code / generators | **None** in the clone (no scripts explaining Form/cluster/Elo join) |
| Declared sources | Football-Data.co.uk (matches/stats/odds), ClubElo (ratings through 2025-06-01) |
| External packs | Marketing link to odds.adamgabor.eu (not audited here) |
| Full dataset in git | Yes (~57 MB). **Not redistributed** by this project; clone path `audit/external/` is gitignored |

---

## 2. Data inventory (measured)

| File | Format | Size | Rows | Columns | Encoding | Delimiter |
|------|--------|------|------|---------|----------|-----------|
| `Matches.csv` | CSV | 45,608,878 B | **238,858** | **48** | utf8 | `,` |
| `EloRatings.csv` | CSV | 11,331,209 B | **273,972** | **4** | utf8 | `,` |

Header matches README column list exactly (`header_matches_expected: true`).

Machine profiles: `audit/club-football-match-data-columns.csv`, `audit/club-football-match-data-summary.json`.

---

## 3. Geographic / competition coverage

**38 division codes:**  
ARG, AUT, B1, BRA, CHN, D1, D2, DEN, E0, E1, E2, E3, EC, F1, F2, FIN, G1, I1, I2, IRL, JAP, MEX, N1, NOR, P1, POL, ROM, RUS, SC0, SC1, SC2, SC3, SP1, SP2, SUI, SWE, T1, USA

Rough country mapping follows football-data.co.uk division codes (England E*, Spain SP*, Italy I*, Germany D*, France F*, Scotland SC*, plus single-league country codes). Elo table reports **19** country codes and **984** clubs.

**Date coverage (matches):** 2000-07-28 → 2026-09-03  
**Elo snapshots:** 2000-07-01 → 2026-09-01 (**629** snapshot dates)

| Bucket | Matches |
|--------|--------:|
| 2000-2005 | 24,797 |
| 2005-2010 | 34,086 |
| 2010-2015 | 48,654 |
| 2015-2020 | 60,876 |
| 2020-2025 | 58,506 |
| 2025+ | 11,939 |

---

## 4. Completeness matrix (availability %)

From `audit/club-football-match-data-coverage.csv`:

| Feature family | 2000-05 | 05-10 | 10-15 | 15-20 | 20-25 | 2025+ | Overall band |
|----------------|---------|-------|-------|-------|-------|-------|--------------|
| Bet365 1X2 (`Odd*`) | 89% | ~100% | ~100% | ~100% | ~100% | ~100% | **90-99%+** |
| Max aggregates | 0% | 92% | ~100% | ~100% | ~100% | ~100% | rises after mid-2000s |
| Shots stats | 42% | 51% | 42% | 46% | 59% | 95% | **25-75%** historically |
| Elo on match row | 76% | 73% | 57% | 49% | 49% | 92% | **~63%** overall non-null HomeElo |
| Form3/5 | ~100% | 100% | 100% | 98% | ~100% | 99% | **99%+** |
| Clusters `C_*` | 39% | 47% | 42% | 46% | 59% | 30% | **~47%**; last **8,301** rows blank |

Overall non-null (Matches): HomeElo **62.8%**, HomeShots **51.3%**, MatchTime **45.0%**, OddHome **98.7%**, C_LTH **47.1%**.

---

## 5. Match fields — semantics & leakage

| Field | Source (declared) | Semantics | Temporal status | Leakage | Usable prematch? |
|-------|-------------------|-----------|-----------------|---------|------------------|
| Division | FD.co.uk | Competition code | identity | none | yes (identity) |
| MatchDate | FD.co.uk | Calendar match date | `event_time` candidate (`date_only`) | none if used only as event date | yes as event date; **never** as availability |
| MatchTime | FD.co.uk | Claimed kickoff; README “CET-1” unverified | unknown precision | misuse as availability = leakage | event_time only; **55% missing** |
| Home/AwayTeam | FD.co.uk (remapped names) | Club labels | identity | alias risk | yes with alias table |
| FT*/HT* | FD.co.uk | Results | post-match | **yes** | **no** (labels/outcomes only) |
| Shots/Target/Fouls/Corners/Cards | FD.co.uk | Final match stats | post-match | **yes** | **no** for prematch features |
| HomeElo/AwayElo | ClubElo join + provisional | “Most recent Elo” | `dataset_window` | provisional post-2025-06-01 **suspect** | only if reconstructed from primary ClubElo as-of |
| Form3/5* | Derived in repo | Points last 3/5 | claimed prematch | if includes current/future | **APPROVED only after exact lag reconstruction** |
| Odd*/Over/Under/Handi* | Bet365 via FD.co.uk | Decimal odds | **open/close unknown** | if closing used as opening | **not** STRICT_AS_OF |
| Max* | Aggregate ~17 books | Max price | unknown | same | **not** a bookmaker; not STRICT_AS_OF |
| C_* | Author clustering | Cluster likelihood | unknown / likely post-stat | **high** | **FORBIDDEN** prematch |

---

## 6. Odds audit

**Present as BOOKMAKER columns:** Bet365 only (`OddHome/Draw/Away`, `Over25`, `Under25`, `HandiSize/Home/Away`).

**Present as AGGREGATE (not bookmakers):** `MaxHome/Draw/Away`, `MaxOver25`, `MaxUnder25`.

**Absent as dedicated columns:** Pinnacle, William Hill, BetVictor, Interwetten, etc.

**Opening vs closing:** **Not documented.** Temporal class for all odds columns = `UNKNOWN`.  
Per project rules: closing inaccessible when `decision_time < closing_observation`; here observation time is unknown → require `temporal_precision=unknown` and block `requirePrecision=exact`.

**Quality:** 14 invalid Bet365-side odds values in scan; **7** rows with `OddHome == 0`.

---

## 7. Temporal matrix (summary)

| Dataset field | Event time | Observation time | Availability time | Precision |
|---------------|------------|------------------|-------------------|-----------|
| MatchDate/Time | claimed kickoff parts | unknown | **must not** use as quote/feature availability | date_only / unknown |
| FT/HT/stats | match / FT | unknown publish time | after kickoff | unknown |
| Form* | prior matches | unknown | unknown until rebuilt with shift | unknown |
| HomeElo/AwayElo | n/a | ClubElo snapshot dates (1st/15th) or provisional | ≤ snapshot date *if* join correct | dataset_window |
| Odd*/Max* | kickoff ≠ quote time | **unknown** | **unknown** | unknown |
| C_* | match | model-derived | not demonstrably pre-match | unknown |

`ingested_at` is never in the upstream files (only our future ingest clock).

---

## 8. Elo forensics

README states:

- Through **2025-06-01**: ClubElo  
- From **2025-06-15**: **provisional continuation** generated by the repo author from last ClubElo + new results  
- Snapshots on **1st and 15th** of month; some club names remapped

Measured Elo file: **245,033** pre-provisional rows, **28,939** provisional (`date >= 2025-06-15`).

**Sample join (local, reproducible):**  
Burnley vs Man City, `2023-08-11` → Match `HomeElo=1726.42`, `AwayElo=2077.27` equals EloRatings snapshot **2023-08-01** for both clubs. So for this sample, values are **pre-match relative to kickoff calendar date**, but only at **bi-monthly snapshot granularity** (`dataset_window`), not an exact pre-kickoff ClubElo tick.

**Not proven:** methodology of provisional Elo; whether any match row after mid-2025 embeds future results beyond the decision point; name remap completeness.

**Conclusion:** Elo columns are **not** automatically leakage-free. Prefer independent ClubElo ingest with explicit `available_at = snapshot_date` and treat repo provisional Elo as **suspect / BENCHMARK_ONLY**.

---

## 9. Form forensics

Declared formula: points from last 3 / last 5 matches (W=3, D=1, L=0).

Offline reconstruction over first **5,000** chronological rows with **global** team history (all competitions), lagged correctly (exclude current):

- Exact match rate: **88.0%** (4,400 / 5,000)  
- Mismatch: **12%** → formula scope is **not fully explained** (likely competition/season windowing, postponed handling, or early-history padding)

**APPROVED prematch status:** **not yet.** Class = `DERIVED_REQUIRES_RECONSTRUCTION`. Safe path: rebuild form ourselves from canonical results with documented window + shift.

---

## 10. Derived / cluster features

In-file derived: Form*, Elo join, `C_*` clusters.  
README also lists many *suggested* lagged/derived features **not present** in CSV (GF3, streaks, implied probs, etc.) — ignore for inventory of actual columns.

`C_*` blank on newest **8,301** rows (100% of that tail) — confirms README. Clusters classified **LEAKAGE_RISK / FORBIDDEN_PREMATCH**.

---

## 11. Provenance

| Group | Original source | Source type | Confidence | Notes |
|-------|-----------------|-------------|------------|-------|
| Identity + results + stats | football-data.co.uk | aggregator | partially_verified | Live CSV cross-check **blocked** (HTTP 503) during audit |
| Bet365 / Max odds | via football-data.co.uk | bookmaker_feed / aggregate | partially_verified | open/close unlabeled in this repo |
| Elo table ≤2025-06-01 | clubelo.com | rating_provider | partially_verified | ClubElo API **502** during audit; local join consistent on sample |
| Elo ≥2025-06-15 | repo author provisional | derived | **suspect** | not primary ClubElo |
| Form / clusters | repository | derived | unknown / suspect | no generation code in repo |

Artifacts: `audit/club-football-match-data-provenance.csv`.

---

## 12. Duplicates & identity

Deterministic candidate key: `Division|MatchDate|HomeTeam|AwayTeam` (lowercased teams).

**Duplicate identity keys:** **0** in full file.

Team inventory: ~1,219 home / 1,221 away distinct strings. Alias candidates (prefix / youth markers / case) exported to `audit/club-football-match-data/team_alias_candidates.json` — **no fuzzy matching applied**.

---

## 13. Cross-source validation

| Check | Result |
|-------|--------|
| football-data.co.uk `notes.txt` / `2324/E0.csv` | **HTTP 503** — quantitative value match **not performed** |
| ClubElo API `ManUnited` | **HTTP 502** |
| Local EloRatings ↔ Matches HomeElo/AwayElo (Burnley–Man City 2023-08-11) | **PASS** (exact float match to 2023-08-01 snapshot) |
| Cluster blank tail | **PASS** vs README (8,301) |

See `docs/club-football-match-data-sample-cross-validation.md`.

---

## 14. Critical question

**Does the dataset contain information the model could not have known at match decision time?**

**Yes.**

| Field | Reason | Leakage mechanism | Safe reconstruction |
|-------|--------|-------------------|---------------------|
| FT*/HT*/shots/fouls/corners/cards | Realized during/after match | post-match facts as features | outcomes/stats tables only; never STRICT_AS_OF features |
| C_* | Undocumented clusters; likely from match-style stats | train/serve leakage | rebuild from lagged prematch only or drop |
| Odd*/Max*/Handi* | Open vs close unknown | possible closing-as-prematch | re-ingest FD.co.uk with `dataset_open`/`dataset_close` + `temporal_precision=unknown` |
| Provisional Elo (≥2025-06-15) | Author continuation using new results | possible look-ahead in rating path | use ClubElo primary only |
| Form* (as shipped) | 12% mismatch vs simple lag; scope opaque | possible window errors | reconstruct with explicit shift |

---

## 15. Usage modes

| Mode | Columns |
|------|---------|
| **STRICT_AS_OF** | Division, HomeTeam, AwayTeam; MatchDate as event calendar identity only |
| **RESEARCH_DATASET** | Form*, HomeElo/AwayElo (pre-provisional, marked unknown/dataset_window); MatchTime as claimed kickoff |
| **BENCHMARK_ONLY** | All POST_MATCH stats/results; all Odd*/Max*/Handi*; all C_*; provisional Elo |

---

## 16. Import readiness (no import performed)

| Family | Status |
|--------|--------|
| matches | READY_WITH_TRANSFORMATIONS |
| results | READY_WITH_TRANSFORMATIONS |
| stats | BLOCKED_PENDING_TEMPORAL_VALIDATION |
| odds | BLOCKED_PENDING_TEMPORAL_VALIDATION |
| Elo | BLOCKED_PENDING_PROVENANCE |
| form | BLOCKED_PENDING_TEMPORAL_VALIDATION |
| derived_features | BLOCKED_PENDING_TEMPORAL_VALIDATION |

**SCHEMA CHANGE REQUIRED** if we later store Elo/form/clusters as first-class feature facts (new feature tables / observation metadata). **Not applied** in this task — propose only.

---

## 17. Recommended source role

**Secondary + benchmark / validation**, not primary.

- **Primary** for matches/odds/stats should remain **football-data.co.uk** (and ClubElo for ratings) with our temporal contracts.  
- This repo is valuable as a **wide historical pack**, **benchmark corpus**, and **cross-check** after transformations.  
- It is **not** sufficient alone for a market-competitive as-of system (“more columns” ≠ better temporal honesty).

**Reconstruction feasibility:** A (partial, after transform) + B (form/Elo if rebuilt) + C (benchmark) + D (validation). Not E.

---

## 18. Proposed mapping (no DB writes)

| Repository | Canonical target |
|------------|------------------|
| HomeTeam / AwayTeam | `teams` (+ declarative aliases) |
| Division | `competitions` / league codes |
| MatchDate (+ optional MatchTime) | `events.scheduled_start_at` (event_time only; timezone unverified) |
| FT*/HT* | future event outcomes (post-match) |
| shots/cards/… | future match_stats (post-match) |
| Odd*/Max* | `market_snapshots` only after open/close classification from **original** FD columns |
| HomeElo/AwayElo | future feature_source rows from **ClubElo**, not provisional pack |
| Form* | derived feature store after reconstruction |
| C_* | do not import for modeling |

---

## 19. Quality labels (non-numeric)

| Area | Label | Why |
|------|-------|-----|
| Match identity/results packaging | partially_verified | Declared FD.co.uk; live verify blocked; internal consistency strong |
| Odds packaging | partially_verified | Bet365/Max present; temporal class unknown; some invalid 0 odds |
| ClubElo official slice | partially_verified | Local join OK; live ClubElo blocked |
| Provisional Elo | suspect | Author-generated continuation |
| Form | unknown | 88% reconstructible; scope incomplete |
| Clusters | suspect | undocumented model; blank recent tail |

---

## 20. License / attribution

- Repository packaging: **MIT**.  
- Underlying Football-Data.co.uk and ClubElo remain subject to **their** terms — MIT on the GitHub repo does **not** re-license upstream sports data.  
- Do not republish full third-party CSVs in this project; cite Gábor (2026) if using the pack for research, and attribute original sources.

---

## 21. Artifacts

- `docs/club-football-match-data-audit.md` (this file)  
- `docs/club-football-match-data-column-dictionary.md`  
- `docs/club-football-match-data-sample-cross-validation.md`  
- `audit/club-football-match-data-summary.json`  
- `audit/club-football-match-data-columns.csv`  
- `audit/club-football-match-data-coverage.csv`  
- `audit/club-football-match-data-leakage.csv`  
- `audit/club-football-match-data-provenance.csv`  
- `audit/club-football-match-data/team_alias_candidates.json`  
- Offline fixtures under `src/audit/club-football-match-data/fixtures/`  
- Reproducible runner: `pnpm exec tsx src/audit/club-football-match-data/run-audit.ts`

---

## 22. Decision gate

### YELLOW — usable with transformations / limitations

Motivations from measured evidence:

1. Large, internally consistent historical pack (238k matches, 0 identity collisions).  
2. Declared lineage to sources we already care about — but **this pack is not a substitute** for primary ingest with temporal metadata.  
3. Explicit post-match, unlabeled odds, provisional Elo, and opaque clusters **fail** the question “was this available before the decision?” for STRICT_AS_OF.  
4. Therefore: allow as **benchmark / research / secondary validation**, block silent use as primary modeling features until reconstruction + provenance tasks complete.
