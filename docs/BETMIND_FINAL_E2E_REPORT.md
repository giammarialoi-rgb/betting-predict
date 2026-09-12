# BetMind FINAL E2E Report — Golden Event (live path)

**Updated:** 2026-09-12 (live ingest wired; FT not invented)  
**Branch:** `cursor/betmind-live-settle-learn-55f4` (from `main` @ `2f06885`, after PR #21 + #22)  
**Commands:** `pnpm betmind:e2e` · `pnpm betmind:e2e:live`  
**Neon:** `NEON NON UTILIZZATO`. No `DATABASE_URL`. Lab B filesystem JSONL is SoT; Vercel reads Blob `betmind/runtime-mirror.json`.

This report uses only numbers produced by the pre-match Golden Event run plus a real ESPN scoreboard read during this close-out. Nothing below is padded or guessed.

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
| Source (identity) | espn |
| Pre-match status | UPCOMING (PR #21 run at 13:43Z) |
| Live source at close-out | ESPN `site.api` scoreboard — **WORKING** HTTP 200 |

ESPN event id `401879285` (`Brentford at AFC Bournemouth`). Honest live probes (no invented FT):

- Lab PC publish (folded in): **LIVE 0–1**, ~39', `STATUS_FIRST_HALF`, source `espn_scoreboard`. Blob already had `dossiers=1` after merge. Payload fields: `observatory.next_events.status=LIVE` + `payload.live_snapshots` (1 row). Event API stayed `dossier_state=ok` / NO_PREDICTION.
- Agent `pnpm betmind:e2e:live` @ 2026-09-12T14:49:43.137Z: **LIVE 1–1**, minute `45'+4'`, ESPN HTTP 200, `parsed=16` `matched=1`.

Vercel snapshot now reads **both** artifact `live_states` and Lab `payload.live_snapshots`, overlays `/live` board rows, and treats a recent live snapshot as freshness so health is not falsely OFFLINE. `completed=false` — no FT invented.

---

## What shipped in this close-out

1. **Live** — ESPN parser now extracts published score, clock, period, and status. `ingestLiveStates` matches board identity (exact/alias pair, no guessing), writes `mirror/live-states.jsonl` + `updates.jsonl`, overlays `status` / score / minute on board rows so `/live` can list in-play matches.
2. **Settlement** — `settleFromLiveState` runs **only** when ESPN (or another adapter) publishes `completed/post` **and** both scores. NO_PREDICTION still writes a settlement (`selection=null`, `outcome=UNSETTLED`) plus a learning record. No invented FT.
3. **Conclusi / Learning** — remote artifact slices `settlements` + `learning_cases` are merge-safe. Snapshot on Vercel reads payload arrays, then those slices. `/conclusi` and `/learn` therefore show Blob-backed rows, not only local FS.
4. **Event detail (iPhone)** — SSR and `/api/betmind/event/:id` load the **dossier from Blob** (`dossier_state=ok`) when present. They also attach live / settlement. A present dossier is never classified as red `dossier_not_mirrored`. Honest **NO PREDICTION** is rendered as its own card.
5. **Publish safety** — `runtime:publish` / ingest merge **dossiers + live_states + settlements + learning_cases**. Empty incoming arrays do not wipe remote rows. Unreadable existing artifact → fail closed (same as PR #22).
6. **E2E / Lab refresh** — `pnpm betmind:e2e` probes ESPN live after pre-match. `pnpm betmind:e2e:live` is the Golden Event live→settle→learn command. `pnpm betmind:live` (and `betmind:live:loop`) refresh in-play board events from ESPN and merge-publish without wiping dossiers. Lab temp `src/scripts/_live_golden_espn.ts` is kept as an alias (`pnpm betmind:live:golden`).

---

## Pipeline counts (pre-match run — unchanged, honest)

From `artifacts/golden-e2e/e2e-report.json` @ 2026-09-12T13:43:00.118Z:

| Step | Count | Evidence |
|---|---:|---|
| Events persisted | 1 | `appendEvent044=ok` |
| Research jobs | 1 | queued then `RESEARCHED` |
| Sources probed (audit) | 5 | OpenLigaDB, ESPN, TheSportsDB, ClubElo, Open-Meteo |
| Sources WORKING | 4 | OpenLigaDB, ESPN, TheSportsDB, Open-Meteo |
| Observations persisted | 4 | open-meteo CONTEXT (3) + sky-sports CONTEXT (1) |
| Dossiers local | 1 | `mirror/dossiers/de3b08b74a8249c647ee0e42.json` |
| PREDICTION | 0 | gates failed — not bypassed |
| NO PREDICTION | 1 | `failed_gates` recorded |
| Live updates (that run) | 0 | match was UPCOMING |
| Settlements (that run) | 0 | event not finished |
| Learning records (that run) | 0 | not settled |

---

## Live / settlement / learning (this close-out)

| Step | Status | Evidence |
|---|---|---|
| Live ingest path | **wired + proven on real ESPN 200** | `artifacts/golden-e2e/e2e-live-report.json`: BOU 1–1 BRE, `45'+4'`, `status=LIVE`, `http=200` |
| `/live` | **ready** | Board rows get `status=LIVE` + score + minute from overlay. Filter already matches `/live\|in_play\|playing/i` |
| Settlement | **ready, deferred** | Match was **not FT** at probe. Do not invent 90' score. Re-run `pnpm betmind:e2e:live` after ESPN `STATUS_FINAL` |
| `/conclusi` | **ready** | Reads `recent_settlements` or artifact `settlements` from Blob |
| `/learning` (`/learn`) | **ready** | Reads `learning_cases` slice the same way |
| Event detail | **ready** | Dossier from Blob + NO PREDICTION + live section; board-only only if dossier truly missing |

### SETTLE DEFERRED

```
pnpm betmind:e2e:live -- --event de3b08b74a8249c647ee0e42
```

When ESPN publishes `completed=true` and both scores, that command writes settlement + learning and merge-publishes them. Until then, settlement count stays 0 for an honest reason: **event_not_finished**.

Live E2E on this agent VM used `remote_backend=memory` because `BLOB_READ_WRITE_TOKEN` is `KEY_MISSING` here. Lab PC must run the same command (or `runtime:publish`) so Vercel Blob gets the live slice. The merge protocol is proven in tests.

---

## Remote mirror slices (merge-safe)

| Slice | Wipe-safe | Reader |
|---|---|---|
| `dossiers` | yes (PR #22 + this PR) | `/api/betmind/event/:id` |
| `live_states` | yes | `/live`, event detail, snapshot overlay |
| `payload.live_snapshots` | yes (merged with `live_states`) | Lab PC already published this field — Vercel reads it |
| `settlements` | yes | `/conclusi`, event detail |
| `learning_cases` | yes | `/learn`, event detail |
| `board_events` | replaced by latest board (intended) | `/events` |

Board-only heartbeat with empty arrays **must not** drop dossiers, live rows, or settled rows.

---

## UI routes on Blob-backed Vercel

| Route | Expected when Blob is published |
|---|---|
| `/events/de3b08b74a8249c647ee0e42` | Dossier + independent **NO PREDICTION** + live score/minute if mirrored. Not a red-only `dossier_not_mirrored` page when the dossier is on Blob |
| `/live` | Golden Event listed as in corso when live overlay is present |
| `/conclusi` | Empty until real FT settlement is published |
| `/learn` | Empty until learning_record after FT |
| `/events` | Board identity (not a synthesized dossier) |

---

## What remains blocked / deferred

| Item | Why | Not a bypass |
|---|---|---|
| Independent PREDICTION | Failed gates (`independent_model`, `predict_ok`, `feature_coverage`, `no_failed_research_as_model`) | Do not lower gates |
| Vercel Blob write in this cloud environment | `BLOB_READ_WRITE_TOKEN` often `KEY_MISSING` here | Protocol proven in-memory; PC publisher must POST ingest |
| SofaScore / FBref / WhoScored | HTTP 403 WAF | Not probed, not revived |
| Settlement / Conclusi row for Golden Event | Match still in play (1–1, 45'+4') — no FT | Re-run live E2E after FT |
| Neon | Banned | Filesystem + Blob only |

---

## Integrity

Tests added: ESPN live/FT parse, live ingest + overlay, NO_PREDICTION settlement, merge-safe remote slices, Vercel event-detail `dossier_state=ok` + live.

Pre-match integrity from PR #21 still applies (34 tests + this file).

---

## What this does **not** claim

- Not a demonstrated betting edge  
- Not a model promotion  
- Not an invented final score  
- Not a production Blob write from this agent VM unless credentials are present  

The complete **code path** is on main via this PR. The complete **data path** for settlement waits on a real ESPN FT for `de3b08b74a8249c647ee0e42`.
