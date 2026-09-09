# TASK 033 — FINAL VERDICT

VERDICT: NO_DEMONSTRATED_EDGE
STRICT_EVENTS: 10499 (1X2 LEVEL_B) + 1 (exchange MIRROR clock, not capital)
STRICT_MARKETS: 11
MODEL_READY: 1
BEST_MODEL: MARKET_DEVIG
BEST_MARKET: 1X2
DELTA_VS_MARKET: 0
HOLM: n_tests=0 (no new market reached n≥100; 1X2 not re-tested)
HOLDOUT: EMPTY
BET_COUNT: 0
BANKROLL: NOT_QUALIFIED
WINNER: null
AUTO_PROMOTION: false
REAL_MONEY: false

FINGERPRINT: `ba1a74139bed1f8a4c369e2438eb89031df71270f36143a591b008cd96f7c88a`
DATASET_031_SHA256: `6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b`
TASK_032_FINGERPRINT: `fd252d57021317754e2a056b3b59fc11e9df108ac7aaa00e95481caa5a383239`

## 1. WHAT WE ACTUALLY HAVE

- Frozen 1X2 STRICT set TASK_031_BASE: 10 499 events, T−1h, MATCH_EXACT, SHA frozen. File not copied or rewritten.
- TASK 032 already showed MARKET_DEVIG unbeaten on that set (NO_DEMONSTRATED_EDGE). This task does not re-fit those models.
- Betfair BASIC GitHub MIRROR: one football event (2017-04-30 Middlesbrough v Man City) with `pt` < `marketTime` (ISO-Z). Many market types, n=1.
- Kaggle zygmunt/betfair-sports weekly CSV (~329 MB): many football markets, naive `FIRST_TAKEN`/`SCHEDULED_OFF`, **no timezone** → not STRICT.
- BeatTheBookie odds_series / closing_odds: 1X2 only (series) or DATE_ONLY closing.
- Club-Football, Zenodo UCD, football-data lineage: 1X2 + OU 2.5 + AH labels, DATE_ONLY.
- soccer-dataset odds.parquet: known_at = kickoff (closing) → FORBIDDEN as DecisionContext.

## 2. WHAT WAS DISCOVERED

Filesystem inventory: 219 candidate files under artifacts/audit/data/datasets/downloads/external/tmp/cache/docs. Missing roots: data, datasets, downloads, external, tmp, cache.

New public probes (not previously treated as SUCCESS):
- hf-olivier-closing-sample: acquired=true class=DATE_ONLY_OR_CLOSING_SAMPLE — HuggingFace 1% sample advertised as closing odds 1998–2026. Not a quote clock. Paid master set not acquired.
- hf-olivier-parquet: acquired=true class=CLOSING_SAMPLE_LISTING — ["https://huggingface.co/api/datasets/oliviersportsdata/Sample-Historical-Football-Odds/parquet/default/train/0.parquet"]
- petermclagan-sample-listing: acquired=true class=MIRROR_SAMPLE_LISTING — Already on disk as TASK 023 football BASIC. Listing: "name":"football-basic-sample.bz2"
- skipped-already-blocked: acquired=false class=SKIP_BLOCKED — Not re-probed: ClubElo, football-data.co.uk 503, OddsPapi, 5Dollar, Betfair Historic login, Football Charts paid.

No additional LEVEL_A/B dump with n≥100 non-1X2 markets was physically acquired.

## 3. MARKETS TESTED

