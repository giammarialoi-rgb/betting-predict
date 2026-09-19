# BetMind — stato del modello predittivo (handoff)

Documento di passaggio di consegne fra sessioni e strumenti. Aggiornato: 2026-09-19 (sera).
Tutte le cifre sono riproducibili con gli script indicati; nessuna è stimata.

## Stato in una riga

`MODEL_v1 = MARKET_DEVIG`: il modello di produzione rispecchia il mercato, quindi il suo
edge è **zero per costruzione** e `NO_BET` è la risposta corretta. È stato aggiunto un
modello indipendente reale, `INDEPENDENT_STRENGTH_DC_v1`, registrato come **SHADOW**.
Non è promosso e non deve esserlo: batte i lambda precedenti ma **non batte il mercato**.

## Cosa è stato aggiunto

| file | ruolo |
|---|---|
| `src/domain/eval/predictive-intelligence/models/strength-dc.ts` | forza attacco/difesa via MLE Poisson pesato, decadimento esponenziale, vantaggio casa e baseline lega stimati, shrinkage, correzione Dixon-Coles. Espone anche la matrice dei punteggi e la proiezione sui totali. |
| `.../models/ticket-ev.ts` | valutazione schedine multi-selezione: probabilità congiunta esatta per legs della stessa partita, scaletta bonus, EV reale, contributo marginale per gamba. |
| `.../models/strength-dc.test.ts` | 4 test: firewall temporale, nessun input di mercato, aggiustamento per avversario, probabilità proprie. |
| `.../models/ticket-ev.test.ts` | 8 test: parser selezioni, correlazione, scaletta bonus, gambe che abbassano l'EV. |
| `src/scripts/lab-strength-dc.ts` | `pnpm lab:strength-dc` — 1X2, a stadi (`--stage=1|2|3|eval|register|report`). |
| `src/scripts/lab-totals-dc.ts` | `pnpm lab:totals-dc` — Over/Under 2.5 (`--stage=tune|eval --season=`). |
| `src/scripts/lab-ticket-ev.ts` | `pnpm lab:ticket-ev` — schedine reali + scansione correlazione. |
| `audit/market-efficiency-findings.md` | tutte le misure in forma leggibile. |
| `audit/strength-dc-report.json`, `totals-dc-report.json`, `ticket-ev-report.json` | output grezzi. |

Nessun file preesistente è stato modificato, a parte `package.json` (tre script + i test
nuovi nella suite) e l'aggiunta di `.gitattributes`.

## Protocollo temporale usato nei lab

Più severo del walk-forward esistente, che taratura gli iperparametri sulla stagione 2425,
**successiva** all'holdout 2324:

- taratura: stagioni ≤ 2122, validazione su 2223
- holdout cieco: 2324, valutato una sola volta
- conferma: 2425, valutata una sola volta

Le forze squadra sono rifittate as-of per lega/giornata dai soli risultati già disponibili.

## Risultati misurati

**1X2, holdout 2324 (n=1752)**

| modello | log loss | Brier |
|---|---|---|
| STRENGTH_DC | 0,98311 | 0,19548 |
| mercato (devig apertura) | 0,95482 | 0,18898 |
| medie mobili (lambda precedenti) | 1,02105 | 0,20376 |
| frequenze di lega | 1,07642 | 0,21717 |

Contro le medie mobili: −0,038 di log loss, p(migliore)=1,000 su bootstrap appaiato.
Contro il mercato: +0,02829, IC 95% [0,0217, 0,0328] — il mercato vince. Confermato su 2425.

**Over/Under 2.5**: divario dal mercato +0,00715 (2324) e +0,00883 (2425), cioè **3-4 volte
più stretto che sull'1X2**. I totali sono la proiezione naturale di un modello di gol.

**CLV**: negativo ovunque. Sull'1X2 lo yield peggiora al crescere della soglia di edge —
firma di un modello che non sa qualcosa.

**La leva più forte non è il modello.** Puntando a caso su O/U 2.5 e cambiando solo dove si
prende il prezzo: apertura Bet365 → CLV −4,71%; miglior prezzo fra i book → **CLV −1,21%**.
+3,5 punti con zero capacità predittiva. La selezione del modello vale circa zero.

## Regole che il codice nuovo dà per acquisite

