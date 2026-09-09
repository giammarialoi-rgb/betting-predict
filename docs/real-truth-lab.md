# Real Truth Lab V1

## Purpose

Replace the synthetic-only lab with a **real historical offline pack** (football-data.co.uk schema, 2019–2024 E0 sample) plus ClubElo-style ratings, while keeping blind temporal reconstruction.

## Blind research

```text
event → asOf → DecisionContext → LOCK → OutcomeContext → evaluate
```

DecisionContext never contains FT result, future Elo, future odds, post-match stats, or unknown precision under STRICT_AS_OF.

## Sources

| Source | Role |
| --- | --- |
| football-data.co.uk offline pack | PRIMARY |
| ClubElo ratings (lab snapshots) | PRIMARY |
| Club-Football-Match-Data | SECONDARY / BENCHMARK only |

## Catalog ≠ Observed ≠ MODEL_READY

`MarketDiscoveryEngine` emits `ObservedMarketCoverage` with `model_ready: false` always until temporal + outcome + feature policy approve a market.

## Market-agnostic identity

```text
sport | marketType | period | line | selection | selectionRef
```

## Costs

Offline pack is free. Live CSV ingest remains BLOCKED while the remote returns HTTP 503. No paid APIs in this task.
