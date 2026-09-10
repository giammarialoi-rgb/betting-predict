# Phase 3E — Feature → Source map (actual PI names)

## Model gate (unchanged thresholds)

- Fail if `missing_keys > 45` OR `feature_coverage < 0.35` (~25+ of ~69 keys)
- Soft uncertain if missing > 25 OR coverage < 0.55
- Soccer dataset must have ≥500 PI matches
- Code: `src/domain/eval/predictive-intelligence/predict-live.ts`

## Why 5 scalars failed

`strength_diff_pts`, `home_rest_days`, `home_advantage`, `h2h_n`, `season_phase` ≈ 7% coverage.
Root cause: live events used `league=soccer_epl` + unresolved team ids (`live:nottingham forest`) so Football-Data priors never attached.

## Fix

- Map `soccer_epl→E0` (and peers) via `live-resolve.ts`
- Resolve Odds names → `aston-villa` / `nottingham-forest`
- Use latest PI season for division; form/venue fall back to league priors
- Import season `2425`; ClubElo public API attempted (HTTP 502 on 2026-09-10 — recorded honestly)

## Required families → sources

| Feature family | Keys (examples) | Source | Adapter | Status |
|---|---|---|---|---|
| Form L3/L5/L10 | home_gf_l5, away_pts_l10, … | football-data-co-uk | PI matches.jsonl CACHE | ACTIVE after resolve |
| Venue strength | home_attack_home, away_defense_away | football-data-co-uk | same | ACTIVE |
| Context | home_advantage, rest_days, season_phase, league_avg_gf | derived from priors | engine | ACTIVE |
| H2H | h2h_n, h2h_home_win_rate | football-data-co-uk | same | ACTIVE when history |
| Elo | home_elo, away_elo, elo_diff | ClubElo | api.clubelo.com → data/clubelo | FETCH 502 (optional) |
| Injuries/lineups | home_injuries_n, … | API-Sports | cache-only | Often CACHE_MISS / no fixture_id |
| xG | home_xg_prematch | Understat | TEST_PROBE only | CONTEXT; not MODEL merge |
| Market odds | — | The Odds API | Lab B quotes | COMPARE ONLY — never MODEL |

## Odds firewall

`assertNoMarketInputsInPredictionContext` on feature keys; analyze never copies market → probability_model.