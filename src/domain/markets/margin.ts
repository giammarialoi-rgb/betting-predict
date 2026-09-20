/**
 * MARGIN — quanto costa entrare in un mercato, prima di chiedersi se lo si batte.
 *
 * L'overround è la somma delle probabilità implicite meno 1. È la tassa che il
 * modello deve superare PRIMA di produrre un euro. Un vantaggio di modello
 * misurato contro prezzi al 5% non sopravvive automaticamente a prezzi al 12%:
 * è lo stesso segnale contro una tassa doppia.
 *
 * La trappola che questo modulo rende impossibile:
 *   sommare le implicite di un mercato di cui NON si hanno tutti gli esiti.
 * Un blocco con esiti mancanti (o quote non quotate) produce una somma < 1, che
 * letta come margine diventa un'arbitraggio inesistente. Qui quel caso è un
 * errore esplicito, non un numero negativo da interpretare.
 */

/**
 * Quanto la somma delle implicite può stare sotto 1 restando un mercato reale.
 *
 * Un mercato equo somma esattamente 1; un arbitraggio genuino scende di qualche
 * punto percentuale. Un blocco con esiti MANCANTI crolla molto più in basso —
 * "SQUADRA CON PIÙ ANGOLI" quota solo 1 e 2 e somma 0.43. La soglia separa i
 * due casi: sopra è un margine (eventualmente negativo, ed è un'informazione
 * vera), sotto sono esiti che non abbiamo letto.
 */
const MIN_CREDIBLE_IMPLIED_SUM = 0.98;

/**
 * Quante volte gli esiti elencati coprono lo spazio degli eventi.
 *
 * 1X2 è una partizione: copertura 1, le implicite sommano a 1 + margine.
 * DOPPIA CHANCE no: 1X, 12 e X2 coprono OGNI risultato due volte, quindi le
 * implicite sommano a 2 + margine. Letta con copertura 1, una doppia chance
 * perfettamente equa risulterebbe al 100% di margine. È l'errore che questo
 * parametro rende impossibile commettere in silenzio.
 */
export type Coverage = number;

export type MarginVerdict =
  | { kind: "ok"; overround: number; impliedSum: number; outcomes: number }
  | { kind: "incomplete"; impliedSum: number; outcomes: number; shortfall: number };

/** Probabilità implicita grezza di una quota decimale. */
export function impliedProbability(decimalOdds: number): number {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) {
    throw new Error(`quota decimale non valida: ${decimalOdds}`);
  }
  return 1 / decimalOdds;
}

/**
 * Margine di un mercato a n esiti.
 *
 * `odds` deve contenere TUTTI gli esiti mutuamente esclusivi ed esaustivi del
 * mercato. Se la somma delle implicite è <= 1 il mercato non è esaustivo — per
 * esempio un blocco "Si" senza il "No", o una riga con quote non disponibili —
 * e la funzione lo dichiara invece di restituire un margine negativo.
 */
export function marketMargin(odds: readonly number[], coverage: Coverage = 1): MarginVerdict {
  if (odds.length < 2) {
    throw new Error(`un mercato ha almeno 2 esiti, ricevuti ${odds.length}`);
  }
  if (!Number.isFinite(coverage) || coverage < 1) {
    throw new Error(`copertura non valida: ${coverage}`);
  }
  if (odds.length < coverage + 1) {
    throw new Error(
      `copertura ${coverage} impossibile con ${odds.length} esiti`,
    );
  }
  const impliedSum = odds.reduce((acc, o) => acc + impliedProbability(o), 0);
  if (impliedSum < MIN_CREDIBLE_IMPLIED_SUM * coverage) {
    return {
      kind: "incomplete",
      impliedSum,
      outcomes: odds.length,
      shortfall: coverage - impliedSum,
    };
  }
  return {
    kind: "ok",
    overround: impliedSum - coverage,
    impliedSum,
    outcomes: odds.length,
  };
}

/** Il margine, o un errore se il mercato non è esaustivo. Per i casi in cui il chiamante non può proseguire senza. */
export function requireMargin(
  odds: readonly number[],
  label = "mercato",
  coverage: Coverage = 1,
): number {
  const v = marketMargin(odds, coverage);
  if (v.kind === "incomplete") {
    throw new Error(
      `${label}: somma implicite ${v.impliedSum.toFixed(4)} sotto ${MIN_CREDIBLE_IMPLIED_SUM} — esiti mancanti, non un margine`,
    );
  }
  return v.overround;
}

/**
 * Margine per esito.
 *
 * Misurato sulla board angoli reale di Planetwin365, questo numero è quasi
 * COSTANTE (~4.6%) tra mercati a 2, 3 e 5 esiti della stessa partita: le bande
 * TOTALE ANGOLI non sono prezzate peggio, hanno solo più esiti su cui spalmare
 * la stessa tassa unitaria. Quindi l'overround totale NON dice quanto è caro un
 * mercato — dice quanti esiti ha. Per confrontare mercati serve questo.
 */
export function marginPerOutcome(
  odds: readonly number[],
  label = "mercato",
  coverage: Coverage = 1,
): number {
  return requireMargin(odds, label, coverage) / odds.length;
}
