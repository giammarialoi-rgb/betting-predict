# Blind Historical Replay

Entry: `runBlindReplay` in `src/domain/eval/blind-replay.ts`.

## Question this answers

> Take a historical event, go to 17:30 on match day, and show **exactly** what the system could have known — without revealing what happened after.

## Separation

```text
DecisionContext  →  (future) model
OutcomeContext   →  evaluator only
```

Never pass outcome into the decision/model path.

## Policies

| Policy | Behavior |
|--------|----------|
| STRICT_AS_OF | Drops unknown precision, FORBIDDEN, TEMPORAL_UNKNOWN; runs `assertDecisionContextSafe` |
| RESEARCH | Keeps more rows but still filters `available_at <= asOf` |
| ANY | Same as RESEARCH for now |

## Tables

- `event_outcomes` — facts only
- `elo_snapshots` — ClubElo primary path
- `feature_observations` — persistable feature store

## Not included

Predictions, stakes, ROI, MODEL_READY inflation.
