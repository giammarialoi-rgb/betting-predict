# REAL PIPELINE AUDIT

Audit of BetMind as of `main` @ `4de9b72` (2026-09-12). Read-only of production behavior. No second architecture proposed here — this document maps what already exists and why a future match is not analyzed end-to-end today.

**Storage:** Filesystem StorageProvider (`audit/external/task-044` JSONL). **NEON NON UTILIZZATO.** Remote SoT on Vercel is one Blob artifact (`betmind/runtime-mirror.json`).

---

## CURRENT FLOW

Production spine (wired, but only when the Lab B PC worker runs a full brain cycle):

```
Discovery (Odds API 049 / collector-042  OR  free ESPN / OpenLigaDB / TheSportsDB)
  → persist events.jsonl (Lab B)
  → Research orchestrator (Phase 8 lanes + ClubElo + Open-Meteo + RSS + acquisition-cache attach)
  → analyzeAllLabB045 → predictIndependentForEvent (INDEPENDENT_POISSON_v1)
       market triangulation is COMPARE-only (never copied into probability_model)
  → runDecisionEngine048 → decisions.jsonl
  → buildAnalysisDossier (join event + prediction + reasoning + research + decision)
  → persistAndMirrorDossier + publishRuntimeStatus / publishLiveSliceLight
  → Vercel Blob runtime-mirror.json
  → GET /api/betmind/snapshot | /api/betmind/event/:id | UI Eventi / Detail / Analizzati
```

Secondary paths that look like the same product:

| Path | Entry | Writes strong analysis? |
|------|--------|-------------------------|
| Brain cycle | `pnpm brain:once` / `brain-worker.ts` → `runBrainCycle051` | Yes, all Lab B events |
| Golden E2E | `pnpm betmind:e2e` → `runGoldenEventE2E` | Partial: research + dossier **before** predict; skips 045/048 |
| Light refresh | `POST /api/betmind/refresh-events` | No — historical frequencies only; `brain_online_claimed: false` |
| Live/settle | `pnpm betmind:live` | ESPN in-play + settle/learn; light-merge publish |
| Phase 9 | `pnpm betmind:backtest` | Historical backtest only |
| Acquisition engine | `pnpm acquire:engine` | Cache only; analyze does not run |
| Permanent-live APIs | `/api/permanent-live/*` | Read-only Lab B observatory |

There is **no** `pnpm analyze:event -- <EVENT_ID>` and **no** `assertPreMatchData`. There is **no** unified `SourceResult` status (`ACTIVE | PARTIAL | UNAVAILABLE | BLOCKED | NOT_CONFIGURED | ERROR`).

---

## BROKEN LINKS

1. **No single-event production command.** Brain analyzes *every* Lab B event. Golden E2E picks one event but does not call `analyzeAllLabB045` or `runDecisionEngine048`.
2. **Golden E2E builds the dossier before inference.** `buildAnalysisDossier` runs with empty reasoning → `features=0`. Then `decidePrediction` runs `predictIndependentForEvent` **without** `diObservations` (045 does pass them). Latest artifact (`artifacts/golden-e2e/checklist.md`): Bournemouth vs Brentford, `NO PREDICTION`, gates `independent_model,predict_ok,feature_coverage`.
3. **Feature universe often absent on a clean checkout.** `loadPiMatches` reads `audit/external/task-044/predictive-intelligence/datasets/matches.jsonl`. That file is not in git. Soccer adapter requires ≥500 rows or returns `SOCCER_DATASET_INSUFFICIENT`. Import exists (`importFootballDataDataset`) but is not on the live/golden path.
4. **Primary discovery is Odds-API-gated.** Massive-049 / collector-042 need `THE_ODDS_API_KEY`. Free discovery exists (golden-e2e / light refresh) but is not the brain default.
5. **Publish can hang / 413 on full `runtime:publish`.** Light merge (`publishLiveSliceLight`) is the safe Blob update. Heartbeat/full publish can still drop remote dossiers if a caller passes an empty `dossiers[]` without going through `mergeDossierRows` (write path now merge-safe; some older scripts are not the vertical-slice entry).
6. **Analizzati lists light analysis only.** `listAnalyzedEvents` reads `data/light-analysis/analyses.jsonl` (finished-match frequencies). Real `analysis_dossier` rows are ignored. Copy tells the user to press «Aggiorna eventi».
7. **Event detail on Vercel is `board_only` when `dossiers[]` is empty.** Home/Eventi can show board `probability_model` while detail honestly hides HDA. Confusing, not invented — but the slice is incomplete.
8. **Health systems contradict each other.**
   - `GET /api/health` pings **Neon** (`pingDatabase`) and can return `ok: true` / `db: ok` while BetMind runtime is OFFLINE.
   - `GET /api/betmind/health` is the real runtime strip (disk or stale Blob).
   - AppShell hardcodes `webOnline={true}`. `deriveSystemStrip` hardcodes `webApp: "ONLINE"`.
   - `/api/permanent-live/health` is a third disk-only lab surface.
