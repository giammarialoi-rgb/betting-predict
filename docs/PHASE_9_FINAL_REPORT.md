# Phase 9 — Final report (OOS backtest)

**Written:** 2026-09-12  
**Branch:** `cursor/phase-9-oos-backtest-fc61`  
**Base:** `main` @ `91ee590`  
**Storage:** filesystem `StorageProvider`. **NEON NON UTILIZZATO.**  
**Principle:** prove on the past before authorizing the future. SEEK TRUTH.

This report is **not** a claim that BetMind “works”, is profitable, or is production-verified.  
`PROMOTED = 0`. Live pointer remains `INDEPENDENT_POISSON_v1`.

Artifacts: `artifacts/phase-9/*.json`. UI: `/backtest`.

---

## The 15 questions

### 1. Where is the historical data, and what quantities exist?

**FATTO.** After HTTP fetch via the existing PI path (`importFootballDataDataset` → football-data.co.uk `mmz4281`):

| Item | Value |
|---|---|
| Rows | **10,707** unique finished matches |
| Date range | **2019-08-09 → 2025-05-25** |
| Leagues | E0 2280, SP1 2280, I1 2280, F1 2031, D1 1836 |
| Seasons | 1920: 1725; 2021/2122/2223: 1826 each; 2324/2425: 1752 each |
| Downloads | **30/30 OK**, 0 fail |
| FT goals | 100% |
| Shots / corners / cards | 99.99% (10,706 / 10,707) |
| Kickoff Time column | 98.3% (cutoff still DATE_ONLY) |
| Open 1X2 odds (any of B365/PS/Avg) | 10,706 |
| Close odds (research/CLV only) | 10,707 |
| O/U 2.5 overlay (not a feature) | 10,705 |

Lab B live ledgers (events/predictions/settlements/observations) remain **empty on this VM** (gitignored). Club-Football `Matches.csv` (238,858 documented) is **absent**. Those gaps are not invented.

Pre-fetch audit: `docs/PHASE_9_PRE_BACKTEST_AUDIT.md`. Manifest: `artifacts/phase-9/dataset-manifest.json`.

### 2. If local CSV was missing, was a wired public path used?

**FATTO.** Local FDouk / Club-Football / PI `matches.jsonl` were missing. Phase 9 used the **existing** HTTP importer (not a new scraper). Light-analysis fetch was not needed after PI import succeeded.

### 3. Is FEATURES(T) temporally valid?

**EVIDENZA.** Feature cutoff = `match_dateT00:00:00.000Z`. Priors require `result_available_at < cutoff` (next UTC day after the previous match date) **and** previous kickoff `<` target kickoff. Same-day results excluded (DATE_ONLY). Leakage audit: temporal/target/odds/future-features **pass**; random split **rejected**. Closing odds never enter the independent bag.

Ugly and conservative: even when `Time` exists, we do **not** treat kickoff as quote/result availability.

### 4. What splits were used?

**FATTO.** Chronological expanding walk-forward only. Four windows with exact dates:

| Window | Train | VAL | OOS |
|---|---|---|---|
| wf … 1920 / 2021 / 2122 | 2019-08-09→2020-08-02 (n=1725) | 2020-08-21→2021-05-23 (1826) | 2021-08-06→2022-05-22 (1826) |
| … 1920+2021 / 2122 / 2223 | →2021-05-23 (3551) | 2021-08-06→2022-05-22 (1826) | 2022-08-05→2023-06-04 (1826) |
| … +2122 / 2223 / 2324 | →2022-05-22 (5377) | 2022-08-05→2023-06-04 (1826) | 2023-08-11→2024-06-02 (1752) |
| … +2223 / 2324 / 2425 | →2023-06-04 (7203) | 2023-08-11→2024-06-02 (1752) | 2024-08-15→2025-05-25 (1752) |

Pooled OOS n for evaluated models: **7,156**. Thresholds chosen on VAL only.

### 5. How did baselines perform? (last OOS window 2425, n=1752)

Quality only. Market is **not** an independent model.

| Baseline | LogLoss | Brier | Acc | ECE | AUC |
|---|---:|---:|---:|---:|---:|
| UNIFORM_1X2 | 1.0986 | 0.2222 | 42.0% | 0.087 | 0.50 |
| HISTORICAL_HDA | 1.0771 | 0.2175 | 42.0% | 0.011 | 0.48 |
| LEAGUE_FREQ | 1.0835 | 0.2188 | 41.7% | 0.025 | 0.50 |
| HOME_ADVANTAGE | 1.0844 | 0.2193 | 42.0% | 0.061 | 0.48 |
| MARKET_DEVIG_OPEN (non-independent) | **0.9647** | **0.1911** | **53.4%** | 0.025 | **0.69** |

