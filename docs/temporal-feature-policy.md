# Temporal feature policy

## Absolute rule

For decision time `T`:

```text
available_at <= T
```

Hard failure otherwise (`AsOfLeakageError` / `FeatureGateError`).

## Forbidden at prematch T

- Final / HT results of the same event
- Post-match statistics of the same event
- Closing odds when `T` is before closing observation
- Elo snapshots with `available_at > T`
- Provisional Elo
- Form windows that include match N
- News / lineup / injury published after T
- Inflating `temporal_precision=unknown` to `exact`

## Precision classes

| Class | Meaning |
|-------|---------|
| STRICT / RECONSTRUCTED_STRICT | Demonstrably lagged from known results |
| DATASET_WINDOW | e.g. ClubElo bi-monthly snapshot ≤ T |
| UNKNOWN | Not proven; research only with labeling |
| FORBIDDEN | Must not enter modeling path |

Kickoff is **event_time**, never quote/feature availability.
