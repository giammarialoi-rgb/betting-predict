# TASK 056 — System audit (evidence-based)

Generated from code inspection of the live Lab B stack. No invented metrics.

Canonical Lab B root: `audit/external/task-044` (`permanentRoot044()`).  
Lab A root: `audit/external/task-039` — **READ_ONLY**.

---

## A. Processo realmente attivo

**Catena canonica 24/7:**

```
pnpm permanent-live:supervisor:start
  → scripts/start-supervisor.ps1
  → src/scripts/permanent-live-supervisor.ts (run)
  → healOnce054 / spawnBrainWorker054
  → pnpm exec tsx src/scripts/brain-worker.ts
  → runBrainCycle051
  → runMassive049Cycle (+ catalog-054/055 opzionali)
```

**Competizione:** `pnpm brain:start` → `brain-watchdog.ts` usa lo **stesso** `acquireSupervisorLock054`. Non avviare entrambi.

**Legacy (non canonico):** `permanent-live:start` → `permanent-live-run.ts` (+ collector Lab A). Non è la catena supervisor→worker.

---

## B. Supervisor realmente attivo

`src/domain/eval/supervisor-054/`

| File | Ruolo |
|------|--------|
| `heal.ts` | assess + spawn + cooldown 90s |
| `locks.ts` | PID lock atomico |
| `state.ts` | stato, heartbeat ricco, journal; stale default 10m |

IDLE / PAUSED_BUDGET / SLEEP ≠ DEAD. Restart solo su WORKER_DEAD o HEARTBEAT_STALE.

Lock: `audit/external/task-044/supervisor/supervisor.lock`.

---

## C. Worker realmente attivo

`src/scripts/brain-worker.ts`

- Lock: `…/brain/worker.lock`
- Loop: `runBrainCycle051({ allowDiscover: true })` + heartbeat a slice 10s
- Errori di ciclo: catch + backoff 15s (non crash silenzioso)

---

## D. Brain realmente attivo

`src/domain/eval/brain-051/cycle.ts` → `runBrainCycle051`:

1. `planCycle051` (P0 settle, P5 pre-lock, P1/P2 discovery, P4 scan)
2. `runMassive049Cycle` (`factory-049/cycle.ts`) — nucleo
3. Paper open 051 + virtual bankroll 053 settle/open
4. `runCatalogCycle054` (Directa policy)
5. `runMultiSourceCycle055` (overlay catalog)

Priorità P3/P6/P7 dichiarate in config ma **non usate** dal planner.

---

## E. Sorgente reale degli eventi

**Primaria live:** The Odds API via `runDiscover049` → `fetchSportsCatalog045` / `pullSportOddsMulti045` (`factory-045/pull.ts`), scritta su Lab B.

**Seed:** sync Lab A → Lab B in `runPermanent044Cycle({ runCollector042: false })` (read Lab A).

**catalog-055 Odds adapter:** legge lo store Lab B da disco — **non** spende crediti Odds dalla UI.

**Sofa / Flashscore / Soccerway / Directa:** `DISABLED_BY_POLICY` (stub).

---

## F. Sorgente reale delle quote

Stessa pipeline Odds API → ingest Lab B JSONL. Nessuna seconda fonte quote attiva.

---

## G. Mercati realmente analizzati

Richiesti al provider: `h2h,spreads,totals` → normalizzati `1X2` / `AH` / `OU`.

`runMultiMarketPass049` analizza i mercati **presenti** sulle quote.

Predizioni core `analyzeAllLabB045` sono centrate su **1X2** (`market: "1X2"`).

`market_catalog.json` (055) = snapshot dinamico dai quote osservati — non inventa mercati.

---

## H. Sport realmente disponibili

Diagnostica: `bankroll-053/sports-registry.ts` → ACTIVE_DATA / ACTIVE_EMPTY / UNAVAILABLE / BUDGET_BLOCKED / RATE_LIMITED / ERROR.

Consolidation 055 mappa a ACTIVE / EMPTY_WINDOW / PROVIDER_UNAVAILABLE / …

Tipico osservato (Lab B): SOCCER ACTIVE; TENNIS/BASKETBALL/HOCKEY EMPTY_WINDOW; VOLLEYBALL spesso PROVIDER_UNAVAILABLE. Mai “0” senza motivo se la UI usa questi status.

---

## I. Decision engine realmente utilizzato

**Sì:** `runMassive049Cycle` → `runDecisionEngine048` (`factory-048/engine.ts`).

Model id: `MODEL_v2_DECISION_ENGINE`.

**Critico:** predizioni con `marketOnly: true` → probabilità modello = MARKET_DEVIG → `MODEL_MIRRORS_MARKET` / `MODEL_IS_MARKET_ONLY` → quasi sempre **NO_BET**.

Questo è **corretto** (non inventa edge), ma **non** è ancora un modello indipendente dal mercato.

WHY: `WhyBlock048` + `buildWhyMachine053`.

---