The open market is the strongest 1X2 probability source in this corpus. That does **not** authorize using odds as model features.

### 6. Which models were evaluated OOS?

| Model | Gate | OOS n | Status |
|---|---|---:|---|
| INDEPENDENT_POISSON_v1 | N≥20 | 7156 | EXPERIMENTAL (does not beat naive log-loss) |
| DIXON_COLES_v1 | N≥40 | 7156 | CANDIDATE (beats naive on all 4 windows) |
| NEGBIN_v1 | N≥80 **and** overdispersion | 0 | **INSUFFICIENT_EVIDENCE** — goals not overdispersed (mean 1.40, var 1.56) |
| INDEPENDENT_LOGISTIC_v1 | N≥40 + weights | 7156 | EXPERIMENTAL (worse than naive) |
| GBM_STUMPS_v1 | N≥200, ≥6 keys | 7156 | CANDIDATE (beats naive log-loss/Brier; weak accuracy) |

No percentage was emitted for NegBin. Logistic/GBM have no invented BTTS/O/U heads.

### 7. Model quality vs betting profitability (must stay separate)

**Pooled OOS 1X2 quality (n=7156):**

| Model | LogLoss | Brier | Acc | BalAcc | ECE | AUC | Goals MAE H/A |
|---|---:|---:|---:|---:|---:|---:|---|
| Poisson (live) | 1.1270 | 0.2178 | 48.8% | 0.427 | 0.122 | 0.618 | 1.16 / 0.99 |
| Dixon–Coles | **1.0579** | **0.2099** | 48.6% | 0.426 | 0.040 | 0.616 | 1.04 / 0.95 |
| Logistic | 1.3162 | 0.2424 | 45.0% | — | 0.208 | — | n/a |
| GBM stumps | 1.0681 | 0.2152 | 43.4% | 0.333 | **0.004** | 0.557 | n/a |
| Naive (last window) | 1.0835 | 0.2188 | 41.7% | — | 0.025 | 0.50 | n/a |
| Market OPEN (last window) | 0.9647 | 0.1911 | 53.4% | — | 0.025 | 0.69 | n/a |

**Value (independent p̂ vs real OPEN 1X2; threshold chosen on VAL):**

| Model | VAL-chosen edge | OOS bets | Hit | Yield | Max DD (stake units / bets) |
|---|---:|---:|---:|---:|---:|
| Poisson | 10% | 3342 | 41.5% | **−6.4%** | 0.073 |
| Dixon–Coles | 10% | 2589 | 34.9% | **−6.9%** | 0.079 |
| Logistic | 10% | 5301 | 39.0% | **−6.0%** | 0.062 |
| GBM | 10% | 3179 | 25.3% | **−14.1%** | 0.145 |

Bootstrap 95% CI on Poisson OOS yield: **[−11.9%, −2.0%]** — negative, not “unlucky noise” in this sample.  
A single-window or single-threshold positive ROI was **not** used to promote.

### 8. Was value leakage-safe?

**FATTO.** Edge = `p_model(sel) − 1/odds_open(sel)` after independent probabilities. Close odds unused. Grid 1/2/3/5/7/10% reported; selection on VAL only; OOS is verification. All chosen-threshold OOS yields are negative.

### 9. Market discovery — what can be asserted?

Settlement exists for 1X2, DC, DNB, BTTS, O/U 0.5–3.5, multigol bands, team-goal overs, corners, cards (corners/cards n≈7155).

| Market | Settlement | Historical odds | Quality | ROI |
|---|---|---|---|---|
| 1X2 | yes | yes (open) | Dixon–Coles best independent log-loss 1.058 | negative (see §7) |
| DC / DNB / BTTS / O-U / multigol / team goals | yes (from FT score) | **no** except O/U 2.5 overlay | score-matrix models only | ROI **NON DETERMINABILE CON I DATI DISPONIBILI** except O/U 2.5 prices (not used to promote) |
| Corners / cards | yes | no | no independent corner/card model head | **NON DETERMINABILE CON I DATI DISPONIBILI** |

Logistic/GBM: 1X2 only. We did not invent other-market heads.

### 10. Robustness / uncertainty / snooping?

- Bootstrap n=200 on pooled OOS. Dixon–Coles log-loss CI95 **[1.045, 1.070]** (SE 0.0004).
- PnL concentration (Poisson): top 10% of |bets| ≈ 23% of absolute PnL; max single bet share ≈ 0.19%. Not a one-bet story.
- Six thresholds tested; choice locked on VAL → documented snooping budget, not hidden search.
- NegBin: explicit INSUFFICIENT_EVIDENCE (not overdispersed).
- N=7156 is not “small” for 1X2 quality. Corners/cards **model** n is insufficient (no head).

