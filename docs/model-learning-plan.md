# Model learning plan (foundation only)

Future loop:

```text
prediction → outcome → error → feature attribution → calibration update
```

## Avoid

| Risk | Mitigation |
|------|------------|
| Overfitting | Walk-forward folds; hold out recent seasons |
| Data leakage | `available_at <= asOf` hard tests |
| Feedback loops | Do not train on own previous published tips |
| Selection bias | Log all evaluated markets, not only “wins” |
| Survivorship | Include relegated/dissolved clubs via stable ids |
| Data snooping | Multiple-testing correction + mandatory OOS confirmation |

## Not in this task

No autonomous ML, no LLM probabilities, no staking.
