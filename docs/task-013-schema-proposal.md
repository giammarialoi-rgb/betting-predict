# TASK 013 — Schema proposal (NOT APPLIED)

Proposed future tables (do **not** migrate without approval):

## `acquisition_file_runs`
- provider, division, season_code, url, http_status, content_hash,
  content_type, bytes, provider_status, ingested_at

## `truth_reconciliation_audits`
- event_id, subject, decision (AGREEMENT|CONFLICT|INSUFFICIENT),
  selected_source, reasons_json, observations_json

## `challenger_comparison_runs`
- experiment_id, champion, challenger, partition, metrics_json,
  promotion_status (pending|approved|rejected)

## `correlation_exposure_snapshots`
- as_of, cluster_id, selections_json, exposure, real_money=false

All remain domain/in-memory for TASK 013.
