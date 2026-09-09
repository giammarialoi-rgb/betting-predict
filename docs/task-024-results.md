# TASK 024 — Historical data attack v1

**TASK 024 VERDICT: PARTIAL_STRICT**

Success class: **B** (STRICT < 100 but a concrete acquirable path to ≥100 is documented)

## HISTORICAL DATA ATTACK — TASK 024

| Metrica | Risultato |
|---|---|
| Dataset realmente acquisiti | 3 |
| Eventi totali (listed, overlapping sources) | 1166654 |
| Quote totali (listed, overlapping sources) | 1035060 |
| Quote exact timestamp | 213984 |
| Kickoff exact | 112376 |
| Temporal relation proven | 213984 |
| STRICT events | 1 |
| Eventi rejected | 666253 |
| Lineage clusters | 4 |
| Mercati STRICT | MATCH_ODDS |
| Primo anno testabile | — |
| Modello testato | none |
| Bets cieche | 0 |
| Edge dimostrato | NO |
| Bankroll testabile | NO |
| Verdict | PARTIAL_STRICT |

## PRIMARY BLOCKER

Official Betfair Historic BASIC is login-gated (credentials not used). BeatTheBookie odds_series / odds_series_b / SQL remain NOT_ACQUIRED (Dropbox HTML / Drive). soccer-dataset known_at equals date_utc on all 213,983 odds rows (closing, not STRICT prematch).

## NEXT ACTION

Log into historicdata.betfair.com with a dedicated research account (not this run). Free BASIC Soccer, MATCH_ODDS, Premier League, start 2019–20, 100 then 500 events. Do not buy Advanced until BASIC is STRICT.

```
soccer_odds_fixtures=186813; soccer_odds_rows=213983; known_at_eq_kickoff=213983; btb_closing=479440; btb_series=false; betfair_mirror_strict=1; official_betfair=0
STRICT events: 1 (gate 100)
Replay launched: false
winner = null
real_money = false
```

## Main inventory

| Source | Events | Odds | Exact timestamp | Exact kickoff | Temporal relation proven | STRICT | Independence | Status |
|---|---:|---:|---|---|---|---:|---|---|
| football-data.co.uk | 13247 | 341637 | no | no | no | 0 | upstream (lineageRoot football-data.co.uk) | DATE_ONLY |
| BeatTheBookie closing_odds.csv | 479440 | 479440 | no | no | no | 0 | REDISTRIBUTION of Lisandro79/BeatTheBookie | DATE_ONLY |
| BeatTheBookie odds_series / odds_series_b / SQL | 0 | 0 | no | no | no | 0 | same BeatTheBookie root | NOT_ACQUIRED |
| eatpizzanot/soccer-dataset | 186813 | 213983 | ✓ | mixed | equals kickoff (not <) | 0 | DERIVED (API-Football + football-data.co.uk + The-Odds-API) | CLOSING_AT_KICKOFF |
| Betfair Historic official BASIC | 0 | 0 | ✓ | ✓ | no | 0 | OFFICIAL historicdata.betfair.com | ACQUISITION_BLOCKED |
| Betfair Historic GitHub MIRROR | 1 | 3 | ✓ | ✓ | ✓ | 1 | MIRROR of historicdata.betfair.com | PARTIAL_STRICT |
| Zenodo 10.5281/zenodo.12673394 | 0 | 0 | no | no | no | 0 | REDISTRIBUTION of football-data.co.uk | NOT_ACQUIRED (semantics proven; FD cluster) |

## STRICT_EVENT_LEDGER

Only `STRICT = YES` may enter the capital lab. n=1 is a method demo (GitHub MIRROR), not a 100-event official dump.

| Event | Competition | Kickoff UTC | Market | Bookmaker/Exchange | Quote timestamp | Δ kickoff | Outcome | STRICT | Independence |
|---|---|---|---|---|---|---:|---|---|---|
| M001 | EPL | 2017-04-30T13:05:00.000Z | MATCH_ODDS | Betfair Exchange | 2017-04-30T11:10:52.099Z | -6848s | DRAW | YES | MIRROR |

