# PHASE 4 AUDIT — Real event research pipeline

Date: 2026-09-10

Scope: reconstruct what BetMind actually does today, before claiming more sources or more coverage.

## Why FONTI CONSULTATE = 0 can sit next to INFORMAZIONI UTILIZZATE = 4

This is not a UI rounding bug. Two independent telemetry streams are mixed in one dossier.

| UI label | Counts | Disk source |
|---|---|---|
| Informazioni utilizzate | Features with entered_model and a numeric value | reasoning snapshot built during analyze |
| Fonti consultate / sources_attempted | Rows in research-status.jsonl for that event_id | Written only by runEventResearchBatch |

Analyze runs on every Lab B event inside runMassive049Cycle BEFORE research.

Research then runs on at most 8 upcoming events (maxEvents: 8 in brain-051/cycle.ts).

Football-Data priors are loaded in predict-live.ts from matches.jsonl even when no research row exists.

So a UEFA match (Omonoia vs Celta, Slavia vs Lens) can receive 4-69 rolling features from the global historical file (or sparse leftovers) and zero research-status.jsonl rows.

The Italian copy then says "BetMind ha consultato 0 fonti" while listing four archive-derived labels.

Worse: when Football-Data IS logged, the adapter marks SUCCESS if matches.jsonl exists, not if THESE TWO TEAMS have prior matches. A Champions League fixture can inherit a file-level OK while contributing no event-specific form.

Homepage SITE_PROBE (UEFA CL landing page HTTP 200) was copied onto every event in the batch. Phase 3F marked those PARTIAL, but they are still not match-page research.

## Pipeline table

| Pipeline step | Real | Stub | Cache | Broken | Missing |
|---|---|---|---|---|---|
| Event discovery | Odds API pull when budget allows | Catalog 054/055 coverage refresh | Skip if catalog under 1.5h | Budget stop | Events never pulled stay un-researched |
| Identity | pl045 hash; alias table for big-5 leagues | live:slug when unmatched | — | UEFA keys unmapped to PI divisions | SofaScore / API-Sports / FBref / Understat fixture IDs |
| Source selection | 13 executed ids in research batch | 19 MISSING_ADAPTER catalogue rows | — | File-exists treated as event data | Production match-page adapters |
| Fetch | Open-Meteo HTTP; ClubElo CSV; Odds discovery | POLICY_DENIED rows | API-Sports disk; matches.jsonl | 403 SofaScore/FBref | Per-event API-Sports network without fixture_id |
| Event matching | Odds source_event_id | Homepage probe copied to 8 events | — | UEFA teams unresolved live ids | Fixture ID crosswalk |
| Extraction | PI rolling aggregates; Poisson | Probe regex on homepage HTML | Cached JSON | Form claimed without team priors | Match-page xG / injuries / lineups |
| Timestamps | DATE_ONLY cutoff; ClubElo rating_date | — | Retrieval time is not publish time | API-Sports without clock = NOT_ELIGIBLE | Exact quote clocks for most sources |
| Normalization | Quote + team alias | — | — | — | Provider ID map |
| Reconciliation | DI primary-source pick | No agreement engine | — | — | Cross-source injury/xG compare |
| Features | Football-Data L3/L5/L10 from priors excluding target | UNAVAILABLE placeholders | matches.jsonl | Sparse UEFA may still pass/fail gate independently | Provenance match ids on every feature |
| Eligibility | coverage >= 0.35; missing <= 45 (DO NOT LOWER) | — | — | — | — |
| Model gate | Unchanged | — | params JSON | — | — |
| Inference | INDEPENDENT_POISSON_v1 | — | — | — | Feature SHAP |
| Prediction | predictions.jsonl + reasoning snapshot | INSUFFICIENT placeholders persisted | — | Stale worker blocked by 3E.1 | — |
| Explanation | Deterministic from dossier | "ha raccolto" even when only archive | — | Mixes archive features with live source counts | Origin split live vs historical vs derived vs market |
| Neon | upsert compact dossier | Silent upsert warn | — | Old worker overwrote payloads | Queue counters |
| UI | Italian dossier | Raw enums under details | Neon on Vercel | 0 fonti / 4 dati | Queue, researched-today, origin sections |

## Execution order (brain cycle)

1. planCycle051
2. runMassive049Cycle — discover (optional) then ingest then analyzeAllLabB045 (all events) then decisions
3. Catalog 054/055 (optional)
4. runEventResearchBatch — max 8 of first 20 upcoming
5. mirrorDossiersToNeon
6. publishRuntimeStatusNow

Analyze does not wait for research. Research does not backfill events 9+.

## What is actually downloaded vs catalogued

Real HTTP when run: Open-Meteo, ClubElo CSV, Odds API (discovery/market), gated homepage probes.

Cache only: Football-Data matches.jsonl, API-Sports injuries/lineups, Club-Football-Match-Data folder presence.

Catalogue stubs: WhoScored, Opta, The Athletic, Diretta (policy), Sky, ANSA, and others.

Never match-page: SofaScore / FBref / Understat / UEFA probes hit homepages.

## Phase 4 required corrections (from this audit)

1. Split live research / historical archive / derived / static / market in the dossier object and Italian text.
2. Football-Data and ClubElo must match this event's teams, not file presence.
3. Research queue: DISCOVERED to QUEUED to RESEARCHING to RESEARCHED, processing more than 8 over successive cycles.
4. Stop treating homepage 200 as event data. Event-page fetch must validate both team names.
5. Persist identity: canonical_id, aliases, competition, provider ids only when known (never invented).
6. Feature provenance: source, available_at, origin, entered_model.
7. Control Center: queued / researched / live sources today.
8. Do not lower model gates. If still sparse after real lookup, say exactly why.

## Implementation status (same day)

Audit table above is the pre-change truth. After Phase 4 code:

- Research queue budget is 24 per cycle (not a silent 8-event stop). Unresearched upcoming events are processed first; remaining wait for later cycles.
- Football-Data and ClubElo success require these teams, not file presence.
- Homepage HTTP 200 without both team names is NO_EVENT. Understat has no event-page URL without a fixture id.
- Dossier splits live research / historical archive / derived / static / market.
- Feature rows can carry derived_from prior match ids. Target match is excluded.
- Model gates unchanged: missing_keys > 45 or coverage < 0.35 → INSUFFICIENT.

