# TASK 014 — Schema proposal (NOT APPLIED)

Candidates only — do **not** migrate without approval:

## `source_availability_rows`
source, sport, competition, market, historical, live, temporal_precision,
access_type, license_class, status, last_success, last_failure, http_status, reason

## `experiment_runs`
experiment_id, dataset_hash, feature_schema, model_version, partitions_json, metrics_json

## `paper_risk_runs`
strategy, risk_budget_json, ending_bankroll, max_drawdown, real_money=false

## `opportunity_rankings`
as_of, mode, tier (QUALIFIED|WATCHLIST|BLOCKED), payload_json

All remain domain/JSON for TASK 014.
