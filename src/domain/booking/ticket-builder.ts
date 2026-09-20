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
  /** Probabilità che il modello assegna all'esito. */
  readonly probability: number;
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

/** Il costo in probabilità di ogni unità di quota. Sotto 1 = vantaggio. */
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

  // Ricerca a fascio, non avidità pura.
  //
  // Prendere sempre la gamba col costo più basso sembra ragionevole e non lo è:
  // con quote [1.45, 1.42, 1.30] e obiettivo 1.90-2.20 il raddoppio ESISTE
  // (1.45 x 1.42 = 2.06), ma l'avidità parte da 1.30, arriva a 1.85 e si blocca
  // perche' ogni aggiunta sfonda il tetto. Dichiarare impossibile un biglietto
  // che si può comporre è un guasto, non una prudenza.
  //
  // Il fascio tiene le migliori combinazioni parziali invece di una sola strada.
  const LARGHEZZA = 250;
  type Stato = { legs: RatedSelection[]; quota: number; logP: number; usati: Set<string> };

  let fascio: Stato[] = [{ legs: [], quota: 1, logP: 0, usati: new Set() }];
  let migliore: Stato | null = null;

  const consideraCompleto = (st: Stato): void => {
    if (st.legs.length < minLegs) return;
    if (st.quota < target.minOdds || st.quota > target.maxOdds) return;
    if (migliore === null || st.logP > migliore.logP) migliore = st;
  };

  for (let profondita = 0; profondita < target.maxLegs; profondita += 1) {
    const prossimo: Stato[] = [];
    for (const st of fascio) {
      for (const s of candidati) {
        if (st.usati.has(s.event)) continue;
        const quota = st.quota * s.odds;
        if (quota > target.maxOdds) continue;
        const usati = new Set(st.usati);
        usati.add(s.event);
        const nuovo: Stato = {
          legs: [...st.legs, s],
          quota,
          logP: st.logP + Math.log(s.probability),
          usati,
        };
        consideraCompleto(nuovo);
        prossimo.push(nuovo);
      }
    }
    if (prossimo.length === 0) break;
    // Si tengono le parziali con la probabilità più alta a parità di profondità.
    prossimo.sort((x, y) => y.logP - x.logP);
    fascio = prossimo.slice(0, LARGHEZZA);
  }

  if (migliore === null) {
    const massimaRaggiungibile = candidati
      .slice()
      .sort((x, y) => y.odds - x.odds)
      .slice(0, target.maxLegs)
      .reduce((a, l) => a * l.odds, 1);
    throw new TicketBuildError(
      massimaRaggiungibile < target.minOdds
        ? `quota raggiungibile al massimo ${massimaRaggiungibile.toFixed(2)}, sotto il minimo richiesto ${target.minOdds.toFixed(2)}`
        : `nessuna combinazione cade tra ${target.minOdds.toFixed(2)} e ${target.maxOdds.toFixed(2)} con al più ${target.maxLegs} gambe`,
      {
        disponibili: candidati.length,
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
  const migliore = candidati.reduce((best, s) =>
    s.probability * s.odds > best.probability * best.odds ? s : best,
  );
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
