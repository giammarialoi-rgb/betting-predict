# Club Football Match Data — Column Dictionary

Source commit: `25882a58a736daf7ece3781940eac17ae1117a66` (2026-09-06 audit).

Full numeric profiles: `audit/club-football-match-data-columns.csv`.

## Matches.csv (48 columns)

| Column | Declared meaning | Feature class | Usage mode | Notes |
|--------|------------------|---------------|------------|-------|
| Division | League/division code | RAW | STRICT_AS_OF | 38 codes |
| MatchDate | YYYY-MM-DD | RAW | STRICT_AS_OF | event date only |
| MatchTime | HH:MM:SS; README CET-1 | RAW | RESEARCH_DATASET | 55% null; not availability |
| HomeTeam | Home club name | RAW | STRICT_AS_OF | remapped English names |
| AwayTeam | Away club name | RAW | STRICT_AS_OF | README typo says “Home team's” |
| HomeElo | Most recent home Elo | DERIVED_REQUIRES_RECONSTRUCTION | RESEARCH_DATASET | join to EloRatings; provisional after 2025-06-01 |
| AwayElo | Most recent away Elo | DERIVED_REQUIRES_RECONSTRUCTION | RESEARCH_DATASET | same |
| Form3Home | Points last 3 | DERIVED_REQUIRES_RECONSTRUCTION | RESEARCH_DATASET | 0–9 |
| Form5Home | Points last 5 | DERIVED_REQUIRES_RECONSTRUCTION | RESEARCH_DATASET | 0–15 |
| Form3Away | Points last 3 | DERIVED_REQUIRES_RECONSTRUCTION | RESEARCH_DATASET | |
| Form5Away | Points last 5 | DERIVED_REQUIRES_RECONSTRUCTION | RESEARCH_DATASET | |
| FTHome / FTAway / FTResult | Full-time score/result | POST_MATCH | BENCHMARK_ONLY | labels/outcomes |
| HTHome / HTAway / HTResult | Half-time | POST_MATCH | BENCHMARK_ONLY | ~23% null |
| Home/Away Shots, Target, Fouls, Corners, Yellow, Red | Final stats | POST_MATCH | BENCHMARK_ONLY | ~47–49% null historically |
| OddHome / OddDraw / OddAway | Bet365 1X2 | LEAKAGE_RISK | BENCHMARK_ONLY | open/close unknown |
| MaxHome / MaxDraw / MaxAway | Max across ~17 books | LEAKAGE_RISK | BENCHMARK_ONLY | AGGREGATE ≠ bookmaker |
| Over25 / Under25 | Bet365 OU 2.5 | LEAKAGE_RISK | BENCHMARK_ONLY | |
| MaxOver25 / MaxUnder25 | Max OU 2.5 | LEAKAGE_RISK | BENCHMARK_ONLY | AGGREGATE |
| HandiSize / HandiHome / HandiAway | Bet365 Asian handicap | LEAKAGE_RISK | BENCHMARK_ONLY | |
| C_LTH … C_PHB | Cluster probabilities | LEAKAGE_RISK | BENCHMARK_ONLY | blank on latest 8301 rows |

## EloRatings.csv (4 columns)

| Column | Meaning | Notes |
|--------|---------|-------|
| date | Snapshot date | 1st/15th of month |
| club | Club name aligned to Matches | remaps e.g. Bayern → Bayern Munich |
| country | ISO-like 3-letter | 19 values observed |
| elo | Rating float | official ClubElo ≤2025-06-01; provisional ≥2025-06-15 |
