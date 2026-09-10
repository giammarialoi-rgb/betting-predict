# Phase 5 — Final report

Status: acquisition engine visible in production path. Model gates were not lowered.
This is not a claim that every catalogue source now returns typed match statistics.

## 1. What changed

- Research runs before analyze in the same Brain cycle (`factory-049/cycle.ts`, `brain-051/cycle.ts`).
- Calendar lists every `events.jsonl` row for a Europe/Rome date, with no 8/25/120 cap (`calendar.ts`, `GET /api/events`).
- Events page: day navigation, real count, team names, buckets DISCOVERED / QUEUED / RESEARCHING / RESEARCHED / MODEL_INFERENCE / INSUFFICIENT_DATA.
- Operational source engine: capabilities, fallback chain, health from `research-status.jsonl`. Homepage mention is not SUCCESS.
- Event identity: `live:` stays a provisional id.
- HistoricalDataProvider: Football-Data first. Club-Football folder presence is not SUCCESS without a bound match.
- Scrape PARTIAL (name mention only) does not count as a successful research fetch.
- Odds research is MARKET_LAYER, not research SUCCESS.
- Neon board: full calendar; dossier mirror limit 2000.
- Runtime version: `phase-5-data-acquisition-v1`.
- Per-cycle research budget default 24; optional `RESEARCH_EVENT_BUDGET`. Queue still holds all upcoming events.
- Sources page: last attempt / success / failure, last event, blocked / NO_EVENT, capabilities.

## 2. Problems found in code

1. Analyze ran before research, so UI lineage and the feature bag were out of sync.
2. Events UI read the decisions tail, not the full calendar.
3. HTTP 200 homepage was treated as event data (already tightened in 3F/4; reinforced here).
4. Understat has no event URL without a fixture id — stays NO_EVENT; xG is not invented.
5. Club-Football-Match-Data was folder presence, not per-event rows.
6. Odds research rows were `ok:true` without a fetch.

## 3. Working sources (real adapter or API)

- The Odds API (discovery + market layer; never independent MODEL)
- Football-Data.co.uk (L3/L5/L10 priors already in the engine)
- ClubElo (day cache)
- API-Sports (only with cache/key and budget)
- Open-Meteo (when location and kickoff exist)
- Ordinary GET scrape (SofaScore, FBref, Diretta, and others): PARTIAL / NO_EVENT / BLOCKED. Not typed stats.

## 4. Blocked sources (honest)

- 403 / Cloudflare / CAPTCHA / WAF: BLOCKED. No bypass.
- Login / paywall: AUTH_REQUIRED or POLICY_DISABLED.
- Understat without a match URL: NO_EVENT.

## 5. Missing adapters

The catalogue keeps ~33 sources. Many stay `MISSING_ADAPTER` (WhoScored, SoccerVista, news, tennis, Opta, and others). They remain registered; fallback continues to the next useful source.

## 6. Data actually collected

Independent MODEL still uses:

- Football-Data priors (form, goals, shots when present in history)
- ClubElo
- API-Sports cache when present
- Open-Meteo when location is known

GET scrape does not write typed xG / lineup / injury observations. PARTIAL is not a model observation.

## 7. Events per date

Count depends on Odds API discovery on Lab B disk / Neon. The UI does not truncate to 8/25/120. The real count is `total` on `GET /api/events`.

## 8. Inferences

Only `hasIndependentModel` (coverage, missing keys, temporal validity, odds firewall). No invented percentages.
Gates unchanged: coverage >= 0.35, missing_keys <= 45.

## 9. Tests

- `pnpm test`: 658 pass / 0 fail (includes `phase-5-data-acquisition.test.ts`)
- `pnpm lint`: 0 errors
- `pnpm build`: ok

Phase 5 coverage: fallback, 200 homepage != event, 403 BLOCKED, identity, calendar 40 events, queue 80 / batch 24, odds firewall, no fake feature.

## 10. Production

See `artifacts/phase-5/production-verification.json` after push, deploy, and worker restart.

## 11. Remaining real blockers

- Mention-based scrape is not a match-page parser (xG, lineup, referee).
- Research JSONL is not a typed feature store read by `predictIndependentForEvent` beyond existing providers.
- Club-Football CSV is not parsed per event.
- No new Neon table `source_attempts` (existing `betmind_*` JSONB remains).
- Per-cycle budget limits how many events are researched per tick, not how many exist.
- WAF/CAPTCHA: recorded and skipped; not bypassed.
