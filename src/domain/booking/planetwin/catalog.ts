/**
 * CATALOGO PLANETWIN365 — dove sta, sulla pagina evento, una selezione del motore.
 *
 * Le etichette qui sotto non sono indovinate: sono lette dalla board reale di
 * Fiorentina - Napoli il 20/09/2026. Ogni voce dice tre cose: quale scheda
 * aprire, quale blocco cercare, quale cella cliccare.
 *
 * La regola che conta: una selezione NON mappata è un errore, mai un tentativo.
 * Il motivo per cui questa sezione esiste è togliere l'errore umano dalla
 * composizione di un listone; un catalogo che tira a indovinare lo reintrodurrebbe
 * peggiorato, perché sbaglierebbe in silenzio e sempre allo stesso modo.
 */
import { BookingError } from "@/domain/booking/types";

/** Le schede di mercato sulla pagina evento. */
export type MarketTab = "Principali" | "U/O" | "Angoli";

export type CatalogEntry = {
  readonly tab: MarketTab;
  /** Titolo esatto del blocco mercato, come appare sulla board. */
  readonly block: string;
  /** Etichetta della cella da cliccare dentro il blocco. */
  readonly outcome: string;
  /**
   * Riga di linea dentro il blocco, per i mercati che ne hanno più di una
   * (U/O 2.5, U/O ANGOLI 9.5). Assente per i blocchi a riga unica.
   */
  readonly line?: string;
  /** Quante volte gli esiti del blocco coprono lo spazio: 2 per la doppia chance. */
  readonly coverage: number;
  /**
   * Il palinsesto mostra gia' questo mercato: si può cliccare dalla lista,
   * senza aprire la pagina della partita. Vale per 1X2 e U/O 2.5, che sono le
   * colonne della griglia.
   */
  readonly onGrid?: boolean;
};

const RE_GOALS_OU = /^([OU])(\d+\.5)$/;
const RE_CORNERS_OU = /^CORNERS_([OU])(\d+\.5)$/;

/** Mercati a riga unica, mappati uno a uno. */
const FIXED: Readonly<Record<string, CatalogEntry>> = {
  "1": { tab: "Principali", block: "1X2", outcome: "1", coverage: 1, onGrid: true },
  X: { tab: "Principali", block: "1X2", outcome: "X", coverage: 1, onGrid: true },
  "2": { tab: "Principali", block: "1X2", outcome: "2", coverage: 1, onGrid: true },

  "1X": { tab: "Principali", block: "DC", outcome: "1X", coverage: 2 },
  "12": { tab: "Principali", block: "DC", outcome: "12", coverage: 2 },
  X2: { tab: "Principali", block: "DC", outcome: "X2", coverage: 2 },

  GG: { tab: "Principali", block: "GG/NG", outcome: "GG", coverage: 1 },
  NG: { tab: "Principali", block: "GG/NG", outcome: "NG", coverage: 1 },

  CORNERS_1: { tab: "Angoli", block: "ANGOLI 1X2", outcome: "1", coverage: 1 },
  CORNERS_X: { tab: "Angoli", block: "ANGOLI 1X2", outcome: "X", coverage: 1 },
  CORNERS_2: { tab: "Angoli", block: "ANGOLI 1X2", outcome: "2", coverage: 1 },

  CORNERS_ODD: { tab: "Angoli", block: "P/D ANGOLI", outcome: "Disp.", coverage: 1 },
  CORNERS_EVEN: { tab: "Angoli", block: "P/D ANGOLI", outcome: "Pari", coverage: 1 },
};

/** Linee gol effettivamente quotate nel blocco U/O. */
const GOAL_LINES = new Set(["0.5", "1.5", "2.5", "3.5", "4.5", "5.5", "6.5"]);
/** Linee angoli effettivamente quotate nel blocco U/O ANGOLI. */
const CORNER_LINES = new Set(["7.5", "8.5", "9.5", "10.5", "11.5", "12.5"]);

/**
 * Dove cliccare per una selezione del motore.
 * Solleva se la selezione non è mappata o se la linea non è quotata dal book.
 */
export function locateSelection(code: string): CatalogEntry {
  const c = code.trim().toUpperCase();

  const fixed = FIXED[c];
  if (fixed) return fixed;

  const corners = RE_CORNERS_OU.exec(c);
  if (corners) {
    const side = corners[1];
    const line = corners[2];
    if (side === undefined || line === undefined) {
      throw new BookingError(`selezione angoli malformata: ${code}`);
    }
    if (!CORNER_LINES.has(line)) {
      throw new BookingError(
        `linea angoli ${line} non quotata da Planetwin365`,
        { code, quotate: [...CORNER_LINES] },
      );
    }
    return {
      tab: "Angoli",
      block: "U/O ANGOLI",
      outcome: side === "O" ? "O" : "U",
      line,
      coverage: 1,
    };
  }

  const goals = RE_GOALS_OU.exec(c);
  if (goals) {
    const side = goals[1];
    const line = goals[2];
    if (side === undefined || line === undefined) {
      throw new BookingError(`selezione gol malformata: ${code}`);
    }
    if (!GOAL_LINES.has(line)) {
      throw new BookingError(`linea gol ${line} non quotata da Planetwin365`, {
        code,
        quotate: [...GOAL_LINES],
      });
    }
    return {
      tab: "U/O",
      block: "U/O",
      outcome: side === "O" ? "O" : "U",
      line,
      coverage: 1,
    };
  }

  throw new BookingError(
    `selezione "${code}" non mappata sul catalogo Planetwin365 — mappala prima di prenotarla`,
    { supportate: [...Object.keys(FIXED), "O<linea>/U<linea>", "CORNERS_O<linea>/CORNERS_U<linea>"] },
  );
}

/** Se il catalogo sa dove cliccare. Non solleva. */
export function isBookable(code: string): boolean {
  try {
    locateSelection(code);
    return true;
  } catch {
    return false;
  }
}
