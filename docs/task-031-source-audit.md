# TASK 031 — Source audit

| SOURCE | URL | DATASET | LICENSE | EVENTS | QUOTES | MARKETS | BOOKMAKERS | KICKOFF | QUOTE_TIMESTAMP | TIMESTAMP_TYPE | TIMEZONE | MATCHING | STRICT_EVENTS | STATUS | SHA256 | LEVEL |
|--------|-----|---------|---------|-------:|-------:|---------|------------|---------|-----------------|----------------|----------|----------|--------------:|--------|--------|-------|
| DATASET_031_BASE / TASK 028 STRICT | https://www.kaggle.com/datasets/austro/beat-the-bookie-worldwide-football-dataset | BeatTheBookie odds_series T-1h + soccer-dataset date_utc | GPL-3.0 upstream; dump gitignored | 10499 | 31497 | 1X2 | 32 (frozen file) | soccer-dataset date_utc SOURCE UTC | PHP hours_before=1 DERIVED | RELATIVE / BIN_DOCUMENTED | kickoff UTC documented; quote derived | MATCH_EXACT date+home+away | 10499 | STRICT_FROZEN | 6d78ca34da9df180… | LEVEL_B |
| JulienDelavande/soccer_stats soccer_odds.csv | https://huggingface.co/datasets/JulienDelavande/soccer_stats | soccer_odds.csv (~18KB sample) | Apache-2.0 | 2 | 81 | h2h | Odds-API-like keys | commence_time naive | bookmaker_last_update naive; datetime_insert post-match | ABSOLUTE_NAIVE | undocumented — not invented as UTC | match_id; outcomes not joined for capital | 0 | RESEARCH | 685834f94c458d00… | UNKNOWN |
| 5dollarfootballapi PL 2025/26 HF sample | https://huggingface.co/datasets/5dollarfootballapi/premier-league-2025-26-football-api-sample | data.csv opening/closing 1X2 | HF sample; full API is paid $5/mo + key | 50 | 150 | 1X2 opening/closing labels | unspecified in sample | kickoff_utc ISO +00:00 | none | OPEN_CLOSE_LABEL | kickoff UTC documented | fixture_id | 0 | RESEARCH | 9246ebdb26cf007e… | UNKNOWN |
| Zenodo 12673394 Hegarty/Whelan | https://zenodo.org/records/12673394 | football-data.co.uk combined CSV | CC BY 4.0 | 131432 | — | 1X2 opening-ish / closing C* | football-data set | Date + Time local undocumented collection TZ | Friday afternoon / Tuesday afternoon window | DATE_ONLY / DATASET_WINDOW | not a quote clock | teams/date | 0 | DATE_ONLY | 23b7f0ab97354099… | DATE_ONLY |
| football-data.co.uk CSVs | https://www.football-data.co.uk/data.php | divisional season CSVs 1993– | site terms | — | — | 1X2 / OU / AH | B365, Pinnacle, WH, … | Date + Time | collection window, not T-1h | DATE_ONLY / DATASET_WINDOW | undocumented for quotes | teams/date | 0 | DATE_ONLY | — | DATE_ONLY |
| Betfair Historic | https://historicdata.betfair.com/ | BASIC/ADVANCED/PRO stream bz2 MATCH_ODDS | Betfair account; BASIC listed free of charge after login | — | — | MATCH_ODDS | Betfair Exchange | marketTime / marketStartTime | pt publishTime ms UTC | ABSOLUTE | UTC (pt millis) | eventId + runners | 0 | ACCOUNT_REQUIRED | — | LEVEL_A |
| OddsPapi /historical-odds | https://api.oddspapi.io/v4/historical-odds | per-fixture snapshot list createdAt | free tier requires apiKey; no signup performed | — | — | 1X2 + others | max 3 per call | fixture clock via other endpoint | createdAt with Z | ABSOLUTE | UTC documented in examples | fixtureId | 0 | API_KEY_REQUIRED | — | LEVEL_A |
| Football Charts archive | https://www.football-charts.com/data | paid odds history | €199 — not purchased | — | — | unknown until purchase | unknown | unknown | claimed history | UNKNOWN | unknown | unknown | 0 | PAID | — | UNKNOWN |
| Club-Football-Match-Data | https://github.com/xgabora/Club-Football-Match-Data | Odd* columns | repo terms | 238000 | — | 1X2 | aggregated | MatchTime CET-1 label (TASK 018) | none | DATE_ONLY | not a quote clock | teams/date | 0 | DATE_ONLY | — | DATE_ONLY |
| Kaggle realsingwong Asian handicap ticks | https://www.kaggle.com/datasets/realsingwong/european-football-asian-handicap-odds-time-series | 90-match SAMPLE YYYYMMDDHHmmss | UNKNOWN — not CAPITAL | 90 | — | AH not 1X2 | Chinese books | absent | compact clock; TZ undocumented | ABSOLUTE_UNDOCUMENTED_TZ | undocumented | ambiguous Chinese names | 0 | RESEARCH | — | UNKNOWN |
| 5DollarFootballAPI odds/history | https://5dollarfootballapi.com/docs/odds | GET /v1/fixtures/{id}/odds/history | paid $5/mo + API key — not purchased, no signup | — | — | 1X2 history claimed | Bet365 + paid extras | kickoff_utc | history endpoint (not acquired) | ABSOLUTE (claimed) | UTC for kickoff | fixture id | 0 | API_KEY_REQUIRED | — | UNKNOWN |

