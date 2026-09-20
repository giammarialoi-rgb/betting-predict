/**
 * COSTRUTTORE DI BIGLIETTI — singola, raddoppio, multipla, listone.
 *
 * I quattro prodotti sono la stessa funzione con un parametro diverso: componi
 * un biglietto la cui quota totale cada in un intervallo. Singola = una gamba,
 * raddoppio ≈ 2.00, multipla ≈ 5 o 10, listone = la quota che risulta da
 * "punto X, voglio vincere Y".
 *
 * L'obiettivo è ben definito e vale la pena enunciarlo: FISSATO IL PAYOUT, il
 * biglietto migliore è quello con la probabilità di vincita più alta. Con la
 * vincita fissata, massimizzare il valore atteso e massimizzare p(vincita) sono
 * lo stesso problema. Quindi non c'è un compromesso da arbitrare: c'è un
 * massimo da cercare.
 *
 * Ne discende la misura con cui si scelgono le gambe:
 *
 *     costo = -ln(p) / ln(quota)
 *
 * Vale esattamente 1 su una gamba prezzata equamente (p = 1/quota), sta sotto 1
 * quando il modello la valuta MEGLIO del prezzo, sopra 1 quando la valuta
 * peggio. Costruire il biglietto dalle gambe con costo più basso massimizza la
 * probabilità totale a parità di quota raggiunta. È anche, letteralmente, la
 * misura del vantaggio: un biglietto tutto sotto 1 è a valore atteso positivo.
 *
 * Quello che questo modulo NON fa, deliberatamente: nascondere i numeri. Ogni
 * biglietto porta la sua probabilità di vincita e il suo valore atteso. Un
 * listone a quota 500 si vince una volta ogni 500 e passa, e chi lo gioca deve
 * vederlo scritto.
 */

/** Una selezione già valutata dal motore, con il suo prezzo. */
import { MIN_INFORMATION_SHARE } from "@/domain/eval/predictive-intelligence/models/effective-sample";

export type RatedSelection = {
  /** Evento come lo scrive il book, es. "Fiorentina - Napoli". */
  readonly event: string;
  /** Codice selezione del motore, es. "1", "O2.5", "CORNERS_O9.5". */
  readonly selection: string;
  /** Quota decimale offerta dal book. */
  readonly odds: number;
  /**
   * Probabilità usata per comporre e valutare il biglietto.
   *
   * È la probabilità EQUA DEL MERCATO — il prezzo ripulito dal margine — non
   * quella del modello. Misurato su 5256 osservazioni (stagione 2425, cinque
   * campionati maggiori): dove il modello alza la probabilità rispetto al
   * mercato, l'esito si verifica MENO spesso di quanto dica il mercato; dove la
   * abbassa, si verifica di più. Nella fascia estrema il modello diceva 29.8%,
   * il mercato 16.7%, la realtà 11.6%. Scegliere le gambe dove il modello
   * dissente di più significava selezionare sistematicamente le peggiori.
   */
  readonly probability: number;
  /**
   * Cosa dice il modello, tenuto solo per mostrarlo accanto al prezzo. NON
   * entra nella scelta delle gambe finche' non esiste una misura che dica che
   * aggiunge qualcosa.
   */
  readonly modelProbability?: number | null;
  /** Inizio evento ISO, per l'orizzonte e per la scadenza del codice. */
  readonly kickoff: string;
  /**
   * Quanta parte della stima viene dalla squadra e non dalla media di lega.
   * null quando non è stata calcolata. Sotto la soglia la selezione non entra
   * in nessun biglietto: uno scarto dal mercato su una squadra che il modello
   * non conosce misura la nostra ignoranza, non un vantaggio.
   */
  readonly informationShare?: number | null;
};

export type TicketTarget = {
  /** Quota totale minima accettabile. */
  readonly minOdds: number;
  /** Quota totale massima accettabile. */
  readonly maxOdds: number;
  /** Numero massimo di gambe. */
  readonly maxLegs: number;
  /** Numero minimo di gambe. */
  readonly minLegs?: number;
  /** Orizzonte in giorni dal momento della composizione. */
  readonly horizonDays?: number;
  /**
   * Quota minima di informazione richiesta a ogni gamba. Sotto, la previsione
   * è in prevalenza la media del campionato. Default: metà.
   */
  readonly minInformationShare?: number;
};

export type BuiltTicket = {
  readonly legs: readonly RatedSelection[];
  readonly totalOdds: number;
  /** Probabilità che TUTTE le gambe vincano. */
  readonly probability: number;
  /** Valore atteso per euro puntato: p * quota - 1. */
  readonly edgePerEuro: number;
  /** Probabilità che servirebbe per andare in pari a questa quota. */
  readonly breakEvenProbability: number;
  /** Una vincita ogni quante giocate, in media. */
  readonly oneWinEvery: number;
};

export class TicketBuildError extends Error {
  constructor(
    message: string,
    readonly detail?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "TicketBuildError";
  }
}