## J. Learning realmente utilizzato

| Path | Hooked |
|------|--------|
| Autopsy/learning 044 su settle | Sì (`runSettle045`) |
| Autopsy/counterfactual/patterns 048 | Sì (`runDecisionEngine048`) |
| Challenger registry 053 | OBSERVATION_ONLY, no auto-promo |

Learning cases possono essere 0 se pochi settled/incorrect o path non ha ancora popolato `learning-cases.jsonl`.

---

## K. Settlement realmente utilizzato

`runSettle045` dentro massive cycle. Virtual bankroll `settleVirtualBets053` nel brain cycle.

Paper 051 (`maybeOpenPaperBet051`): **open-only** — settle paper-051 non hooked (duplicato parziale vs 053).

---

## L. Codice morto / parallelo

- `permanent-live-run.ts` daemon legacy
- One-shot `permanent-live:{discover,analyze,…}` (ops manuali)
- Scheduler P3/P6/P7 unused
- SportAdapter053 discover stubs (vuoti)
- Dual paper 051 open-only vs 053 virtual
- Dual entry supervisor (`brain:start` vs `supervisor:start`)

---

## M. Duplicazioni

| Funzione | Implementazioni | Canonica |
|----------|-----------------|----------|
| Supervisor | brain-watchdog ≈ permanent-live-supervisor | `permanent-live:supervisor:*` |
| Catalog overlay | 054 Directa + 055 multi-source | Entrambi post-cycle; 055 per observatory |
| Health | brain-051, bankroll-053, supervisor-054 | UI health → 053 + autostart 055 |
| Paper | paper-051 + bankroll-053 | **053** per capitale €1000 |

---

## N. Falsi indicatori UI (rischio)

- Contatori TOP-N non sono “tutti gli eventi”.
- BET_CANDIDATES≈0 con model market-only può sembrare “sistema spento” — in realtà è NO_BET motivato.
- Event table storica: Kickoff/Event/Status/Pred/Lock/Markets — **mancavano** MODEL%/MARKET%/EDGE/EV/DECISION/STAKE/WHY (gap UI, non assenza dati su decisioni.jsonl).

---

## O. Metriche calcolabili vs supportate

| Metrica | Supportata dai dati? |
|---------|----------------------|
| Event counts / horizons | Sì (store) |
| NO_BET / LOCKED / SETTLED | Sì |
| PAPER bankroll 1000 | Sì (053) |
| MODEL_EDGE DEMONSTRATED | **No** — gate SETTLED≥100 + stats; attualmente UNKNOWN |
| Independent model edge | **No** — marketOnly |
| Multi-source quotes | **No** — policy disabled |
| API_CALLS_UI | 0 by design |

---

## Pipeline target vs realtà

```
DISCOVERY → NORMALIZE → QUOTES → FEATURES → MODEL → EDGE → DECISION → PAPER → LOCK → POSTLOCK → SETTLE → AUTOPSY → LEARNING
```

| Stage | Status |
|-------|--------|
| DISCOVERY | OPERATIONAL (Odds + budget) |
| NORMALIZE | OPERATIONAL (Lab B ingest) |
| QUOTES | OPERATIONAL (h2h/spreads/totals) |
| FEATURES | OPERATIONAL (snapshot) |
| MODEL | OPERATIONAL ma **market-only** |
| EDGE | Structural ~0 (honest) |
| DECISION | OPERATIONAL (048) |
| PAPER | OPERATIONAL (053); 051 incomplete settle |
| LOCK | OPERATIONAL T−1h |
| POSTLOCK | OPERATIONAL |
| SETTLE | OPERATIONAL |
| AUTOPSY | OPERATIONAL |
| LEARNING | OPERATIONAL (observation); volume dipende da settled |

---

## Autostart

- Install XML + Startup shortcut (`scripts/install-supervisor.ps1`)
- Verify: `scripts/verify-autostart.ps1` → `supervisor/autostart-status.json`
- Tipico: Task Scheduler Access Denied → `StartupOnly` / STARTUP_FOLDER — **non** dichiarare Task Scheduler se fallisce

---

## Gap list (solo questi meritano fix in TASK 056)

1. Documentare catena canonica + audit report (questo file).
2. Control Center: tabella eventi con MODEL%/MARKET%/EDGE/EV/DECISION/WHY da store/API locale.
3. AUTOSTART_STATUS enum esplicito: TASK_SCHEDULER | STARTUP_FOLDER | DISABLED.
4. Diagnostic panel: integrity checks (dup IDs, BET without WHY, etc.) da store.
5. Canonical paper = bankroll-053; non espandere paper-051.
6. lab/audit task-056 con verdetto onesto (blocker MODEL_IS_MARKET_ONLY se si richiede edge indipendente).
7. Non aprire TASK 057. Non toccare Lab A. Non inventare modello edge.

**NON gap (non rifare):** nuovo supervisor, nuovo store, nuovo brain, nuovo decision engine.
