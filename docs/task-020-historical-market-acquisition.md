# TASK 020 — Historical market acquisition

## Lineage (not four independent sources)

Upstream clusters: football-data-co-uk, xgabora-club-football-match-data

| sourceId | upstream | cluster | independence |
|----------|----------|---------|--------------|
| football-data-co-uk-live | football-data.co.uk | football-data-co-uk | BLOCKED |
| offline-pack-e0 | football-data.co.uk | football-data-co-uk | REDISTRIBUTION |
| anishkhetani-epl-archive | football-data.co.uk | football-data-co-uk | REDISTRIBUTION |
| jokecamp-e0-2014-15 | football-data.co.uk | football-data-co-uk | REDISTRIBUTION |
| jokecamp-i1 | football-data.co.uk | football-data-co-uk | REDISTRIBUTION |
| jokecamp-d1 | football-data.co.uk | football-data-co-uk | REDISTRIBUTION |
| club-football-match-data | xgabora/Club-Football-Match-Data | xgabora-club-football-match-data | SECONDARY_INDEX |

## GitHub audits

| Repo | Original | Timestamps | STRICT |
|------|----------|------------|--------|
| AnishKhetani/premier-league-data | football-data.co.uk | match date only | no |
| jokecamp/FootballData | football-data.co.uk | match date only | no |
| footballcsv/cache.footballdata | football-data.co.uk | match date | no |
| xgabora/Club-Football-Match-Data | compiled match database | UNKNOWN for odds | no |
| kito129/betfairHitoricalRawDataConversion | historicdata.betfair.com | publishTime (pt) — Level A format | no |
| tarb/betfair_data | Betfair historic files you already own | yes, if you have files | no |
| sosthene14/footballdataset | football-data.co.uk | date only | no |

## Sport adapters

- football: OBSERVED
- basketball: EMPTY
- tennis: EMPTY
- baseball: EMPTY
- ice_hockey: EMPTY
- american_football: EMPTY
- rugby: EMPTY
- volleyball: EMPTY
- handball: EMPTY
- cricket: EMPTY
- motor_sports: EMPTY
- combat_sports: EMPTY
- other: EMPTY

## Better than DATE_ONLY

Betfair historic stream publishTime (pt): found_format=true, ingested_for_capital=false.

official archive is paid / ToS-restricted; public GitHub sample not licensed for STRICT capital