9. **`assertPreMatchData` does not exist.** Leakage guards are scattered (`assertAsOf`, PI `assertNoMarketInputsInPredictionContext`, research `asOfAfterKickoff`). A snapshot can reach the model without a single pre-match assertion.
10. **Source statuses are not one enum.** Acquisition uses `OK|PARTIAL|BLOCKED|AUTH_REQUIRED|…`. Research uses `QUEUED|FETCH|OK|BLOCKED|MISSING_ADAPTER`. Golden audit uses `WORKING|PARTIAL|FAILED|UNAVAILABLE|BLOCKED`. Data-intelligence catalog uses `ACTIVE|UNAVAILABLE|…`. Nothing prevents a UI from treating a failed probe as ACTIVE.

---

## DUPLICATE IMPLEMENTATIONS

Keep one; do not add another.

| Concern | Canonical (wire this) | Parallel / lab-only (do not replace) |
|---------|------------------------|--------------------------------------|
| Discover future football | `golden-e2e/discover.ts` (ESPN, OpenLigaDB, TheSportsDB) | factory-049 Odds discovery; light-analysis refresh; catalog-055 |
| Collect / research | `runEventResearchBatch` + acquisition-engine lanes | Phase 6/7 scripts; permanent-live-discover |
| Normalize live event | `PermanentEvent044` via `appendEvent044` | API-Sports `normalizeFixtures057`; FD.org provider normalizer |
| As-of / leakage | `src/lib/as-of.ts` + PI `features/asof.ts` | Phase 9 firewall; bankroll leakage; 044 `classifyVsLock044` |
| Features (live MODEL) | `buildFeatureVectorPi` + `synthesizeFeatureBag` | `features/engine-v2|v3|v4` (blind lab) |
| Model | `predictIndependentForEvent` → `INDEPENDENT_POISSON_v1` | Dixon-Coles / GBM / logistic (Phase 9); market-only 044 predict |
| Decision | `runDecisionEngine048` / `decisionFromPrediction048` | live-043 `WATCH`; bankroll-053 why-machine |
| Dossier | `buildAnalysisDossier` | Light analysis; board_summary (explicitly not a dossier) |
| Publish | `persistAndMirrorDossier` + `writeRemoteMirror` (merge-safe) | `runtime:publish` full rebuild; `mirror-dossiers-neon.ts` (banned) |
| Health | should be one builder | `/api/health` Neon ping; `/api/betmind/health`; `/api/permanent-live/health` |

---

## REAL SOURCES vs MOCK/FIXTURE

| Source | Adapter | Auth | Live identity? | Enters independent MODEL? |
|--------|---------|------|----------------|---------------------------|
| ESPN scoreboard | `acquisition-engine/sources/espn.ts` | none | Yes (unofficial JSON) | No (identity / live / CONTEXT) |
| OpenLigaDB | `…/openligadb.ts` | none | Yes | No |
| TheSportsDB | `…/thesportsdb.ts` | free key `3` in URL | Yes | No |
| ClubElo | `…/clubelo.ts` + research lookup | none | Ratings CSV | Yes when as-of Elo is ELIGIBLE |
| Open-Meteo | `…/open-meteo.ts` | none | Weather | CONTEXT only |
| RSS (ANSA/BBC/Guardian/…) | `…/rss.ts` | none | News | CONTEXT only |
| Understat | Phase 8 lane | none (XHR) | xG | Overlay when observation exists |
| football-data.co.uk | PI dataset + acquisition lane | none | Historical priors | Yes (lagged form / goal rates) |
| football-data.org | lane + provider | `FOOTBALL_DATA_ORG_TOKEN` | Fixtures | No if `AUTH_REQUIRED` |
| API-Sports / API-Football | Phase 8 + TASK 057 | `API_SPORTS_KEY` / `API_FOOTBALL_KEY` | Injuries/lineups | Yes when ELIGIBLE + clock-proven |
| The Odds API | 039/042/045/049 + odds lane | `THE_ODDS_API_KEY` | Markets | **Never** — COMPARE only |
| SofaScore / Flashscore / Soccerway | catalog-055 | — | Policy-blocked | No (no WAF bypass) |
| `MockSportsProvider` | `src/providers/mock` | — | Fixture | Tests / `ingest:mock` only |
| Club-Football-Match-Data | local clone | — | CACHE_ONLY | No if missing |

