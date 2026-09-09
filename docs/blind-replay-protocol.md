# Blind Replay Protocol

## Workflow

```text
event
  → asOf
  → DecisionContext (features + market only)
  → model probabilities
  → LOCK
  → outcome reveal
  → evaluation
```

## Rules

1. `runBlindDecideAndLock` builds a sample with `includeOutcome: false`.
2. Probabilities are computed from `DecisionContext` only.
3. The lock record stores `outcomeRevealed: false` and `outcomeContext: null`.
4. `revealOutcomeAfterLock` attaches the real outcome and sets `revealAfterDecision: true`.

## Safety

- `assertDecisionContextSafe` hard-fails on future `available_at`, forbidden features, and `temporal_precision=unknown` under `STRICT_AS_OF`.
- Leakage attacks must **fail explicitly**, never silently drop future data when hard-failure is required.
- Replay is deterministic for identical `(eventId, asOf, featurePolicy, market)`.

## What is revealed when

| Phase | Decision features | Market | Outcome |
| --- | --- | --- | --- |
| Decide / lock | yes (asOf-legal) | yes (asOf-legal) | no |
| Reveal | frozen | frozen | yes |
| Evaluate | frozen | frozen | yes |
