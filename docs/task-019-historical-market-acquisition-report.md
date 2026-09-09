# TASK 019 — Historical Market Data Acquisition & Blind Actuarial Replay V1

## TASK 019 VERDICT

**D_DATASET_INSUFFICIENT_FOR_STRICT**

This task unlocks observations. It does not relax STRICT_AS_OF.

```
RAW EVENTS (rows+index): 252518
NORMALIZED: 13247
TEMPORALLY VALID (STRICT/exact): 0
TEMPORALLY VALID (date OPEN): 277973
MODEL READY: 0
DECISIONS: 10218
MATCHED vs Club-Football: 10212

NEW SOURCES: anishkhetani-epl-archive, jokecamp-e0-2014-15, jokecamp-i1, jokecamp-d1
NEW MARKETS: 1X2, AH, OU25
NEW BOOKMAKERS: 1xbet, bet-and-win, bet365, betfair, betfair-exchange, betfair-sb, betmgm, betvictor, blue-square, coral, gamebookers, interwetten, ladbrokes, pinnacle, sporting-odds, sportingbet, stan-james, stanleybet, vc-bet, william-hill

2001: events=6329 book_events=373 date_quotes=5661 strict=0 decisions=373 bets=0 status=INSUFFICIENT_DATA
2002: events=6173 book_events=391 date_quotes=8172 strict=0 decisions=391 bets=0 status=INSUFFICIENT_DATA
2003: events=3967 book_events=359 date_quotes=10009 strict=0 decisions=359 bets=0 status=INSUFFICIENT_DATA
2004: events=5534 book_events=392 date_quotes=12083 strict=0 decisions=392 bets=0 status=INSUFFICIENT_DATA
2005: events=6340 book_events=374 date_quotes=10786 strict=0 decisions=374 bets=0 status=INSUFFICIENT_DATA
2006: events=6959 book_events=394 date_quotes=10638 strict=0 decisions=394 bets=0 status=INSUFFICIENT_DATA
2007: events=6585 book_events=371 date_quotes=10290 strict=0 decisions=371 bets=0 status=INSUFFICIENT_DATA
2008: events=7148 book_events=379 date_quotes=11370 strict=0 decisions=379 bets=0 status=INSUFFICIENT_DATA
2009: events=7054 book_events=378 date_quotes=11337 strict=0 decisions=378 bets=0 status=INSUFFICIENT_DATA
2010: events=6925 book_events=374 date_quotes=11220 strict=0 decisions=374 bets=0 status=INSUFFICIENT_DATA
2011: events=7410 book_events=377 date_quotes=11310 strict=0 decisions=377 bets=0 status=INSUFFICIENT_DATA
2012: events=10597 book_events=571 date_quotes=17124 strict=0 decisions=571 bets=0 status=INSUFFICIENT_DATA
2013: events=11729 book_events=707 date_quotes=19221 strict=0 decisions=707 bets=0 status=INSUFFICIENT_DATA
2014: events=11993 book_events=380 date_quotes=12777 strict=0 decisions=380 bets=0 status=INSUFFICIENT_DATA
2015: events=12352 book_events=380 date_quotes=11961 strict=0 decisions=380 bets=0 status=INSUFFICIENT_DATA
2016: events=12100 book_events=378 date_quotes=7938 strict=0 decisions=378 bets=0 status=INSUFFICIENT_DATA
2017: events=12364 book_events=401 date_quotes=8421 strict=0 decisions=401 bets=0 status=INSUFFICIENT_DATA
2018: events=12042 book_events=371 date_quotes=7191 strict=0 decisions=371 bets=0 status=INSUFFICIENT_DATA
2019: events=12018 book_events=385 date_quotes=8546 strict=0 decisions=385 bets=0 status=INSUFFICIENT_DATA
2020: events=9562 book_events=342 date_quotes=8846 strict=0 decisions=342 bets=0 status=INSUFFICIENT_DATA
2021: events=13127 book_events=411 date_quotes=10727 strict=0 decisions=411 bets=0 status=INSUFFICIENT_DATA
2022: events=12168 book_events=366 date_quotes=9505 strict=0 decisions=366 bets=0 status=INSUFFICIENT_DATA
2023: events=12501 book_events=418 date_quotes=10827 strict=0 decisions=418 bets=0 status=INSUFFICIENT_DATA
2024: events=11148 book_events=374 date_quotes=10454 strict=0 decisions=374 bets=0 status=INSUFFICIENT_DATA
2025: events=7368 book_events=378 date_quotes=12890 strict=0 decisions=378 bets=0 status=INSUFFICIENT_DATA
2026: events=4571 book_events=194 date_quotes=5645 strict=0 decisions=194 bets=0 status=INCOMPLETE

TOTAL VALID BET OPPORTUNITIES (STRICT): 0
TOTAL NO BET: 10218

BANKROLL RESULTS: not computed — INSUFFICIENT_DATA (0 STRICT quotes). Not 1000→1000.
BEST PERFORMING POLICY: winner = null
```

