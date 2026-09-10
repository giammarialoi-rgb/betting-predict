# Phase 6 ? Real data acquisition engine

Status: the existing research pipeline now extracts typed event fields when HTML actually contains them, binds Club-Football prior rows, records conflicts, and explains dossiers in Italian from persisted facts. Model gates were not lowered. HTTP 200 is never SUCCESS.

Runtime version: `phase-6-data-acquisition-v1`.

## IMPLEMENTATO

- Generic HTML/JSON-LD extractor (`extract-html.ts`). SUCCESS requires EVENT_MATCHED plus at least one typed field.
- Event-page GET uses the extractor, URL cache with TTL by type, 12s timeout, statuses TIMEOUT / NETWORK_ERROR / AUTH_REQUIRED / DYNAMIC_CONTENT_UNAVAILABLE / AMBIGUOUS_EVENT.
- Typed observations in `research-observations.jsonl`. `available_at` stays null unless demonstrated. Scrape never enters independent MODEL.
- Source attempt standard (`source-attempt.ts`) and operational registry (`source-registry.ts`) on top of the existing catalogue.
- Identity wrappers: `resolveTeamIdentity` / `resolveCompetitionIdentity` / `resolveEventIdentity`. Alias `Nottingham Forest FC` -> `nottingham-forest`. No invented provider IDs.
- Queue priorities P0?P4 and refresh: P0 15m, P1 1h, P2 6h, P3 24h. Unresearched still get half of each cycle budget.
- Club-Football-Match-Data bind: prior rows with MatchDate before the target calendar day. Odds columns ignored. Same-day DATE_ONLY rows excluded.
- Conflict engine keeps both values and picks the priority source. No invented consensus.
- Data quality score on the dossier. Not used as a model gate.
- Market data-layer families (1X2, DC, O/U, BTTS, DNB, corners, cards) catalogued. No extra models.
- Italian dossier: traffic-light topics, sources sought/found/status, missing sentences from facts, conflicts card, technical details remain at the bottom.
- Neon observatory `phase6_metrics`. Compact dossier includes data_quality and conflicts.
- Tests in `phase-6-data-acquisition.test.ts`.
- Ten-event research run: `pnpm phase6:research` -> `artifacts/phase-6/ten-event-run.json`.

## NON DISPONIBILE (onesta)

- Typed xG / shots / lineups / injuries from live HTML on the 10-event run: pages were BLOCKED, NO_EVENT, AMBIGUOUS_EVENT, HTTP_ERROR, or DYNAMIC. No invented values.
- Understat: still no per-event URL without a fixture id (DENIED / no EPL table false positive).
- Open-Meteo: no stadium coords for these fixtures in the small map.
- API-Sports: NO_FIXTURE_ID on Odds-API events (no invented fixture id).
- ClubElo: 0 event matches in this 10-event batch (not counted as SUCCESS).

## BLOCCATO

- SofaScore, FBref, UEFA, Diretta, Flashscore, Soccerway: 403 / challenge / HTTP error on ordinary GET. Recorded BLOCKED or HTTP_ERROR. No WAF/CAPTCHA bypass.

## NON ANCORA IMPLEMENTATO

- Per-player injury/lineup parsers (need a compatible source that actually returns those fields).
- Referee and advanced stats (PPDA, etc.) as first-class MODEL keys.
- Dedicated models for O/U, BTTS, corners, cards (data layer only).
- Club-Football form merge into independent MODEL (observations stay CONTEXT; PI engine still uses Football-Data priors). Expanding DI_MODEL_MERGE_KEYS for form would overwrite PI values.

## 10-event run (2026-09-10)

Processed: 10. Research fetches (typed/archive success): 16. Failures: 94. Missing adapters: 190. Denied (Understat URL): 10.

Club-Football-Match-Data: 10/10 bound prior rows (SUCCESS or PARTIAL). Football-Data: 6/10 form priors. Scrape typed SUCCESS: 0.

Observations written: 19 (club-football home/away gf_l5). Conflicts: 0. Temporal leakage tests: pass. Odds in MODEL: 0.

### Events in the run

1. Aston Villa vs Nottingham Forest ? Football-Data form L3/L5/L10; Club-Football PARTIAL (home_gf_l5). Independent Poisson already persisted: HOME 44.5% DRAW 27.4% AWAY 28.1%.
2. Liverpool vs Fulham ? Football-Data + Club-Football SUCCESS. Model HOME 49.7% DRAW 27.6% AWAY 22.6%.
3. Tottenham Hotspur vs Everton ? Football-Data + Club-Football SUCCESS. Model HOME 39.3% DRAW 30.0% AWAY 30.7%.
4. Sunderland vs Arsenal ? Club-Football SUCCESS; Football-Data NO_EVENT.
5. Bournemouth vs Brentford ? both archives OK.
6. Chelsea vs Hull City ? Club-Football SUCCESS; Football-Data NO_EVENT.
7. Crystal Palace vs Ipswich Town ? Club-Football SUCCESS.
8. Coventry City vs Brighton ? Club-Football SUCCESS.
9. Manchester United vs Manchester City ? both archives OK.
10. Leeds United vs Newcastle United ? both archives OK.

Open in UI (same event ids as production):

- https://betting-predict.vercel.app/events/b54ded61f9dc94423dfcb089
- https://betting-predict.vercel.app/events/aa61ed76290f6bad175de6c1
- https://betting-predict.vercel.app/events/6ad3005597157baf9d6cee11

## Tests

- `pnpm test`: 674 pass / 0 fail
- `pnpm lint`: 0 errors (pre-existing warnings elsewhere; unused imports in the research script were removed)
- `pnpm build`: ok

Coverage: homepage 200 != event, 403 BLOCKED, JSON-LD typed xG, mention-only PARTIAL, odds keys excluded from extract, JS shell DYNAMIC, identity FC alias, P0/budget 24, fallback chain, odds firewall, post-kickoff, conflicts, Club-Football same-day excluded, explanation does not invent injuries.

## Worker / Neon / Vercel

- Workers: 1 (pid 25892 + watchdog). This phase did not start a second worker.
- Neon: producer remains the PC; `runtime:publish` after code deploy.
- Vercel: deploy follows `git push origin main`.

## Gates (unchanged)

coverage >= 0.35, missing_keys <= 45, odds firewall, temporal firewall.