## Rejected from STRICT (why, not INSUFFICIENT_DATA as a slogan)

| Reason | Events | Odds rows |
|---|---:|---:|
| soccer-dataset known_at = date_utc (closing/around kickoff) — not quote < kickoff | 112375 | 213983 |
| soccer-dataset kickoff midnight placeholder (00:00:00) plus known_at copied | 74438 | 0 |
| BeatTheBookie closing_odds.csv DATE_ONLY match_date | 479440 | 479440 |
| BeatTheBookie odds_series / odds_series_b / SQL dump NOT_ACQUIRED | 0 | 0 |
| Betfair Historic official bulk login-gated (BASIC £0 not used) | 0 | 0 |

## NEXT_DATA_BLOCKER (EIG / cost)

| Rank | ID | EIG | Cost | Action |
|---:|---|---|---|---|
| 1 | betfair-historic-basic-login | high | £0 + login (credentials not used here) | Log into historicdata.betfair.com with a dedicated research account (not this run). Free BASIC Soccer, MATCH_ODDS, Premier League, start 2019–20, 100 then 500 events. Do not buy Advanced until BASIC is STRICT. |
| 2 | beatthebookie-sql-odds-datetime | medium | free if the zip is public; currently HTML interstitial / NOT_ACQUIRED | If Dropbox/Drive ever serves the SQL dump without login tricks, parse odds_history_series.odds_datetime. Still refuse STRICT until timezone is documented. |
| 3 | beatthebookie-odds-series-txt | low | Dropbox/Drive blocked; would not unlock UTC STRICT anyway | Do not prioritize odds_series TXT for STRICT. Relative 60 min LOCF, TZ unknown. |

## BeatTheBookie series semantics (generator + Figure2B.m)

- Bulk odds_series / odds_series_b: **NOT_ACQUIRED**
- Case: **D** — odds_series / SQL dump NOT_ACQUIRED — semantics from generator only
- PHP: 72 hourly LOCF bins; column 0 = 71h before; column 71 = kickoff marker.
- Figure2B.m MATLAB 1-indexed 67:71 = PHP 66:70 = **5h → 1h before kickoff** (kickoff column excluded).
- Absolute `odds_datetime` lives in the SQL dump (not acquired). TXT files destroy it.
- Timezone of `matches.date`: undocumented → no UTC `available_at`.

| MATLAB 1-index | PHP 0-index | Hours before kickoff |
|---:|---:|---:|
| 67 | 66 | 5 |
| 68 | 67 | 4 |
| 69 | 68 | 3 |
| 70 | 69 | 2 |
| 71 | 70 | 1 |

## soccer-dataset (materialized parquet)

- fixtures 673966; odds rows 213983; odds fixtures 186813
- known_at < kickoff: 0; = kickoff: 213983; > kickoff: 0
- kickoff midnight fixtures 74438; kickoff with clock 112375
- match_stats 283834 known_at = kickoff + 6300s (105 min) — POST_MATCH
- dictionary odds.known_at: Odds known at/around kick-off (closing line)
- sources: API-Football-closing=175908; CSV=24412; The-Odds-API=12655; API-Football=1008
- bookmaker Maximum is an aggregate label, not a book.
- The-Odds-API rows still have known_at copied to kickoff — last_update was not preserved.

Parquet hash checks:

