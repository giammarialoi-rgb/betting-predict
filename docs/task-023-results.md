# TASK 023 — Temporal odds breakthrough

**Verdict: PARTIAL_STRICT**

Official Betfair Historic BASIC was probed without login and without purchase. The portal/API remain credential-gated. A GitHub **MIRROR** BASIC football sample (one EPL MATCH_ODDS market, 2017-04-30 Middlesbrough v Man City) was parsed for real `pt` / `marketTime` / PREMATCH proof. That is not an independent source and not a 100-event licensed dump.

```
mirror_events=1; official_bulk=false; full_sample_ltp=5628; match_odds_ltp=24; BASIC ladder=0
STRICT events (mirror method demo): 1
Official STRICT events: 0
Timestamp observations: 5628
100-event acceptance: false
Bets: 0
winner = null
```

| Source | Period | Events | Markets | Timestamp | STRICT | Cost | Status |
|---|---|---:|---:|---|---:|---|---|
| historicdata.betfair.com BASIC (OFFICIAL) | from ~2015/2016 documented | 0 | 0 | EXACT pt (not acquired) | 0 | £0 + login | ACQUISITION_BLOCKED |
| petermclagan football-basic-sample (MIRROR) | 2017-04-30 EPL Middlesbrough v Man City | 1 | 59 | EXACT pt vs marketTime | 1 | £0 (GitHub test fixture) | PARTIAL_STRICT |
| kito129 tennis BASIC json (MIRROR) | tennis MATCH_ODDS sample | 0 | 1 | EXACT pt (format only; not soccer capital) | 0 | £0 | FORMAT_ONLY |

## Access (not purchased, no user credentials)

- BASIC: **£0**, still requires a Betfair account to “purchase” the free basket.
- Advanced Soccer: **£69/month** or **£699/year**.
- Pro Soccer: **£230/month** or **£2,299/year**.
- BASIC is last-traded ~1 minute, no volume, no ladder. Measured on the real sample: `batb=atb=atl=0`.
- BASIC **is** sufficient for the TIMESTAMP → AS_OF → LOCK clock test. It is **not** sufficient for depth/liquidity features.

## Acquisition probes

- local-cache-football-basic-json [MIRROR]: acquired=true status=200 petermclagan tests/sample_data football BASIC decompressed; not official licensed bulk
- local-cache-football-basic-bz2 [MIRROR]: acquired=true status=200 original bz2 sample from GitHub tooling tests
- local-cache-tennis-basic-json [MIRROR]: acquired=true status=200 tennis MATCH_ODDS BASIC format confirmation — not EPL soccer
- official-portal [OFFICIAL]: acquired=false status=200 200 text/html <!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-sca
- official-pdf-spec [OFFICIAL]: acquired=false status=200 200 text/html <!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-sca
- official-api-unauthenticated [OFFICIAL]: acquired=false status=404 404 application/json {"timestamp":"2026-09-07T08:29:29.355009032","status":404,"message":"Not Found","exception":"NoResourceFoundException","
- github-football-basic-bz2 [MIRROR]: acquired=false status=200 200 application/octet-stream
- betfair-automation-hub [OFFICIAL]: acquired=false status=200 200 text/html; charset=utf-8  <!doctype html> <html lang="en" class="no-js"> <head> <meta charset="utf-8"> <meta name="viewport" content="width=devic
- official-pricing-table [OFFICIAL]: acquired=false status=200 200 text/html; charset=utf-8 <!DOCTYPE html> <html dir="ltr" lang="en-US"> <head> <meta charset="utf-8" /> <!-- v27896 --> <title>Are bulk purchase d

Fixture sha256: f30b7d7b38bae59c5cff4f2a149b9a5ed3a5ef2ba9070c8a2c2ad09bc07b7f6f (expected f30b7d7b38bae59c5cff4f2a149b9a5ed3a5ef2ba9070c8a2c2ad09bc07b7f6f)

Full football BASIC sample sha256: 9a41d7ebf6884fa6ad6d2dbdd943e92bd24502b9a4ce00b2fe168c30e61fcdae (expected 9a41d7ebf6884fa6ad6d2dbdd943e92bd24502b9a4ce00b2fe168c30e61fcdae); lines=1096; markets=77; LTP=5628

## MATCH_ODDS (fixture)

- marketId 1.131162837 eventId 28202626 Middlesbrough v Man City
- kickoff 2017-04-30T13:05:00.000Z (ISO Z; MD timezone field Europe/London — not used to invent a clock)
- PREMATCH LTP 10 INPLAY 14 POSTMATCH 0 UNKNOWN 0
- first observation 2017-04-28T11:31:51.802Z
- last prematch 2017-04-30T13:02:53.487Z
- prematch observation count (unique pt) 10
- interval sec median=946.072 p95=100922.91259999994 min=60.008 max=163816.467

## Cost

| Events | BASIC GBP | Advanced soccer GBP | Pro soccer GBP | COST_PER_EVENT BASIC |
|---:|---:|---:|---:|---:|
| 100 | 0 | 69 | 230 | 0 |
| 500 | 0 | 69 | 230 | 0 |
| 1000 | 0 | 69 | 230 | 0 |
| 10000 | 0 | 69 | 230 | 0 |
| 100000 | 0 | 699 | 2299 | 0 |

- COST_PER_1K_EVENTS BASIC = 0 (login still required; not acquired)
- COST_PER_10K_EVENTS BASIC = 0
- EXPECTED_INFORMATION_GAIN: EXACT publishTime (pt) + marketStartTime — the missing STRICT clock
- Purchased this run: **false**

## Data quality

- source: GitHub MIRROR of Betfair Historic BASIC (petermclagan sample) + official portal probed unauthenticated
- events 1; markets 59; timestamps 5628
- prematch 2877; inplay 2751; postmatch 0
- exact 5628; unknown 0
- median interval 946.072
- STRICT events 1
- license: Betfair Historic ToS for official bulk (not acquired). GitHub test sample = MIRROR, not an independent source.
- cost: BASIC £0 + login (blocked this run). Advanced soccer £69/month or £699/year. Not purchased.
- quality: Documented BASIC ≈1 min LTP, no ladder. Measured MATCH_ODDS unique-pt median interval is sparser than 1 min; batb/atb/atl=0; kickoff=marketTime UTC

## SCIENTIFIC VERDICT

- DATA AVAILABLE: mirror_events=1; official_bulk=false; full_sample_ltp=5628; match_odds_ltp=24; BASIC ladder=0
- STRICT EVENTS: 1
- OFFICIAL STRICT EVENTS: 0
- MODEL_READY MARKETS: none
- YEARS TESTABLE: none
- YEARS INSUFFICIENT: 2017, 2018, 2019, 2020
- TOTAL BLIND DECISIONS: 1
- TOTAL BETS: 0
- BEST MODEL: null
- BEST RISK POLICY: null
- STATISTICAL SIGNIFICANCE: none (n=1; Bonferroni 7 models; no edge claim)
- HOLDOUT STATUS: SACRED
- AUTO-PROMOTION: FALSE
- REAL MONEY: FALSE
- PARTIAL_STRICT
