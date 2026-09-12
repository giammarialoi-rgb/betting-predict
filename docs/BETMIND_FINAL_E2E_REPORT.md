# BetMind FINAL E2E Report — Golden Event

**Run at:** 2026-09-12T13:43:00.118Z  
**Branch:** `cursor/final-e2e-golden-event-8b24` (from `main` @ `b3a0cbd`, after PR #20)  
**Command:** `pnpm betmind:e2e`  
**Artifact:** `artifacts/golden-e2e/e2e-report.json`  
**Neon:** `NEON NON UTILIZZATO` (`neon_in_use=false`). No `DATABASE_URL`. StorageProvider = filesystem JSONL + in-process remote mirror.

This report uses only numbers produced by that run. Nothing below is padded or guessed.

---

## Golden Event

| Field | Value |
|---|---|
| `event_id` | `de3b08b74a8249c647ee0e42` |
| Home | AFC Bournemouth |
| Away | Brentford |
| Competition | `eng.1` (ESPN Premier League scoreboard) |
| Kickoff | `2026-09-12T14:00:00.000Z` |
| Sport | soccer |
| Source | espn |
| Status at run | UPCOMING |

Discovery scanned OpenLigaDB + ESPN + TheSportsDB and found **79** identified candidates. The picker took the earliest upcoming match with home/away/kickoff. Identity was not invented.

---

## Pipeline counts (this event)

| Step | Count | Evidence |
|---|---:|---|
| Events persisted | 1 | `appendEvent044=ok` |
| Research jobs | 1 | queued then `RESEARCHED` |
| Sources probed (audit) | 5 | OpenLigaDB, ESPN, TheSportsDB, ClubElo, Open-Meteo |
| Sources WORKING | 4 | OpenLigaDB, ESPN, TheSportsDB, Open-Meteo |
| Observations persisted | 4 | open-meteo CONTEXT (3) + sky-sports CONTEXT (1) |
| Dossiers local | 1 | `mirror/dossiers/de3b08b74a8249c647ee0e42.json` |
| Dossiers remote (verified readback) | 1 | in-process memory artifact (`repairMirror`) |
| Brain cycles | 1 | focused single-event path |
| PREDICTION | 0 | gates failed — not bypassed |
| NO PREDICTION | 1 | `failed_gates` recorded |
| Live updates | 0 | no in-play feed for this match at run time |
| Settlements | 0 | event not finished |
| Learning records | 0 | not settled |

Research batch: `fetches=2`, `observations_created=4`, `data_yield=0.211`.  
Dossier: `features=0` (no independent feature snapshot), `research_rows=19`, `data_quality_score=0.305`.

---

## Checklist (honest)

- [x] Neon excluded
- [x] One real event discovered and persisted
- [x] Research job created and executed
- [x] Real sources queried (existing adapters only)
- [x] Observations persisted (CONTEXT only; none entered independent MODEL)
- [x] `analysis_dossier` generated, validated, stored locally
- [x] Remote mirror protocol: persist → verify local → write remote → read back
- [x] Board row written separately (not used as a dossier)
- [x] Event-detail states: dossier OK (local + remote protocol); not faked from board
- [x] Brain path executed
- [x] Gates applied
- [x] **NO PREDICTION** — failed gates, no invented HDA
- [x] Live: unavailable (`no_in_play_feed`)
- [x] Settlement: unavailable (`event_not_finished`)
- [x] Learning: unavailable (`not_settled`)
- [x] `pnpm betmind:e2e` exits 0 with this checklist

Integrity tests (34/34): dossier-mirror, remote-mirror, event-detail-view, event-detail-remote-board, storage, golden-e2e-integrity.

---

## Source audit (existing adapters only)

Capability matrix is **extractable-only**. SofaScore / FBref / WhoScored were **not probed** and remain BLOCKED (WAF). No revive.

| source_id | status | http | extractable | key | probed |
|---|---|---:|---|---|---|
| openligadb | WORKING | 200 | matchID, team1, team2, matchDateTimeUTC | NOT_REQUIRED | yes |
| espn | WORKING | 200 | events, competitions | NOT_REQUIRED | yes |
| thesportsdb | WORKING | 200 | idEvent, strHomeTeam, strAwayTeam | NOT_REQUIRED | yes |
| open-meteo | WORKING | 200 | current_weather | NOT_REQUIRED | yes |
| clubelo | FAILED | 502 | — | NOT_REQUIRED | yes |
| sofascore | BLOCKED | 403 | — | NOT_REQUIRED | no |
| fbref | BLOCKED | 403 | — | NOT_REQUIRED | no |
| whoscored | BLOCKED | 403 | — | NOT_REQUIRED | no |
| football-data-co-uk | PARTIAL | — | — | NOT_REQUIRED | no (CACHE_ONLY) |
| club-football-match-data | PARTIAL | — | — | NOT_REQUIRED | no (CACHE_ONLY) |
| api-sports / the-odds-api | not in this probe set | — | — | KEY_MISSING on research (`API_KEY_NOT_CONFIGURED`) | — |
| remaining catalogue (RSS, Understat, OpenFootball, StatsBomb, …) | PARTIAL | — | — | NOT_REQUIRED | catalogued, not live-probed this cycle |

Research rows for the Golden Event recorded per-source UNAVAILABLE / NO_DATA / NO_EVENT honestly (e.g. RSS 200 but neither team pair in the item; ClubElo 502; Understat slug not guessed).

---

## Observations (all CONTEXT)

| feature_key | value | source | status | available_at |
|---|---|---|---|---|
| temp_c | 19.2 | open-meteo | CONTEXT | 2026-09-12T14:00:00.000Z |
| precip_mm | 0 | open-meteo | CONTEXT | 2026-09-12T14:00:00.000Z |
| wind_kmh | 24.1 | open-meteo | CONTEXT | 2026-09-12T14:00:00.000Z |
| news_other | Schuster makes Brentford PL debut at unchanged Bournemouth LIVE! | sky-sports | CONTEXT | Sat, 12 Sep 2026 13:20:00 BST (as returned by RSS) |

News stays `CONTEXT_ONLY`. It did not become a probability or a supporting causal claim.

---

## Dossier vs board

- **Board** has lite identity: Bournemouth vs Brentford, `eng.1`, kickoff, bucket `ANALYZED`.
- **analysis_dossier** has event identity + 19 research rows with lineage + data quality 0.305 + independent_model.probability = `null` + explicit `NO DATA AVAILABLE` note.
- Validator rejected board-shaped objects as dossiers (tests).
- Event detail can show this dossier; it does not invent HDA from the board.

---

## Prediction / gates

`predictIndependentForEvent` did not produce an independent model (feature coverage unavailable / INSUFFICIENT_DATA).

Failed gates (not bypassed):

1. `independent_model`
2. `predict_ok`
3. `feature_coverage`
4. `no_failed_research_as_model`

Outcome: **NO PREDICTION**. Journal + `predictions.jsonl` row with `model_version=NO_PREDICTION`, `probability_model=null`, `reason_codes` listing the failed gates. No Poisson/DC/NegBin/Logistic/GBM auto-promote.

---

## Live / settlement / learning

The Golden Event was **upcoming** at run time (kickoff 14:00Z). There was no real in-play feed and no finished score, so:

- live = unavailable
- settlement = unavailable
- `/conclusi` has nothing new from this event
- learning_record = not written (no single-match weight hack)

That is the correct firewall: a historical or live result was not invented to “complete” the path.

---

## Remote mirror

| Item | Result |
|---|---|
| Local persist + verify | YES |
| `BLOB_READ_WRITE_TOKEN` | **KEY_MISSING** |
| Remote backend used | `memory` (in-process), so the write→read protocol could be proven |
| Vercel Blob write | **not performed** |
| `repairMirror` | YES on the memory artifact (local YES, remote NO → write → readback YES) |

### ERROR / CAUSE / EVIDENCE / REMEDIATION

**ERROR:** Vercel Blob dossier publish not executed in this environment.  
**CAUSE:** `BLOB_READ_WRITE_TOKEN` KEY_MISSING (and no OIDC + `BLOB_STORE_ID`).  
**EVIDENCE:** e2e report `blob_credentials=KEY_MISSING`, `remote_backend=memory`; ingest without override still returns `blob_token_missing` / 503 (test).  
**REMEDIATION:** Set Blob credentials + `BETMIND_RUNTIME_INGEST_URL` + publish secret on the PC publisher; `publishRuntimeStatus` now includes local dossiers in the ingest body; board-only publish merges and does not wipe dossiers. Re-run `pnpm betmind:e2e` or `repairMirror(event_id)` after keys are present. Do not treat memory-protocol success as a production Blob write.

**ERROR:** Independent PREDICTION not produced.  
**CAUSE:** Feature coverage / independent model gates failed; PI priors + event features insufficient.  
**EVIDENCE:** `failed_gates` list; dossier `features=[]`; `independent_model.probability=null`.  
**REMEDIATION:** Acquire pre-kickoff eligible features (ClubElo CSV, FD archive, mapped Understat) with real `available_at`. Do not invent xG or promote a model without OOS evidence.

**ERROR:** Live / settlement / learning not written.  
**CAUSE:** Event not finished; no in-play snapshot from the source.  
**EVIDENCE:** status `UPCOMING`, kickoff `2026-09-12T14:00:00.000Z`.  
**REMEDIATION:** Re-run after FT with the same `event_id` when ESPN/OpenLigaDB publish a real score. Do not synthesize live or settle from news copy.

---

## Home health (distinct layers)

Control Center now reports six separate layers (not one “online” blob):

1. **App** — this Next.js process  
2. **Runtime** — PC heartbeat / remote mirror freshness  
3. **Brain** — worker cycle state  
4. **Sources** — adapter overlay (`/sources`)  
5. **Research** — queue queued vs researched  
6. **Dossier-mirror** — local count vs remote count vs `KEY_PRESENT`/`KEY_MISSING`

App online ≠ Runtime online ≠ Brain online ≠ dossier on Blob.

---

## What this does **not** claim

- Not a demonstrated betting edge  
- Not a Vercel Blob production write (token missing here)  
- Not a model promotion  
- Not a finished-match settlement  
- Not thousands of events — **one** Golden Event, as specified  

Next scale step is the same path on more events only after this `event_id` can settle from a real score.
