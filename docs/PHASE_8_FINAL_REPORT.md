# Phase 8 mega — final report

**NEON NON UTILIZZATO.**

This is not a claim that the product is “fully working.” It is an evidence record of what this branch implemented and what this host measured.

| Field | Value |
|---|---|
| Branch | `cursor/phase-8-mega-neon-free-db12` |
| Base | `main` @ `dc360a2` |
| Report written | 2026-09-11 |
| Storage | filesystem `StorageProvider` → Lab B JSONL + `data/` + `mirror/` |
| Neon | **NEON NON UTILIZZATO** (not store, not fallback) |

## 1. Commits

Atomic series on this branch:

1. `736fbb7` — STEP1–2 StorageProvider + audit (`docs/PHASE_8_STORAGE_AUDIT.md`)
2. `d801856` — STEP2 Neon removed from worker / light / dossier / runtime mirror
3. `0013884` — STEP3–20 queue, capabilities, models, value gate, `/conclusi`, tests
4. (this report + verification artifact + verify-script expansion)

Exact HEAD is the last commit on the PR after this file lands.

## 2. Tests / build / lint

| Check | Result |
|---|---|
| New Phase 8 mega + storage tests | **82/82 pass** (targeted run) |
| Full `pnpm test` | **777 pass, 16 fail, 15 skip** |
| `pnpm build` | **OK** (`/conclusi` in route table) |
| `pnpm lint` | **2 errors, 24 warnings** — errors are pre-existing (`page.tsx` React Compiler memo; `clubelo.ts` prefer-const). Not introduced by this slice. |

### Full-suite failures (honest)

These fail because this VM has **empty Lab A / Lab B ledgers** (`audit/external` is gitignored and `events.jsonl` is empty) and a **stale Fonti registry test** (fbref/directa were pruned from `buildSourceRegistry` in an earlier PR):

- TASK 057 / 046 / 047 / 048 / 049 / 051 / 052 / 053 / 054 / 055 / 056 Lab A fingerprint `0 !== 114`
- TASK 018 annual `withData.length > 0` on missing Club-Football corpus
- data-intelligence: `fbref` missing from pruned registry

They are **not** Neon regressions and were not used to weaken gates.

## 3. Real source audit (this host, 2026-09-11)

Script: `pnpm phase8:mega-verify` → `artifacts/phase-8/mega-verification.json`.

Ordinary GET only. No WAF bypass. HTTP 200 without both teams is not SUCCESS.

| Source | HTTP | Parsed / upcoming | Notes |
|---|---|---|---|
| ESPN scoreboards (14 leagues) | 200 | 19 upcoming after kickoff filter | Unofficial JSON |
| TheSportsDB `eventsnextleague` (9 leagues) | 200 | 9 upcoming | CONTEXT meta |
| OpenLigaDB `getmatchdata` (9 competitions) | 200 | 43 upcoming | German + extras |
| Football-Data.co.uk (in-research) | fail 20/20 | 0 | No local CSV / bind this host |
| Open-Meteo | 5 ok / 15 fail | weather when coords exist | CONTEXT |
| Understat | 8 ok / 3 fail / 9 denied | HTML/XHR; not invented xG | |
| API-Sports | 20 fail | no key | AUTH / no fixture |
| ClubElo | 20 fail | `MISSING_FILE` | |
| SofaScore / FBref / WhoScored | not probed as success | capabilities `[]` | 403 = BLOCKED policy |

## 4. Research cycle numbers

| Metric | Number |
|---|---|
| Upcoming discovered (deduped pairs) | **69** |
| Queued (every upcoming stays on the queue) | **69** |
| Events researched this cycle | **20** (not padded) |
| Observations created in cycle | **84** |
| Observations on disk for those 20 | **101** |
| Real event observations | **28** |
| Historical observations | **56** |
| Derived | **0** |
| Events with real event-level data | **5** |
| Events with historical data | **8** |
| Cycle data yield | **0.221** |
| Research fetches | 16 |
| Honest failures | 355 |
| Denied (policy / understat) | 9 |
| Missing adapters | 0 |

Sample researched: VfL Bochum vs Greuther Fürth; Magdeburg vs Kaiserslautern; Eintracht Braunschweig vs Dynamo Dresden; Racing Santander vs Alavés; Fortuna Düsseldorf vs MSV Duisburg.

No invented xG / injuries / lineups / referees. No placeholder percentages.

## 5. Features / models / backtest / promotion

