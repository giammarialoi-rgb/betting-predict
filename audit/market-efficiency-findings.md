# Efficienza dei mercati — misure su 10.707 partite (5 leghe, 2019/20–2024/25)

Fonte: `audit/external/task-044/predictive-intelligence/datasets/raw/*.csv` (Football-Data.co.uk).
Tutte le cifre sono riproducibili con `pnpm lab:strength-dc` e `pnpm lab:totals-dc`.

## 1. Le quote alte sono la parte peggiore del mercato

ROI realizzato puntando piatto su **ogni** selezione 1X2, per fascia di quota.

| fascia quota | n | win% | ROI apertura | ROI chiusura |
|---|---|---|---|---|
| 1.00–1.50 | 2.155 | 74,8% | −2,06% | −2,81% |
| 1.50–2.00 | 3.828 | 56,5% | −3,38% | −2,70% |
| 2.00–2.75 | 5.056 | 41,3% | −4,91% | −4,62% |
| 2.75–4.00 | 11.541 | 28,5% | −4,69% | −5,74% |
| 4.00–6.00 | 6.073 | 19,7% | −9,15% | −9,27% |
| 6.00–10.0 | 2.585 | 11,0% | **−21,55%** | −16,95% |
| 10.0–26.0 | 848 | 8,6% | +9,91% | −1,61% |

Bias favorito-outsider classico: il margine del bookmaker è caricato sulle quote lunghe.
La fascia 10–26 ha IC 95% bootstrap **[−14,27%, +34,55%]** (ampiezza 48,8 punti, P(ROI≤0)=0,211)
e passa a −1,61% alla chiusura: è rumore, non un segnale.

**Conseguenza operativa: "quotato alto" non va mai usato come filtro di selezione.**

## 2. Margine per mercato — dove il book è davvero sottile

| mercato | n | overround | margine |
|---|---|---|---|
| Asian Handicap — Pinnacle | 10.695 | 1,0232 | 2,32% |
| Asian Handicap — Bet365 | 10.690 | 1,0267 | 2,67% |
| 1X2 — Pinnacle chiusura | 10.707 | 1,0270 | 2,70% |
| 1X2 — Pinnacle apertura | 10.699 | 1,0298 | 2,98% |
| O/U 2.5 — Pinnacle chiusura | 10.644 | 1,0299 | 2,99% |
| O/U 2.5 — Pinnacle apertura | 10.626 | 1,0318 | 3,18% |
| O/U 2.5 — Bet365 | 10.698 | 1,0507 | 5,07% |
| 1X2 — Bet365 apertura | 10.702 | 1,0546 | 5,46% |

## 3. Copertura dei mercati secondari in questo dataset

| mercato | risultati storici | quote storiche |
|---|---|---|
| Corner | 10.706 | **nessuna** |
| Cartellini gialli / rossi | 10.706 | **nessuna** |
| Gol primo tempo | 10.706 | **nessuna** |
| Over/Under 2.5 | 10.707 | 10.698 (apertura + chiusura) |
| Asian Handicap | 10.707 | 10.690 (apertura + chiusura) |

Corner e cartellini non sono attaccabili con questi dati: senza prezzo storico
non esiste backtest, solo un modello non falsificabile.

## 4. STRENGTH_DC su Over/Under 2.5 (holdout cieco)

| stagione | n | modello ll | mercato ll | delta | IC 95% |
|---|---|---|---|---|---|
| 2023/24 | 1.752 | 0,66932 | 0,66217 | +0,00715 | [0,0027, 0,0098] |
| 2024/25 | 1.752 | 0,67727 | 0,66844 | +0,00883 | [0,0055, 0,0123] |

Il mercato vince ancora, ma il divario è **3–4× più stretto che su 1X2** (+0,0283 / +0,0227).
I totali sono la proiezione naturale di un modello di gol: non richiedono il confine del pareggio.

## 5. Il risultato che conta più del modello

CLV puntando **completamente a caso** su O/U 2.5, valutato contro la chiusura equa Pinnacle.
Cambia solo **dove** si prende il prezzo:

| dove prendi il prezzo | n | CLV medio | batte la chiusura |
|---|---|---|---|
| apertura Bet365 | 10.635 | −4,71% | 21,2% |
| media dei book | 10.642 | −4,90% | 19,7% |
| **miglior prezzo tra i book** | 10.642 | **−1,21%** | **41,2%** |

**+3,5 punti di CLV con zero capacità predittiva.** Per confronto, la selezione del modello
STRENGTH_DC vale circa zero: −5,41% e −4,78% contro un riferimento casuale di −4,71%.

