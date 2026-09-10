# Phase 5 — Data Acquisition Audit

Codice letto, non documentazione precedente. Gate del modello **non** da abbassare (`coverage >= 0.35`, `missing_keys <= 45`).

## Grafo reale (prima di Phase 5)

```
Odds API discovery (no event cap; credit/rate only)
  → events.jsonl
  → analyzeAllLabB045  (TUTTI gli eventi, PRIMA della research)
      → API-Sports cache only + Football-Data priors + ClubElo cache
      → predict-live gates
      → predictions.jsonl  (spesso INSUFFICIENT / NO_INDEPENDENT)
  → research orchestrator (budget 24/ciclo, coda persistente)
      → research-status.jsonl  (lineage UI)
      ✗ nessun read path verso predictIndependentForEvent
  → Neon mirror (board 120, dossier 150)
  → UI Events = next_events (max 120, e solo se esiste una decision row)
```

## Problemi

| Problema | File | Causa | Soluzione | Test |
|---|---|---|---|---|
| Research dopo analyze | `brain-051/cycle.ts` | `runMassive049Cycle` poi orchestrator | Discovery → research → analyze nello stesso ciclo | phase-5 order |
| Research non entra nel modello | `factory-045/analyze.ts`, `run-event-research.ts` | Solo API-Sports cache in DI; scrape = mention HTML | Fallback fonti + historical provider; scrape PARTIAL ≠ typed feature | homepage ≠ event; odds firewall |
| Events UI cap 120 / solo decisioni | `board.ts` `buildLiteNextEvents` | Itera `decisions.jsonl` tail 400, break a 120 | Calendario da **tutti** gli `events.jsonl` per data | all events by date; no cap |
| Homepage 8 | `(betmind)/page.tsx` | Widget display | Lasciare widget; pagina Events senza cap | Events count |
| Dossier Neon 150 | `dossier.ts` mirror limit | Trim payload | Mirror finestra date (oggi+7) senza 150 fisso | calendar neon |
| Scrape PARTIAL contato come fetch OK | `run-event-research.ts` | `page_mentions_both_teams` | PARTIAL = menzione, non observation typed | 200 homepage ≠ event |
| Understat sempre DENIED | `event-page-fetch.ts` URL vuoto | Evita false positive EPL table | Resta NO_EVENT senza fixture id; fallback xG | no invented xG |
| Club-Football = presenza cartella | `run-event-research.ts` | `existsSync` | HistoricalDataProvider: match team o NO_EVENT | CFMD not file SUCCESS |
| Odds research `ok:true` senza GET | `run-event-research.ts` | Riga dichiarativa | `MARKET_LAYER` not SUCCESS research | odds firewall |
| Sources page ≠ catalogue 33 | `registry.ts` vs `source-catalogue.ts` | Registry statico 15 voci | SourceEngine operativo da `research-status.jsonl` | source health |
| `live:` come id | `live-resolve.ts` | Unresolved → `live:slug` | Provisional only; EventIdentityResolver | identity |
| Analyze usa 0 per missing? | `engine.ts` `put()` | **No** — null + missing[] | Mantenere; UI MISSING ≠ 0 | no fake feature |
| BETMIND_TEST_SCRAPE | `scraping-policy.ts` | Già sempre ALLOW | Confined to tests | scrape always on |
| Queue 24 | `orchestrator.ts` | Budget per ciclo, non cap coda | Coda già tutti i futuri; budget env | no artificial event cap on queue |

## Fonti catalogue vs runtime

Vedi `source-catalogue.ts`. Adapter `MISSING_ADAPTER` restano catalogati. Fallback: tentare la prossima fonte utile, registrare BLOCKED/NO_EVENT, non fermare la ricerca.

## Vincoli permanenti

- Odds mai nel vettore indipendente (`asof.ts`, `odds-firewall.ts`)
- HTTP 200 homepage ≠ dato evento
- Predictions.jsonl row ≠ inference (`hasIndependentModel`)
- Nessuna migrazione Neon Drizzle non approvata; tabelle `betmind_*` restano DDL runtime
