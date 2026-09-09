# TASK 035 — Source audit

Investigated: 34. Usable (local/public/sample/mirror files): 22. New in 035: 11.

## Probes

| id | HTTP | acquired | class | note |
|---|---:|---|---|---|
| betfair-historic | 200 | false | LOGIN_HTML | Official Betfair Historic. Login wall. No credentials used. |
| football-data-e0-live | 503 | false | HTTP_503 | Live football-data.co.uk. Even on 200 this is OPEN/CLOSE + kickoff Time, not a quote clock. |
| football-data-e0-ia | 200 | true | DATE_ONLY_IA_COPY | Internet Archive copy of E0 2019/20 saved to audit/external/task-035/ia-e0-1920.csv. Kickoff Time present; odds lack publish timestamp. |
| odds-api-no-key | 401 | false | BLOCKED_API_KEY | Historical endpoint is paid. No user key. No public dump of /v4/historical found. |
| kaggle-obiguy | 302 | false | BLOCKED_LOGIN | Best remaining clocked-looking Pinnacle archive. No GitHub/HF/DOI/IA mirror. |
| kaggle-wc-ts | 302 | false | BLOCKED_LOGIN | Naive Snapshot_TS + date-only kickoff. No public copy. |
| hf-olivier-card | 200 | true | DATE_ONLY_CLOSING_SAMPLE | Public 1% closing sample already on disk. Master is paid. |
| hf-soccer-stats | 200 | true | PUBLIC_CARD | soccer_odds.csv is 18KB / one match. SQL dump is the same naive table. |
| sharpapi-github | 200 | true | PUBLIC_SNAPSHOT | CC BY 4.0 snapshot listing: [{"name":"LICENSE","path":"LICENSE","sha":"da6ab6cc8f333d7e89a99812866df8f24374d47c","size":18657,"url":"https://api.github.com/repos/Sharp-API/sports-odds-samp |
| ia-betfair-search | 200 | false | NOT_FOUND | Internet Archive numFound=0. No soccer BASIC price dump downloaded. |
| zenodo-12673394 | 200 | true | DATE_ONLY_MIRROR | Already on disk as TASK 026. football-data.co.uk lineage. |
| figshare-news | 200 | true | NEWS_NOT_ODDS | Sports news metadata. No quote clock. |
| github-betfairutil | 200 | true | PARSER_NO_DATA | Parser for official Betfair bz2. Not an archive. |
| petermclagan-samples | 200 | true | MIRROR_SAMPLE | Already on disk TASK 023. n=1 football BASIC. |

## Axes A–T

Betfair historic/stream/snapshots, Match Odds, tick data, bookmaker timestamp CSVs, historical APIs, Kaggle, HuggingFace, Zenodo, Figshare, university/Zenodo mirrors, GitHub raw, exchange research, odds movement, 1X2 and OU timestamp sets were each assigned at least one catalog row. Login/API-key sources were not attacked; public copies and official samples were sought immediately.

Mirrors of football-data.co.uk and Betfair Historic do not count as independent sources.
