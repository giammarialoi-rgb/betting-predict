# Market data requirements

| Market | Required data | Optional data | Temporal requirement | Readiness today |
|--------|---------------|---------------|----------------------|-----------------|
| result (1X2) | teams, FT result history, odds AS-OF | Elo, injuries, news | STRICT for form/odds; Elo DATASET_WINDOW | CATALOG + partial odds OBSERVED |
| total_goals | goals history, line, O/U odds | shots, xG | STRICT | CATALOG |
| team_total_goals | team goals history, line | shots | STRICT | CATALOG |
| both_teams_to_score | FT goals both sides | shot quality | STRICT | CATALOG |
| asian_handicap | FT score, handicap line | Elo | STRICT | CATALOG |
| european_handicap | FT score, EH line | — | STRICT | CATALOG |
| double_chance / DNB | FT result | — | STRICT | CATALOG |
| correct_score / goal_range | FT score | — | STRICT | CATALOG |
| HT / HTFT | HT + FT scores | — | STRICT | CATALOG |
| corner_total / team / handicap | corner history | shots, possession | STRICT | CATALOG |
| card_total / team / handicap | cards history | referee, fouls | STRICT | CATALOG |
| shots / SOT / fouls / offsides | matching stats history | — | STRICT | CATALOG |
| player_* | player event stats | lineup, injury, minutes | STRICT | CATALOG |
| basketball_total_points | points history | — | STRICT | CATALOG stub |
| tennis_total_games | games history | — | STRICT | CATALOG stub |

## Legend

- **CATALOG_CAPABILITY** — defined in taxonomy
- **DISCOVERED / OBSERVED** — seen in provider quotes
- **MODEL_READY** — none yet (outcome + features + temporal policy approved together)

Club Football `C_*` and provisional Elo remain **FORBIDDEN / BLOCKED** for STRICT_AS_OF.
