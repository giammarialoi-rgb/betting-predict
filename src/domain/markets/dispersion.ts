/**
 * DISPERSIONE MULTI-BOOK — trovare chi ha sbagliato a prezzare, non prevedere.
 *
 * E' la leva misurata due volte con metodi indipendenti: sullo storico
 * Over/Under 2.5 prendere il miglior prezzo invece di uno solo vale +3,5 punti
 * di CLV; sui prezzi live di Premier League vale +3,5/+3,9 punti. Nessun
 * modello predittivo in questo repo si avvicina a quel numero.
 *
 * Il motore non prevede nulla: prende il consenso del mercato come stima equa e
 * cerca il book che se ne discosta in nostro favore.
 *
 * Tre insidie che il codice tratta esplicitamente:
 *  1. Il de-vig proporzionale gonfia la probabilita equa degli sfavoriti e
 *     produce edge inesistenti proprio sulle quote lunghe. Qui si usa Shin.
 *  2. I prezzi degli exchange sono al lordo della commissione, che non compare
 *     nella quota. Confrontarli con quelli dei book e barare a proprio favore.
 *  3. Un book solo non e un consenso. Sotto una soglia minima di bookmaker il
 *     risultato e dichiarato non affidabile invece di essere restituito.
 */
import { devig, type DevigMethod } from "@/domain/odds/devig";

export type BookQuote = {
  book: string;
  /** Prezzi nell'ordine degli esiti, uguale per tutti i book. */
  prices: number[];
};

/** Commissione sulle vincite nette, per piattaforma. */
export const EXCHANGE_COMMISSION: Record<string, number> = {
  betfair: 0.05,
  "betfair exchange": 0.05,
  smarkets: 0.02,
  matchbook: 0.015,
  betdaq: 0.02,
  prophetx: 0.03,
  novig: 0,
  rebet: 0,
};

/** Quota netta dopo commissione: la vincita si riduce, la puntata no. */
export function effectivePrice(book: string, price: number): number {
  const c = EXCHANGE_COMMISSION[book.trim().toLowerCase()];
  if (c == null || c <= 0) return price;
  return 1 + (price - 1) * (1 - c);
}

export type OutcomeEdge = {
  outcome: string;
  bestBook: string;
  bestPriceRaw: number;
  bestPriceNet: number;
  fairProbability: number;
  fairPrice: number;
  /** Valore atteso per unita puntata, meno 1: >0 significa vantaggio. */
  edge: number;
};

export type DispersionResult = {
  outcomes: string[];
  nBooks: number;
  consensusSource: string;
  consensusOverround: number;
  bestCombinedOverround: number;
  /** Punti di margine risparmiati prendendo il miglior prezzo invece del riferimento. */
  executionGain: number;
  edges: OutcomeEdge[];
  reliable: boolean;
  warnings: string[];
};

export type DispersionOptions = {
  /** Book di riferimento per il consenso equo. Se assente si usa la mediana. */
  sharpBook?: string;
  method?: DevigMethod;
  minBooks?: number;
  /** Esclude gli exchange dal consenso: i loro prezzi non contengono margine. */
  excludeExchangesFromConsensus?: boolean;
};

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function analyseDispersion(input: {
  outcomes: string[];
  quotes: readonly BookQuote[];
  options?: DispersionOptions;
}): DispersionResult {
  const { outcomes } = input;
  const opts = input.options ?? {};
  const method: DevigMethod = opts.method ?? "shin";
  const minBooks = opts.minBooks ?? 3;
  const warnings: string[] = [];

  const valid = input.quotes.filter(
    (q) => q.prices.length === outcomes.length && q.prices.every((p) => Number.isFinite(p) && p > 1),
  );
  if (valid.length < input.quotes.length) {
    warnings.push(`${input.quotes.length - valid.length} book scartati per quote incomplete`);
  }
  if (!valid.length) {
    return {
      outcomes, nBooks: 0, consensusSource: "nessuno", consensusOverround: 0,
      bestCombinedOverround: 0, executionGain: 0, edges: [], reliable: false,
      warnings: [...warnings, "nessuna quota utilizzabile"],
    };
  }

  // ---- consenso equo ----
  const isExchange = (b: string) => EXCHANGE_COMMISSION[b.trim().toLowerCase()] != null;
  const sharp = opts.sharpBook
    ? valid.find((q) => q.book.trim().toLowerCase() === opts.sharpBook!.trim().toLowerCase())
    : undefined;

  let consensus: number[];
  let consensusSource: string;
  let consensusOverround: number;
  if (sharp) {
    const d = devig(sharp.prices, method);
    consensus = d.probabilities;
    consensusSource = sharp.book;
    consensusOverround = d.overround;
  } else {
    const pool = opts.excludeExchangesFromConsensus === false
      ? valid
      : valid.filter((q) => !isExchange(q.book));
    const use = pool.length >= minBooks ? pool : valid;
    if (pool.length < minBooks && pool.length !== valid.length) {
      warnings.push("pochi bookmaker tradizionali: consenso calcolato includendo gli exchange");
    }
    const perBook = use.map((q) => devig(q.prices, method));
    consensus = outcomes.map((_, i) => median(perBook.map((d) => d.probabilities[i]!)));
    const s = consensus.reduce((a, b) => a + b, 0);
    consensus = consensus.map((p) => p / s);
    consensusSource = `mediana di ${use.length} book`;
    consensusOverround = perBook.reduce((a, d) => a + d.overround, 0) / perBook.length;
  }

  // ---- miglior prezzo per esito, al netto della commissione ----
  const edges: OutcomeEdge[] = outcomes.map((name, i) => {
    let bestBook = valid[0]!.book;
    let bestRaw = valid[0]!.prices[i]!;
    let bestNet = effectivePrice(bestBook, bestRaw);
    for (const q of valid) {
      const net = effectivePrice(q.book, q.prices[i]!);
      if (net > bestNet) {
        bestNet = net;
        bestRaw = q.prices[i]!;
        bestBook = q.book;
      }
    }
    const fp = consensus[i]!;
    return {
      outcome: name,
      bestBook,
      bestPriceRaw: bestRaw,
      bestPriceNet: bestNet,
      fairProbability: fp,
      fairPrice: 1 / Math.max(1e-12, fp),
      edge: bestNet * fp - 1,
    };
  });

  const bestCombinedOverround = edges.reduce((a, e) => a + 1 / e.bestPriceNet, 0);
  const reliable = valid.length >= minBooks;
  if (!reliable) {
    warnings.push(`solo ${valid.length} book: sotto ${minBooks} il consenso non e affidabile`);
  }

  return {
    outcomes,
    nBooks: valid.length,
    consensusSource,
    consensusOverround,
    bestCombinedOverround,
    executionGain: consensusOverround - bestCombinedOverround,
    edges,
    reliable,
    warnings,
  };
}
