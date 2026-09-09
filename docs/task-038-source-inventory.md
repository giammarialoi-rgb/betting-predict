# TASK 038 — Source inventory

acquired != strict usable.

| sourceId | cluster | class | partition | research | strict | events | rejection |
| anishkhetani | football-data-co-uk | DATE_ONLY | RESEARCH_ONLY | true | false | 12704 | Date + OPEN/CLOSE labels. No publish timestamp. football-data.co.uk cluster. |
| nm2890 | open-close-averages | DATE_ONLY | RESEARCH_ONLY | true | false | 5782 | Naive Date + open/close averages. Not a quote clock. |
| akareen | scraped-odds-date-time | DATE_ONLY | RESEARCH_ONLY | true | false | 7531 | Scraped date + naive kickoff-like time. No publish timestamp. |
| ivanzou | derived-features | DATE_ONLY | RESEARCH_ONLY | true | false | 20 | YYYY-MM-DD only. Form not as-of. |
| petermclagan | betfair-historic | RESEARCH_TEMPORAL | RESEARCH_ONLY | true | false | 1 | Parser-compatibility sample n=1. Not a historical dump. Official Soccer archive login-gated. |
| petermclagan_underscore | betfair-historic | INVALID | QUARANTINE | false | false | 0 | Repository does not exist. |
| tarb | betfair-historic | INVALID | QUARANTINE | false | false | 0 | No soccer archive. Demo is horse racing. |
| hblauth | betfair-historic | INVALID | QUARANTINE | false | false | 0 | DATASET_NOT_PRESENT. Official Betfair Soccer dumps login-gated. |
| betfair_historicdata | betfair-historic | INVALID | QUARANTINE | false | false | 0 | PARSER_NO_DATA. |
| betfair_workbook | betfair-historic | INVALID | QUARANTINE | false | false | 0 | Documentation only. |
| beatthebookie | beatthebookie | INVALID | QUARANTINE | false | false | 0 | DATASET_NOT_PRESENT in git. Frozen TASK_031_BASE is the local derived LEVEL_B file and is not counted as new 038 STRICT. |
| soccer_dataset | soccer-dataset | DATE_ONLY | RESEARCH_ONLY | true | false | 1000 | Closing odds. known_at ≠ bookmaker publish time. |
| oddsharvester | oddsportal-scraper | AMBIGUOUS | QUARANTINE | true | false | 4 | scraped_date is client retrieval. Forbidden as quote clock. |
| iredchuk | average-odds-no-date | DATE_ONLY | RESEARCH_ONLY | true | false | 5320 | Averages. No date, kickoff, or quote clock in schema. |
| sportyhack | models-no-archive | INVALID | QUARANTINE | false | false | 0 | DATASET_NOT_PRESENT. |
| betfairutil | betfair-historic | INVALID | QUARANTINE | false | false | 0 | PARSER_NO_DATA. |
| liampauling | betfair-historic | INVALID | QUARANTINE | false | false | 0 | PARSER_NO_DATA. |
| task-031-base | task-031-base | LEVEL_B_STRICT | REFERENCE | true | false | 10499 | count_legacy_031_as_new_strict = false. Reference only. |
| the-odds-api | live-odds-api | LEVEL_A_STRICT | CAPITAL_STRICT | true | true | 0 |  |
