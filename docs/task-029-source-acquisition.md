# TASK 029 — Source acquisition

Independent clusters only. BeatTheBookie GitHub forks are not counted separately.
DATASET_029_A is a new extract from the same dump as TASK 028, not a second independent market.

| Source | URL | Access | Data | Timestamp | Kickoff | License | Match Rate | Classification |
|--------|-----|--------|------|-----------|---------|---------|------------|----------------|
| TASK 028 STRICT (frozen) | https://www.kaggle.com/datasets/austro/beat-the-bookie-worldwide-football-dataset | ON_DISK | 10499 MATCH_EXACT T-1h 1X2 LEVEL B | PHP hours_before=1 DERIVED | soccer-dataset date_utc UTC | GPL-3.0 upstream + Kaggle redistribution; dump gitignored | 1.0 on frozen file | A_STRICT |
| BeatTheBookie multi-book T-1h overlay | file://audit/external/task-029/books-t1h.csv | EXTRACTED | 217871 book-rows at hours_before=1 | same PHP bin 70 as STRICT | joined by frozen match_id | same lineage as 028 | joined on match_id | A_STRICT |
| ClubElo daily ratings | http://api.clubelo.com/2016-06-01 | TIMEOUT | club,country,level,elo,rank,from,to | DATE_ONLY rating window | not a fixture clock | ClubElo | not MATCH_EXACT to this corpus (no forced join) | B_RESEARCH |
| Open-Meteo ERA5-derived archive | https://archive-api.open-meteo.com/v1/archive | 200 | hourly weather given lat/lon | EXACT if coordinates verified | n/a | CC BY 4.0 | 0 stadium MATCH_EXACT in this task | C_CONTEXT |
| OpenLigaDB | https://api.openligadb.de/getavailableleagues | 200 | German league fixtures index | API match datetime | present for BL | OpenLigaDB | not overlayed on worldwide 028 corpus | B_RESEARCH |
| football-data.co.uk | https://www.football-data.co.uk/mmz4281/1516/E0.csv | 503 | closing / date-labelled odds | DATE_ONLY; closing C* not T-1h | date | site terms | research cluster only | B_RESEARCH |
| Football Charts archive | https://www.football-charts.com/data | PAYWALL | open/close timestamps 2020-21→ 91 leagues | unix+ISO claimed | claimed | €199 one-off — not purchased | 0 (not acquired) | REJECTED |
| eatpizzanot/soccer-dataset | https://huggingface.co/datasets/eatpizzanot/soccer-dataset | ON_DISK fixtures used in 027 | fixtures + odds.known_at | odds.known_at = kickoff (closing) | date_utc UTC SOURCE | CC BY 4.0 | kickoff overlay only | B_RESEARCH |
| Betfair Historic | https://historicdata.betfair.com/ | ACCOUNT | MCM publishTime | SOURCE | marketTime | Betfair | 0 | REJECTED |
| public news / GDELT / lineups | n/a | NOT_JOINED | no MATCH_EXACT injury/lineup clock for 2015-16 worldwide STRICT | unknown availability | n/a | n/a | 0 | C_CONTEXT |