## Frozen constraints

- STRICT_AS_OF unchanged
- No invented `available_at`
- Kickoff / `Time` column is not availability
- CLOSE is not pre-match
- Max/Avg ≠ bookmaker
- Club-Football Odd* remain RESEARCH_ONLY
- HOLDOUT sacred; `winner = null`; `real_money = false`

## WHAT WE ACTUALLY KNOW

- football-data.co.uk documents OPEN vs CLOSE column semantics and a Friday/Tuesday collection schedule, without per-row clocks
- A legitimate GitHub redistribution of those EPL files can be parsed into bookmaker-level 1X2 / OU2.5 / AH observations
- Max/Avg/Betbrain columns are aggregates and were skipped
- Club-Football remains a secondary event index; its Odd* columns stay TEMPORALLY_UNKNOWN
- STRICT_AS_OF still admits 0 bets because no observation has temporalPrecision=exact
- Closing odds must not be treated as pre-kickoff available_at

## WHAT WE DO NOT KNOW

- The exact clock when any opening quote became available
- Whether a given Friday-afternoon collection finished before a specific Saturday kickoff (not claimed)
- Bookmaker-level odds for most non-EPL seasons after the live site 503
- Corners / cards / player / BTTS / DC as observed bookmaker markets in these files
- Source reliability (unmeasured; left null)

## WHAT DATA BLOCKS US

- Live football-data.co.uk HTTP 503
- Absence of Level A (event×book×market×selection×odds×timestamp) public archives without scrape or paid login
- ClubElo HTTP 502 at probe time (Elo, not odds)
- MODEL_READY gates (exact share, calibration, walk-forward, holdout) correctly fail

## WHAT WE SHOULD ACQUIRE NEXT

- Authorized bookmaker or exchange history with explicit quote timestamps (Level A)
- Live football-data.co.uk CSVs when HTTP 200 returns — do not invent clocks even then
- Licensed Betfair historic ticks if a research license is obtained
- National federation result feeds only as index/settlement, never as odds

## Failure budget

```
{
  "HTTP_ERROR": 1,
  "PARSE_ERROR": 0,
  "SCHEMA_ERROR": 0,
  "DUPLICATE": 0,
  "ENTITY_UNMATCHED": 0,
  "TEMPORAL_UNKNOWN": 320785,
  "TEMPORAL_CONFLICT": 0,
  "POST_MATCH": 0,
  "LICENSE_BLOCKED": 0,
  "INSUFFICIENT_FIELDS": 0,
  "AGGREGATE_SKIPPED": 180420,
  "CLOSE_NOT_PREMATCH": 81927,
  "acquired_files": 6,
  "parsed_rows": 13660,
  "normalized_events": 13660,
  "matched_events": 10212,
  "observations_raw": 359900,
  "observations_book": 359900,
  "observations_strict": 0,
  "observations_date": 277973
}
```

## Researched sources (not a success metric)

