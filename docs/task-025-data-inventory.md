# TASK 025 — data inventory

| Source | Class | Events this run | Odds | STRICT | Notes |
|---|---|---:|---:|---:|---|
| Betfair BASIC GitHub MIRROR | A_STRICT | 1 | 3 | 1 | quote < kickoff proven |
| Club-Football Matches.csv | C_RESEARCH_ONLY | 238858 | 235806 | 0 | DATE_ONLY Odd* |
| Kaggle zygmunt/betfair-sports | B_RESEARCH_TEMPORAL | 32873 | 1306748 | 0 | bulk=true; one week not multi-year |
| eatpizzanot/soccer-dataset | C_RESEARCH_ONLY | listed in overlapping | closing | 0 | known_at = kickoff |
| BeatTheBookie closing | C_RESEARCH_ONLY | listed | DATE_ONLY | 0 | |
| football-data.co.uk | C_RESEARCH_ONLY | optional | DATE_ONLY | 0 | 503=BLOCKED continue |
| UCD WP2025/22 Advanced | A potential | 0 | 0 | 0 | not public |

## Matching V2

M001 vs Club: **MATCH_EXACT** (only MATCH_EXACT may join STRICT capital; Club odds remain C)

## Countries (observed vs not observed)

| Country | Status | Events |
|---|---|---:|
| England | observed | 58958 |
| Italy | observed | 19733 |
| Germany | observed | 15331 |
| Spain | observed | 20411 |
| France | observed | 18100 |
| Netherlands | observed | 7627 |
| Portugal | observed | 6965 |
| Belgium | observed | 6906 |
| Scotland | observed | 18182 |

## Coverage matrix (E0 / Premier League, observed)

| Period | Competition | Events | Odds | Exact timestamp | Date-only | STRICT | STRICT_RATIO | RESEARCH_RATIO |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 2000 | E0 | 205 | 205 | 0 | 205 | 0 | 0.0000 | 1.0000 |
| 2001 | E0 | 373 | 291 | 0 | 291 | 0 | 0.0000 | 0.7802 |
| 2002 | E0 | 391 | 390 | 0 | 390 | 0 | 0.0000 | 0.9974 |
| 2003 | E0 | 359 | 359 | 0 | 359 | 0 | 0.0000 | 1.0000 |
| 2004 | E0 | 347 | 347 | 0 | 347 | 0 | 0.0000 | 1.0000 |
| 2005 | E0 | 329 | 329 | 0 | 329 | 0 | 0.0000 | 1.0000 |
| 2006 | E0 | 394 | 394 | 0 | 394 | 0 | 0.0000 | 1.0000 |
| 2007 | E0 | 371 | 371 | 0 | 371 | 0 | 0.0000 | 1.0000 |
| 2008 | E0 | 379 | 379 | 0 | 379 | 0 | 0.0000 | 1.0000 |
| 2009 | E0 | 378 | 378 | 0 | 378 | 0 | 0.0000 | 1.0000 |
| 2010 | E0 | 374 | 374 | 0 | 374 | 0 | 0.0000 | 1.0000 |
| 2011 | E0 | 377 | 377 | 0 | 377 | 0 | 0.0000 | 1.0000 |
| 2012 | E0 | 391 | 391 | 0 | 391 | 0 | 0.0000 | 1.0000 |
| 2013 | E0 | 372 | 372 | 0 | 372 | 0 | 0.0000 | 1.0000 |
| 2014 | E0 | 380 | 380 | 0 | 380 | 0 | 0.0000 | 1.0000 |
| 2015 | E0 | 380 | 380 | 0 | 380 | 0 | 0.0000 | 1.0000 |
| 2016 | E0 | 378 | 378 | 0 | 378 | 0 | 0.0000 | 1.0000 |
| 2017 | E0 | 401 | 401 | 1 | 401 | 1 | 0.0025 | 1.0000 |
| 2018 | E0 | 371 | 371 | 0 | 371 | 0 | 0.0000 | 1.0000 |
| 2019 | E0 | 379 | 379 | 0 | 379 | 0 | 0.0000 | 1.0000 |
| 2020 | E0 | 336 | 336 | 0 | 336 | 0 | 0.0000 | 1.0000 |
| 2021 | E0 | 408 | 408 | 0 | 408 | 0 | 0.0000 | 1.0000 |
| 2022 | E0 | 361 | 361 | 0 | 361 | 0 | 0.0000 | 1.0000 |
| 2023 | E0 | 412 | 412 | 0 | 412 | 0 | 0.0000 | 1.0000 |
| 2024 | E0 | 372 | 372 | 0 | 372 | 0 | 0.0000 | 1.0000 |
| 2025 | E0 | 378 | 378 | 0 | 378 | 0 | 0.0000 | 1.0000 |
| 2026 | E0 | 214 | 214 | 0 | 214 | 0 | 0.0000 | 1.0000 |

_Full year×division matrix: `artifacts/task-025-coverage.csv` (observed cells only, not catalogued)._