| Market | STRICT events | Model | Test Brier | Market Brier | Δ | CI95 | Holm p | Holdout | Verdict |
|---|---:|---|---:|---:|---:|---|---:|---|---|
| 1X2 | 10499 | MARKET_DEVIG | 0.198778 | 0.198778 | 0 | — | — | EMPTY | NO_DEMONSTRATED_EDGE |
| OU | 1 | — | — | — | — | — | — | EMPTY | INSUFFICIENT_N |
| BTTS | 1 | — | — | — | — | — | — | EMPTY | INSUFFICIENT_N |
| AH | 1 | — | — | — | — | — | — | EMPTY | INSUFFICIENT_N |
| DC | 1 | — | — | — | — | — | — | EMPTY | INSUFFICIENT_N |
| DNB | 1 | — | — | — | — | — | — | EMPTY | INSUFFICIENT_N |
| Correct Score | 1 | — | — | — | — | — | — | EMPTY | INSUFFICIENT_N |
| Corners | 1 | — | — | — | — | — | — | EMPTY | INSUFFICIENT_N |
| Cards | 1 | — | — | — | — | — | — | EMPTY | INSUFFICIENT_N |
| Player | 1 | — | — | — | — | — | — | EMPTY | INSUFFICIENT_N |
| Exchange | 1 | — | — | — | — | — | — | EMPTY | INSUFFICIENT_N |

