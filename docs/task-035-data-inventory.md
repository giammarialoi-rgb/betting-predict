# TASK 035 — Data inventory (candidates)

| id | access | new | clock | kickoff | match | depth | coverage | holdout | total | class | why not STRICT |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| task_031_base | LOCAL | false | 3 | 3 | 2 | 1 | 3 | 0 | 12 | STRICT_B | Already STRICT_B, but window is only 2015-09-01→2016-11-19. HOLDOUT 2020+ empty. Not a 035 calendar breakthrough. |
| books_t1h | LOCAL | false | 3 | 3 | 2 | 1 | 3 | 0 | 12 | STRICT_B | Overlay on 031. No new years. |
| movement_t24 | LOCAL | false | 3 | 3 | 2 | 2 | 3 | 0 | 13 | STRICT_B | Overlay on 031. No T−6h/T−3h. No 2020+. |
| beatthebookie_series | LOCAL | false | 3 | 3 | 2 | 2 | 3 | 0 | 13 | STRICT_B | Same independent cluster as 031. Not a new source. |
| closing_odds_date_only | LOCAL | false | 1 | 1 | 1 | 1 | 3 | 2 | 9 | DATE_ONLY | Calendar date ≠ quote timestamp. OPEN/CLOSE ≠ clock. |
| club_football | LOCAL | false | 1 | 1 | 1 | 0 | 3 | 2 | 8 | DATE_ONLY | DATE_ONLY / TEMPORALLY_UNKNOWN. Form* forbidden. |
| zenodo_12673394 | LOCAL | false | 1 | 1 | 1 | 1 | 3 | 2 | 9 | DATE_ONLY | Closing averages. Not a quote clock. |
| soccer_dataset_odds_parquet | LOCAL | false | 2 | 3 | 2 | 0 | 3 | 3 | 13 | DATE_ONLY | known_at = kickoff. Closing, not pre-match publish time. |
| petermclagan_basic | MIRROR | false | 5 | 3 | 0 | 3 | 0 | 0 | 11 | RESEARCH_TEMPORAL | n=1 sample. Mirror of Betfair Historic, not an independent archive. |
| kaggle_zygmunt_betfair | LOCAL | false | 2 | 2 | 1 | 1 | 3 | 0 | 9 | RESEARCH_TEMPORAL | Naive timestamps. Not promoted. Same Betfair cluster. |
| kaggle_ah_sample | SAMPLE_ONLY | false | 2 | 0 | 0 | 2 | 0 | 1 | 5 | RESEARCH_TEMPORAL | No kickoff. TZ undocumented. Sample ~90 files. Cannot prove quote < kickoff. |
| anishkhetani_epl | MIRROR | false | 1 | 2 | 1 | 1 | 2 | 2 | 9 | DATE_ONLY | Mirror of football-data.co.uk. Time is kickoff, odds lack publish timestamp. |
| hf_soccer_odds | PUBLIC_DOWNLOAD | true | 2 | 2 | 0 | 0 | 0 | 1 | 5 | AMBIGUOUS | n=1. Naive TZ. No FT in odds file. Cannot assume UTC. |
| hf_soccer_stats_sql | PUBLIC_DOWNLOAD | true | 2 | 2 | 0 | 0 | 0 | 1 | 5 | AMBIGUOUS | Same naive soccer_odds table. FBref results are DATE_ONLY outcomes, not a quote clock. |
| hf_olivier_closing | SAMPLE_ONLY | true | 1 | 0 | 1 | 1 | 0 | 0 | 3 | DATE_ONLY | Closing + calendar date. Paid master not acquired. No user credentials. |
| hf_5dollar_inplay | PUBLIC_DOWNLOAD | true | 2 | 2 | 1 | 1 | 1 | 1 | 8 | POSTMATCH | Quotes are after kickoff. Beijing-named kickoff. Not pre-match. |
| sharpapi_wc2026 | PUBLIC_DOWNLOAD | true | 5 | 2 | 0 | 0 | 0 | 3 | 10 | RESEARCH_TEMPORAL | One snapshot. No settled outcomes. Midnight kickoffs ambiguous. Futures start ≠ football kickoff. |
| betfair_historic_login | BLOCKED_LOGIN | false | 5 | 3 | 0 | 3 | 0 | 0 | 11 | UNKNOWN | BLOCKED_LOGIN. Public samples are n=1 (petermclagan). Internet Archive soccer BASIC not found. |
| football_data_co_uk | PUBLIC_DOWNLOAD | false | 1 | 2 | 1 | 1 | 3 | 3 | 11 | DATE_ONLY | IA copy acquired after live 503. Time is kickoff, not quote publish time. Odds are Friday/Tuesday collection + closing columns. TZ not in file. DATE_ONLY. |
| odds_api_historical | BLOCKED_API_KEY | false | 4 | 3 | 0 | 2 | 0 | 0 | 9 | UNKNOWN | BLOCKED_API_KEY. No public historical dump of the same format found. |
| kaggle_obiguy | BLOCKED_LOGIN | true | 2 | 2 | 1 | 2 | 2 | 3 | 12 | AMBIGUOUS | File not on disk. Login. Naive clock even if acquired. TZ not documented on the card. |
| kaggle_wc_timestamp | BLOCKED_LOGIN | true | 2 | 1 | 1 | 3 | 1 | 2 | 10 | AMBIGUOUS | Gated sample. Kickoff is a date. Snapshot naive. No HF/GitHub/DOI copy. |
| oddspapi | BLOCKED_API_KEY | false | 4 | 0 | 0 | 3 | 0 | 1 | 8 | UNKNOWN | API key. No redistributable archive found. |
| pinnapi_live | BLOCKED_API_KEY | false | 0 | 0 | 0 | 0 | 0 | 0 | 0 | UNKNOWN | Live API, not a settled multi-year dump. |
| opticodds | BLOCKED_PAYWALL | false | 4 | 3 | 0 | 3 | 0 | 1 | 11 | UNKNOWN | Paid. No public equivalent dump. |
| figshare_news | PUBLIC_DOWNLOAD | true | 0 | 0 | 0 | 0 | 0 | 0 | 0 | UNKNOWN | Not betting quotes. |
| ia_betfair_soccer | NOT_FOUND | true | 0 | 0 | 0 | 0 | 0 | 0 | 0 | UNKNOWN | No public IA copy of official Betfair soccer streams. |
| eddieglush_movement | SAMPLE_ONLY | true | 2 | 0 | 0 | 2 | 0 | 1 | 5 | UNKNOWN | Not event-level STRICT units. |
| github_betfair_parsers | PUBLIC_DOWNLOAD | false | 5 | 3 | 0 | 3 | 0 | 0 | 11 | UNKNOWN | Parser without data. Official files remain login-gated. |
| theoddsgap_live | PUBLIC_DOWNLOAD | true | 2 | 2 | 0 | 0 | 0 | 1 | 5 | UNKNOWN | Live snapshot. No historical outcomes. |
| clubelo | BLOCKED_PAYWALL | false | 1 | 1 | 0 | 0 | 3 | 3 | 8 | DATE_ONLY | Not quote+timestamp odds. |
| five_dollar_api | BLOCKED_PAYWALL | false | 0 | 0 | 0 | 0 | 0 | 0 | 0 | UNKNOWN | No user credentials. Public sample is POSTMATCH. |
| football_charts | BLOCKED_PAYWALL | false | 0 | 0 | 0 | 0 | 0 | 0 | 0 | UNKNOWN | Paid. No public dump. |
| pinnacle_public_api | UNREACHABLE | false | 0 | 0 | 0 | 0 | 0 | 0 | 0 | UNKNOWN | API closed. obiguy dump is the would-be archive and is Kaggle-gated. |

BEST CANDIDATE: `sharpapi_wc2026`

SharpAPI World Cup 2026 snapshot (CC BY 4.0). One snapshot. No settled outcomes. Midnight kickoffs ambiguous. Futures start ≠ football kickoff.