- odds.parquet: present=true match=true bytes=2591808 sha256=33286ac0c288a2dfd149a1cb26db92eba2ddb33fec74b30967607035592d720d
- fixtures.parquet: present=true match=true bytes=12938933 sha256=7ba90661dbed29eb940daf5ea385c7d76d5751d16be86bd9063293a982abc7b7
- leagues.parquet: present=true match=true bytes=8240 sha256=55c8e198650f5e2864fac85823196f6b5b45caf8342c1308e87e351098242c58
- teams.parquet: present=true match=true bytes=321028 sha256=5529282b37ad51437142dd7c6d32fb60bbbdd56953dc432e3b9247dca17a2fa5
- match_stats.parquet: present=true match=true bytes=7027755 sha256=2fb85b14b4428e1a36efe6d651de4ca8f7a6169ecfa3edb9cda49cb5e58d97e9
- fixture_lineups.parquet: present=true match=true bytes=7042165 sha256=dcd9181f54df52193877ffd8a41b5d1097b404eb46b4890069c0e4d1c8c13abd

## Gates

| Source | EXISTS | ACQUIRED | PARSED | HAS_TS | TS_EXACT | KO_EXACT | RELATION | STRICT_USABLE | Class |
|---|---|---|---|---|---|---|---|---|---|
| football-data-co-uk | true | true | true | false | false | false | false | false | DATE_ONLY |
| beatthebookie-closing | true | true | true | false | false | false | false | false | DATE_ONLY |
| beatthebookie-series | true | false | false | false | false | false | false | false | NOT_ACQUIRED |
| soccer-dataset | true | true | true | true | true | true | true | false | CLOSING_AT_KICKOFF |
| betfair-historic-official | true | false | false | true | true | true | false | false | NOT_ACQUIRED |
| betfair-historic-mirror | true | true | true | true | true | true | true | true | STRICT_PREMATCH |
| zenodo-tale-of-two-markets | true | false | true | false | false | false | false | false | DATE_ONLY |

## Lineage clusters

4 clusters. GitHub/Kaggle/HF/Dropbox copies of the same root are not independent.

- football-data-co-uk: root=football-data.co.uk; upstream=football-data.co.uk; channel=publisher CSV (mmz4281); class=OFFICIAL
- beatthebookie-closing: root=Lisandro79/BeatTheBookie; upstream=Lisandro79/BeatTheBookie; channel=Kaggle austro / TilenKopac GitHub CSV; class=REDISTRIBUTION
- beatthebookie-series: root=Lisandro79/BeatTheBookie; upstream=Lisandro79/BeatTheBookie; channel=Dropbox odds_series.zip (NOT_ACQUIRED); class=OFFICIAL
- beatthebookie-kaggle: root=Lisandro79/BeatTheBookie; upstream=Lisandro79/BeatTheBookie; channel=Kaggle austro dataset v2; class=MIRROR
- soccer-dataset-hf: root=eatpizzanot/soccer-dataset; upstream=API-Football + football-data.co.uk + The-Odds-API; channel=Hugging Face parquet (CC BY 4.0); class=DERIVED
- soccer-dataset-github: root=eatpizzanot/soccer-dataset; upstream=API-Football + football-data.co.uk + The-Odds-API; channel=GitHub eatpizzanot/soccer-dataset; class=MIRROR
- zenodo-tale-of-two-markets: root=football-data.co.uk; upstream=football-data.co.uk; channel=Zenodo 10.5281/zenodo.12673394 (collected 2022-05-22); class=REDISTRIBUTION
- betfair-historic-official: root=historicdata.betfair.com; upstream=historicdata.betfair.com; channel=Betfair Historic portal (login-gated BASIC £0); class=OFFICIAL
- betfair-historic-petermclagan: root=historicdata.betfair.com; upstream=historicdata.betfair.com; channel=GitHub petermclagan/betfair-historical tests/sample_data; class=MIRROR

## Acquisition probes