/**
 * Quanto margine si paga su questa gamba, per unità di quota.
 *
 *     costo = -ln(p_equa) / ln(quota)
 *
 * Con p_equa presa dal mercato ripulito, vale 1 su un prezzo senza margine e
 * cresce con la tassa incorporata. Scegliere le gambe col costo più basso
 * significa comporre la quota voluta pagando meno tassa possibile — che è
 * l'unica cosa che possiamo davvero ottimizzare, dato che una multipla si
 * gioca su un book solo e il vantaggio del confronto prezzi non si applica.
 *
 * Prima questa funzione confrontava il modello col prezzo e i valori sotto 1
 * venivano letti come vantaggio. Con p equa di mercato NON scende mai sotto 1:
 * un biglietto a valore atteso positivo su un singolo book non esiste, e ora
 * il numero lo dice invece di prometterlo.
 */
export function legCost(selection: RatedSelection): number {
  const { odds, probability } = selection;
  if (!Number.isFinite(odds) || odds <= 1) {
    throw new TicketBuildError(`quota non valida per ${selection.selection}: ${odds}`);
  }
  if (!(probability > 0) || probability >= 1) {
    throw new TicketBuildError(
      `probabilità fuori range per ${selection.selection}: ${probability}`,
    );
  }
  return -Math.log(probability) / Math.log(odds);
}

/**
 * La quota totale da raggiungere partendo da "punto X, voglio vincere Y".
 * La vincita non deve essere precisa: si restituisce un intervallo.
 */
export function targetFromStake(
  stake: number,
  desiredWin: number,
  tolerance = 0.15,
): Pick<TicketTarget, "minOdds" | "maxOdds"> {
  if (!(stake > 0)) throw new TicketBuildError(`importo non valido: ${stake}`);
  if (!(desiredWin > stake)) {
    throw new TicketBuildError(
      `la vincita voluta (${desiredWin}) deve superare l'importo puntato (${stake})`,
    );
  }
  if (!(tolerance > 0 && tolerance < 1)) {
    throw new TicketBuildError(`tolleranza non valida: ${tolerance}`);
  }
  const centro = desiredWin / stake;
  return { minOdds: centro * (1 - tolerance), maxOdds: centro * (1 + tolerance) };
}

/** Solo eventi entro l'orizzonte, e mai due gambe sulla stessa partita. */
function eligible(
  pool: readonly RatedSelection[],
  horizonDays: number | undefined,
  now: Date,
  minInformationShare = MIN_INFORMATION_SHARE,
): readonly RatedSelection[] {
  const limite =
    horizonDays === undefined ? null : now.getTime() + horizonDays * 86_400_000;
  return pool.filter((s) => {
    const t = Date.parse(s.kickoff);
    if (!Number.isFinite(t)) return false;
    if (t <= now.getTime()) return false;
    if (limite !== null && t > limite) return false;
    // Una selezione senza quota di informazione calcolata NON passa: meglio
    // perdere una gamba che infilarne una di cui non sappiamo quanto vale.
    if (s.informationShare == null) return false;
    return s.informationShare >= minInformationShare;
  });
}

function describe(legs: readonly RatedSelection[]): BuiltTicket {
  const totalOdds = legs.reduce((a, l) => a * l.odds, 1);
  const probability = legs.reduce((a, l) => a * l.probability, 1);
  return {
    legs,
    totalOdds,
    probability,
    edgePerEuro: probability * totalOdds - 1,
    breakEvenProbability: 1 / totalOdds,
    oneWinEvery: 1 / probability,
  };
}

/**
 * Compone il biglietto più probabile che raggiunge la quota voluta.
 *
 * Mai due gambe sulla stessa partita: sarebbero correlate, e moltiplicare le
 * loro probabilità darebbe un numero che non significa niente. Chi vuole
 * combinare esiti dello stesso incontro deve prezzarli sulla matrice congiunta,
 * non qui.
 */