Latest golden source audit: 21 catalogued, 4 working (free adapters).

---

## REQUIRED ENV VARS

| Variable | Required for vertical slice? | Effect if missing |
|----------|------------------------------|-------------------|
| none of ESPN / OpenLigaDB / TheSportsDB | No | Discovery `UNAVAILABLE` if HTTP fails |
| `THE_ODDS_API_KEY` | No (market only) | Market `NOT_CONFIGURED`; decision may be NO BET / INSUFFICIENT |
| `API_SPORTS_KEY` / `API_FOOTBALL_KEY` | No | API-Sports lanes `NOT_CONFIGURED` |
| `FOOTBALL_DATA_ORG_TOKEN` | No | FD.org `NOT_CONFIGURED` |
| `BLOB_READ_WRITE_TOKEN` | For remote board | Local dossier OK; remote `DOSSIER_NOT_MIRRORED` / `blob_token_missing` |
| `BETMIND_RUNTIME_PUBLISH_SECRET` + `BETMIND_RUNTIME_INGEST_URL` | PC → Vercel ingest | Local FS SoT still writes; Vercel stays OFFLINE |
| `BETMIND_STORE_ROOT` | Optional | Default `audit/external/task-044` |
| `RESEARCH_EVENT_BUDGET` | Brain cycle only | Caps research; single-event path ignores |
| `DATABASE_URL` | **Forbidden** | Ignored. Neon banned. |
| `REAL_MONEY` | Must stay false | Paper only |

---

## RUNTIME DEPENDENCIES

- Node + pnpm; `tsx` for scripts; Next.js App Router for UI/API.
- Filesystem Lab B JSONL (`getStorage()` / `loadStore044`).
- Public HTTP GET to ESPN / OpenLigaDB / TheSportsDB / ClubElo / Open-Meteo / football-data.co.uk (ordinary GET; 403/CAPTCHA stay BLOCKED).
- Optional paid HTTP: Odds API, API-Sports, football-data.org.
- PI historical `matches.jsonl` (≥500 rows) for soccer adapter ACTIVE.
- No Neon. No WAF bypass.

---

## PUBLISH DEPENDENCIES

- Local: `getStorage(root).upsertDossier` + `upsertBoardEvent`.
- Remote: `writeRemoteMirror` → Vercel Blob **or** in-process memory override (tests). Merge is by `event_id`; empty incoming must not wipe existing dossiers (`mergeDossierRows`, `dossier_merge_empty` fail-closed).
- Ingest: `POST /api/betmind/runtime/ingest` with shared secret.
- Light merge preferred (`publishLiveSliceLight`) so Lab does not hang/413. Full `pnpm runtime:publish` rebuilds the whole board.

If dossier is not on the remote artifact: UI must say **DOSSIER_NOT_MIRRORED** / `board_only` — never synthesize `analysis_dossier` from `board_summary`.

---

## EXACT ROOT CAUSE

A future match is not analyzed end-to-end today because **the production functions are not composed into one future-match slice**.

Concretely:

1. The only path that writes independent probabilities + decisions + a real dossier in the correct order is the **brain cycle** (`analyzeAllLabB045` then `runDecisionEngine048` then dossier). That cycle is Odds-API-centric, all-events, and PC-worker-shaped.
2. The only path that picks **one real free-source event** (Golden E2E) **inverts the order** (dossier before model), **omits DI observations**, **omits Decision-048**, and often hits **empty PI `matches.jsonl`** → `FEATURES_TOO_SPARSE` / `NO_PREDICTION`.
3. The UI then shows either light historical % (Analizzati) or a board row without a mirrored dossier (Detail `board_only`).
4. `/api/health` can still report success via a Neon ping, which is not the pipeline.

Until those four links are wired — discover one future event → collect/research → as-of snapshot + `assertPreMatchData` → 045 analyze → 048 decision → `analysis_dossier` → merge-safe publish → honest health/Analizzati — the app cannot take **one real future match** and show the full result.

This is not a missing Poisson or a missing ESPN parser. Those exist. The slice is uncomposed.