## Probes

- betfair-historic: HTTP 200 acquired=true bytes=1769 sha=0437ebd575d4
- football-charts: HTTP 200 acquired=true bytes=671193 sha=3c3de78af581
- oddspapi-v4-historical: HTTP 401 acquired=false bytes=158 sha=6a809d89be03
- 5dollar-status: HTTP 401 acquired=false bytes=262 sha=45bd5119c174
- football-data-co-uk-E0-1516: HTTP 503 acquired=false bytes=489 sha=05f3d70d0be3
- huggingface-julien-soccer-stats: HTTP 200 acquired=true bytes=1279 sha=8369f32865d9
- huggingface-5dollar-pl-sample: HTTP 200 acquired=true bytes=1759 sha=d066f726d8bd
- zenodo-12673394: HTTP 200 acquired=true bytes=5404 sha=12f357c82321
- C:\Users\giamm\Desktop\app previsioni sportive\betting predict\audit\external\task-031\julien-soccer-odds.csv: HTTP 200 acquired=true bytes=18103 sha=685834f94c45
- C:\Users\giamm\Desktop\app previsioni sportive\betting predict\audit\external\task-031\5dollar-data.csv: HTTP 200 acquired=true bytes=11113 sha=9246ebdb26cf
- C:\Users\giamm\Desktop\app previsioni sportive\betting predict\audit\external\task-031\zenodo-readme.txt: HTTP 200 acquired=true bytes=5168 sha=23b7f0ab9735

## Residual blockers for 2020+ STRICT

1. Betfair Historic BASIC: LEVEL_A format (pt + marketTime) but ACCOUNT_REQUIRED. Credentials not used. BASIC is listed free of charge after login; login was not performed.
2. OddsPapi `/v4/historical-odds`: examples use UTC `createdAt`, but API_KEY_REQUIRED and docs state history from January 2026 only — not 2015–2025.
3. 5DollarFootballAPI `/odds/history`: paid $5/mo + key. Public HF sample has kickoff_utc but opening/closing labels without quote clocks.
4. Football Charts: paid €199. Not purchased.
5. football-data.co.uk / Zenodo 12673394 / Club-Football: DATE_ONLY or collection-window. Not T-1h.
6. JulienDelavande soccer_odds.csv: ~80 quote rows, timezone-naive commence_time / last_update; datetime_insert is post-match.
