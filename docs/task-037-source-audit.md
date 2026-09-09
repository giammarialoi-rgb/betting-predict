# TASK 037 — Source audit

| repository | cluster | role | class | exists | events | why |
| AnishKhetani/premier-league-data | football-data-co-uk | MIRROR | DATE_ONLY | true | 12704 | football-data.co.uk mirror. Date + open/close labels ≠ quote clock. |
| nm2890/football-data | open-close-averages | RAW | DATE_ONLY | true | 5782 | README: average opening/closing odds. Naive datetime. Not STRICT. |
| akareen/Football-Data-Analysis | scraped-odds-date-time | RAW | DATE_ONLY | true | 7531 | Scraped odds CSVs. Windows checkout blocked on colon paths. Header inspected via git show. DATE_ONLY/NAIVE. |
| ivanzou29/football_fair | derived-features | DERIVATIVE | DATE_ONLY | true | 20 | Small derived feature table. DATE_ONLY. Form columns not as-of. |
| petermclagan/betfair-historical | betfair-historic | MIRROR | RESEARCH_TEMPORAL | true | 1 | Parser + football-basic-sample.bz2 only. Not a historical dump. Parser-compatibility sample. |
| petermclagan/betfair_historical | betfair-historic | REPOSITORY | NOT_FOUND | false | 0 | Repository does not exist on GitHub (404). |
| tarb/betfair_data | betfair-historic | PARSER | PARSER_NO_DATA | true | 0 | Rust parser. Releases have no soccer archive assets. Demo output is Warrnambool horse racing. |
| hblauth/betfair_historic_data | betfair-historic | PARSER | DATASET_NOT_PRESENT | true | 0 | Catalog of Betfair Historic files. Actual dumps require official login. No .bz2 soccer archive in tree. |
| betfair/historicdata | betfair-historic | PARSER | PARSER_NO_DATA | true | 0 | Official TS client. No redistributable soccer files. |
| betfair/historic-data-workbook | betfair-historic | PARSER | PARSER_NO_DATA | true | 0 | xlsx/docx documentation only. |
| Lisandro79/BeatTheBookie | beatthebookie | REPOSITORY | DATASET_NOT_PRESENT | true | 0 | Code + README. odds_series CSV.gz not present. Local TASK_031_BASE remains the frozen derived STRICT_B file (not counted as new 037 STRICT). |
| v-eatpizzanot/soccer-dataset | soccer-dataset | RAW | DATE_ONLY | true | 1000 | GitHub holds samples. Full parquet is on HuggingFace. Closing odds. Already audited TASK 024/035. |
| jordantete/OddsHarvester | oddsportal-scraper | PARSER | RESEARCH_TEMPORAL | true | 4 | Scraper + test fixtures (n handful). Historic scrape ≠ historical publish timestamp. RESEARCH_ONLY. |
| iredchuk/soccer-bookmaker-odds | average-odds-no-date | RAW | DATE_ONLY | true | 5320 | 2005–2019 averages. Schema has no date, no kickoff, no quote clock. |
| odafeigho/SportyOddsHack | models-no-archive | REPOSITORY | DATASET_NOT_PRESENT | true | 0 | Model sketch. No odds archive. |
| mberk/betfairutil | betfair-historic | PARSER | PARSER_NO_DATA | true | 0 | Parser without soccer dump. |
| liampauling/betfair | betfair-historic | PARSER | PARSER_NO_DATA | true | 0 | Parser without soccer dump. |

Mirrors of football-data.co.uk / open-close averages are one scientific cluster, not independent clocks.
Betfair cluster = official client + parsers + n=1 BASIC sample. Official Soccer dump = BLOCKED_LOGIN.
