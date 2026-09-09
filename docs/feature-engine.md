# Feature engine

Entry: `buildFeatureSnapshot(event, asOf, …)` in `src/domain/features/matrix.ts`.

## What the system KNOWS (when inputs are provided)

- Lagged form (3/5/10, overall/home/away) reconstructed from prior matches with `resultAvailableAt <= asOf` and current match excluded
- Rolling team stats, goals for/against, optional shots when present in history
- Rest days from prior kickoffs in the provided history
- Home venue flag (identity)
- Official ClubElo as-of snapshots (`DATASET_WINDOW`) when provenance = `official_clubelo`
- Market implied / overround / cross-book disagreement from quotes with `available_at <= asOf`

## What the system does NOT know / BLOCKS

- Provisional Elo (Club Football continuation) → `BLOCKED`
- Blind pack `Form*` / `C_*` clusters → `FORBIDDEN` / reconstruct instead
- Closing prices before kickoff/close observation
- Post-match stats of the decision event
- Injuries, lineups, news, weather (interfaces not fed — remain missing)
- Invented confidence

## Missing ≠ 0

`status: MISSING` with `value: null` is required. Never coerce.

## Schema note

No Neon `feature_observations` table yet. Engines are in-memory. See `docs/task-007-discovery.md` for proposed additive schema.
