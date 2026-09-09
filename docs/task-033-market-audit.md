# TASK 033 — Market audit

| Market | Observed | STRICT n | Research n | Temporal | Verdict | Note |
|---|---|---:|---:|---|---|---|
| 1X2 | true | 10499 | 1397 | LEVEL_B_EXACT | NO_DEMONSTRATED_EDGE | Carried from TASK 032. Not re-fit. VAL selected schedule TEST ΔBrier=0.000034 (worse or null vs market). Market logloss=0.996355. Holm no rejection. |
| OU | true | 1 | 7976 | LEVEL_A_EXACT | INSUFFICIENT_N | Betfair BASIC MIRROR n=1 event(s), pt < marketTime. Not capital (MIRROR + n<100). Weekly naive-TZ events=7976 remain RESEARCH_ONLY. |
| BTTS | true | 1 | 359 | LEVEL_A_EXACT | INSUFFICIENT_N | Betfair BASIC MIRROR n=1 event(s), pt < marketTime. Not capital (MIRROR + n<100). Weekly naive-TZ events=359 remain RESEARCH_ONLY. |
| AH | true | 1 | 727 | LEVEL_A_EXACT | INSUFFICIENT_N | Betfair BASIC MIRROR n=1 event(s), pt < marketTime. Not capital (MIRROR + n<100). Weekly naive-TZ events=727 remain RESEARCH_ONLY. |
| DC | true | 1 | 123 | LEVEL_A_EXACT | INSUFFICIENT_N | Betfair BASIC MIRROR n=1 event(s), pt < marketTime. Not capital (MIRROR + n<100). Weekly naive-TZ events=123 remain RESEARCH_ONLY. |
| DNB | true | 1 | 282 | LEVEL_A_EXACT | INSUFFICIENT_N | Betfair BASIC MIRROR n=1 event(s), pt < marketTime. Not capital (MIRROR + n<100). Weekly naive-TZ events=282 remain RESEARCH_ONLY. |
| Correct Score | true | 1 | 1588 | LEVEL_A_EXACT | INSUFFICIENT_N | Betfair BASIC MIRROR n=1 event(s), pt < marketTime. Not capital (MIRROR + n<100). Weekly naive-TZ events=1588 remain RESEARCH_ONLY. |
| Corners | true | 1 | 72 | LEVEL_A_EXACT | INSUFFICIENT_N | Betfair BASIC MIRROR n=1 event(s), pt < marketTime. Not capital (MIRROR + n<100). Weekly naive-TZ events=72 remain RESEARCH_ONLY. |
| Cards | true | 1 | 38 | LEVEL_A_EXACT | INSUFFICIENT_N | Betfair BASIC MIRROR n=1 event(s), pt < marketTime. Not capital (MIRROR + n<100). Weekly naive-TZ events=38 remain RESEARCH_ONLY. |
| Player | true | 1 | 20 | LEVEL_A_EXACT | INSUFFICIENT_N | Betfair BASIC MIRROR n=1 event(s), pt < marketTime. Not capital (MIRROR + n<100). Weekly naive-TZ events=20 remain RESEARCH_ONLY. |
| Exchange | true | 1 | 0 | LEVEL_A_EXACT | INSUFFICIENT_N | Betfair BASIC MIRROR n=1 event(s), pt < marketTime. Not capital (MIRROR + n<100). Weekly naive-TZ events=0 remain RESEARCH_ONLY. |

## Weekly Betfair (naive clock)

path: audit/external/task-025/betfair-sports.csv · rows=1306748 · football_rows=857936 · timezone_in_file=false

| Family | Rows | Events | FIRST_TAKEN < SCHEDULED_OFF (naive) | IN_PLAY rows |
|---|---:|---:|---:|---:|
| 1X2 | 176938 | 1397 | 33649 | 135533 |
| OU | 349342 | 7976 | 43397 | 288214 |
| BTTS | 7358 | 359 | 2753 | 4491 |
| AH | 7555 | 727 | 4230 | 3139 |
| DC | 1322 | 123 | 692 | 615 |
| DNB | 4907 | 282 | 2311 | 2538 |
| Correct Score | 135227 | 1588 | 30701 | 102195 |
| Corners | 630 | 72 | 587 | 35 |
| Cards | 411 | 38 | 397 | 4 |
| Player | 1391 | 20 | 891 | 430 |
| Exchange | 0 | 0 | 0 | 0 |

Naive order is not UTC. These counts are RESEARCH_ONLY.