1. **Mai moltiplicare probabilità di selezioni della stessa partita.** Vanno lette dalla
   matrice congiunta con `evaluateTicket`. Misurato su 1752 partite: `1 + Over 2.5 + GG`
   vale 21,20% reale contro 13,11% come indipendenti (+71%); `Over 3.5 + NG` vale 3,60%
   contro 13,34% (−74%).
2. **Le quote alte non sono valore.** ROI per fascia, apertura: 1,0-1,5 → −2,06%;
   4-6 → −9,15%; 6-10 → −21,55%. Il bias favorito-outsider è monotòno.
3. **Il bonus multipla vale ~2,4 punti di margine per evento**, qualunque sia la lunghezza,
   e nei biglietti 2022 è zero. Va rimisurato sui termini correnti, mai assunto.
4. **Nessun prezzo entra mai nelle feature del modello.** `assertNoMarketInputsInPredictionContext`
   resta il guardiano; i test lo verificano anche per `strength-dc`.

## Limiti noti e prossimi passi

- Il devig di `market-baseline.ts` è **proporzionale**, non Shin. Distorce gli sfavoriti, e
  gli sfavoriti sono dove nascono i falsi edge. Da sostituire prima di misurare edge sugli underdog.
- Corner e cartellini: risultati presenti su 10.706 partite, **quote storiche assenti**.
  Non backtestabili senza una nuova fonte di prezzi.
- Asian Handicap: quote presenti e inutilizzate, margine più basso del dataset (2,32% Pinnacle).
  Coperto dalla matrice dei punteggi, non serve un modello nuovo.
- Il motore di dispersione multi-book non esiste ancora ed è la leva misurata più forte.
- Le percentuali di correlazione dicono cosa regala un book che prezza i combo **come
  indipendenti**. Va verificato contro prezzi combo reali, book per book.

## Ambiente

`node_modules` è installato con pnpm su Windows: i suoi symlink non sono leggibili da un
filesystem Linux, quindi `npx tsc` e `npx tsx` falliscono da lì con `MODULE_NOT_FOUND`.
Da Windows funzionano normalmente (`pnpm test`, `pnpm lab:*`).


---

## Aggiornamento — copertura, corner, tabellone

**Dataset esteso**: da 5 a 22 divisioni, 45.228 partite (`pnpm data:build-expanded`, file
separato `matches-expanded.jsonl`). Copertura per lega misurata con `pnpm lab:league-coverage`:
il modello non batte il mercato in **nessuna** delle 22, ma il divario si stringe fino a 13
volte nelle divisioni minori (2. Bundesliga +0,0031) rispetto alle grandi (Bundesliga
+0,0428). Attenzione al margine: in Scozia il book costa 9,2-9,6% contro 5,4% delle grandi.
Candidati con divario stretto E margine normale: D2, E3, E1, E2, SP2.

**Corner** (`count-model.ts`, `pnpm lab:corners`): sui **totali** nessun segnale oltre la
media di lega — l'effetto squadra si annulla nella somma. Sui **direzionali** segnale forte:
corner 1X2 −0,03486 (IC [−0,0444, −0,0256]), corner casa Over 4.5 −0,02442. Comprare quote
sui corner totali sarebbe denaro sprecato; `corners_1x2` e i team total corner no.

**Tabellone 7 giorni** (`pnpm board:7days`): calendario da football-data.org, 63 partite su
81 nel tabellone. Le quote di quella API sono un pacchetto a pagamento, quindi **non ci sono
prezzi e nessuna selezione viene proposta**.

**Abbinamento nomi** (`team-matching.ts`): non restituisce mai il candidato piu vicino.
Pretende punteggio alto e margine netto, altrimenti AMBIGUOUS o NO_MATCH e la partita esce.
Due trappole gia trovate e chiuse, entrambe con test di regressione:
- la rosa costruita per divisione rendeva invisibile ogni promossa o retrocessa;
- il punteggio basato su sottostringa/lunghezza minima dava 1,0 a qualunque query contenuta
  nel candidato, e faceva passare "Paris FC" per il PSG. Ora si scala per i token del
  candidato non spiegati dalla query.

**Stato generatore casuale**: usare sempre `validation/rng.ts`. Un LCG scritto a mano
degenera in copertura e falsa gli intervalli di confidenza.
