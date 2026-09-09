# TASK 025 — source acquisition

EIG/cost ranking. A 10k exact-timestamp source outranks 500k DATE_ONLY.

| Source | temporal | coverage | EIG | cost | EIG/cost | capital | class |
|---|---:|---:|---:|---:|---:|---|---|
| betfair-historic-official-basic | 10 | 9 | 10 | 0 | 10 | true | A_STRICT |
| ucd-wp2025-22-betfair-advanced | 10 | 10 | 10 | 0 | 10 | true | A_STRICT |
| kaggle-zygmunt-betfair-sports | 7 | 2 | 6 | 0 | 6 | false | B_RESEARCH_TEMPORAL |
| club-football-match-data | 2 | 8 | 5 | 0 | 5 | false | C_RESEARCH_ONLY |
| petermclagan-football-basic-sample | 10 | 1 | 4 | 0 | 4 | true | A_STRICT |
| football-data-co-uk | 2 | 7 | 4 | 0 | 4 | false | C_RESEARCH_ONLY |
| eatpizzanot-soccer-dataset | 3 | 10 | 3 | 0 | 3 | false | C_RESEARCH_ONLY |

## Probes

| Channel | HTTP | Acquired | Note |
|---|---:|---|---|
| betfair-mcm-fixture | 200 | true | Committed MATCH_ODDS ndjson (1 EPL event, STRICT candidate) bytes=14050 |
| betfair-basic-sample-json | 200 | true | petermclagan football-basic-sample extracted JSON (gitignored) bytes=1472599 |
| kaggle-betfair-sports-csv | 200 | true | Kaggle weekly CSV cache bytes=337478465 |
| club-football-matches | 200 | true | Club-Football Matches.csv RESEARCH_ONLY bytes=45608878 |
| btb-closing-odds | 200 | true | BeatTheBookie closing_odds.csv DATE_ONLY bytes=69340934 |
| soccer-odds-parquet | 200 | true | soccer-dataset odds.parquet CLOSING_AT_KICKOFF bytes=2591808 |
| kaggle-api-view | 200 | false | HTTP 200 zip=false {"subtitleNullable":"A detailed history of prices traded for each event","creato |
| kaggle-download | 206 | false | HTTP 206 zip=true PK  -     ä 5OÓÌgÿÿÿÿÿÿÿÿ    betfair_140901.csv    A      è   |
| betfair-historic-portal | 200 | false | HTTP 200 zip=false <!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" |
| betfair-data-sample-host | — | false | fetch failed |
| betfair-automation-hub | 200 | false | HTTP 200 zip=false  <!doctype html> <html lang="en" class="no-js">   <head>            <meta charse |
| football-data-co-uk-e0 | 503 | false | BLOCKED HTTP 503 — optional source, laboratory continues. <html> <head> <title>The page is temporarily unavailable</title> <style> body {  |
| ucd-wp2025-22-pdf | 403 | false | HTTP 403 zip=false <!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.or |
| zenodo-12673394 | 200 | false | HTTP 200 zip=false {"created": "2024-07-06T15:15:22.006433+00:00", "modified": "2024-07-06T15:15:22 |
| kaggle-bulk-acquire | 200 | true | Kaggle weekly CSV already cached (gitignored). License Other — local research only, not redistributed. bytes=337478465 |

## GitHub audits

- **betfair/historic-data-workbook** license=HTTP 404 raw=false provenance=OFFICIAL_DOCS. Official workbook (xlsm/docx). No market JSON/BZ2. License unspecified on GitHub. BASIC download still requires a Betfair account. LICENSE fetch 404.
- **petermclagan/betfair-historical** license=MIT License Copyright (c) 2020 Peter McLagan Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, i raw=true provenance=MIRROR. Parser/downloader plus football-basic-sample.bz2. MIRROR of historicdata.betfair.com — not an independent bookmaker. Redistribution of the sample is not a license to republish the full historic archive. LICENSE fetch 200.
- **mzaja/betfair-database** license=HTTP 404 raw=false provenance=TOOLING. MIT indexer. No soccer dump in the repo. Needs local Betfair files the user already owns. LICENSE fetch 404.
- **AnishKhetani/premier-league-data** license=MIT License Copyright (c) 2026 Anish Khetani Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, i raw=true provenance=FD_CLUSTER. EPL 1993–present odds. football-data.co.uk cluster — not an independent bookmaker source. LICENSE fetch 200.
- **Lisandro79/BeatTheBookie** license= GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007 Copyright (C) 2007 Free Software Foundation, Inc. <http://fsf.org/> Everyone is permitted to copy and distribute verbatim copies of this licen raw=false provenance=RESEARCH_CODE. Generator + MATLAB. Bulk odds_series on Dropbox/Drive, not in git. DATE_ONLY / relative bins. LICENSE fetch 200.
- **xgabora/Club-Football-Match-Data (local clone)** license=MIT License Copyright (c) 2025 xgabora Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal raw=true provenance=LOCAL_CLONE RESEARCH_ONLY DATE_ONLY odds. Inspected Matches.csv on disk. Odd* are not STRICT quote clocks. Form*/C_*/Max* forbidden in STRICT.

## Academic

- **UCD WP2025/22 Whelan — Agreeing to Disagree** acquired=false paper=https://www.ucd.ie/economics/t4media/WP2025_22.pdf dataset=none redistribution=NOT_PUBLIC. Do not scrape. Do not assume availability.
- **MPRA 126351 (same paper)** acquired=false paper=https://mpra.ub.uni-muenchen.de/126351/ dataset=none redistribution=no dataset
- **Zenodo 10.5281/zenodo.12673394 Hegarty IJF 2024** acquired=false paper=https://zenodo.org/records/12673394 dataset=https://zenodo.org/records/12673394 redistribution=yes (CC-BY) but not STRICT and not independent of FD
- **Kaggle zygmunt/betfair-sports** acquired=false paper=https://www.kaggle.com/datasets/zygmunt/betfair-sports dataset=https://www.kaggle.com/datasets/zygmunt/betfair-sports redistribution=do not mirror without license; unauthenticated download blocked