| Item | Evidence |
|---|---|
| Temporal firewall | `assertNoFutureDataInModel` throws `FUTURE_DATA_MUST_NOT_ENTER_MODEL` |
| Odds firewall | `MARKET_INPUT_FORBIDDEN` on odds keys |
| Independent Poisson | Still the only **live** champion (`INDEPENDENT_POISSON_v1`) |
| Dixon–Coles | Implemented; requires train N ≥ 40 |
| NegBin | Implemented; requires overdispersion + N ≥ 80 |
| Logistic | Existing challenger; used only with trained weights |
| GBM stumps | Implemented; requires N ≥ 200 and ≥6 keys — **not trained this host** |
| OOS / walk-forward | Existing `walk-forward.ts`; **not re-run** — no PI `matches.jsonl` on this VM |
| Promotion | Ledger `CANDIDATE→TRAINED→VALIDATED→OOS→SHADOW\|REJECTED`. **PROMOTED: 0. REJECTED on leakage: tested. Auto-promote: false.** |
| Predictions this cycle | **0 independent probabilities** — coverage/missing_keys gates unchanged; thin events stay INSUFFICIENT |

## 6. Value / live / settlement / learning / UI

| Item | Evidence |
|---|---|
| Odds separate | `BET_QUALIFICATION_GATE`; `odds_in_model: false` |
| Value candidates this cycle | **0** (no independent inference + no market quotes on this host) |
| Live | Existing live/settlement path unchanged; no live scores faked |
| Settlements this cycle | **0** (researched events are still upcoming) |
| `/conclusi` | Route built; reads real `settlements.jsonl` only |
| Learning records | Path exists; `auto_applied: false`; no per-match weight hack |
| Retrain | `retrainIndependentModelPi` writes a **new** artifact; not executed (no dataset) |
| UI truth | DATI TROVATI / DERIVATI / STORICI / MANCANTI / ESCLUSI / MERCATO |
| Sources | DATA_SUCCESS ≠ HTTP 200 (`isDataSuccess`, `http200IsNotSuccess`) |

## 7. Storage

- Provider: `src/domain/storage/` — `backend: "filesystem"`, `neon_in_use: false`
- Ledgers: `audit/external/task-044/*.jsonl`
- Mirror: `audit/external/task-044/mirror/` (runtime, board, dossiers)
- Light: `data/light-analysis/` + HTTP football-data.co.uk (no Neon cache)
- **NEON NON UTILIZZATO.** `DATABASE_URL`, if present, is ignored.

## 8. Criteria A–Q (honest)

| | Criterion | Status |
|---|---|---|
| A | Storage without Neon | **Met** |
| B | Real research | **Met** (20 upcoming, 69 queued) |
| C | Observations + provenance | **Met** (84/101; failures recorded) |
| D | Temporal features | **Met in tests**; FDouk history missing on this host |
| E | Multi-model when data allows | **Implemented**; only Poisson is live; others gated by data |
| F | OOS backtest | **Partial** — code exists; no dataset on this VM |
| G | Promotion evidence | **Met as SHADOW/REJECT only** — none PROMOTED |
| H | Odds separate | **Met** |
| I | Value candidates | **Gate met**; 0 candidates (honest) |
| J | Live | **Existing path**; not newly scored this cycle |
| K | Settlement | **Write path met**; 0 rows (events still upcoming) |
| L | `/conclusi` | **Met** (empty until settlements exist) |
| M | Learning dataset | **Path met**; no new settled cases |
| N | No leakage | **Met** (unit + firewall) |
| O | Retrain path | **Exists**; not run |
| P | UI truth | **Met** |
| Q | Storage works without Neon | **Met** (tests ignore `DATABASE_URL`) |

**Phase 8 is not declared complete.** Incomplete: OOS numbers, promoted models, settlements, learning-from-settlement on this host, full-suite Lab A data.

## 9. Open problems

1. Lab B / Lab A JSONL not in git — Vercel/PC still need the host disk or a non-Neon sync of `audit/external/task-044`.
2. Football-Data.co.uk / ClubElo files missing in this environment → form/stats/Elo FAIL honestly.
3. API-Sports / Odds API keys unset → AUTH / no market quotes.
4. Understat xG still JS-loaded; not SUCCESS from HTML GET.
5. WAF sources remain BLOCKED; capabilities stay empty.
6. Full `pnpm test` 16 fails need Lab A 114-event store + un-stale fbref registry test.
7. No model was promoted. Do not lower gates to invent predictions.

## 10. Verdict

The critical path no longer requires Neon. Real free sources returned **69** upcoming fixtures; **20** were researched; observations and failures are real. Independent prediction stayed off where features were insufficient. **NEON NON UTILIZZATO.**
