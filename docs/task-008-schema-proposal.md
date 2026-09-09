# TASK 008 — Schema proposal (additive)

Applied as migration `0004_historical_truth_layer`.

## Tables

### `event_outcomes`
Append-only observed FT results. No features. Unique `identity_key`.

### `elo_snapshots`
Append-only ClubElo (and future sources) ratings with `snapshot_at` ≠ `available_at`. Unique `(source_id, identity_key)`.

### `feature_observations`
Append-only typed feature store (numeric/text/json). Unique `(event_id, feature_key, identity_key)` via `identity_key` uniqueness per event+key pattern: unique `(source_id nullable handled via identity_key)`.

## Not included
- predictions / bets / stakes
- outcome versioning/corrections workflow
- destructive changes to existing tables