Betfair BASIC market types (MIRROR, capital_eligible=false):
- OVER_UNDER_85_CORNR (OU) event=28202626 prematch_ticks=11 last_pt=2017-04-30T12:52:53.180Z
- SHOWN_A_CARD (Cards) event=28202626 prematch_ticks=20 last_pt=2017-04-30T13:04:52.430Z
- TO_SCORE_2_OR_MORE (Exchange) event=28202626 prematch_ticks=27 last_pt=2017-04-30T13:02:53.487Z
- OVER_UNDER_25 (OU) event=28202626 prematch_ticks=94 last_pt=2017-04-30T13:04:52.430Z
- OVER_UNDER_45 (OU) event=28202626 prematch_ticks=28 last_pt=2017-04-30T13:02:53.487Z
- HALF_TIME_SCORE (Exchange) event=28202626 prematch_ticks=84 last_pt=2017-04-30T13:04:52.430Z
- HALF_TIME_FULL_TIME (Exchange) event=28202626 prematch_ticks=176 last_pt=2017-04-30T13:04:52.430Z
- OVER_UNDER_15 (OU) event=28202626 prematch_ticks=39 last_pt=2017-04-30T13:04:52.430Z
- WIN_BOTH_HALVES (Exchange) event=28202626 prematch_ticks=0 last_pt=—
- CLEAN_SHEET (Exchange) event=28202626 prematch_ticks=0 last_pt=—
- WIN_BOTH_HALVES (Exchange) event=28202626 prematch_ticks=7 last_pt=2017-04-30T13:04:52.430Z
- CLEAN_SHEET (Exchange) event=28202626 prematch_ticks=18 last_pt=2017-04-30T13:03:53.555Z
- PENALTY_TAKEN (Exchange) event=28202626 prematch_ticks=3 last_pt=2017-04-30T13:00:53.099Z
- CORRECT_SCORE2 (Correct Score) event=28202626 prematch_ticks=2 last_pt=2017-04-30T13:04:52.430Z
- HAT_TRICKED_SCORED (Player) event=28202626 prematch_ticks=5 last_pt=2017-04-30T12:45:53.449Z
- TEAM_TOTAL_GOALS (OU) event=28202626 prematch_ticks=6 last_pt=2017-04-30T12:27:53.218Z
- TO_SCORE_BOTH_HALVES (Exchange) event=28202626 prematch_ticks=10 last_pt=2017-04-30T13:02:53.487Z
- CORRECT_SCORE2 (Correct Score) event=28202626 prematch_ticks=69 last_pt=2017-04-30T13:04:52.430Z
- FIRST_GOAL_SCORER (Player) event=28202626 prematch_ticks=74 last_pt=2017-04-30T13:04:52.430Z
- TO_SCORE_BOTH_HALVES (Exchange) event=28202626 prematch_ticks=0 last_pt=—
- OVER_UNDER_105_CORNR (OU) event=28202626 prematch_ticks=10 last_pt=2017-04-30T13:03:53.555Z
- TO_SCORE (Exchange) event=28202626 prematch_ticks=109 last_pt=2017-04-30T13:04:52.430Z
- TO_SCORE_HATTRICK (Exchange) event=28202626 prematch_ticks=10 last_pt=2017-04-30T13:00:53.099Z
- WINNING_MARGIN (Exchange) event=28202626 prematch_ticks=6 last_pt=2017-04-30T13:03:53.555Z
- BOOKING_ODDS (Cards) event=28202626 prematch_ticks=12 last_pt=2017-04-30T13:02:53.487Z
- SENDING_OFF (Exchange) event=28202626 prematch_ticks=23 last_pt=2017-04-30T13:03:53.555Z
- TEAM_TOTAL_GOALS (OU) event=28202626 prematch_ticks=1 last_pt=2017-04-30T12:12:52.809Z
- OVER_UNDER_35 (OU) event=28202626 prematch_ticks=79 last_pt=2017-04-30T13:04:52.430Z
- ASIAN_HANDICAP (AH) event=28202626 prematch_ticks=111 last_pt=2017-04-30T13:04:52.430Z
- DRAW_NO_BET (DNB) event=28202626 prematch_ticks=30 last_pt=2017-04-30T13:02:53.487Z
- TEAM_A_2 (Exchange) event=28202626 prematch_ticks=34 last_pt=2017-04-30T13:03:53.555Z
- TEAM_B_1 (Exchange) event=28202626 prematch_ticks=7 last_pt=2017-04-30T13:02:53.487Z
- CORNER_ODDS (Corners) event=28202626 prematch_ticks=10 last_pt=2017-04-30T13:04:52.430Z
- TEAM_A_3 (Exchange) event=28202626 prematch_ticks=19 last_pt=2017-04-30T13:02:53.487Z
- TEAM_B_2 (Exchange) event=28202626 prematch_ticks=5 last_pt=2017-04-30T12:53:53.109Z
- TEAM_B_3 (Exchange) event=28202626 prematch_ticks=0 last_pt=—
- TEAM_A_WIN_TO_NIL (Exchange) event=28202626 prematch_ticks=3 last_pt=2017-04-30T12:43:52.512Z
- TEAM_B_WIN_TO_NIL (Exchange) event=28202626 prematch_ticks=13 last_pt=2017-04-30T13:03:53.555Z
- OVER_UNDER_75 (OU) event=28202626 prematch_ticks=8 last_pt=2017-04-30T13:02:53.487Z
- OVER_UNDER_85 (OU) event=28202626 prematch_ticks=11 last_pt=2017-04-30T13:04:52.430Z
- FIRST_HALF_GOALS_25 (Exchange) event=28202626 prematch_ticks=8 last_pt=2017-04-30T13:02:53.487Z
- BOTH_TEAMS_TO_SCORE (BTTS) event=28202626 prematch_ticks=34 last_pt=2017-04-30T13:04:52.430Z
- FIRST_GOAL_ODDS (Exchange) event=28202626 prematch_ticks=18 last_pt=2017-04-30T13:04:52.430Z
- MATCH_ODDS (1X2) event=28202626 prematch_ticks=748 last_pt=2017-04-30T13:04:52.430Z
- TOTAL_GOALS (OU) event=28202626 prematch_ticks=6 last_pt=2017-04-30T13:01:53.479Z
- ODD_OR_EVEN (Exchange) event=28202626 prematch_ticks=7 last_pt=2017-04-30T13:03:53.555Z
- DOUBLE_CHANCE (DC) event=28202626 prematch_ticks=15 last_pt=2017-04-30T13:02:53.487Z
- TEAM_A_1 (Exchange) event=28202626 prematch_ticks=41 last_pt=2017-04-30T13:03:53.555Z
- FIRST_HALF_GOALS_05 (Exchange) event=28202626 prematch_ticks=11 last_pt=2017-04-30T13:04:52.430Z
- OVER_UNDER_05 (OU) event=28202626 prematch_ticks=36 last_pt=2017-04-30T13:03:53.555Z
- FIRST_HALF_GOALS_15 (Exchange) event=28202626 prematch_ticks=19 last_pt=2017-04-30T13:03:53.555Z
- OVER_UNDER_65 (OU) event=28202626 prematch_ticks=18 last_pt=2017-04-30T13:04:52.430Z
- HALF_TIME (Exchange) event=28202626 prematch_ticks=50 last_pt=2017-04-30T13:04:52.430Z
- OVER_UNDER_55 (OU) event=28202626 prematch_ticks=33 last_pt=2017-04-30T13:04:52.430Z
- CORRECT_SCORE (Correct Score) event=28202626 prematch_ticks=550 last_pt=2017-04-30T13:04:52.430Z
- WINCAST (Exchange) event=28202626 prematch_ticks=4 last_pt=2017-04-30T13:03:53.555Z
- HALF_WITH_MOST_GOALS (Exchange) event=28202626 prematch_ticks=1 last_pt=2017-04-30T04:25:48.610Z
- SCORE_CAST (Exchange) event=28202626 prematch_ticks=49 last_pt=2017-04-30T13:04:52.430Z
- OVER_UNDER_45_CARDS (Cards) event=28202626 prematch_ticks=5 last_pt=2017-04-30T12:08:52.305Z
- CORNER_MATCH_BET (Corners) event=28202626 prematch_ticks=6 last_pt=2017-04-30T12:56:53.070Z
- OVER_UNDER_135_CORNR (OU) event=28202626 prematch_ticks=6 last_pt=2017-04-30T12:58:53.412Z
- MATCH_ODDS_AND_OU_25 (Exchange) event=28202626 prematch_ticks=7 last_pt=2017-04-30T13:04:52.430Z
- MATCH_ODDS_AND_BTTS (Exchange) event=28202626 prematch_ticks=12 last_pt=2017-04-30T13:04:52.430Z
- CORRECT_SCORE (Correct Score) event=28202626 prematch_ticks=0 last_pt=—
- HALF_TIME_SCORE (Exchange) event=28202626 prematch_ticks=0 last_pt=—
- HALF_TIME (Exchange) event=28202626 prematch_ticks=0 last_pt=—
- MATCH_ODDS (1X2) event=28202626 prematch_ticks=10 last_pt=2017-04-30T13:02:53.487Z
- OVER_UNDER_15 (OU) event=28202626 prematch_ticks=0 last_pt=—
- OVER_UNDER_25 (OU) event=28202626 prematch_ticks=3 last_pt=2017-04-30T12:58:53.412Z
- OVER_UNDER_35 (OU) event=28202626 prematch_ticks=2 last_pt=2017-04-30T13:02:53.487Z
- OVER_UNDER_45 (OU) event=28202626 prematch_ticks=1 last_pt=2017-04-30T12:17:50.038Z
- OVER_UNDER_55 (OU) event=28202626 prematch_ticks=0 last_pt=—
- OVER_UNDER_65 (OU) event=28202626 prematch_ticks=0 last_pt=—
- ANYTIME_SCORE (Exchange) event=28202626 prematch_ticks=2 last_pt=2017-04-30T13:02:53.487Z
- UNKNOWN (Exchange) event=28202626 prematch_ticks=1 last_pt=2017-04-30T12:54:52.584Z
- UNKNOWN (Exchange) event=28202626 prematch_ticks=0 last_pt=—
- OVER_UNDER_05 (OU) event=28202626 prematch_ticks=0 last_pt=—

