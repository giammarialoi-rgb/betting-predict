# TASK 033 — Blind protocol

AS_OF → FEATURES → MARKET → MODEL → EVIDENCE → RISK GATE → LOCK → REVEAL → SETTLE

- DecisionContext contains only information with available_at ≤ asOf.
- FT/HT/outcome live in OutcomeContext after LOCK.
- CLOSE is never in DecisionContext.
- TEST locked. HOLDOUT locked. No random split.
- 1X2 models were frozen in TASK 032; TASK 033 does not re-select on TEST.
- Markets with n<100: MODEL_READY=false, diagnostic only.

## Leakage battery

| id | throws |
|----|--------|
| future_timestamp | true |
| kickoff_leakage | true |
| FT | true |
| HT | true |
| outcome | true |
| closing_odds | true |
| post_match_odds | true |
| ambiguous_match | true |
| future_bookmaker_quote | true |
| future_lineup | true |
| future_news | true |
| aggregate_leakage | true |
| cross_event_leakage | true |
| date_only_to_strict | true |
| naive_as_utc | true |
| invented_ts | true |
| test_lock | true |
| holdout_lock | true |
| feature_test | true |
| holdout_train | true |
| lock | true |
| auto_promote | true |
| masaniello | true |
| task_034 | true |
| frozen_flags | true |

test_used_for_selection: false
HOLDOUT_TOUCHED: false
