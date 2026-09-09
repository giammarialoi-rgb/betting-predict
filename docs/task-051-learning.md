# TASK 051 — Learning (no auto-promotion)

## Pipeline

```
ERROR → AUTOPSY → LEARNING CASE → PATTERN → HYPOTHESIS
  → BACKTEST → TEMPORAL VALIDATION → TEST → STAT VALIDATION
  → MODEL CANDIDATE → PROMOTION REVIEW → MODEL_vN+1
```

Active model remains `MODEL_v2_DECISION_ENGINE` until explicit promotion review.

## Artifacts (Lab B)

Reuse 048/044 ledgers: autopsies, learning-candidates, error-patterns, counterfactuals (when produced). Paper bets: `paper-bets.jsonl` (virtual stake only).

## Forbidden

- Auto-promotion after one error
- Contaminating historical predictions with counterfactuals
- Declaring EDGE without settled sample + temporal gates
- Opening capital / real money

## Capital

`CAPITAL: CLOSED` · `REAL_MONEY: false` · `AUTO_PROMOTION: false`