As-of windows on the MIRROR event (observed ticks only): 72h=yes · 48h=yes · 24h=yes · 12h=yes · 6h=yes · 3h=yes · 1h=yes · 30m=yes · 15m=yes · 5m=yes · 1m=yes

## 4. BLIND TEST

1X2: TRAIN/VAL/TEST/HOLDOUT already locked in TASK 028–032. TEST was not re-opened. No model was chosen on TEST.
Other markets: n<100 → MODEL_READY=false; no TEST evaluation; no staking.
HOLDOUT 2020+: EMPTY (0 events). Not used for confirmation.

## 5. STATISTICAL RESULTS

No new Holm family. 1X2 incremental Holm from TASK 032: 0 rejections. Selected VAL model (schedule) TEST ΔBrier ≈ +0.000034, CI includes 0.
Declaring edge from DATE_ONLY OU/AH Brier on Club/Zenodo is forbidden.

## 6. HOLDOUT

HOLDOUT_STATUS = EMPTY. The 2016 corpus leftover is not 2020+ and was not used.

## 7. ANNUAL €1000 BANKROLL

QUALIFIED=false. Predictive gate failed. No Kelly, no flat, no Masaniello production. End = —. Never 1000→1000.

| Anno | Mercato | STRICT | Decisioni | Bets | Start | End | P/L | ROI | Max DD | Modello | Stato |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| 2001–2014 | 1X2 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2015 | 1X2 | 2381 | 0 | 0 | 1000 | — | — | — | — | MARKET_DEVIG | NO_EDGE |
| 2016 | 1X2 | 8118 | 0 | 0 | 1000 | — | — | — | — | MARKET_DEVIG | NO_EDGE |
| 2017 | Exchange | 1 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_N |
| 2018 | 1X2 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2019 | 1X2 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2020 | 1X2 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2021 | 1X2 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2022 | 1X2 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2023 | 1X2 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2024 | 1X2 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2025 | 1X2 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INSUFFICIENT_DATA |
| 2026 YTD | 1X2 | 0 | 0 | 0 | 1000 | — | — | — | — | — | INCOMPLETE_YEAR |

