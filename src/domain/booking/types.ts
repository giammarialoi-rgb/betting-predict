/**
 * BOOKING — dal biglietto che il motore propone al codice che il book emette.
 *
 * Il codice di prenotazione non è calcolabile: lo emette il bookmaker. Quindi
 * questo dominio non lo genera, lo VA A PRENDERE, e il suo lavoro vero è fare
 * in modo che la schedina prenotata sia esattamente quella decisa — non una
 * riga sotto, non la quota di dieci minuti fa.
 *
 * In Italia la prenotazione è valida solo alla cassa di un'agenzia: il codice
 * non si ricarica sul conto online. Verificato il 20/09/2026 su Sisal e
 * Planetwin365, entrambi senza login.
 */

/** Una gamba come la decide il motore, prima di toccare il book. */
export type TicketLeg = {
  /** Squadre come le scrive il book, es. "Fiorentina - Napoli". */
  readonly event: string;
  /** Codice selezione del motore, es. "1", "O2.5", "CORNERS_O9.5". */
  readonly selection: string;
  /** La quota su cui il motore ha calcolato il valore. */
  readonly expectedOdds: number;
  /**
   * Inizio evento ISO, quando noto. Serve a rifiutare subito una gamba gia'
   * iniziata: una partita in corso esce dal palinsesto prepartita, e senza
   * questo il driver la cercherebbe invano dando un errore che parla d'altro.
   */
  readonly kickoff?: string;
};

/** Una gamba come risulta dopo essere finita nella schedina del book. */
export type PlacedLeg = TicketLeg & {
  /** La quota effettivamente presa. */
  readonly takenOdds: number;
  /** Scostamento relativo rispetto a expectedOdds. */
  readonly drift: number;
};

export type BookedTicket = {
  readonly bookmaker: string;
  /** Il codice emesso dal book, normalizzato senza spazi. */
  readonly code: string;
  readonly bookedAt: string;
  /** Testo della scadenza come lo mostra il book. */
  readonly expiry: string;
  readonly legs: readonly PlacedLeg[];
  readonly totalOdds: number;
  readonly bonus: number;
};

/**
 * Quanto una quota può muoversi tra la decisione e la prenotazione prima che il
 * biglietto non sia più quello deciso. Un 2% su una gamba è rumore; su dieci
 * gambe composte è un quinto del valore.
 */
export const DEFAULT_ODDS_TOLERANCE = 0.02;

export class BookingError extends Error {
  constructor(
    message: string,
    readonly detail?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

/** Scostamento relativo di una quota presa rispetto a quella attesa. */
export function oddsDrift(expected: number, taken: number): number {
  if (!Number.isFinite(expected) || expected <= 1) {
    throw new BookingError(`quota attesa non valida: ${expected}`);
  }
  if (!Number.isFinite(taken) || taken <= 1) {
    throw new BookingError(`quota presa non valida: ${taken}`);
  }
  return (taken - expected) / expected;
}

/**
 * Una quota che PEGGIORA oltre la tolleranza invalida il biglietto.
 * Una che migliora non lo invalida mai: il valore sale.
 */
export function driftIsAcceptable(drift: number, tolerance = DEFAULT_ODDS_TOLERANCE): boolean {
  return drift >= -tolerance;
}