Ordine di priorità che ne discende:
1. esecuzione (prendere il miglior prezzo disponibile) — effetto misurato +3,5 punti
2. informazione che il mercato non ha ancora prezzato (formazioni, infortuni tardivi)
3. raffinamento del modello su dati pubblici — effetto misurato ~0 sul CLV

Anche il miglior prezzo resta a −1,21%: da solo non basta. Serve combinarlo con (2).

---

# Schedine multi-selezione — cosa dicono i biglietti storici

## 6. Il bonus era il motore, e il tuo stesso archivio ne certifica la morte

Scaletta bonus estratta dagli screenshot (bonus / ritorno lordo pre-bonus):

| schedina | eventi | bonus | margine max tollerato per evento |
|---|---|---|---|
| 2016-05-02 | 7 | 15,0% | 1,98% |
| 2016-04-30 | 7 | 18,0% | 2,34% |
| 2016-05-01 | 9 | 25,0% | 2,45% |
| 2016-05-02 | 10 | 30,0% | 2,59% |
| 2016-04-28 | 10 | 33,0% | 2,81% |
| 2016-05-02 (sistema) | 11 | 30,0% | 2,36% |
| 2017-05-20 | 13 | 30,2% | 2,01% |
| 2017-04-02 | 13 | 35,9% | 2,33% |
| 2016-04-24 | 14 | 50,0% | 2,85% |
| **2022-02-23** | 8 | **0,0%** | **0,00%** |

Il margine massimo tollerato è **praticamente costante a ~2,4% per evento**, quale che sia
la lunghezza: la scaletta era tarata per restituire circa metà del margine tipico.
Nel biglietto del 2022 il bonus è **zero su ogni combinazione**.

## 7. Le schedine storiche valutate a margine noto

EV per euro giocato, ipotizzando margine uniforme per evento e nessun vantaggio predittivo:

| schedina | prodotto quote | bonus | EV@3% | EV@5% | EV@7% | p(incasso) |
|---|---|---|---|---|---|---|
| 7 eventi (2016-04-30) | 6,16 | 18,0% | 0,953 | 0,824 | 0,710 | 9,77% |
| 7 eventi (2016-05-02) | 4,34 | 15,0% | 0,929 | 0,803 | 0,692 | 13,85% |
| 10 eventi | 6,58 | 33,0% | 0,981 | 0,796 | 0,644 | 7,36% |
| 13 eventi (2017-05-20) | 31,93 | 30,2% | 0,876 | 0,668 | 0,507 | 1,22% |
| 13 eventi (2017-04-02) | 45,47 | 35,9% | 0,915 | 0,698 | 0,529 | 0,86% |
| 14 eventi | 285,65 | 50,0% | 0,979 | 0,732 | 0,543 | **0,13%** |

La schedina da 4.284 € su 10 € aveva **una probabilità di incasso dello 0,13%: una su 750.**

## 8. Dove la multi-selezione ha un margine reale: la correlazione

Selezioni della **stessa partita** non sono indipendenti. Probabilità congiunta esatta letta
dalla matrice dei punteggi del modello, stagione 2023/24, 1.752 partite:

| combinazione | p come indipendenti | p reale | rapporto | effetto |
|---|---|---|---|---|
| 1 + Over 2.5 + GG | 0,1311 | 0,2120 | 1,710 | **+71,0%** a tuo favore |
| NG + Under 2.5 | 0,2124 | 0,3442 | 1,679 | +67,9% |
| GG + Over 2.5 | 0,3008 | 0,4326 | 1,476 | +47,6% |
| 1 + Over 2.5 | 0,2311 | 0,2767 | 1,206 | +20,6% |
| 1 + MultiGol casa 1-3 | 0,3013 | 0,3514 | 1,199 | +19,9% |
| 2 + Over 2.5 | 0,1583 | 0,1870 | 1,176 | +17,6% |
| 1X + Under 3.5 | 0,4802 | 0,4820 | 1,007 | +0,7% |
| 1X + Over 1.5 | 0,5446 | 0,5416 | 0,992 | −0,8% |
| 1 + GG | 0,2404 | 0,2120 | 0,885 | −11,5% |
| 1 + Under 2.5 | 0,1992 | 0,1536 | 0,772 | −22,8% |
| Over 3.5 + NG | 0,1334 | 0,0360 | 0,259 | **−74,1%** contro di te |

Un book che prezza queste combinazioni come indipendenti regala il 47-71% sulle prime tre
e ne guadagna il 23-74% sulle ultime tre. I mercati "Chance Mix", "DC Combo" e "Combo Mix"
delle schedine storiche sono esattamente combinazioni della stessa partita.

**Da verificare prima di usarlo**: se un dato book prezzi davvero questi combo come
indipendenti. Va confrontato con i suoi prezzi combo reali, non assunto.