| Source | Languages | Result | STRICT |
|--------|-----------|--------|--------|
| football-data-co-uk-live | en | HTTP 503 — BLOCKED; no WAF bypass | no |
| anishkhetani-epl-archive | en | ACQUIRED if cache present — Level B/C date precision, not exact | no |
| jokecamp-footballdata | en | Partial ACQUIRED (E0 2014/15, I1 2012/13, D1 2013/14) — Level B/C | no |
| footballcsv-cache | en | Results-only football.csv — no bookmaker columns | no |
| club-football-match-data | en | LOCAL SECONDARY INDEX — Odd* TEMPORALLY_UNKNOWN | no |
| clubelo | en | HTTP 502 at probe time — Elo not used as odds | no |
| football-data-org | en | Not a historical bookmaker-odds archive | no |
| oddsportal-historical | en,it,es,de,fr | Would require unauthorized scrape / WAF bypass — REJECTED | no |
| betfair-historic | en | Paid / login archive — not acquired; no scrape | no |
| kaggle-european-soccer | en | No documented per-quote available_at — Level D if used | no |
| figc-lega-serie-a | it | No historical bookmaker timestamp feed; site is not an odds archive | no |
| lfp-rfef | es | No historical bookmaker OPEN/CLOSE archive | no |
| dffl-kicker | de | Editorial / WAF — no authorized bulk odds dump used | no |

## Sample evidence (TASK 015)

```
HOME — Probability: n/a — Evidence strength: INSUFFICIENT
Context: Lagged form before asOf: home 7 pts vs away 5 pts (n=5); 18 documented OPEN bookmaker quotes at calendar-date precision (not exact available_at)
```

## Annual table

| Year | Eventi | Quote valide (STRICT) | Quote date | Mercati | Decisioni | No Bet | Start | End | P/L | Max DD | Stato |
|------|-------:|----------------------:|-----------:|--------:|----------:|-------:|------:|----:|----:|-------:|-------|
| 2001 | 6329 | 0 | 5661 | 1 | 373 | 373 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2002 | 6173 | 0 | 8172 | 2 | 391 | 391 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2003 | 3967 | 0 | 10009 | 3 | 359 | 359 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2004 | 5534 | 0 | 12083 | 3 | 392 | 392 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2005 | 6340 | 0 | 10786 | 3 | 374 | 374 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2006 | 6959 | 0 | 10638 | 1 | 394 | 394 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2007 | 6585 | 0 | 10290 | 1 | 371 | 371 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2008 | 7148 | 0 | 11370 | 1 | 379 | 379 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2009 | 7054 | 0 | 11337 | 1 | 378 | 378 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2010 | 6925 | 0 | 11220 | 1 | 374 | 374 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2011 | 7410 | 0 | 11310 | 1 | 377 | 377 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2012 | 10597 | 0 | 17124 | 1 | 571 | 571 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2013 | 11729 | 0 | 19221 | 1 | 707 | 707 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2014 | 11993 | 0 | 12777 | 1 | 380 | 380 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2015 | 12352 | 0 | 11961 | 1 | 380 | 380 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2016 | 12100 | 0 | 7938 | 1 | 378 | 378 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2017 | 12364 | 0 | 8421 | 1 | 401 | 401 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2018 | 12042 | 0 | 7191 | 1 | 371 | 371 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2019 | 12018 | 0 | 8546 | 3 | 385 | 385 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2020 | 9562 | 0 | 8846 | 3 | 342 | 342 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2021 | 13127 | 0 | 10727 | 3 | 411 | 411 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2022 | 12168 | 0 | 9505 | 3 | 366 | 366 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2023 | 12501 | 0 | 10827 | 3 | 418 | 418 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2024 | 11148 | 0 | 10454 | 3 | 374 | 374 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2025 | 7368 | 0 | 12890 | 3 | 378 | 378 | 1000 | — | — | — | INSUFFICIENT_DATA |
| 2026 | 4571 | 0 | 5645 | 3 | 194 | 194 | 1000 | — | — | — | INCOMPLETE |

## Why we did not bet