## 8. LEAKAGE AUDIT

- future_timestamp: HARD FAIL (ok)
- kickoff_leakage: HARD FAIL (ok)
- FT: HARD FAIL (ok)
- HT: HARD FAIL (ok)
- outcome: HARD FAIL (ok)
- closing_odds: HARD FAIL (ok)
- post_match_odds: HARD FAIL (ok)
- ambiguous_match: HARD FAIL (ok)
- future_bookmaker_quote: HARD FAIL (ok)
- future_lineup: HARD FAIL (ok)
- future_news: HARD FAIL (ok)
- aggregate_leakage: HARD FAIL (ok)
- cross_event_leakage: HARD FAIL (ok)
- date_only_to_strict: HARD FAIL (ok)
- naive_as_utc: HARD FAIL (ok)
- invented_ts: HARD FAIL (ok)
- test_lock: HARD FAIL (ok)
- holdout_lock: HARD FAIL (ok)
- feature_test: HARD FAIL (ok)
- holdout_train: HARD FAIL (ok)
- lock: HARD FAIL (ok)
- auto_promote: HARD FAIL (ok)
- masaniello: HARD FAIL (ok)
- task_034: HARD FAIL (ok)
- frozen_flags: HARD FAIL (ok)

## 9. DATA LIMITATIONS

- Official Betfair Historic BASIC/Advanced remains account-gated. The GitHub sample is a MIRROR, not an independent licensed bulk.
- Weekly Betfair CSV clocks have no timezone; they are not converted to UTC.
- Opening/closing labels without a quote clock are not STRICT.
- News/lineup/injury without a pre-kickoff timestamp stay CONTEXT_ONLY / BLOCKED.
- A second independent 2020+ HOLDOUT does not exist on disk.

## 10. FINAL SCIENTIFIC CONCLUSION

Il mercato è il miglior benchmark osservato e non è stato battuto in modo statisticamente robusto.

That does not mean the engine is useless. It means we do not have sufficient temporally valid evidence to turn it into capital.

No TASK 034 is opened. The predictive laboratory on currently available STRICT data is CLOSED.

WINNER = null · AUTO_PROMOTION = false · REAL_MONEY = false · REPRODUCIBILITY pending dual-run CLI.