- betfair-mcm-fixture [MIRROR]: acquired=true status=200 TASK 023 committed MATCH_ODDS ndjson (1 EPL event)
- btb-closing-odds-csv [REDISTRIBUTION]: acquired=true status=200 TASK 022 cache closing_odds.csv (DATE_ONLY)
- soccer-odds.parquet [DERIVED]: acquired=true status=200 Hugging Face parquet cache
- soccer-fixtures.parquet [DERIVED]: acquired=true status=200 Hugging Face parquet cache
- soccer-leagues.parquet [DERIVED]: acquired=true status=200 Hugging Face parquet cache
- soccer-teams.parquet [DERIVED]: acquired=true status=200 Hugging Face parquet cache
- soccer-match_stats.parquet [DERIVED]: acquired=true status=200 Hugging Face parquet cache
- soccer-fixture_lineups.parquet [DERIVED]: acquired=true status=200 Hugging Face parquet cache
- btb-readme [OFFICIAL]: acquired=false status=200 200 zip=false html=false text/plain; charset=utf-8 ## Beating the bookies with their own numbers. This repository contains the code to reproduce our be
- btb-generate_odds_series_csv.php [OFFICIAL]: acquired=false status=200 200 zip=false html=false text/plain; charset=utf-8 <?php // for each match outputs a 32 x (72*3) matrix of odds // the rows of the matrix are the diffe
- btb-Figure2B.m [OFFICIAL]: acquired=false status=200 200 zip=false html=false text/plain; charset=utf-8 function Figure2B () %% Stragegy implementation with Historical time series odds (from 5 hours %% be
- dropbox-odds_series.zip [OFFICIAL]: acquired=false status=200 200 zip=false html=true text/html; charset=utf-8 <!DOCTYPE html> <html class="maestro global-header" xmlns="http://www.w3.org/1999/xhtml" lang="en">
- dropbox-odds_series_b.zip [OFFICIAL]: acquired=false status=200 200 zip=false html=true text/html; charset=utf-8 <!DOCTYPE html> <html class="maestro global-header" xmlns="http://www.w3.org/1999/xhtml" lang="en">
- google-drive-btb-folder [OFFICIAL]: acquired=false status=200 200 zip=false html=false text/html; charset=utf-8
- tilenkopac-data-listing [MIRROR]: acquired=false status=200 200 zip=false html=false application/json; charset=utf-8 [{"name":"closing_odds.csv","path":"data/closing_odds.csv","sha":"fbc1a692226acd6a5d23e3f533a0b4621c
- hf-soccer-odds.parquet [DERIVED]: acquired=false status=200 200 zip=false html=false application/octet-stream
- hf-soccer-dictionary [DERIVED]: acquired=false status=200 200 zip=false html=false text/plain; charset=utf-8 # Data Dictionary _Regenerated from the curated data. One section per table._ ## `fixtures` (673,966
- betfair-historic-portal [OFFICIAL]: acquired=false status=200 200 zip=false html=true text/html <!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=devi
- zenodo-12673394 [REDISTRIBUTION]: acquired=false status=200 200 zip=false html=false application/json {"created": "2024-07-06T15:15:22.006433+00:00", "modified": "2024-07-06T15:15:22.550619+00:00", "id"

## Hostile leakage A–H

| Attack | HARD FAIL |
|---|---|
| A | yes |
| B | yes |
| C | yes |
| D | yes |
| E | yes |
| F | yes |
| G | yes |
| H | yes |

## Annual capital (start 1000 / solar year, no carry)

STRICT < 100 → no replay. END = **—**, never silent 1000 → 1000.

| year | start | bets | end | status |
|---:|---:|---:|---:|---|
| 2015 | 1000 | 0 | — | INSUFFICIENT_DATA |
| 2016 | 1000 | 0 | — | INSUFFICIENT_DATA |
| 2017 | 1000 | 0 | — | INSUFFICIENT_DATA |
| 2018 | 1000 | 0 | — | INSUFFICIENT_DATA |
| 2019 | 1000 | 0 | — | INSUFFICIENT_DATA |
| 2020 | 1000 | 0 | — | INSUFFICIENT_DATA |
| 2021 | 1000 | 0 | — | INSUFFICIENT_DATA |
| 2022 | 1000 | 0 | — | INSUFFICIENT_DATA |
| 2023 | 1000 | 0 | — | INSUFFICIENT_DATA |
| 2024 | 1000 | 0 | — | INSUFFICIENT_DATA |
| 2025 | 1000 | 0 | — | INSUFFICIENT_DATA |
| 2026 | 1000 | 0 | — | INCOMPLETE |

## Evidence (TASK 015)

```
{
  "eventId": "task-024-corpus",
  "asOf": "2017-04-30T12:05:00.000Z",
  "hypothesis": "HOME",
  "probability": null,
  "evidenceStrength": "insufficient",
  "narrativeSummary": "HOME — Probability: n/a — Evidence strength: INSUFFICIENT\nContext: eatpizzanot/soccer-dataset odds.known_at is documented closing/around kick-off; measured known_at == date_utc on all 186813 odds fixtures",
  "evidenceGraph": {
    "eventId": "task-024-corpus",
    "asOf": "2017-04-30T12:05:00.000Z",
    "hypothesis": "HOME",
    "supporting": [],
    "contradicting": [],
    "contextual": [
      {
        "evidenceId": "task-024|soccer-known-at",
        "category": "market",
        "epistemicKind": "FACT",
        "claim": "eatpizzanot/soccer-dataset odds.known_at is documented closing/around kick-off; measured known_at == date_utc on all 186813 odds fixtures",
        "entityRef": "soccer-dataset odds",
        "eventId": "task-024-corpus",
        "sourceId": "eatpizzanot/soccer-dataset",
        "sourceUrl": "https://huggingface.co/datasets/eatpizzanot/soccer-dataset",
        "publishedAt": "2017-04-30T12:05:00.000Z",
        "availableAt": "2017-04-30T12:05:00.000Z",
        "observedAt": "2017-04-30T12:05:00.000Z",
        "temporalPrecision": "exact",
        "polarity": "CONTEXT_ONLY",
        "targetHypothesis": "HOME",
        "magnitude": 186813,
        "claimConfidence": null,
        "sourceReliability": null,
        "confirmations": [],
        "rebuttals": []
      }
    ],
    "insufficient": [
      "STRICT < 100 — no capital replay, no model selection, winner = null",
      "News/injuries remain CONTEXT_ONLY; no causal SUPPORT from articles",
      "soccer-dataset match_stats.known_at = kickoff + 105 min is post-match",
      "Closing odds are not prematch decision quotes"
    ]
  },
  "attributions": [
    {
      "evidenceId": "task-024|soccer-known-at",
      "kind": "market",
      "sourceId": "eatpizzanot/soccer-dataset",
      "sourceUrl": "https://huggingface.co/datasets/eatpizzanot/soccer-dataset",
      "publishedAt": "2017-04-30T12:05:00.000Z",
      "availableAt": "2017-04-30T12:05:00.000Z",
      "observedAt": "2017-04-30T12:05:00.000Z",
      "claim": "eatpizzanot/soccer-dataset odds.known_at is documented closing/around kick-off; measured known_at == date_utc on all 186813 odds fixtures",
      "epistemicKind": "FACT",
      "polarity": "CONTEXT_ONLY",
      "category": "market"
    }
  ],
  "blockedByTemporal": []
}
```

## SCIENTIFIC VERDICT

- DATA AVAILABLE: soccer_odds_fixtures=186813; soccer_odds_rows=213983; known_at_eq_kickoff=213983; btb_closing=479440; btb_series=false; betfair_mirror_strict=1; official_betfair=0
- STRICT EVENTS: 1
- YEARS TESTABLE: none
- YEARS INSUFFICIENT: 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026
- TOTAL BETS: 0
- BEST MODEL: null
- HOLDOUT: SACRED
- AUTO-PROMOTION: FALSE
- REAL MONEY: FALSE
- PARTIAL_STRICT
