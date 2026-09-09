# TASK 026 — source matrix

| Source | Accessible | Free | Events | Quotes | Exact ts | License | Level | STRICT | Note |
|---|---|---|---:|---:|---|---|---|---:|---|
| 5dollarfootballapi | false | false | 0 | 0 | — | ToS; Bearer key; no signup performed | UNUSABLE | 0 | probe HTTP 401 — 401 without key. Free plan exists in docs; key not obtained (€0 / no account). |
| oddspapi | false | false | 0 | 0 | — | B2B; all HTTP requires apiKey | UNUSABLE | 0 | v4 historical HTTP 401; v5 bookmakers HTTP 401. No public unauthenticated historical dump. |
| kaggle-realsingwong-ah | true | true | 90 | 107446 | true | UNKNOWN (Kaggle) / README personal use / titan007.com — not capital | RESEARCH_STRICT | 0 | Public Kaggle zip is SAMPLE only (90 CSVs, not 7494). Timestamp=YYYYMMDDHHmmss claimed UTC. No kickoff column. FT/HT sit on every odds row — ignored for DecisionContext. License UN |
| zenodo-12673394-ucd | true | true | 131433 | 131433 | false | CC-BY-4.0 | RESEARCH_DATE_ONLY | 0 | Hegarty/Whelan IJF replication. Odds from football-data.co.uk (collected 2022-05-22). OPEN/CLOSE bookmaker columns are DATE_ONLY. Time in tidy notes is kickoff, not a quote timesta |
| betfair-historic-basic-github-mirror | true | true | 1 | 3 | true | Betfair terms; GitHub SAMPLE/MIRROR — not licensed historic capital | RESEARCH_STRICT | 0 | petermclagan football-basic-sample / committed ndjson. OPTIONAL_HIGH_QUALITY. Provenance=MIRROR. |
| club-football-match-data | true | true | 238858 | 238858 | false | upstream clone | RESEARCH_DATE_ONLY | 0 | Research corpus A — never capital. |
| openligadb | true | true | — | 0 | false | OpenLigaDB | INDEX | 0 | HTTP 200. Fixtures/leagues index, not bookmaker quote clocks. |
| clubelo | false | true | — | 0 | false | ClubElo | UNUSABLE | 0 | HTTP timeout/error. Ratings only. |
| football-data-co-uk | false | true | — | — | false | football-data.co.uk | RESEARCH_DATE_ONLY | 0 | BLOCKED HTTP 503 — optional, laboratory continues. |
| nautilus-trader-betfair-sample | false | true | 0 | 0 | — | LGPL-3.0 code; Betfair data gitignored / not shipped | UNUSABLE | 0 | GitHub contents HTTP 404. Path tests/test_data/local/betfair is gitignored. Docs are not a download. |
| kito129-betfair-raw-conversion | false | true | 0 | 0 | — | third-party conversion | UNUSABLE | 0 | GitHub tree listed tennis player markets. Not a football timestamp corpus. |
| petermclagan-betfair-historical | true | true | 1 | 3 | true | MIRROR/SAMPLE | RESEARCH_STRICT | 0 | Only football-basic-sample.bz2 in the repo tree. No extra BASIC-*.bz2 football dump. |

CAPITAL_STRICT, RESEARCH_STRICT, RESEARCH_DATE_ONLY, SECONDARY, INDEX, UNUSABLE are never mixed.
