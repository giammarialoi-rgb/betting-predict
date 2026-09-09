# TASK 026 — data acquisition

Each source: DISCOVER → ACCESS → DOWNLOAD/QUERY → PARSE → INSPECT ROWS → TIMESTAMP → MATCH → CLASSIFY → HASH/REPORT.

| Channel | HTTP | Acquired | License | Note |
|---|---:|---|---|---|
| betfair-mcm-fixture | 200 | true | Betfair terms / GitHub MIRROR | Committed MATCH_ODDS ndjson (1 EPL event). MIRROR — format/temporal validation only bytes=14050 |
| kaggle-ah-zip | 200 | true | Kaggle License Unknown | Kaggle AH public zip (sample, not claimed 7494) bytes=821224 |
| zenodo-raw-zip | 200 | true | CC-BY-4.0 | Zenodo UCD Raw to Tidy Data.zip bytes=12554590 |
| club-football-matches | 200 | true | upstream clone | Club-Football Matches.csv RESEARCH_DATE_ONLY bytes=45608878 |
| 5dollar-status | 401 | false | ToS; key required | HTTP 401 zip=false bytes=262 {"success":0,"error":{"type":"authentication_error","code":"missing_api_key","message":"No API key provided. Send it as  |
| 5dollar-leagues | 401 | false | ToS; key required | HTTP 401 zip=false bytes=262 {"success":0,"error":{"type":"authentication_error","code":"missing_api_key","message":"No API key provided. Send it as  |
| oddspapi-v4-historical | 401 | false | B2B; apiKey required | HTTP 401 zip=false bytes=158 {"error":{"message":"Missing API key","code":"MISSING_API_KEY","details":"Please provide a valid API key in the request  |
| oddspapi-v4-sports | 401 | false | B2B; apiKey required | HTTP 401 zip=false bytes=158 {"error":{"message":"Missing API key","code":"MISSING_API_KEY","details":"Please provide a valid API key in the request  |
| oddspapi-v5-bookmakers | 401 | false | B2B; apiKey required | HTTP 401 zip=false bytes=65 {"error":401,"message":"missing apiKey","code":"missing_api_key"} |
| kaggle-ah-view | 200 | true | Unknown | HTTP 200 zip=false bytes=5026 {"subtitleNullable":"","creatorNameNullable":"real_SingWong","totalBytesNullable":7650493,"licenseNameNullable":"Unknown |
| zenodo-12673394 | 200 | true | CC-BY-4.0 | HTTP 200 zip=false bytes=5404 {"created": "2024-07-06T15:15:22.006433+00:00", "modified": "2024-07-06T15:15:22.550619+00:00", "id": 12673394, "concept |
| openligadb-leagues | 200 | true | OpenLigaDB | HTTP 200 zip=false bytes=122390 [{"leagueId":3,"leagueName":"1. FuÃball-Bundesliga 2007/2008","leagueShortcut":"bl1","leagueSeason":"2007","sport":{"sp |
| clubelo-chelsea | — | false | ClubElo | The operation was aborted due to timeout |
| github-petermclagan-tree | 206 | true | repo | HTTP 206 zip=false bytes=5067 {"sha":"50c16a2c4aa838e16e6115c51de61d7aa31be287","url":"https://api.github.com/repos/petermclagan/betfair-historical/gi |
| github-kito-tree | 206 | true | repo | HTTP 206 zip=false bytes=8192 {"sha":"dd9818409dfc24832a0032eb9f221415960a941a","url":"https://api.github.com/repos/kito129/betfairHitoricalRawDataCon |
| nautilus-betfair-dir | 404 | false | LGPL-3.0; data gitignored | HTTP 404 zip=false bytes=127 {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/contents#get-repository-content","status" |
| football-data-co-uk-e0 | 503 | false | football-data.co.uk | HTTP 503 zip=false bytes=489 <html> <head> <title>The page is temporarily unavailable</title> <style> body { font-family: Tahoma, Verdana, Arial, san |
| kaggle-ah-download | 200 | true | Kaggle License Unknown — DOWNLOAD ≠ USE for capital | already cached (gitignored) bytes=821224 |
| zenodo-raw-download | 200 | true | CC-BY-4.0 | already cached (gitignored) bytes=12554590 |

## Paid alternatives (only after €0 paths were actually tried)

| Source | Cost | Events | Timestamp | Markets | Depth | License | Cost/event |
|---|---|---|---|---|---|---|---|
| 5DollarFootballAPI Ultra | $25/month (public docs, not purchased) | claimed tick history per fixture; volume unverified without key | docs: recorded ticks; opening/closing labels ≠ STRICT until rows inspected | 1X2, AH, goals, corners, cards, BTTS, HT; Bet365 on lower plans, 19 books on Ultra | docs: back to 2014 on Ultra; Free=3 months fixtures, ticks=Ultra-only (403 otherwise) | ToS; no raw-feed resale | unknown until a key probe returns a real event count |
| OddsPapi (B2B) | not listed publicly; contact sales — not purchased | docs: historical odds since ~2026-01 on some pages; unverified | docs: createdAt / changedAt epoch ms — unverified (401 without apiKey) | aggregated 350+ books including Pinnacle/Bet365 if the plan allows | REST historical / CLV; depth unverified | B2B operator terms | unknown |
| Betfair Historic BASIC/Advanced/Pro | account + product fees (not purchased) | official BASIC files with pt / marketTime — still the best STRICT model | SOURCE publishTime — suitable for STRICT if licensed | exchange MATCH_ODDS and others in the product | official archive | Betfair historic data terms | unknown; OPTIONAL_HIGH_QUALITY_SOURCE not SINGLE_BLOCKER |

No key was purchased. No user signup was performed.