### 11. MODEL × MARKET matrix — auto-promote?

**No.** Matrix in `market-comparison.json` (`auto_promote: false` on every cell). Best independent 1X2 quality ≠ license to bet. Market still dominates 1X2 log-loss.

### 12. Registry and promotion?

Statuses used: EXPERIMENTAL / VALIDATED / CANDIDATE / PROMOTED / RETIRED / INSUFFICIENT_EVIDENCE.

| | |
|---|---|
| PROMOTED | **0** |
| CANDIDATE | Dixon–Coles, GBM (quality vs naive only) |
| EXPERIMENTAL | Poisson (live), Logistic |
| INSUFFICIENT_EVIDENCE | NegBin |
| CURRENT_PRODUCTION | **INDEPENDENT_POISSON_v1 unchanged** |

Policy (enforced): leakage pass; odds not in features; minima 200/80/80; beat naive log-loss **and** Brier on **every** OOS window; ECE < 0.08; threshold on VAL; **human approval required for PROMOTED**; single positive ROI insufficient; no code path writes `PROMOTED`.

Dixon–Coles and GBM reaching CANDIDATE does **not** replace the live Poisson pointer (no regression / no auto-swap). Poisson failed the “beat naive” gate in this lab — that is evidence against promoting it, not a reason to silently swap in another model.

### 13. Learning loop?

Batch only: 28,624 graded rows (4 evaluated models × 7156). `auto_applied: false`. No per-match weight hack.

Poisson error mix: HOME 4551 pred / 2348 hit; AWAY 2124 / 1004; DRAW 481 / 140. Mean |1−p_actual| ≈ 0.58.

Feature importance (logistic |W|² / GBM stump mass) is **not causal**. Top logistic keys: `strength_diff_pts`, rest days, `home_ga_l5`. Provenance: football-data priors, DATE_ONLY, `entered_model` only if ELIGIBLE.

Hypotheses are labelled IPOTESI and were **not** turned into features.

### 14. Commands and artifacts?

```
pnpm betmind:backtest
pnpm betmind:backtest:report
pnpm betmind:model-evaluate
pnpm betmind:model-registry
```

All filesystem; ignore `DATABASE_URL`.

| Artifact | Role |
|---|---|
| `dataset-manifest.json` | corpus + coverage |
| `backtest-results.json` | windows, models, baselines, value |
| `model-comparison.json` | quality comparison |
| `market-comparison.json` | MODEL×MARKET |
| `promotion-candidates.json` | registry snapshot, promoted_count=0 |
| `leakage-audit.json` | firewall |
| `calibration-report.json` | ECE |
| `error-analysis.json` | batch grading + importance |
| `ui-copy.json` | Italian FATTO/EVIDENZA/IPOTESI |
| `windows.json` | exact dates |

### 15. What can / cannot be asserted?

**Can assert (FATTO / EVIDENZA):**

- A 10,707-match DATE_ONLY FDouk corpus was fetched and evaluated with walk-forward OOS.
- Independent models do **not** beat OPEN-market log-loss on the last window.
- Dixon–Coles beats league-frequency naive on all four OOS windows on log-loss and Brier; Poisson and Logistic do not (pooled).
- Paper value at the VAL-chosen 10% edge is **negative** for every evaluated model; Poisson yield CI excludes zero.
- NegBin is not supported by these goal statistics.
- No model was promoted. Neon was not used. Odds were not features.

**Cannot assert:**

- That BetMind has an operational betting edge.
- That any model should go live in place of Poisson.
- ROI on DC/DNB/BTTS/multigol/corners/cards — **NON DETERMINABILE CON I DATI DISPONIBILI** (no or unused prices / no model head).
- That Club-Football 238k rows or Lab B live settlements were used — they were not on this VM.
- Causal meaning of feature importance.
- Production verification beyond this offline archive replay.

---

## Open problems

1. Live Lab B still empty — this lab is archive replay, not settled BetMind paper bets.
2. Market remains a much better 1X2 probability than any independent model here.
3. DATE_ONLY discards same-day information; loosening that would be a leakage regression.
4. GBM CANDIDATE on proper scoring rules with 43% accuracy / 0.33 balanced accuracy is a warning, not a trophy.
5. `audit/external/` fetch cache is gitignored; Vercel/other hosts must re-fetch FDouk.

**Phase 9 does not declare the product complete.** It declares what the past, under a strict firewall, allows us to say.