export function buildTicket(
  pool: readonly RatedSelection[],
  target: TicketTarget,
  now: Date = new Date(),
): BuiltTicket {
  if (!(target.minOdds > 1)) {
    throw new TicketBuildError(`quota minima non valida: ${target.minOdds}`);
  }
  if (!(target.maxOdds >= target.minOdds)) {
    throw new TicketBuildError(
      `intervallo invertito: ${target.minOdds}..${target.maxOdds}`,
    );
  }
  if (!Number.isInteger(target.maxLegs) || target.maxLegs < 1) {
    throw new TicketBuildError(`numero di gambe non valido: ${target.maxLegs}`);
  }
  const minLegs = target.minLegs ?? 1;

  const candidati = [...eligible(pool, target.horizonDays, now, target.minInformationShare)].sort(
    (a, b) => legCost(a) - legCost(b),
  );
  if (candidati.length === 0) {
    throw new TicketBuildError("nessuna selezione disponibile nell'orizzonte richiesto");
  }

  // Programmazione dinamica a fasce di quota.
  //
  // L'avidità pura si perde biglietti che esistono. Ma anche una ricerca a
  // fascio ordinata per probabilità sbaglia, e sbaglia in modo sistematico:
  // le combinazioni più probabili sono quelle a quota più BASSA, quindi il
  // fascio si riempie di parziali che non arriveranno mai a un obiettivo alto
  // e scarta proprio quelle che servono. Con 12 eventi disponibili e obiettivo
  // 1600-2400 dichiarava impossibile un biglietto raggiungibile.
  //
  // Qui lo spazio delle quote viene diviso in fasce logaritmiche e si tiene la
  // combinazione più probabile PER OGNI FASCIA. Così ogni livello di quota
  // resta rappresentato, e alla fine si legge la migliore tra quelle che
  // cadono nell'intervallo richiesto.
  const FASCE = 600;
  const logMax = Math.log(target.maxOdds);
  const fasciaDi = (logQuota: number): number =>
    Math.min(FASCE - 1, Math.max(0, Math.floor((logQuota / logMax) * FASCE)));

  type Stato = {
    legs: RatedSelection[];
    logQuota: number;
    logP: number;
    usati: Set<string>;
  };

  let livello = new Map<number, Stato>();
  livello.set(0, { legs: [], logQuota: 0, logP: 0, usati: new Set() });
  let migliore: Stato | null = null;

  const considera = (st: Stato): void => {
    if (st.legs.length < minLegs) return;
    const quota = Math.exp(st.logQuota);
    if (quota < target.minOdds || quota > target.maxOdds) return;
    if (migliore === null || st.logP > migliore.logP) migliore = st;
  };

  for (let profondita = 0; profondita < target.maxLegs; profondita += 1) {
    const prossimo = new Map<number, Stato>();
    for (const st of livello.values()) {
      for (const s of candidati) {
        if (st.usati.has(s.event)) continue;
        const logQuota = st.logQuota + Math.log(s.odds);
        if (logQuota > logMax) continue;
        const usati = new Set(st.usati);
        usati.add(s.event);
        const nuovo: Stato = {
          legs: [...st.legs, s],
          logQuota,
          logP: st.logP + Math.log(s.probability),
          usati,
        };
        considera(nuovo);
        const f = fasciaDi(logQuota);
        const attuale = prossimo.get(f);
        if (attuale === undefined || nuovo.logP > attuale.logP) prossimo.set(f, nuovo);
      }
    }
    if (prossimo.size === 0) break;
    livello = prossimo;
  }

  if (migliore === null) {
    const massimaRaggiungibile = candidati
      .slice()
      .sort((x, y) => y.odds - x.odds)
      .filter((s, i, arr) => arr.findIndex((z) => z.event === s.event) === i)
      .slice(0, target.maxLegs)
      .reduce((a, l) => a * l.odds, 1);
    throw new TicketBuildError(
      massimaRaggiungibile < target.minOdds
        ? `quota raggiungibile al massimo ${massimaRaggiungibile.toFixed(2)}, sotto il minimo richiesto ${target.minOdds.toFixed(2)}`
        : `nessuna combinazione cade tra ${target.minOdds.toFixed(2)} e ${target.maxOdds.toFixed(2)} con al più ${target.maxLegs} gambe`,
      {
        disponibili: candidati.length,
        eventi: new Set(candidati.map((c) => c.event)).size,
        massimo_gambe: target.maxLegs,
        gambe_minime: minLegs,
      },
    );
  }

  return describe((migliore as Stato).legs);
}

/**
 * La singola del giorno: la selezione col valore atteso più alto.
 *
 * Qui il criterio NON è il costo per unità di quota. Quella misura serve a
 * scegliere le gambe di un biglietto che deve arrivare a una quota data; con
 * una gamba sola e quota libera minimizzare il costo porterebbe a prendere
 * sempre la quota più bassa disponibile, che non è ciò che si vuole. Con una
 * sola giocata la domanda è semplicemente quale rende di più: p * quota - 1.
 */
export function bestSingle(
  pool: readonly RatedSelection[],
  horizonDays?: number,
  now: Date = new Date(),
): BuiltTicket {
  const candidati = eligible(pool, horizonDays, now);
  if (candidati.length === 0) {
    throw new TicketBuildError("nessuna selezione disponibile nell'orizzonte richiesto");
  }
  // Col prezzo equo di mercato tutte le singole hanno valore atteso negativo:
  // la migliore è quella che paga meno margine, cioè il costo più basso.
  const migliore = candidati.reduce((best, s) => (legCost(s) < legCost(best) ? s : best));
  return describe([migliore]);
}

/** Gli altri prodotti, come parametri dello stesso costruttore. */
export const PRESETS = {
  /** Raddoppio: circa 2.00. */
  raddoppio: (maxLegs = 4): TicketTarget => ({
    minOdds: 1.9,
    maxOdds: 2.2,
    maxLegs,
    minLegs: 2,
  }),
  /** Multipla a quota 5 o 10. */
  multipla: (quota: 5 | 10, maxLegs = 8): TicketTarget => ({
    minOdds: quota * 0.85,
    maxOdds: quota * 1.15,
    maxLegs,
    minLegs: 2,
  }),
} as const;
