# Phase 7 — Data Acquisition and Research Engine

Principle: no data = no claim. HTTP 200 is not SUCCESS. A homepage is not event data. Odds never enter the independent model. Model gates stay at coverage 0.35 and missing_keys 45.

Runtime: phase-7-data-acquisition-v1.

## Pipeline

Discovery (Odds API) to persistent research queue to orchestrator (24 events per cycle as a governor) to per-event research to typed observations to temporal firewall to feature bag to independent model to Italian dossier to Neon to Vercel.

Scraping is always ALLOW on the production path. 403, Cloudflare and CAPTCHA stay BLOCKED. No WAF bypass.

## Observation schema

event_id, feature_key, value, source, source_url, observed_at, available_at (null unless demonstrated), kind (HISTORICAL_PRIOR, EVENT_RESEARCH, DERIVED, CONTEXT, MARKET), status, enters_independent_model.

Model policy: REAL_EVENT_DATA, HISTORICAL_PRIOR and DERIVED may enter if temporally valid. MARKET, POST_KICKOFF, UNVERIFIED and scrape CONTEXT never enter.

## Adapters

Football-Data.co.uk: local archive, target excluded, DATE_ONLY, enters MODEL when PI-eligible.

Club-Football-Match-Data: prior rows only, not MODEL.

ClubElo: CSV as-of rating_date less than match date. Missing file is not success.

Open-Meteo: forecast for future kickoffs, archive for past. CONTEXT. available_at equals asOf for forecasts. Needs stadium coordinates.

ANSA: public calcio RSS. CONTEXT only if both teams appear in the same item.

Sky Sport: no official public RSS (HTTP 404). Recorded as HTTP_ERROR.

API-Sports: cache only, needs a real fixture_id.

The Odds API: market compare only.

FBref, SofaScore, Diretta, WhoScored, Flashscore, Soccerway, SoccerVista, SoccerVital, The Analyst, Abseits, UEFA: ordinary GET of an event search URL. Typical result BLOCKED or NO_EVENT.

Understat: no event URL without fixture id. DENIED rather than a false league-table success.

Opta, The Athletic, CIES, tip sites, tennis catalogue: MISSING_ADAPTER or policy.

Tennis categories are typed in sport-schema.ts and not collected yet.

## Queue

Persistent research-queue.json. Refresh windows: T-48h through T-15m. One worker. Explicit runtime version.

## 20-event run (2026-09-10)

See artifacts/phase-7/. This cycle: 20 events across EPL, Serie A, La Liga, Europa and Ligue 1. 744 observations, 48 event-research (weather where coords existed), 660 derived, 36 historical, yield 1.958. HTML scrape typed SUCCESS: 0. xG, injuries, confirmed XI, referee: not found.

Aston Villa vs Nottingham Forest: identity HIGH. Form and team stats from Football-Data. Weather from Open-Meteo. xG / injuries / lineup / referee: not found.

## Tests

pnpm test: 685 pass. Phase 7 suite covers identity aliases, homepage != SUCCESS, 403 fallback, odds firewall, weather available_at, RSS both-team match, model policy.

## Gates (unchanged)

coverage >= 0.35, missing_keys <= 45, odds firewall, temporal firewall.
