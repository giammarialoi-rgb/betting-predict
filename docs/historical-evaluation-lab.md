# Historical Evaluation Lab

## Purpose

The Historical Evaluation Lab is the first rigorous experimental layer of the Sports Prediction Engine.

It answers:

> Using only information that would have been available at decision time `asOf`, does a model produce probabilities that are more informative and better calibrated than the market-implied baseline?

It does **not** answer how much money was won or lost. There is no staking, bankroll, Kelly, or betting execution in this lab.

## What the system knew

At `asOf`, `DecisionContext` may contain only:

- features with `available_at <= asOf`
- market snapshots with `available_at <= asOf`
- temporal precision compatible with the active policy (`STRICT_AS_OF` rejects `unknown`)

## What it didn't know

- the eventual FT result of the target event
- any feature, Elo, quote, lineup, injury, news, or stat published after `asOf`
- provisional ClubElo rows under `STRICT_AS_OF`

## When it knew it

Timestamps are distinct:

```text
event_time ≠ observed_at ≠ available_at ≠ ingested_at
```

Form and historical features use `resultAvailableAt`, not kickoff alone.

## Feature generation

Approved keys only:

- `form_3`, `form_5`, `form_10`
- `historical_goals`, `historical_shots`
- `rest_days`, `home_advantage`, `elo`
- `market_implied_probability`, `market_overround`, `market_disagreement`

Each feature carries `feature_key`, `value`, `source`, `available_at`, `temporal_precision`, `status`, and lineage metadata.

## Sample object

`HistoricalEvaluationSample` separates:

- `decisionContext`
- `marketContext`
- `featureContext`
- `outcomeContext` (evaluation phase only)
- `dataQuality`

## Baselines

Four simple baselines (not optimized):

1. Market implied (normalized)
2. Historical frequency (training window only)
3. Elo expectation
4. Simple fixed-weight feature blend

Outputs are always `P(selection)` maps (e.g. `P(Home)`, `P(Draw)`, `P(Away)`).

## Pipeline readiness

```text
Blind Replay → Prediction → Calibration → Market Edge (diagnostic)
→ Out-of-Sample → Actuarial Risk Engine → Bankroll Simulation
```

This task implements through calibration / diagnostic probability_gap. Risk/bankroll remain stubs (`risk_decision = null`, `stake = null`).