| Year | Eventi | NO_BET_TEMPORAL | NO_BET_DATA | NO_BET_MODEL | NO_BET_RISK | Decisioni |
|------|-------:|----------------:|------------:|-------------:|------------:|----------:|
| 2001 | 6329 | 373 | 0 | 0 | 0 | 373 |
| 2002 | 6173 | 391 | 0 | 0 | 0 | 391 |
| 2003 | 3967 | 359 | 0 | 0 | 0 | 359 |
| 2004 | 5534 | 392 | 0 | 0 | 0 | 392 |
| 2005 | 6340 | 374 | 0 | 0 | 0 | 374 |
| 2006 | 6959 | 394 | 0 | 0 | 0 | 394 |
| 2007 | 6585 | 371 | 0 | 0 | 0 | 371 |
| 2008 | 7148 | 379 | 0 | 0 | 0 | 379 |
| 2009 | 7054 | 378 | 0 | 0 | 0 | 378 |
| 2010 | 6925 | 374 | 0 | 0 | 0 | 374 |
| 2011 | 7410 | 377 | 0 | 0 | 0 | 377 |
| 2012 | 10597 | 571 | 0 | 0 | 0 | 571 |
| 2013 | 11729 | 707 | 0 | 0 | 0 | 707 |
| 2014 | 11993 | 380 | 0 | 0 | 0 | 380 |
| 2015 | 12352 | 380 | 0 | 0 | 0 | 380 |
| 2016 | 12100 | 378 | 0 | 0 | 0 | 378 |
| 2017 | 12364 | 401 | 0 | 0 | 0 | 401 |
| 2018 | 12042 | 371 | 0 | 0 | 0 | 371 |
| 2019 | 12018 | 385 | 0 | 0 | 0 | 385 |
| 2020 | 9562 | 342 | 0 | 0 | 0 | 342 |
| 2021 | 13127 | 411 | 0 | 0 | 0 | 411 |
| 2022 | 12168 | 366 | 0 | 0 | 0 | 366 |
| 2023 | 12501 | 418 | 0 | 0 | 0 | 418 |
| 2024 | 11148 | 374 | 0 | 0 | 0 | 374 |
| 2025 | 7368 | 378 | 0 | 0 | 0 | 378 |
| 2026 | 4571 | 194 | 0 | 0 | 0 | 194 |

## Markets

| Market | Events | Valid date | Valid STRICT | Books | Years | MODEL_READY |
|--------|-------:|-----------:|-------------:|------:|-------|-------------|
| 1X2 | 10423 | 245616 | 0 | 20 | 2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026 | false |
| DC | 0 | 0 | 0 | 0 | — | false |
| DNB | 0 | 0 | 0 | 0 | — | false |
| AH | 3420 | 16205 | 0 | 5 | 2003,2004,2005,2019,2020,2021,2022,2023,2024,2025,2026 | false |
| EH | 0 | 0 | 0 | 0 | — | false |
| OU05 | 0 | 0 | 0 | 0 | — | false |
| OU15 | 0 | 0 | 0 | 0 | — | false |
| OU25 | 3826 | 16152 | 0 | 4 | 2002,2003,2004,2005,2019,2020,2021,2022,2023,2024,2025,2026 | false |
| OU35 | 0 | 0 | 0 | 0 | — | false |
| OU45 | 0 | 0 | 0 | 0 | — | false |
| TEAM_GOALS | 0 | 0 | 0 | 0 | — | false |
| BTTS | 0 | 0 | 0 | 0 | — | false |
| HT_1X2 | 0 | 0 | 0 | 0 | — | false |
| HT_OU | 0 | 0 | 0 | 0 | — | false |
| CORNERS | 0 | 0 | 0 | 0 | — | false |
| CARDS | 0 | 0 | 0 | 0 | — | false |
| CS | 0 | 0 | 0 | 0 | — | false |
| FIRST_GOAL | 0 | 0 | 0 | 0 | — | false |
| PLAYER_GOALS | 0 | 0 | 0 | 0 | — | false |
| PLAYER_SHOTS | 0 | 0 | 0 | 0 | — | false |
| PLAYER_CARDS | 0 | 0 | 0 | 0 | — | false |
