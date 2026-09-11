# MEGA DATA PIPELINE REPORT

**Branch:** `cursor/mega-data-pipeline-5cf1`  
**As-of runtime probe:** 2026-09-11T21:32Z (cloud agent)  
**Rule:** runtime truth > old docs. No invented sources, no mock fixtures, no SUCCESS-from-HTTP-200.

---

## 1. Fonti realmente funzionanti (probe osservato)

| source_id | status | HTTP | yield note |
|-----------|--------|------|------------|
| openligadb | OK | 200 | fixtures + finished scores |
| thesportsdb | OK | 200 | upcoming meta |
| espn | OK / intermittent BLOCKED | 200 or 403 | scoreboard; 403 = BLOCKED, continue |
| openfootball | OK | 200 | season JSON |
| statsbomb | OK | 200 | open-data competitions |
| open-meteo | OK | 200 | weather ping |
| ansa, bbc-sport, guardian-football, gazzetta, sky-sports, espn-soccer-news, corriere-sport, il-messaggero | OK | 200 | RSS items (CONTEXT) |
| club-football-match-data | OK | n/a | local archive |

## 2. Fonti realmente fallite / degradate

| source_id | status | note |
|-----------|--------|------|
| football-data-co-uk | BLOCKED (403) in late probe | earlier GET in session returned 200 CSV — intermittent; recorded as observed, not ACTIVE theater |
| understat | PARTIAL / NOT_FOUND intermittent | HTML present; season XHR fields not always extractable from probe |
| clubelo | Fonti-inactive | HTTP 502 history |
| sofascore / fbref / whoscored / diretta | pruned | WAF 403 — no bypass |
| api-sports / football-data-org / the-odds-api | token-gated | keys **absent in this cloud env**; adapters exist |

## 3. Adapter disponibili

Acquisition engine lanes under `src/domain/eval/acquisition-engine/sources/`  
(plus mega free-discover / free-settle). Fonti MISSING_ADAPTER count: **0** (post-prune catalogue).

## 4. API disponibili senza chiave in questo ambiente

- OpenLigaDB  
- TheSportsDB (free key `3`)  
- ESPN unofficial scoreboard (unstable)  
- Open-Meteo  
- Public RSS  
- GitHub raw datasets (openfootball, statsbomb)  

## 5. Scraping

`BETMIND_TEST_SCRAPE` is **ignored**; scrape lane permanently ALLOW for ordinary GET.  
WAF/CAPTCHA bypass still **forbidden**. 403 → BLOCKED → next source.

## 6. Categorie dati realmente ottenibili oggi

| category | obtainable? | notes |
|----------|-------------|-------|
| FORM / RESULTS | yes | football-data.co.uk when not blocked; OpenLiga finished |
| FIXTURES | yes | OpenLiga / TheSportsDB / ESPN |
| LIVE SCORE | yes | OpenLiga match results |
| FINAL RESULT | yes | OpenLiga settle |
| NEWS | yes | RSS CONTEXT only |
| WEATHER | yes | Open-Meteo CONTEXT |
| XG | partial | Understat lane exists; temporal eligibility gated |
| MARKET | only with Odds/API keys | not in this cloud run |
| INJURIES / LINEUPS / REFEREE | no | no honest free source with verified event binding |

## 7–15. Conteggio ciclo mega (Lab B + Neon)

From `artifacts/mega-pipeline/last-cycle.json`:

| metric | value |
|--------|------:|
| fixtures_seen | 147 |
| events_inserted | 147 |
| research_jobs (Neon) | 147 |
| live states FINISHED | 69 |
| live states LIVE | 9 |
| settlements (OpenLiga) | 60 |
| prediction_cases created | 0 |
| independent inferences this cycle | 0 |
| learning cases this cycle | 0 |

**Why 0 predictions / learning?** Free discovery does **not** invent MODEL probabilities. Predictions require the existing gated research → feature → model path. Settlements without prior predictions correctly produce **no** WON/LOST learning rows.

## 16. Test

- `pnpm exec tsx --test src/domain/eval/mega-pipeline/mega-pipeline.test.ts` — PASS  
- `pnpm betmind:self-test` — overall **PARTIAL** (honest: no Odds key, MODEL predictions empty on fresh free-only store, Vercel deploy separate)

## 17. Limiti residui

1. Cloud env has **no** `THE_ODDS_API_KEY` / `API_SPORTS_KEY` / `FOOTBALL_DATA_ORG_TOKEN`.  
2. Independent multi-market MODEL still depends on research coverage + scientific gates (unchanged — not lowered).  
3. ESPN / football-data.co.uk can flip between 200 and 403 — status is observed, not assumed ACTIVE.  
4. Conclusi UI is empty until prediction cases exist and settle.  
5. Formal Drizzle migrations for new domain tables not applied — operational `CREATE IF NOT EXISTS` only (same pattern as runtime status).  
6. User PC Brain (`giamm`, RUNNING) remains the long-running worker; this PR wires mega cycle into `runBrainCycle051`.

## 18. Cosa NON è ancora disponibile

- Guaranteed injuries / official lineups / referee cards from free public endpoints  
- WAF-protected scrapes (SofaScore, FBref, WhoScored)  
- Auto-promotion of model versions without backtest  
- Naked probabilities to “fill” dashboards  

## Implementato in questo PR

- `src/domain/eval/mega-pipeline/` — free discover, free settle, live monitor, source probes, prediction cases, Neon operational tables, self-test, cycle  
- Brain hook: mega cycle before acquisition; labEvents no longer capped at last 80  
- UI: `/conclusi`, nav, Fonti shows HTTP + yield from `betmind_source_runtime`  
- Scripts: `pnpm betmind:self-test`, `pnpm betmind:mega-cycle`
